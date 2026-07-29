package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss"
	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss/credentials"
	"github.com/google/uuid"
	"github.com/wanye/ideaevo/internal/config"
)

var allowedContentTypes = map[string]string{
	"image/jpeg":    ".jpg",
	"image/png":     ".png",
	"image/webp":    ".webp",
	"video/mp4":     ".mp4",
	"text/markdown": ".md", // 聊天文档附件
}

const (
	MaxImageBytes int64 = 5 * 1024 * 1024  // 图片上限 5MB（头像/背景/想法）
	MaxVideoBytes int64 = 50 * 1024 * 1024 // 视频上限 50MB
	// 聊天附件的差异化上限：图片更紧（4MB）、文档很小（10KB）。
	MaxChatImageBytes int64 = 4 * 1024 * 1024 // 聊天图片上限 4MB
	MaxChatDocBytes   int64 = 10 * 1024       // 聊天 Markdown 文档上限 10KB
)

// MaxAssetBytes 是旧符号的别名,保持向后兼容(= 图片上限)。
const MaxAssetBytes int64 = MaxImageBytes

// 聊天附件上传的 kind 常量（对应 OSS key 路径段）。
const (
	kindChatImage = "chat_image"
	kindChatDoc   = "chat_doc"
)

// isVideoContentType 判断 content type 是否为视频。
func isVideoContentType(ct string) bool {
	return strings.HasPrefix(ct, "video/")
}

// isChatAttachmentKind 判断 kind 是否为聊天附件。
func isChatAttachmentKind(kind string) bool {
	return kind == kindChatImage || kind == kindChatDoc
}

// maxBytesFor 按内容类型返回大小上限(图片 5MB / 视频 50MB / markdown 不在此处理)。
func maxBytesFor(contentType string) int64 {
	if isVideoContentType(contentType) {
		return MaxVideoBytes
	}
	return MaxImageBytes
}

// maxBytesForKind 按上传 kind 返回大小上限。聊天附件走差异化限制。
func maxBytesForKind(kind string) (int64, bool) {
	switch kind {
	case kindChatImage:
		return MaxChatImageBytes, true
	case kindChatDoc:
		return MaxChatDocBytes, true
	}
	return 0, false
}

type ObjectStore struct {
	client    *oss.Client
	bucket    string
	region    string
	cdnDomain string
	enabled   bool
}

func NewObjectStore(cfg *config.Config) (*ObjectStore, error) {
	if cfg.AliyunAccessKeyID == "" || cfg.AliyunAssetsBucket == "" {
		return &ObjectStore{enabled: false}, nil
	}

	ossCfg := oss.LoadDefaultConfig().
		WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.AliyunAccessKeyID,
			cfg.AliyunAccessKeySecret,
		)).
		WithRegion(cfg.AliyunAssetsRegion)

	client := oss.NewClient(ossCfg)
	return &ObjectStore{
		client:    client,
		bucket:    cfg.AliyunAssetsBucket,
		region:    cfg.AliyunAssetsRegion,
		cdnDomain: strings.TrimSuffix(cfg.AliyunAssetsCDNDomain, "/"),
		enabled:   true,
	}, nil
}

type PresignResult struct {
	UploadURL  string `json:"upload_url"`
	PublicURL  string `json:"public_url"`
	Key        string `json:"key"`
	ExpiresIn  int    `json:"expires_in"`
}

func (s *ObjectStore) Enabled() bool {
	return s != nil && s.enabled
}

// PresignPut 为指定主体预签名一个上传 URL。
// scope 为 "users"、"agents" 或 "ideas"；id 为对应的 user_id / agent_id / idea_id。
func (s *ObjectStore) PresignPut(scope, id, kind, contentType string) (*PresignResult, error) {
	if !s.Enabled() {
		return nil, errors.New("对象存储未配置")
	}
	if scope != "users" && scope != "agents" && scope != "ideas" {
		return nil, errors.New("上传范围无效")
	}
	if kind != "avatar" && kind != "background" && kind != "icon" && kind != "content" && kind != "cover" && kind != "video" && !isChatAttachmentKind(kind) {
		return nil, errors.New("上传类型无效")
	}
	if scope == "ideas" && kind != "icon" && kind != "content" && kind != "cover" && kind != "video" {
		return nil, errors.New("想法仅支持 icon / content / cover / video 上传")
	}
	if (scope == "users" || scope == "agents") && (kind == "icon" || kind == "content") {
		return nil, errors.New("上传类型无效")
	}
	// 聊天附件仅允许 user 维度上传。
	if isChatAttachmentKind(kind) && scope != "users" {
		return nil, errors.New("聊天附件仅支持用户空间上传")
	}
	ext, ok := allowedContentTypes[contentType]
	if !ok {
		return nil, errors.New("不支持的文件类型")
	}

	key := fmt.Sprintf("%s/%s/%s/%s%s", scope, id, kind, uuid.New().String(), ext)
	req := &oss.PutObjectRequest{
		Bucket:      oss.Ptr(s.bucket),
		Key:         oss.Ptr(key),
		ContentType: oss.Ptr(contentType),
	}

	result, err := s.client.Presign(context.Background(), req, oss.PresignExpires(15*time.Minute))
	if err != nil {
		return nil, err
	}

	publicURL := s.publicURL(key)
	return &PresignResult{
		UploadURL: result.URL,
		PublicURL: publicURL,
		Key:       key,
		ExpiresIn: 900,
	}, nil
}

func (s *ObjectStore) publicURL(key string) string {
	if s.cdnDomain != "" {
		return s.cdnDomain + "/" + key
	}
	return fmt.Sprintf("https://%s.%s.aliyuncs.com/%s", s.bucket, s.region, key)
}

func (s *ObjectStore) IsAllowedURL(raw string) bool {
	if !s.Enabled() {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	// 允许 users/、agents/ 与 ideas/ 三种前缀。
	pathOK := strings.HasPrefix(u.Path, "/users/") ||
		strings.HasPrefix(u.Path, "/agents/") ||
		strings.HasPrefix(u.Path, "/ideas/")
	if s.cdnDomain != "" {
		cdn, _ := url.Parse(s.cdnDomain)
		if cdn != nil && strings.EqualFold(u.Host, cdn.Host) {
			return pathOK
		}
	}
	expectedHost := fmt.Sprintf("%s.%s.aliyuncs.com", s.bucket, s.region)
	return strings.EqualFold(u.Host, expectedHost) && pathOK
}

func (s *ObjectStore) KeyFromURL(raw string) (string, error) {
	if !s.IsAllowedURL(raw) {
		return "", errors.New("文件地址不允许")
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	key := strings.TrimPrefix(u.Path, "/")
	if key == "" {
		return "", errors.New("文件标识无效")
	}
	return key, nil
}

// ValidateUploadedObject 校验上传对象归属（前缀须为 {scope}/{id}/）并检查存在性/大小/类型。
func (s *ObjectStore) ValidateUploadedObject(key, scope, id string) error {
	return s.validateUploaded(key, scope, id, "")
}

// ValidateUploadedObjectWithKind 同 ValidateUploadedObject，但对聊天附件 kind 走差异化大小上限。
// kind 为 "" 时退化为按 content-type 推断上限（向后兼容头像/背景/想法）。
func (s *ObjectStore) ValidateUploadedObjectWithKind(key, scope, id, kind string) error {
	return s.validateUploaded(key, scope, id, kind)
}

// headResult 是 HEAD 校验的产出（供 finalize 复用 content-type / size）。
type headResult struct {
	ContentType   string
	ContentLength int64
}

func (s *ObjectStore) validateUploaded(key, scope, id, kind string) error {
	if !s.Enabled() {
		return errors.New("对象存储未配置")
	}
	if !strings.HasPrefix(key, fmt.Sprintf("%s/%s/", scope, id)) {
		return errors.New("无权访问该文件")
	}

	result, err := s.client.HeadObject(context.Background(), &oss.HeadObjectRequest{
		Bucket: oss.Ptr(s.bucket),
		Key:    oss.Ptr(key),
	})
	if err != nil {
		return fmt.Errorf("上传的文件不存在，请重新上传")
	}
	ct := ""
	if result.ContentType != nil {
		ct = *result.ContentType
	}

	// 上限：聊天附件按 kind 走差异化；其余按 content-type。
	maxBytes, hasKindLimit := maxBytesForKind(kind)
	if !hasKindLimit {
		maxBytes = maxBytesFor(ct)
	}
	if result.ContentLength > maxBytes {
		_, _ = s.client.DeleteObject(context.Background(), &oss.DeleteObjectRequest{
			Bucket: oss.Ptr(s.bucket),
			Key:    oss.Ptr(key),
		})
		switch {
		case kind == kindChatImage:
			return errors.New("图片不能超过 4MB")
		case kind == kindChatDoc:
			return errors.New("文档不能超过 10KB")
		case isVideoContentType(ct):
			return errors.New("视频不能超过 50MB")
		default:
			return errors.New("图片不能超过 5MB")
		}
	}
	if ct != "" {
		if _, ok := allowedContentTypes[ct]; !ok {
			// 浏览器有时把 .md 当作 text/plain 或 application/octet-stream 上传，放行。
			if !(kind == kindChatDoc && (ct == "text/plain" || ct == "application/octet-stream")) {
				return errors.New("文件类型无效")
			}
		}
	}
	return nil
}

// HeadObjectInfo 返回对象的 content-type 与大小（供 finalize 记录元数据），不校验归属/限额。
func (s *ObjectStore) HeadObjectInfo(key string) (*headResult, error) {
	if !s.Enabled() {
		return nil, errors.New("对象存储未配置")
	}
	result, err := s.client.HeadObject(context.Background(), &oss.HeadObjectRequest{
		Bucket: oss.Ptr(s.bucket),
		Key:    oss.Ptr(key),
	})
	if err != nil {
		return nil, fmt.Errorf("上传的文件不存在，请重新上传")
	}
	hr := &headResult{ContentLength: result.ContentLength}
	if result.ContentType != nil {
		hr.ContentType = *result.ContentType
	}
	return hr, nil
}

// GetObject 读取对象全文（用于聊天文档注入对话上下文）。调用方负责 Close。
func (s *ObjectStore) GetObject(key string) (io.ReadCloser, error) {
	if !s.Enabled() {
		return nil, errors.New("对象存储未配置")
	}
	result, err := s.client.GetObject(context.Background(), &oss.GetObjectRequest{
		Bucket: oss.Ptr(s.bucket),
		Key:    oss.Ptr(key),
	})
	if err != nil {
		return nil, err
	}
	return result.Body, nil
}

// PresignGetURL 为对象生成一个短期可读的预签名 URL（默认 15 分钟）。
// 用于把私有 bucket 中的图片交给 LLM vision 读取，避免要求 bucket 公共读。
// 若配置了 CDN 域名（通常已公共读），直接返回 CDN URL，不再预签名。
func (s *ObjectStore) PresignGetURL(key string) (string, error) {
	if !s.Enabled() {
		return "", errors.New("对象存储未配置")
	}
	// CDN 域名通常已公共读，无需预签名。
	if s.cdnDomain != "" {
		return s.publicURL(key), nil
	}
	req := &oss.GetObjectRequest{
		Bucket: oss.Ptr(s.bucket),
		Key:    oss.Ptr(key),
	}
	result, err := s.client.Presign(context.Background(), req, oss.PresignExpires(15*time.Minute))
	if err != nil {
		return "", err
	}
	return result.URL, nil
}

// PresignGetURLOrFallback 返回可读 URL，预签名失败时退化为裸 publicURL（尽力而为）。
func (s *ObjectStore) PresignGetURLOrFallback(key string) string {
	if !s.Enabled() {
		return ""
	}
	if url, err := s.PresignGetURL(key); err == nil {
		return url
	}
	return s.publicURL(key)
}

// deleteObjectQuiet 删除对象，忽略错误（用于超额/失效对象的清理）。
func (s *ObjectStore) deleteObjectQuiet(key string) error {
	if !s.Enabled() {
		return nil
	}
	_, err := s.client.DeleteObject(context.Background(), &oss.DeleteObjectRequest{
		Bucket: oss.Ptr(s.bucket),
		Key:    oss.Ptr(key),
	})
	return err
}

func (s *ObjectStore) DeleteUserPrefix(userID string) error {
	if !s.Enabled() {
		return nil
	}
	prefix := fmt.Sprintf("users/%s/", userID)
	paginator := s.client.NewListObjectsV2Paginator(&oss.ListObjectsV2Request{
		Bucket: oss.Ptr(s.bucket),
		Prefix: oss.Ptr(prefix),
	})
	for paginator.HasNext() {
		page, err := paginator.NextPage(context.Background())
		if err != nil {
			return err
		}
		if len(page.Contents) == 0 {
			continue
		}
		keys := make([]string, 0, len(page.Contents))
		for _, obj := range page.Contents {
			if obj.Key != nil {
				keys = append(keys, *obj.Key)
			}
		}
		_, err = s.client.DeleteMultipleObjects(context.Background(), &oss.DeleteMultipleObjectsRequest{
			Bucket: oss.Ptr(s.bucket),
			Objects: func() []oss.DeleteObject {
				out := make([]oss.DeleteObject, len(keys))
				for i, k := range keys {
					out[i] = oss.DeleteObject{Key: oss.Ptr(k)}
				}
				return out
			}(),
		})
		if err != nil {
			return err
		}
	}
	return nil
}
