package service

import (
	"fmt"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

type CommentService struct {
	db    *gorm.DB
	notif *NotificationService
	mod   *ModerationService
}

func NewCommentService(db *gorm.DB) *CommentService {
	return &CommentService{db: db}
}

// SetNotificationService 注入通知服务（用于评论通知）。
func (s *CommentService) SetNotificationService(notif *NotificationService) {
	s.notif = notif
}

func (s *CommentService) SetModerationService(mod *ModerationService) {
	s.mod = mod
}

// notifyIdeaOwner 向 idea 的 owner 发送通知（非阻塞）。
func (s *CommentService) notifyIdeaOwner(ideaID, actorID, action, summary string) {
	if s.notif == nil {
		return
	}
	var agentID string
	if err := s.db.Model(&model.Idea{}).Where("id = ?", ideaID).Pluck("agent_id", &agentID).Error; err != nil || agentID == "" {
		return
	}
	var ownerUserID string
	if err := s.db.Model(&model.Agent{}).Where("id = ?", agentID).Pluck("COALESCE(owner_user_id, '')", &ownerUserID).Error; err != nil || ownerUserID == "" {
		return
	}
	_ = s.notif.Create(ownerUserID, "user", actorID, "", action, "idea", ideaID, summary)
}

type CreateCommentInput struct {
	IdeaID    string `json:"idea_id"` // 由 handler 从 URL 路径填充
	UserID    string `json:"user_id"` // 由 handler 从鉴权身份填充
	ParentID  string `json:"parent_id"`
	Content   string `json:"content" binding:"required"`
	Sentiment string `json:"sentiment"`
	Kind      string `json:"kind"` // general | evidence | risk
}

func normalizeCommentKind(kind string) model.CommentKind {
	switch model.CommentKind(kind) {
	case model.CommentKindEvidence, model.CommentKindRisk, model.CommentKindGeneral:
		return model.CommentKind(kind)
	default:
		return model.CommentKindGeneral
	}
}

func (s *CommentService) CreateComment(input CreateCommentInput) (*model.Comment, error) {
	if s.mod != nil {
		if err := s.mod.EnsureCommentInteraction(input.IdeaID, input.UserID); err != nil {
			return nil, err
		}
	}
	comment := &model.Comment{
		IdeaID:    input.IdeaID,
		UserID:    input.UserID,
		Content:   input.Content,
		Sentiment: model.CommentSentiment(input.Sentiment),
		Kind:      normalizeCommentKind(input.Kind),
	}
	if input.ParentID != "" {
		rootID, err := s.resolveThreadRoot(input.IdeaID, input.ParentID)
		if err != nil {
			return nil, err
		}
		comment.ParentID = &rootID
	}
	if err := s.db.Create(comment).Error; err != nil {
		return nil, err
	}

	s.db.Model(&model.Idea{}).Where("id = ?", input.IdeaID).
		UpdateColumn("comment_count", gorm.Expr("comment_count + 1"))

	// 评论通知（self-action 守卫已在 Create 内处理）
	summary := input.Content
	if len(summary) > 50 {
		summary = summary[:50]
	}
	s.notifyIdeaOwner(input.IdeaID, input.UserID, "comment", summary)

	return comment, nil
}

// resolveThreadRoot 将任意回复挂到顶层评论（PH 单层线程模型）。
func (s *CommentService) resolveThreadRoot(ideaID, parentID string) (string, error) {
	var parent model.Comment
	if err := s.db.Where("id = ? AND idea_id = ?", parentID, ideaID).First(&parent).Error; err != nil {
		return "", fmt.Errorf("parent comment not found")
	}
	seen := map[string]bool{parent.ID: true}
	for parent.ParentID != nil {
		if seen[*parent.ParentID] {
			break
		}
		seen[*parent.ParentID] = true
		var next model.Comment
		if err := s.db.Where("id = ? AND idea_id = ?", *parent.ParentID, ideaID).First(&next).Error; err != nil {
			break
		}
		parent = next
	}
	return parent.ID, nil
}

func (s *CommentService) GetComments(ideaID string) ([]model.Comment, error) {
	var all []model.Comment
	if err := s.db.Where("idea_id = ? AND is_moderated = ?", ideaID, false).
		Order("created_at ASC").
		Find(&all).Error; err != nil {
		return nil, err
	}
	if len(all) == 0 {
		return []model.Comment{}, nil
	}

	byID := make(map[string]*model.Comment, len(all))
	for i := range all {
		all[i].Replies = nil
		byID[all[i].ID] = &all[i]
	}

	findRootID := func(c *model.Comment) string {
		cur := c
		seen := map[string]bool{cur.ID: true}
		for cur.ParentID != nil {
			p, ok := byID[*cur.ParentID]
			if !ok || seen[p.ID] {
				return cur.ID
			}
			seen[p.ID] = true
			if p.ParentID == nil {
				return p.ID
			}
			cur = p
		}
		return cur.ID
	}

	var roots []model.Comment
	repliesByRoot := make(map[string][]model.Comment)
	for i := range all {
		c := all[i]
		if c.ParentID == nil {
			roots = append(roots, c)
			continue
		}
		rootID := findRootID(&c)
		// 跳过自身即根的异常环
		if rootID == c.ID {
			roots = append(roots, c)
			continue
		}
		repliesByRoot[rootID] = append(repliesByRoot[rootID], c)
	}

	// 根评论按时间倒序（最新在上）；回复保持时间正序
	for i, j := 0, len(roots)-1; i < j; i, j = i+1, j-1 {
		roots[i], roots[j] = roots[j], roots[i]
	}
	for i := range roots {
		roots[i].Replies = repliesByRoot[roots[i].ID]
	}
	return roots, nil
}

func (s *CommentService) GetCommentsEnriched(ideaID string) ([]CommentView, error) {
	return s.GetCommentsEnrichedForViewer(ideaID, "", "")
}

func (s *CommentService) GetCommentsEnrichedForViewer(ideaID, viewerUserID, viewerAgentID string) ([]CommentView, error) {
	comments, err := s.GetComments(ideaID)
	if err != nil {
		return nil, err
	}
	return EnrichCommentsForViewer(s.db, comments, viewerUserID, viewerAgentID), nil
}

func (s *CommentService) LikeComment(commentID, userID, agentID string) error {
	if userID == "" && agentID == "" {
		return fmt.Errorf("authentication required")
	}
	var comment model.Comment
	if err := s.db.Where("id = ?", commentID).First(&comment).Error; err != nil {
		return fmt.Errorf("comment not found")
	}
	like := model.CommentLike{
		CommentID: commentID,
		UserID:    userID,
		AgentID:   agentID,
	}
	if err := s.db.Create(&like).Error; err != nil {
		return fmt.Errorf("already liked or error: %w", err)
	}
	s.db.Model(&model.Comment{}).Where("id = ?", commentID).
		UpdateColumn("like_count", gorm.Expr("like_count + 1"))
	return nil
}

func (s *CommentService) UnlikeComment(commentID, userID, agentID string) error {
	q := s.db.Where("comment_id = ?", commentID)
	if userID != "" {
		q = q.Where("user_id = ?", userID)
	} else {
		q = q.Where("agent_id = ?", agentID)
	}
	res := q.Delete(&model.CommentLike{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected > 0 {
		s.db.Model(&model.Comment{}).Where("id = ? AND like_count > 0", commentID).
			UpdateColumn("like_count", gorm.Expr("like_count - 1"))
	}
	return nil
}

func (s *CommentService) HasLikedComment(commentID, userID, agentID string) bool {
	if userID == "" && agentID == "" {
		return false
	}
	q := s.db.Model(&model.CommentLike{}).Where("comment_id = ?", commentID)
	if userID != "" {
		q = q.Where("user_id = ?", userID)
	} else {
		q = q.Where("agent_id = ?", agentID)
	}
	var n int64
	q.Count(&n)
	return n > 0
}

type AdminCommentFilter struct {
	Moderated *bool
	IdeaID    string
	Limit     int
	Offset    int
}

func (s *CommentService) ListCommentsAdmin(filter AdminCommentFilter) ([]model.Comment, int64, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	q := s.db.Model(&model.Comment{})
	if filter.Moderated != nil {
		q = q.Where("is_moderated = ?", *filter.Moderated)
	}
	if filter.IdeaID != "" {
		q = q.Where("idea_id = ?", filter.IdeaID)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var comments []model.Comment
	if err := q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&comments).Error; err != nil {
		return nil, 0, err
	}
	return comments, total, nil
}

func (s *CommentService) UpdateComment(id, userID, content string) (*model.Comment, error) {
	var comment model.Comment
	if err := s.db.Where("id = ? AND user_id = ?", id, userID).First(&comment).Error; err != nil {
		return nil, fmt.Errorf("comment not found: %w", err)
	}
	comment.Content = content
	if err := s.db.Save(&comment).Error; err != nil {
		return nil, err
	}
	return &comment, nil
}

func (s *CommentService) DeleteComment(id, userID string) error {
	var comment model.Comment
	if err := s.db.Where("id = ? AND user_id = ?", id, userID).First(&comment).Error; err != nil {
		return fmt.Errorf("comment not found")
	}
	if err := s.db.Delete(&comment).Error; err != nil {
		return err
	}
	s.db.Model(&model.Idea{}).Where("id = ? AND comment_count > 0", comment.IdeaID).
		UpdateColumn("comment_count", gorm.Expr("comment_count - 1"))
	return nil
}

func (s *CommentService) ModerateComment(id string, moderated bool) error {
	return s.db.Model(&model.Comment{}).Where("id = ?", id).
		Update("is_moderated", moderated).Error
}
