package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/model"
)

func TestModerationService_BlockLifecycleAndInteractionGuard(t *testing.T) {
	db := testDB(t)
	suffix := uniqueSuffix()
	blocker := model.User{
		Name:         "blocker-" + suffix,
		Email:        "blocker-" + suffix + "@example.com",
		AuthProvider: "email",
	}
	blocked := model.User{
		Name:         "blocked-" + suffix,
		Email:        "blocked-" + suffix + "@example.com",
		AuthProvider: "email",
	}
	require.NoError(t, db.Create(&blocker).Error)
	require.NoError(t, db.Create(&blocked).Error)

	require.NoError(t, db.Create(&model.Follow{FollowerID: blocker.ID, FollowingID: blocked.ID}).Error)
	require.NoError(t, db.Create(&model.Follow{FollowerID: blocked.ID, FollowingID: blocker.ID}).Error)
	require.NoError(t, db.Model(&blocker).Updates(map[string]any{"follower_count": 1, "following_count": 1}).Error)
	require.NoError(t, db.Model(&blocked).Updates(map[string]any{"follower_count": 1, "following_count": 1}).Error)

	t.Cleanup(func() {
		db.Where("blocker_id IN ? OR blocked_id IN ?", []string{blocker.ID, blocked.ID}, []string{blocker.ID, blocked.ID}).
			Delete(&model.UserBlock{})
		db.Where("follower_id IN ? OR following_id IN ?", []string{blocker.ID, blocked.ID}, []string{blocker.ID, blocked.ID}).
			Delete(&model.Follow{})
		db.Unscoped().Delete(&model.User{}, blocker.ID)
		db.Unscoped().Delete(&model.User{}, blocked.ID)
	})

	svc := NewModerationService(db)
	require.NoError(t, svc.BlockUser(blocker.ID, blocked.ID))
	// 重复屏蔽是幂等操作。
	require.NoError(t, svc.BlockUser(blocker.ID, blocked.ID))

	isBlocked, blockedBy, err := svc.BlockStatus(blocker.ID, blocked.ID)
	require.NoError(t, err)
	assert.True(t, isBlocked)
	assert.False(t, blockedBy)
	assert.ErrorContains(t, svc.EnsureUsersCanInteract(blocker.ID, blocked.ID), "interaction blocked")

	var followCount int64
	require.NoError(t, db.Model(&model.Follow{}).
		Where("(follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)",
			blocker.ID, blocked.ID, blocked.ID, blocker.ID).
		Count(&followCount).Error)
	assert.Zero(t, followCount)

	require.NoError(t, db.First(&blocker, "id = ?", blocker.ID).Error)
	require.NoError(t, db.First(&blocked, "id = ?", blocked.ID).Error)
	assert.Zero(t, blocker.FollowerCount)
	assert.Zero(t, blocker.FollowingCount)
	assert.Zero(t, blocked.FollowerCount)
	assert.Zero(t, blocked.FollowingCount)

	require.NoError(t, svc.UnblockUser(blocker.ID, blocked.ID))
	assert.NoError(t, svc.EnsureUsersCanInteract(blocker.ID, blocked.ID))
}

func TestModerationService_BlocksIdeaOwnerInteractions(t *testing.T) {
	db := testDB(t)
	suffix := uniqueSuffix()
	actor := model.User{
		Name:         "actor-" + suffix,
		Email:        "actor-" + suffix + "@example.com",
		AuthProvider: "email",
	}
	owner := model.User{
		Name:         "owner-" + suffix,
		Email:        "owner-" + suffix + "@example.com",
		AuthProvider: "email",
	}
	require.NoError(t, db.Create(&actor).Error)
	require.NoError(t, db.Create(&owner).Error)
	agent := model.Agent{
		Name:         "owner-agent-" + suffix,
		APIKeyHash:   "owner-agent-hash-" + suffix,
		OwnerUserID:  owner.ID,
		Capabilities: "[]",
	}
	require.NoError(t, db.Create(&agent).Error)
	idea := model.Idea{
		AgentID:     agent.ID,
		Title:       "blocked-idea-" + suffix,
		Description: "blocked interaction test",
		Status:      model.IdeaStatusActive,
	}
	require.NoError(t, db.Create(&idea).Error)

	t.Cleanup(func() {
		db.Where("idea_id = ?", idea.ID).Delete(&model.Comment{})
		db.Where("blocker_id IN ? OR blocked_id IN ?", []string{actor.ID, owner.ID}, []string{actor.ID, owner.ID}).
			Delete(&model.UserBlock{})
		db.Delete(&model.Idea{}, idea.ID)
		db.Delete(&model.Agent{}, agent.ID)
		db.Unscoped().Delete(&model.User{}, actor.ID)
		db.Unscoped().Delete(&model.User{}, owner.ID)
	})

	modSvc := NewModerationService(db)
	require.NoError(t, modSvc.BlockUser(owner.ID, actor.ID))

	commentSvc := NewCommentService(db)
	commentSvc.SetModerationService(modSvc)
	_, err := commentSvc.CreateComment(CreateCommentInput{
		IdeaID:  idea.ID,
		UserID:  actor.ID,
		Content: "should be rejected",
	})
	assert.ErrorContains(t, err, "interaction blocked")

	socialSvc := NewSocialService(db)
	socialSvc.SetModerationService(modSvc)
	assert.ErrorContains(t, socialSvc.LikeIdea(idea.ID, actor.ID, ""), "interaction blocked")
	assert.ErrorContains(t, socialSvc.WishIdea(idea.ID, actor.ID, ""), "interaction blocked")
}
