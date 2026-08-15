package service

import (
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service/billing"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 聊天附件相关错误语义。handler 据此返回合适的 HTTP 状态码。
var (
	// ErrAttachmentNotFound 附件不存在或无权访问（404）。
	ErrAttachmentNotFound = errors.New("attachment not found")
	// ErrStorageQuotaExceeded 存储空间不足（413 / 402）。
	ErrStorageQuotaExceeded = errors.New("storage quota exceeded")
	// ErrAttachmentKindInvalid 上传类型无效（400）。
	ErrAttachmentKindInvalid = errors.New("invalid attachment kind")
)

// ChatAttachmentService 负责聊天附件的预签名、配额、finalize（HEAD 校验 + 生成摘要）与消息绑定。
//
// 设计要点：
//   - 复用 ObjectStore 的 presign → 浏览器直传 OSS → finalize(HEAD) 流程。
//   - 免费用户 100MB 存储上限（billing.FreeStorageBytes），付费不限。
//   - 文档摘要用启发式（首个标题 + 前 ~200 字），无额外 LLM 调用。
type ChatAttachmentService struct {
	db     *gorm.DB
	assets *ObjectStore
	subSvc *SubscriptionService
}

func NewChatAttachmentService(db *gorm.DB, assets *ObjectStore, subSvc *SubscriptionService) *ChatAttachmentService {
	return &ChatAttachmentService{db: db, assets: assets, subSvc: subSvc}
}

// PresignChatFileInput 是 presign 请求参数。
type PresignChatFileInput struct {
	Kind        string // "image" | "document"
	ContentType string
	FileName    string
	FileSize    int64
}

// PresignChatFile 为聊天附件预签名一个上传 URL，并预检配额。
func (s *ChatAttachmentService) PresignChatFile(userID string, in PresignChatFileInput) (*PresignResult, error) {
	if s == nil || s.assets == nil || !s.assets.Enabled() {
		return nil, errors.New("对象存储未配置")
	}
	ossKind, err := ossKindForChatKind(in.Kind)
	if err != nil {
		return nil, err
	}
	// 配额预检（付费用户跳过）。
	if err := s.CheckQuota(userID, in.FileSize); err != nil {
		return nil, err
	}
	return s.assets.PresignPut("users", userID, ossKind, in.ContentType)
}

// FinalizeInput 是 finalize 请求参数。
type FinalizeInput struct {
	Kind     string // "image" | "document"
	Key      string
	FileName string
}

// FinalizeChatFile 校验已上传对象（HEAD）并落库 ChatAttachment，返回含摘要的视图。
func (s *ChatAttachmentService) FinalizeChatFile(userID string, in FinalizeInput) (*model.ChatAttachment, error) {
	if s == nil || s.assets == nil || !s.assets.Enabled() {
		return nil, errors.New("对象存储未配置")
	}
	ossKind, err := ossKindForChatKind(in.Kind)
	if err != nil {
		return nil, err
	}
	// HEAD 校验：归属前缀 + 存在性 + 大小/类型（按 kind 差异化上限）。
	if err := s.assets.ValidateUploadedObjectWithKind(in.Key, "users", userID, ossKind); err != nil {
		return nil, err
	}

	info, err := s.assets.HeadObjectInfo(in.Key)
	if err != nil {
		return nil, err
	}

	att := &model.ChatAttachment{
		UserID:      userID,
		Kind:        in.Kind,
		FileName:    truncate(in.FileName, 255),
		ContentType: normalizeDocContentType(in.Kind, info.ContentType),
		Size:        info.ContentLength,
		ObjectKey:   in.Key,
		URL:         s.assets.publicURL(in.Key),
	}
	// 摘要：文档用启发式（需读全文）；图片留简短占位（理解交给发送时的 vision）。
	if in.Kind == model.AttachmentKindDocument {
		raw, rerr := s.readObject(in.Key, MaxChatDocBytes)
		if rerr != nil {
			return nil, fmt.Errorf("读取文档失败: %w", rerr)
		}
		att.Summary = summarizeMarkdown(raw)
	} else {
		att.Summary = "用户上传的图片"
	}

	// 配额校验 + 插入在同一事务内，并对 user 行加 FOR UPDATE 行锁，
	// 串行化同一用户的并发上传，避免 TOCTOU 超额（#2）。
	if err := s.checkQuotaAndInsert(att); err != nil {
		// 超额或失败：删除已上传的对象，避免存储泄漏。
		_ = s.deleteObject(in.Key)
		return nil, err
	}
	return att, nil
}

// checkQuotaAndInsert 在一个事务内完成「锁定 user → 校验配额 → 插入附件」，
// 保证同一用户的并发上传串行执行，杜绝配额竞态。
func (s *ChatAttachmentService) checkQuotaAndInsert(att *model.ChatAttachment) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 锁定 user 行（SELECT ... FOR UPDATE），串行化并发上传。
		var user model.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Select("id").First(&user, "id = ?", att.UserID).Error; err != nil {
			return err
		}
		// 付费用户跳过配额。
		if s.subSvc != nil && s.subSvc.IsPro(att.UserID) {
			return tx.Create(att).Error
		}
		if att.Size > 0 {
			var used int64
			if err := tx.Model(&model.ChatAttachment{}).
				Where("user_id = ?", att.UserID).
				Select("COALESCE(SUM(size), 0)").Scan(&used).Error; err != nil {
				return fmt.Errorf("查询存储用量失败: %w", err)
			}
			if used+att.Size > billing.FreeStorageBytes {
				return ErrStorageQuotaExceeded
			}
		}
		return tx.Create(att).Error
	})
}

// ReadFullContent 读取附件全文（用于聊天文档注入对话上下文）。
func (s *ChatAttachmentService) ReadFullContent(key string) (string, error) {
	raw, err := s.readObject(key, MaxChatDocBytes)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

// GetByID 取附件（含归属校验）。
func (s *ChatAttachmentService) GetByID(id, userID string) (*model.ChatAttachment, error) {
	var att model.ChatAttachment
	if err := s.db.Where("id = ? AND user_id = ?", id, userID).First(&att).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAttachmentNotFound
		}
		return nil, err
	}
	return &att, nil
}

// BindToMessage 把附件绑定到某条消息（发送消息时调用），并返回附件视图。
func (s *ChatAttachmentService) BindToMessage(id, userID, sessionID, messageID string) (*model.ChatAttachment, error) {
	att, err := s.GetByID(id, userID)
	if err != nil {
		return nil, err
	}
	if err := s.db.Model(&model.ChatAttachment{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(map[string]any{
			"session_id": sessionID,
			"message_id": messageID,
		}).Error; err != nil {
		return nil, err
	}
	att.SessionID = sessionID
	att.MessageID = messageID
	return att, nil
}

// AttachmentMetaForMessage 把附件转成消息列表里暴露的轻量信息。
func AttachmentMetaForMessage(att *model.ChatAttachment) *messageAttachment {
	return &messageAttachment{
		ID:        att.ID,
		Kind:      att.Kind,
		FileName:  att.FileName,
		Summary:   att.Summary,
		URL:       att.URL,
		ObjectKey: att.ObjectKey,
		Size:      att.Size,
	}
}

// CheckQuota 校验免费用户存储空间是否足够。付费用户不限。
func (s *ChatAttachmentService) CheckQuota(userID string, addBytes int64) error {
	if s == nil || s.subSvc == nil {
		return nil
	}
	if s.subSvc.IsPro(userID) {
		return nil
	}
	if addBytes <= 0 {
		return nil
	}
	var used int64
	if err := s.db.Model(&model.ChatAttachment{}).
		Where("user_id = ?", userID).
		Select("COALESCE(SUM(size), 0)").Scan(&used).Error; err != nil {
		return fmt.Errorf("查询存储用量失败: %w", err)
	}
	if used+addBytes > billing.FreeStorageBytes {
		return ErrStorageQuotaExceeded
	}
	return nil
}

// StorageUsage 返回用户已用存储字节与上限（付费用户 limit=-1 表示不限）。
func (s *ChatAttachmentService) StorageUsage(userID string) (used, limit int64, err error) {
	limit = -1
	if s.subSvc != nil && s.subSvc.IsPro(userID) {
		// 付费不限，但仍返回已用值。
	} else {
		limit = billing.FreeStorageBytes
	}
	err = s.db.Model(&model.ChatAttachment{}).
		Where("user_id = ?", userID).
		Select("COALESCE(SUM(size), 0)").Scan(&used).Error
	return
}

// DeleteBySession 删除某会话下所有附件的 OSS 对象并清理 DB 行（删会话时级联调用）。
// OSS 删除失败不阻塞 DB 清理（对象最终由孤儿清理兜底）。
func (s *ChatAttachmentService) DeleteBySession(sessionID string) error {
	if s == nil {
		return nil
	}
	var atts []model.ChatAttachment
	if err := s.db.Select("object_key").Where("session_id = ?", sessionID).Find(&atts).Error; err != nil {
		return err
	}
	for _, a := range atts {
		_ = s.deleteObject(a.ObjectKey)
	}
	return s.db.Where("session_id = ?", sessionID).Delete(&model.ChatAttachment{}).Error
}

// CleanupOrphans 清理「已上传但从未绑定到消息」的孤儿附件：
// 删除其 OSS 对象与 DB 行，回收配额。olderThan 控制保留窗口（避免删掉正在发送中的附件）。
// 返回清理掉的附件数。
func (s *ChatAttachmentService) CleanupOrphans(olderThan time.Duration) (int64, error) {
	if s == nil {
		return 0, nil
	}
	cutoff := time.Now().Add(-olderThan)
	var atts []model.ChatAttachment
	// message_id 为空 且 创建时间早于 cutoff 的视为孤儿。
	if err := s.db.Select("id, object_key").
		Where("message_id = ? AND created_at < ?", "", cutoff).
		Find(&atts).Error; err != nil {
		return 0, err
	}
	for _, a := range atts {
		_ = s.deleteObject(a.ObjectKey)
	}
	if len(atts) == 0 {
		return 0, nil
	}
	ids := make([]string, 0, len(atts))
	for _, a := range atts {
		ids = append(ids, a.ID)
	}
	return s.db.Where("id IN ?", ids).Delete(&model.ChatAttachment{}).RowsAffected, nil
}

// --- 内部 helper ---

// ossKindForChatKind 把对外 kind(image|document) 映射到 OSS key 路径段(chat_image|chat_doc)。
func ossKindForChatKind(kind string) (string, error) {
	switch kind {
	case model.AttachmentKindImage:
		return kindChatImage, nil
	case model.AttachmentKindDocument:
		return kindChatDoc, nil
	}
	return "", ErrAttachmentKindInvalid
}

func (s *ChatAttachmentService) readObject(key string, limit int64) ([]byte, error) {
	rc, err := s.assets.GetObject(key)
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(io.LimitReader(rc, limit))
}

func (s *ChatAttachmentService) deleteObject(key string) error {
	return s.assets.deleteObjectQuiet(key)
}

var mdHeadingRe = regexp.MustCompile(`(?m)^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$`)

// summarizeMarkdown 生成 markdown 文档的启发式摘要：
// 取首个标题；取正文前 ~200 字（剥掉常见 markdown 语法符号）；末尾附全文统计。
func summarizeMarkdown(raw []byte) string {
	text := strings.TrimSpace(string(raw))
	if text == "" {
		return "（空文档）"
	}

	// 1. 首个标题。
	var title string
	if m := mdHeadingRe.FindStringSubmatch(text); m != nil {
		title = strings.TrimSpace(m[1])
	}

	// 2. 正文片段：剥掉 markdown 语法，取前 200 个 rune。
	body := stripMarkdownSyntax(text)
	runes := []rune(body)
	if len(runes) > 200 {
		runes = runes[:200]
	}
	snippet := strings.TrimSpace(string(runes))

	// 3. 统计。
	runeCount := len([]rune(text))
	stat := fmt.Sprintf("（全文 %d 字，%.1fKB）", runeCount, float64(len(raw))/1024)

	parts := make([]string, 0, 3)
	if title != "" {
		parts = append(parts, "《"+title+"》")
	}
	if snippet != "" {
		parts = append(parts, snippet+"…")
	}
	parts = append(parts, stat)
	return strings.Join(parts, " ")
}

// stripMarkdownSyntax 去除常见 markdown 语法符号，仅保留可读文字。
func stripMarkdownSyntax(s string) string {
	// 去代码块/行内代码（保留内容）、图片、链接（保留文字）、列表符号、强调符号。
	replacements := []struct{ re *regexp.Regexp; repl string }{
		{regexp.MustCompile("(?s)```.*?```"), ""},      // 围栏代码块
		{regexp.MustCompile("!\\[[^\\]]*\\]\\([^)]*\\)"), ""}, // 图片
		{regexp.MustCompile("\\[([^\\]]+)\\]\\([^)]*\\)"), "$1"}, // 链接 -> 文字
		{regexp.MustCompile("`([^`]+)`"), "$1"},        // 行内代码
		{regexp.MustCompile("(?m)^\\s{0,3}[-*+]\\s+"), ""}, // 无序列表符号
		{regexp.MustCompile("(?m)^\\s{0,3}\\d+\\.\\s+"), ""}, // 有序列表符号
		{regexp.MustCompile("(?m)^\\s{0,3}#{1,6}\\s+"), ""}, // 标题符号
		{regexp.MustCompile("[*_~`>#]+"), ""},           // 残留强调/引用符号
	}
	out := s
	for _, r := range replacements {
		out = r.re.ReplaceAllString(out, r.repl)
	}
	// 合并空白。
	out = strings.Join(strings.Fields(out), " ")
	return out
}

// normalizeDocContentType 规范化 content-type：文档若被浏览器误传为 text/plain / octet-stream，统一回 text/markdown。
func normalizeDocContentType(kind, ct string) string {
	if kind == model.AttachmentKindDocument {
		if ct == "" || ct == "text/plain" || ct == "application/octet-stream" {
			return "text/markdown"
		}
	}
	return ct
}
