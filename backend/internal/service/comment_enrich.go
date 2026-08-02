package service

import (
	"time"

	"gorm.io/gorm"

	"github.com/wanye/ideaevo/internal/model"
)

// CommentView is an enriched comment for API responses (author name + avatar).
type CommentView struct {
	ID           string                 `json:"id"`
	IdeaID       string                 `json:"idea_id"`
	UserID       string                 `json:"user_id"`
	ParentID     *string                `json:"parent_id,omitempty"`
	Content      string                 `json:"content"`
	Sentiment    model.CommentSentiment `json:"sentiment,omitempty"`
	LikeCount    int                    `json:"like_count"`
	Liked        bool                   `json:"liked"`
	IsModerated  bool                   `json:"is_moderated"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
	AuthorName   string                 `json:"author_name,omitempty"`
	AuthorAvatar string                 `json:"author_avatar,omitempty"`
	AuthorType   string                 `json:"author_type,omitempty"` // user | agent
	Replies      []CommentView          `json:"replies,omitempty"`
}

type commentAuthorBrief struct {
	ID        string
	Name      string
	AvatarURL string
}

// EnrichComments attaches author display fields to a comment tree.
func EnrichComments(db *gorm.DB, comments []model.Comment) []CommentView {
	return EnrichCommentsForViewer(db, comments, "", "")
}

// EnrichCommentsForViewer also marks comments liked by the current viewer.
func EnrichCommentsForViewer(db *gorm.DB, comments []model.Comment, viewerUserID, viewerAgentID string) []CommentView {
	if len(comments) == 0 {
		return []CommentView{}
	}
	users, agents := loadCommentAuthors(db, collectCommentAuthorIDs(comments))
	liked := loadViewerCommentLikes(db, collectCommentIDs(comments), viewerUserID, viewerAgentID)
	out := make([]CommentView, len(comments))
	for i, c := range comments {
		out[i] = commentViewFrom(c, users, agents, liked)
	}
	return out
}

func collectCommentIDs(comments []model.Comment) []string {
	var ids []string
	var walk func([]model.Comment)
	walk = func(list []model.Comment) {
		for _, c := range list {
			ids = append(ids, c.ID)
			if len(c.Replies) > 0 {
				walk(c.Replies)
			}
		}
	}
	walk(comments)
	return ids
}

func loadViewerCommentLikes(db *gorm.DB, commentIDs []string, userID, agentID string) map[string]bool {
	liked := make(map[string]bool)
	if len(commentIDs) == 0 || (userID == "" && agentID == "") {
		return liked
	}
	q := db.Model(&model.CommentLike{}).Select("comment_id").Where("comment_id IN ?", commentIDs)
	if userID != "" {
		q = q.Where("user_id = ?", userID)
	} else {
		q = q.Where("agent_id = ?", agentID)
	}
	var rows []string
	q.Pluck("comment_id", &rows)
	for _, id := range rows {
		liked[id] = true
	}
	return liked
}

func collectCommentAuthorIDs(comments []model.Comment) []string {
	seen := make(map[string]bool)
	var ids []string
	var walk func([]model.Comment)
	walk = func(list []model.Comment) {
		for _, c := range list {
			if c.UserID != "" && !seen[c.UserID] {
				seen[c.UserID] = true
				ids = append(ids, c.UserID)
			}
			if len(c.Replies) > 0 {
				walk(c.Replies)
			}
		}
	}
	walk(comments)
	return ids
}

func loadCommentAuthors(db *gorm.DB, ids []string) (users, agents map[string]commentAuthorBrief) {
	users = make(map[string]commentAuthorBrief)
	agents = make(map[string]commentAuthorBrief)
	if len(ids) == 0 {
		return users, agents
	}
	var userRows []commentAuthorBrief
	db.Table("users").Select("id, name, avatar_url").Where("id IN ?", ids).Scan(&userRows)
	for _, u := range userRows {
		users[u.ID] = u
	}
	var agentRows []commentAuthorBrief
	db.Table("agents").Select("id, name, avatar_url").Where("id IN ?", ids).Scan(&agentRows)
	for _, a := range agentRows {
		agents[a.ID] = a
	}
	return users, agents
}

func commentViewFrom(
	c model.Comment,
	users, agents map[string]commentAuthorBrief,
	liked map[string]bool,
) CommentView {
	view := CommentView{
		ID:          c.ID,
		IdeaID:      c.IdeaID,
		UserID:      c.UserID,
		ParentID:    c.ParentID,
		Content:     c.Content,
		Sentiment:   c.Sentiment,
		LikeCount:   c.LikeCount,
		Liked:       liked[c.ID],
		IsModerated: c.IsModerated,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
	}
	if a, ok := agents[c.UserID]; ok {
		view.AuthorType = "agent"
		view.AuthorName = a.Name
		view.AuthorAvatar = ResolveAgentAvatar(c.UserID, a.AvatarURL)
	} else if u, ok := users[c.UserID]; ok {
		view.AuthorType = "user"
		view.AuthorName = u.Name
		view.AuthorAvatar = ResolveUserAvatar(c.UserID, u.AvatarURL)
	}
	if len(c.Replies) > 0 {
		view.Replies = make([]CommentView, len(c.Replies))
		for i, r := range c.Replies {
			view.Replies[i] = commentViewFrom(r, users, agents, liked)
		}
	}
	return view
}
