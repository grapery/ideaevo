package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/model"
)

func TestCommentService_GetComments_FiltersModerated(t *testing.T) {
	db := testDB(t)
	svc := NewCommentService(db)

	ideaID := "idea-" + uniqueSuffix()
	agentID := "agent-" + uniqueSuffix()
	require.NoError(t, db.Create(&model.Agent{ID: agentID, Name: "a", APIKeyHash: "hash-" + uniqueSuffix(), Capabilities: "[]"}).Error)
	require.NoError(t, db.Create(&model.Idea{ID: ideaID, AgentID: agentID, Title: "t", Status: "active"}).Error)

	visible, err := svc.CreateComment(CreateCommentInput{IdeaID: ideaID, UserID: "u1", Content: "visible"})
	require.NoError(t, err)
	hidden, err := svc.CreateComment(CreateCommentInput{IdeaID: ideaID, UserID: "u2", Content: "hidden"})
	require.NoError(t, err)
	require.NoError(t, svc.ModerateComment(hidden.ID, true))

	comments, err := svc.GetComments(ideaID)
	require.NoError(t, err)
	require.Len(t, comments, 1)
	assert.Equal(t, visible.ID, comments[0].ID)
}

func TestCommentService_DeleteComment_DecrementsCount(t *testing.T) {
	db := testDB(t)
	svc := NewCommentService(db)

	ideaID := "idea-" + uniqueSuffix()
	agentID := "agent-" + uniqueSuffix()
	require.NoError(t, db.Create(&model.Agent{ID: agentID, Name: "a", APIKeyHash: "hash-" + uniqueSuffix(), Capabilities: "[]"}).Error)
	require.NoError(t, db.Create(&model.Idea{ID: ideaID, AgentID: agentID, Title: "t", Status: "active"}).Error)

	comment, err := svc.CreateComment(CreateCommentInput{IdeaID: ideaID, UserID: "u1", Content: "hello"})
	require.NoError(t, err)

	var idea model.Idea
	require.NoError(t, db.First(&idea, "id = ?", ideaID).Error)
	assert.Equal(t, 1, idea.CommentCount)

	require.NoError(t, svc.DeleteComment(comment.ID, "u1"))
	require.NoError(t, db.First(&idea, "id = ?", ideaID).Error)
	assert.Equal(t, 0, idea.CommentCount)
}

func TestCommentService_ListCommentsAdmin_FilterModerated(t *testing.T) {
	db := testDB(t)
	svc := NewCommentService(db)

	ideaID := "idea-" + uniqueSuffix()
	agentID := "agent-" + uniqueSuffix()
	require.NoError(t, db.Create(&model.Agent{ID: agentID, Name: "a", APIKeyHash: "hash-" + uniqueSuffix(), Capabilities: "[]"}).Error)
	require.NoError(t, db.Create(&model.Idea{ID: ideaID, AgentID: agentID, Title: "t", Status: "active"}).Error)

	_, err := svc.CreateComment(CreateCommentInput{IdeaID: ideaID, UserID: "u1", Content: "visible"})
	require.NoError(t, err)
	hidden, err := svc.CreateComment(CreateCommentInput{IdeaID: ideaID, UserID: "u2", Content: "hidden"})
	require.NoError(t, err)
	require.NoError(t, svc.ModerateComment(hidden.ID, true))

	moderated := true
	comments, total, err := svc.ListCommentsAdmin(AdminCommentFilter{Moderated: &moderated, IdeaID: ideaID, Limit: 10})
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, comments, 1)
	assert.Equal(t, hidden.ID, comments[0].ID)
}
