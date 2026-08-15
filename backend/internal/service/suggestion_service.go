package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	gomysql "github.com/go-sql-driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/wanye/ideaevo/internal/model"
)

const (
	maxSuggestionContentRunes = 4000
	maxSuggestionImages       = 4
)

var (
	ErrSuggestionNotFound    = errors.New("suggestion not found")
	ErrSuggestionNotAuthor   = errors.New("only the suggestion author can delete it")
	ErrSuggestionNotOwner    = errors.New("only the idea owner can select suggestions")
	ErrSuggestionAlreadyVot  = errors.New("已经投票过这条建议")
	ErrSuggestionIdeaGone    = errors.New("idea not found or not accepting suggestions")
	ErrSuggestionSelected    = errors.New("已采纳的建议不能删除")
	ErrSuggestionJobNotFound = errors.New("implementation job not found")
	ErrSuggestionJobNotOwner = errors.New("only the job owner can update it")
)

type SuggestionService struct {
	db     *gorm.DB
	notif  *NotificationService
	mod    *ModerationService
	assets *ObjectStore
}

func NewSuggestionService(db *gorm.DB) *SuggestionService {
	return &SuggestionService{db: db}
}

func (s *SuggestionService) SetNotificationService(notif *NotificationService) {
	s.notif = notif
}

func (s *SuggestionService) SetModerationService(mod *ModerationService) {
	s.mod = mod
}

// SetObjectStore 注入对象存储（用于建议图片 URL 的域名白名单校验）。
func (s *SuggestionService) SetObjectStore(assets *ObjectStore) {
	s.assets = assets
}

type CreateSuggestionInput struct {
	IdeaID    string
	UserID    string // 用户会话提交时为用户 ID
	AgentID   string // API Key 提交时为 Agent ID（与 UserID 二选一）
	Content   string
	ImageURLs []string
}

// normalizeSuggestionImageURLs 过滤并校验建议图片 URL（域名白名单，防外链）。
func (s *SuggestionService) normalizeSuggestionImageURLs(urls []string) ([]string, error) {
	if len(urls) > maxSuggestionImages {
		return nil, fmt.Errorf("建议最多附带 %d 张图片", maxSuggestionImages)
	}
	out := make([]string, 0, len(urls))
	for _, raw := range urls {
		u := strings.TrimSpace(raw)
		if u == "" {
			continue
		}
		if s.assets != nil && !s.assets.IsAllowedURL(u) {
			return nil, fmt.Errorf("图片链接无效（仅支持本站对象存储）")
		}
		out = append(out, u)
	}
	return out, nil
}

func (s *SuggestionService) Create(input CreateSuggestionInput) (*model.IdeaSuggestion, error) {
	if input.UserID == "" && input.AgentID == "" {
		return nil, fmt.Errorf("authentication required")
	}
	// 服务层统一校验 idea 存在与状态（MCP 工具路径没有 handler 预检）
	var idea model.Idea
	if err := s.db.Where("id = ?", input.IdeaID).First(&idea).Error; err != nil {
		return nil, ErrSuggestionIdeaGone
	}
	if idea.Status == model.IdeaStatusBuried {
		return nil, ErrSuggestionIdeaGone
	}
	if s.mod != nil {
		if err := s.mod.EnsureIdeaInteraction(input.IdeaID, input.UserID, input.AgentID); err != nil {
			return nil, err
		}
	}

	content := strings.TrimSpace(input.Content)
	if content == "" {
		return nil, fmt.Errorf("建议内容不能为空")
	}
	if len([]rune(content)) > maxSuggestionContentRunes {
		return nil, fmt.Errorf("建议内容过长（最多 %d 字）", maxSuggestionContentRunes)
	}
	imageURLs, err := s.normalizeSuggestionImageURLs(input.ImageURLs)
	if err != nil {
		return nil, err
	}
	imageJSON, _ := json.Marshal(imageURLs)

	// 作者主体沿用 Comment 约定：单列 UserID 存用户或 Agent ID，富化时区分。
	authorID := input.UserID
	if authorID == "" {
		authorID = input.AgentID
	}

	suggestion := &model.IdeaSuggestion{
		IdeaID:    input.IdeaID,
		UserID:    authorID,
		Content:   content,
		ImageURLs: string(imageJSON),
	}
	if err := s.db.Create(suggestion).Error; err != nil {
		return nil, err
	}
	s.db.Model(&model.Idea{}).Where("id = ?", input.IdeaID).
		UpdateColumn("suggestion_count", gorm.Expr("suggestion_count + 1"))

	actorType, actorID := "agent", input.AgentID
	if input.UserID != "" {
		actorType, actorID = "user", input.UserID
	}
	logActivity(s.db, actorType, actorID, ActionSuggest, "idea", input.IdeaID, nil)
	s.notifyIdeaOwner(input.IdeaID, actorType, actorID, "suggestion", truncateSummary(content))
	return suggestion, nil
}

// truncateSummary 截断通知摘要。
func truncateSummary(s string) string {
	r := []rune(s)
	if len(r) > 50 {
		return string(r[:50])
	}
	return s
}

// notifyIdeaOwner 向 idea owner 发送通知（非阻塞，self-action 守卫在 Create 内部）。
func (s *SuggestionService) notifyIdeaOwner(ideaID, actorType, actorID, action, summary string) {
	if s.notif == nil {
		return
	}
	var agentID string
	if err := s.db.Model(&model.Idea{}).Where("id = ?", ideaID).Pluck("agent_id", &agentID).Error; err != nil || agentID == "" {
		return
	}
	var ownerUserID string
	if err := s.db.Model(&model.Agent{}).Where("id = ?", agentID).Pluck("owner_user_id", &ownerUserID).Error; err != nil || ownerUserID == "" {
		return
	}
	_ = s.notif.Create(ownerUserID, actorType, actorID, "", action, "idea", ideaID, summary)
}

// hasOwnerVotedSuggestion 检查去重主体（user 本人 + 其所有 agent）是否已给该建议投过票。
func (s *SuggestionService) hasOwnerVotedSuggestion(tx *gorm.DB, suggestionID, ownerID string) (bool, error) {
	if ownerID == "" {
		return false, nil
	}
	var ownCount int64
	if err := tx.Model(&model.SuggestionVote{}).
		Where("suggestion_id = ? AND user_id = ?", suggestionID, ownerID).
		Count(&ownCount).Error; err != nil {
		return false, err
	}
	if ownCount > 0 {
		return true, nil
	}
	var agentIDs []string
	if err := tx.Model(&model.Agent{}).Where("owner_user_id = ?", ownerID).Pluck("id", &agentIDs).Error; err != nil {
		return false, err
	}
	if len(agentIDs) > 0 {
		var agentCount int64
		if err := tx.Model(&model.SuggestionVote{}).
			Where("suggestion_id = ? AND agent_id IN ?", suggestionID, agentIDs).
			Count(&agentCount).Error; err != nil {
			return false, err
		}
		if agentCount > 0 {
			return true, nil
		}
	}
	return false, nil
}

// resolveSuggestionVoterOwnerID 解析投票去重主体（用户本人，或 Agent 的 owner）。
func resolveSuggestionVoterOwnerID(tx *gorm.DB, userID, agentID string) string {
	if userID != "" {
		return userID
	}
	if agentID == "" {
		return ""
	}
	var ownerID string
	if err := tx.Model(&model.Agent{}).Where("id = ?", agentID).Pluck("owner_user_id", &ownerID).Error; err != nil {
		return agentID
	}
	if ownerID == "" {
		return agentID // 系统 agent（无 owner）：各自独立
	}
	return ownerID
}

func (s *SuggestionService) Vote(ideaID, suggestionID, userID, agentID string) error {
	if s.mod != nil {
		var sug model.IdeaSuggestion
		if err := s.db.Where("id = ? AND idea_id = ?", suggestionID, ideaID).First(&sug).Error; err != nil {
			return ErrSuggestionNotFound
		}
		if err := s.mod.EnsureIdeaInteraction(sug.IdeaID, userID, agentID); err != nil {
			return err
		}
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 对建议行加 FOR UPDATE 锁，串行化同一建议的并发投票：
		// 否则 REPEATABLE READ 快照下，同一 owner 的两个身份（本人 + Agent）
		// 并发投票都会通过 hasOwnerVotedSuggestion 检查，导致双票。
		var sug model.IdeaSuggestion
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND idea_id = ?", suggestionID, ideaID).First(&sug).Error; err != nil {
			return ErrSuggestionNotFound
		}

		ownerID := resolveSuggestionVoterOwnerID(tx, userID, agentID)
		voted, err := s.hasOwnerVotedSuggestion(tx, suggestionID, ownerID)
		if err != nil {
			return err
		}
		if voted {
			return ErrSuggestionAlreadyVot
		}

		vote := model.SuggestionVote{
			SuggestionID: suggestionID,
			UserID:       userID,
			AgentID:      agentID,
		}
		if err := tx.Create(&vote).Error; err != nil {
			// 撞唯一索引按「已投过」处理；其余错误原样返回，不误报
			var mysqlErr *gomysql.MySQLError
			if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
				return ErrSuggestionAlreadyVot
			}
			return err
		}
		return tx.Model(&model.IdeaSuggestion{}).Where("id = ?", suggestionID).
			UpdateColumn("vote_count", gorm.Expr("vote_count + 1")).Error
	})
}

func (s *SuggestionService) Unvote(ideaID, suggestionID, userID, agentID string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 校验建议属于该 idea（路径一致性），再按非空身份删除
		var sug model.IdeaSuggestion
		if err := tx.Where("id = ? AND idea_id = ?", suggestionID, ideaID).First(&sug).Error; err != nil {
			return ErrSuggestionNotFound
		}
		q := tx.Where("suggestion_id = ?", suggestionID)
		switch {
		case userID != "" && agentID != "":
			q = q.Where("user_id = ? OR agent_id = ?", userID, agentID)
		case userID != "":
			q = q.Where("user_id = ?", userID)
		case agentID != "":
			q = q.Where("agent_id = ?", agentID)
		default:
			return fmt.Errorf("authentication required")
		}
		result := q.Delete(&model.SuggestionVote{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected > 0 {
			return tx.Model(&model.IdeaSuggestion{}).Where("id = ?", suggestionID).
				UpdateColumn("vote_count", gorm.Expr("GREATEST(vote_count - 1, 0)")).Error
		}
		return nil
	})
}

type SelectSuggestionResult struct {
	Suggestion *model.IdeaSuggestion
	JobID      string
}

// Select 由 idea owner 采纳一条建议：置 SelectedAt、创建 ImplementationJob、
// 将 concept 状态的 idea 推进到 in_progress，并通知建议提交者。
func (s *SuggestionService) Select(ideaID, suggestionID, userID, agentID string) (*SelectSuggestionResult, error) {
	// 解析操作者对应的用户 ID（会话用户优先，其次 agent 的 owner）
	actorUserID := userID
	if actorUserID == "" && agentID != "" {
		if err := s.db.Model(&model.Agent{}).Where("id = ?", agentID).Pluck("owner_user_id", &actorUserID).Error; err != nil {
			return nil, ErrSuggestionNotOwner
		}
	}
	if actorUserID == "" {
		return nil, ErrSuggestionNotOwner
	}

	var jobID string
	var selectedSug model.IdeaSuggestion
	var notifyRecipient, notifySummary string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var idea model.Idea
		if err := tx.Where("id = ?", ideaID).First(&idea).Error; err != nil {
			return fmt.Errorf("idea not found")
		}
		var ownerUserID string
		if err := tx.Model(&model.Agent{}).Where("id = ?", idea.AgentID).Pluck("owner_user_id", &ownerUserID).Error; err != nil || ownerUserID == "" {
			return ErrSuggestionNotOwner
		}
		if ownerUserID != actorUserID {
			return ErrSuggestionNotOwner
		}

		var sug model.IdeaSuggestion
		if err := tx.Where("id = ? AND idea_id = ?", suggestionID, ideaID).First(&sug).Error; err != nil {
			return ErrSuggestionNotFound
		}
		selectedSug = sug

		// 条件更新抢占采纳权：并发第二次调用 RowsAffected=0，不会重复建任务
		now := time.Now()
		res := tx.Model(&model.IdeaSuggestion{}).
			Where("id = ? AND selected_at IS NULL", sug.ID).
			UpdateColumn("selected_at", now)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			// 幂等：已采纳过直接返回，不重复建任务
			return nil
		}
		sug.SelectedAt = &now
		selectedSug = sug

		// 任务简报：idea 快照 + 建议内容，供后续本地 Runner 直接消费
		var imageUrls []string
		_ = json.Unmarshal([]byte(sug.ImageURLs), &imageUrls)
		brief, _ := json.Marshal(map[string]any{
			"idea_id":            idea.ID,
			"idea_title":         idea.Title,
			"idea_description":   idea.Description,
			"idea_repo_url":      idea.RepoURL,
			"suggestion_id":      sug.ID,
			"suggestion_content": sug.Content,
			"suggestion_images":  imageUrls,
			"created_by":         "suggestion_selected",
		})
		job := model.ImplementationJob{
			IdeaID:       idea.ID,
			SuggestionID: &sug.ID,
			OwnerUserID:  ownerUserID,
			Status:       "pending",
			Brief:        string(brief),
		}
		if err := tx.Create(&job).Error; err != nil {
			return err
		}
		jobID = job.ID

		// 采纳即视为开始实现：concept → in_progress
		if idea.ImplStatus == model.ImplStatusConcept || idea.ImplStatus == "" {
			if err := tx.Model(&model.Idea{}).Where("id = ?", idea.ID).
				UpdateColumn("impl_status", model.ImplStatusInProgress).Error; err != nil {
				return err
			}
		}

		actorType, actorIDv := "user", actorUserID
		logActivity(tx, actorType, actorIDv, ActionSuggestionSelected, "idea", idea.ID, nil)

		// 通知建议提交者（agent 提交的解析到其 owner）。
		// 记录待发通知，事务提交成功后再发送，避免回滚后残留通知。
		recipient := sug.UserID
		var suggesterOwner string
		if err := tx.Model(&model.Agent{}).Where("id = ?", sug.UserID).Pluck("owner_user_id", &suggesterOwner).Error; err == nil && suggesterOwner != "" {
			recipient = suggesterOwner
		}
		if recipient != actorUserID {
			notifyRecipient = recipient
			notifySummary = truncateSummary(sug.Content)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if s.notif != nil && notifyRecipient != "" {
		_ = s.notif.Create(notifyRecipient, "user", actorUserID, "", "suggestion_selected", "idea", ideaID, notifySummary)
	}
	// 返回事务内快照，避免提交后建议被并发删除导致 404
	return &SelectSuggestionResult{Suggestion: &selectedSug, JobID: jobID}, nil
}

// Delete 删除建议（仅提交者本人/本人 Agent）。已采纳的建议不能删除——
// 其对应的 ImplementationJob 仍在，删除会造成任务悬空。
func (s *SuggestionService) Delete(ideaID, suggestionID, userID, agentID string) error {
	if userID == "" && agentID == "" {
		return fmt.Errorf("authentication required")
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		var sug model.IdeaSuggestion
		if err := tx.Where("id = ? AND idea_id = ?", suggestionID, ideaID).First(&sug).Error; err != nil {
			return ErrSuggestionNotFound
		}
		if sug.SelectedAt != nil {
			return ErrSuggestionSelected
		}
		// 允许：作者本人（用户会话）、作者 Agent 自身、或作者 Agent 的 owner
		authorized := sug.UserID == userID || sug.UserID == agentID
		if !authorized && userID != "" {
			var agentOwner string
			if err := tx.Model(&model.Agent{}).Where("id = ?", sug.UserID).Pluck("owner_user_id", &agentOwner).Error; err == nil {
				authorized = agentOwner == userID
			}
		}
		if !authorized {
			return ErrSuggestionNotAuthor
		}
		if err := tx.Where("suggestion_id = ?", sug.ID).Delete(&model.SuggestionVote{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&model.IdeaSuggestion{}, "id = ?", sug.ID).Error; err != nil {
			return err
		}
		return tx.Model(&model.Idea{}).Where("id = ?", ideaID).
			UpdateColumn("suggestion_count", gorm.Expr("GREATEST(suggestion_count - 1, 0)")).Error
	})
}

// SuggestionView 是富化后的建议视图（作者信息 + 当前 viewer 投票状态）。
type SuggestionView struct {
	ID         string     `json:"id"`
	IdeaID     string     `json:"idea_id"`
	UserID     string     `json:"user_id"`
	Content    string     `json:"content"`
	ImageURLs  []string   `json:"image_urls"`
	VoteCount  int        `json:"vote_count"`
	Voted      bool       `json:"voted"`
	Selected   bool       `json:"selected"`
	SelectedAt *time.Time `json:"selected_at,omitempty"`
	// JobStatus：采纳后实现任务的当前状态（pending/in_progress/done/failed），空=未采纳
	JobStatus    string    `json:"job_status,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	AuthorName   string    `json:"author_name,omitempty"`
	AuthorAvatar string    `json:"author_avatar,omitempty"`
	AuthorType   string    `json:"author_type,omitempty"` // user | agent
}

// ListByIdea 返回某 idea 的建议列表（已采纳在前，其后按票数、时间倒序），
// 并富化作者信息与 viewer 的投票状态（viewer 主体 = 本人 + 其所有 Agent）。
func (s *SuggestionService) ListByIdea(ideaID, viewerUserID, viewerAgentID string) ([]SuggestionView, error) {
	var suggestions []model.IdeaSuggestion
	if err := s.db.Where("idea_id = ?", ideaID).
		Order("selected_at IS NULL ASC, vote_count DESC, created_at DESC").
		Find(&suggestions).Error; err != nil {
		return nil, err
	}
	if len(suggestions) == 0 {
		return []SuggestionView{}, nil
	}

	// 作者信息（复用评论富化的加载逻辑）
	authorIDs := make([]string, 0, len(suggestions))
	seen := map[string]bool{}
	for _, sug := range suggestions {
		if sug.UserID != "" && !seen[sug.UserID] {
			seen[sug.UserID] = true
			authorIDs = append(authorIDs, sug.UserID)
		}
	}
	var userRows []commentAuthorBrief
	s.db.Table("users").Select("id, name, avatar_url").Where("id IN ?", authorIDs).Scan(&userRows)
	users := map[string]commentAuthorBrief{}
	for _, u := range userRows {
		users[u.ID] = u
	}
	var agentRows []commentAuthorBrief
	s.db.Table("agents").Select("id, name, avatar_url").Where("id IN ?", authorIDs).Scan(&agentRows)
	agents := map[string]commentAuthorBrief{}
	for _, a := range agentRows {
		agents[a.ID] = a
	}

	// viewer 投票状态（同 owner 防刷口径：本人 + 其所有 agent 任一投过即视为已投）
	votedSet := map[string]bool{}
	if viewerUserID != "" || viewerAgentID != "" {
		ids := []string{}
		if viewerUserID != "" {
			ids = append(ids, viewerUserID)
		}
		if viewerAgentID != "" {
			ids = append(ids, viewerAgentID)
		}
		if viewerUserID != "" {
			var agentIDs []string
			s.db.Model(&model.Agent{}).Where("owner_user_id = ?", viewerUserID).Pluck("id", &agentIDs)
			ids = append(ids, agentIDs...)
		}
		var rows []string
		s.db.Model(&model.SuggestionVote{}).
			Where("suggestion_id IN ? AND (user_id IN ? OR agent_id IN ?)", suggestionIDs(suggestions), ids, ids).
			Pluck("suggestion_id", &rows)
		for _, id := range rows {
			votedSet[id] = true
		}
	}

	out := make([]SuggestionView, len(suggestions))
	for i, sug := range suggestions {
		view := SuggestionView{
			ID:         sug.ID,
			IdeaID:     sug.IdeaID,
			UserID:     sug.UserID,
			Content:    sug.Content,
			ImageURLs:  []string{},
			VoteCount:  sug.VoteCount,
			Voted:      votedSet[sug.ID],
			Selected:   sug.Selected(),
			SelectedAt: sug.SelectedAt,
			CreatedAt:  sug.CreatedAt,
		}
		_ = json.Unmarshal([]byte(sug.ImageURLs), &view.ImageURLs)
		if view.ImageURLs == nil {
			view.ImageURLs = []string{}
		}
		if a, ok := agents[sug.UserID]; ok {
			view.AuthorType = "agent"
			view.AuthorName = a.Name
			view.AuthorAvatar = ResolveAgentAvatar(sug.UserID, a.AvatarURL)
		} else if u, ok := users[sug.UserID]; ok {
			view.AuthorType = "user"
			view.AuthorName = u.Name
			view.AuthorAvatar = ResolveUserAvatar(sug.UserID, u.AvatarURL)
		}
		out[i] = view
	}

	// 已采纳建议附带实现任务状态（让提交者能看到推进进展）
	var jobs []model.ImplementationJob
	if err := s.db.Where("suggestion_id IN ?", suggestionIDs(suggestions)).Find(&jobs).Error; err == nil {
		for i := range out {
			for _, j := range jobs {
				if j.SuggestionID != nil && *j.SuggestionID == out[i].ID {
					out[i].JobStatus = j.Status
				}
			}
		}
	}
	return out, nil
}

// ---- 实现任务队列（owner 视角）----

// JobView 是 owner 任务队列的条目视图。
type JobView struct {
	ID                string    `json:"id"`
	IdeaID            string    `json:"idea_id"`
	IdeaTitle         string    `json:"idea_title"`
	SuggestionID      *string   `json:"suggestion_id,omitempty"`
	SuggestionContent string    `json:"suggestion_content,omitempty"`
	SuggestionAuthor  string    `json:"suggestion_author,omitempty"`
	Status            string    `json:"status"`
	Note              string    `json:"note,omitempty"`
	RepoURL           string    `json:"repo_url,omitempty"`
	CommitSHA         string    `json:"commit_sha,omitempty"`
	ResultSummary     string    `json:"result_summary,omitempty"`
	ProgressLog       []JobProgressNoteView `json:"progress_log,omitempty"`
	PendingQuestion   *JobQuestionView      `json:"pending_question,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// JobProgressNoteView 是进展时间线里的一条。
type JobProgressNoteView struct {
	Note string    `json:"note"`
	At   time.Time `json:"at"`
}

// JobQuestionView 是 Agent 发起的提问（未回答的才有意义）。
type JobQuestionView struct {
	ID        string    `json:"id"`
	Question  string    `json:"question"`
	Answer    string    `json:"answer,omitempty"`
	Answered  bool      `json:"answered"`
	CreatedAt time.Time `json:"created_at"`
}

// ListJobs 返回某用户的实现任务队列（新任务在前，未完成优先）。
func (s *SuggestionService) ListJobs(ownerUserID string) ([]JobView, error) {
	var jobs []model.ImplementationJob
	if err := s.db.Where("owner_user_id = ?", ownerUserID).
		Order("CASE status WHEN 'done' THEN 1 WHEN 'failed' THEN 2 ELSE 0 END, created_at DESC").
		Find(&jobs).Error; err != nil {
		return nil, err
	}
	if len(jobs) == 0 {
		return []JobView{}, nil
	}

	// 批量取 idea 标题
	ideaIDs := make([]string, 0, len(jobs))
	for _, j := range jobs {
		ideaIDs = append(ideaIDs, j.IdeaID)
	}
	var ideaRows []struct{ ID, Title string }
	s.db.Table("ideas").Select("id, title").Where("id IN ?", ideaIDs).Scan(&ideaRows)
	titles := map[string]string{}
	for _, r := range ideaRows {
		titles[r.ID] = r.Title
	}

	// 批量取未回答的问题（每任务取最新一条）
	jobIDs := make([]string, 0, len(jobs))
	for _, j := range jobs {
		jobIDs = append(jobIDs, j.ID)
	}
	var questions []model.JobQuestion
	s.db.Where("job_id IN ? AND answered_at IS NULL", jobIDs).
		Order("created_at ASC").Find(&questions)
	pendingQ := map[string]model.JobQuestion{}
	for _, q := range questions {
		pendingQ[q.JobID] = q // 升序遍历，留下最新一条
	}

	out := make([]JobView, len(jobs))
	for i, j := range jobs {
		view := JobView{
			ID: j.ID, IdeaID: j.IdeaID, IdeaTitle: titles[j.IdeaID],
			SuggestionID: j.SuggestionID, Status: j.Status, Note: j.Note,
			RepoURL: j.RepoURL, CommitSHA: j.CommitSHA, ResultSummary: j.ResultSummary,
			CreatedAt: j.CreatedAt, UpdatedAt: j.UpdatedAt,
		}
		// 简报里存有建议内容与作者快照
		var brief struct {
			SuggestionContent string `json:"suggestion_content"`
		}
		_ = json.Unmarshal([]byte(j.Brief), &brief)
		view.SuggestionContent = brief.SuggestionContent
		var notes []JobProgressNoteView
		_ = json.Unmarshal([]byte(j.ProgressLog), &notes)
		view.ProgressLog = notes
		if q, ok := pendingQ[j.ID]; ok {
			view.PendingQuestion = &JobQuestionView{
				ID: q.ID, Question: q.Question, CreatedAt: q.CreatedAt,
			}
		}
		out[i] = view
	}
	return out, nil
}

// 合法状态转移：pending 可开始/完成/失败；in_progress 可完成/失败；终态不可再变。
var jobTransitions = map[string]map[string]bool{
	"pending":     {"in_progress": true, "done": true, "failed": true},
	"in_progress": {"done": true, "failed": true},
	"done":        {},
	"failed":      {},
}

// UpdateJob 由 owner 推进任务状态。完成时通知建议提交者（其建议已实现）。
func (s *SuggestionService) UpdateJob(jobID, ownerUserID, status, note string) (*model.ImplementationJob, error) {
	if status != "in_progress" && status != "done" && status != "failed" {
		return nil, fmt.Errorf("无效的任务状态")
	}
	var notifyRecipient string
	var notifyIdeaID string
	var notifySummary string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var job model.ImplementationJob
		if err := tx.Where("id = ?", jobID).First(&job).Error; err != nil {
			return ErrSuggestionJobNotFound
		}
		if job.OwnerUserID != ownerUserID {
			return ErrSuggestionJobNotOwner
		}
		if !jobTransitions[job.Status][status] {
			return fmt.Errorf("任务已处于终态（%s），不能再变更", job.Status)
		}
		updates := map[string]interface{}{"status": status}
		if note != "" {
			updates["note"] = note
		}
		if err := tx.Model(&job).Updates(updates).Error; err != nil {
			return err
		}

		if status == "done" {
			// 与 Agent 回报路径（ReportJobResult）保持一致：完成即同步想法实现状态
			tx.Model(&model.Idea{}).Where("id = ?", job.IdeaID).Update("impl_status", "implemented")
		}
		if status == "done" && job.SuggestionID != nil {
			logActivity(tx, "user", ownerUserID, ActionSuggestionImplemented, "idea", job.IdeaID, nil)
			// 通知建议提交者：解析建议作者（agent 提交的解析到其 owner）
			var sug model.IdeaSuggestion
			if err := tx.Where("id = ?", *job.SuggestionID).First(&sug).Error; err == nil {
				recipient := sug.UserID
				var suggesterOwner string
				if err := tx.Model(&model.Agent{}).Where("id = ?", sug.UserID).Pluck("owner_user_id", &suggesterOwner).Error; err == nil && suggesterOwner != "" {
					recipient = suggesterOwner
				}
				if recipient != "" && recipient != ownerUserID {
					notifyRecipient = recipient
					notifyIdeaID = job.IdeaID
					notifySummary = truncateSummary(sug.Content)
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if s.notif != nil && notifyRecipient != "" {
		_ = s.notif.Create(notifyRecipient, "user", ownerUserID, "", "suggestion_implemented", "idea", notifyIdeaID, notifySummary)
	}
	var job model.ImplementationJob
	if err := s.db.Where("id = ?", jobID).First(&job).Error; err != nil {
		return nil, ErrSuggestionJobNotFound
	}
	return &job, nil
}

func suggestionIDs(suggestions []model.IdeaSuggestion) []string {
	ids := make([]string, len(suggestions))
	for i, s := range suggestions {
		ids[i] = s.ID
	}
	return ids
}
