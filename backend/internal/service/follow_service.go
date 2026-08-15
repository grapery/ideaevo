package service

import (
	"fmt"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

type FollowService struct {
	db       *gorm.DB
	notifSvc *NotificationService
	modSvc   *ModerationService
}

func NewFollowService(db *gorm.DB, notifSvc *NotificationService) *FollowService {
	return &FollowService{db: db, notifSvc: notifSvc}
}

func (s *FollowService) SetModerationService(modSvc *ModerationService) {
	s.modSvc = modSvc
}

func (s *FollowService) Follow(followerID, followingID string) error {
	if followerID == followingID {
		return fmt.Errorf("cannot follow yourself")
	}

	var count int64
	s.db.Model(&model.User{}).Where("id = ?", followingID).Count(&count)
	if count == 0 {
		return fmt.Errorf("user not found")
	}
	if s.modSvc != nil {
		if err := s.modSvc.EnsureUsersCanInteract(followerID, followingID); err != nil {
			return err
		}
	}

	follow := model.Follow{
		FollowerID:  followerID,
		FollowingID: followingID,
	}
	if err := s.db.Create(&follow).Error; err != nil {
		return fmt.Errorf("already following or error: %w", err)
	}

	tx := s.db.Begin()
	tx.Model(&model.User{}).Where("id = ?", followingID).
		Update("follower_count", gorm.Expr("follower_count + 1"))
	tx.Model(&model.User{}).Where("id = ?", followerID).
		Update("following_count", gorm.Expr("following_count + 1"))
	tx.Commit()

	logActivity(s.db, "user", followerID, "follow", "user", followingID, nil)

	var follower model.User
	if err := s.db.Select("id, name").First(&follower, "id = ?", followerID).Error; err == nil {
		_ = s.notifSvc.Create(followingID, "user", followerID, follower.Name, "follow", "user", followerID, "")
	}
	return nil
}

func (s *FollowService) Unfollow(followerID, followingID string) error {
	result := s.db.Where("follower_id = ? AND following_id = ?", followerID, followingID).
		Delete(&model.Follow{})
	if result.RowsAffected == 0 {
		return fmt.Errorf("not following")
	}

	tx := s.db.Begin()
	tx.Model(&model.User{}).Where("id = ?", followingID).
		Update("follower_count", gorm.Expr("GREATEST(follower_count - 1, 0)"))
	tx.Model(&model.User{}).Where("id = ?", followerID).
		Update("following_count", gorm.Expr("GREATEST(following_count - 1, 0)"))
	tx.Commit()

	logActivity(s.db, "user", followerID, "unfollow", "user", followingID, nil)
	return nil
}

func (s *FollowService) GetFollowers(userID string, limit, offset int) ([]model.User, int64, error) {
	var total int64
	s.db.Model(&model.Follow{}).Where("following_id = ?", userID).Count(&total)

	var follows []model.Follow
	s.db.Where("following_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Preload("Follower").
		Find(&follows)

	users := make([]model.User, 0, len(follows))
	for _, f := range follows {
		users = append(users, f.Follower)
	}
	return users, total, nil
}

func (s *FollowService) GetFollowing(userID string, limit, offset int) ([]model.User, int64, error) {
	var total int64
	s.db.Model(&model.Follow{}).Where("follower_id = ?", userID).Count(&total)

	var follows []model.Follow
	s.db.Where("follower_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Preload("Following").
		Find(&follows)

	users := make([]model.User, 0, len(follows))
	for _, f := range follows {
		users = append(users, f.Following)
	}
	return users, total, nil
}

func (s *FollowService) IsFollowing(followerID, followingID string) (bool, error) {
	var count int64
	s.db.Model(&model.Follow{}).Where("follower_id = ? AND following_id = ?", followerID, followingID).Count(&count)
	return count > 0, nil
}

func (s *FollowService) FollowingIDsAmong(viewerID string, userIDs []string) ([]string, error) {
	if viewerID == "" || len(userIDs) == 0 {
		return nil, nil
	}
	var follows []model.Follow
	if err := s.db.Where("follower_id = ? AND following_id IN ?", viewerID, userIDs).
		Find(&follows).Error; err != nil {
		return nil, err
	}
	out := make([]string, 0, len(follows))
	for _, f := range follows {
		out = append(out, f.FollowingID)
	}
	return out, nil
}

func (s *FollowService) FollowAgent(userID, agentID string) error {
	var agent model.Agent
	if err := s.db.Where("id = ?", agentID).First(&agent).Error; err != nil {
		return fmt.Errorf("agent not found")
	}

	// 权限校验：agent 关闭了关注
	if agent.AllowFollow != nil && !*agent.AllowFollow {
		return fmt.Errorf("this agent does not allow follows")
	}
	if s.modSvc != nil {
		if err := s.modSvc.EnsureUsersCanInteract(userID, agent.OwnerUserID); err != nil {
			return err
		}
	}

	follow := model.AgentFollow{
		UserID:  userID,
		AgentID: agentID,
	}
	if err := s.db.Create(&follow).Error; err != nil {
		return fmt.Errorf("already following or error: %w", err)
	}

	logActivity(s.db, "user", userID, "follow", "agent", agentID, nil)
	return nil
}

func (s *FollowService) UnfollowAgent(userID, agentID string) error {
	result := s.db.Where("user_id = ? AND agent_id = ?", userID, agentID).
		Delete(&model.AgentFollow{})
	if result.RowsAffected == 0 {
		return fmt.Errorf("not following")
	}

	logActivity(s.db, "user", userID, "unfollow", "agent", agentID, nil)
	return nil
}

func (s *FollowService) IsFollowingAgent(userID, agentID string) (bool, error) {
	var count int64
	s.db.Model(&model.AgentFollow{}).Where("user_id = ? AND agent_id = ?", userID, agentID).Count(&count)
	return count > 0, nil
}

// FollowedActor 是一个被关注的主体（agent 或 user），用于关注流过滤活动。
type FollowedActor struct {
	Type string // "agent" | "user"
	ID   string
}

// FollowedActors 返回 userID 关注的所有主体：关注的 agent（agent_follows）
// 与 follow 的用户（follows）合并。供关注流按 (actor_type, actor_id) 过滤活动用。
func (s *FollowService) FollowedActors(userID string) ([]FollowedActor, error) {
	var agentFollows []model.AgentFollow
	if err := s.db.Where("user_id = ?", userID).Find(&agentFollows).Error; err != nil {
		return nil, err
	}
	var userFollows []model.Follow
	if err := s.db.Where("follower_id = ?", userID).Find(&userFollows).Error; err != nil {
		return nil, err
	}

	actors := make([]FollowedActor, 0, len(agentFollows)+len(userFollows))
	for _, af := range agentFollows {
		actors = append(actors, FollowedActor{Type: "agent", ID: af.AgentID})
	}
	for _, uf := range userFollows {
		actors = append(actors, FollowedActor{Type: "user", ID: uf.FollowingID})
	}
	return actors, nil
}

// AgentFollowAgent lets an agent follow another agent (dual-species social graph).
func (s *FollowService) AgentFollowAgent(followerAgentID, targetAgentID string) error {
	if followerAgentID == targetAgentID {
		return fmt.Errorf("cannot follow self")
	}
	var target model.Agent
	if err := s.db.Where("id = ?", targetAgentID).First(&target).Error; err != nil {
		return fmt.Errorf("agent not found")
	}
	if target.AllowFollow != nil && !*target.AllowFollow {
		return fmt.Errorf("this agent does not allow follows")
	}

	follow := model.AgentPeerFollow{
		FollowerAgentID: followerAgentID,
		TargetAgentID:   targetAgentID,
	}
	if err := s.db.Create(&follow).Error; err != nil {
		return fmt.Errorf("already following or error: %w", err)
	}

	logActivity(s.db, "agent", followerAgentID, "follow", "agent", targetAgentID, nil)

	if s.notifSvc != nil && target.OwnerUserID != "" {
		var follower model.Agent
		if err := s.db.Select("id, name").First(&follower, "id = ?", followerAgentID).Error; err == nil {
			_ = s.notifSvc.Create(target.OwnerUserID, "agent", followerAgentID, follower.Name, "follow", "agent", targetAgentID, "")
		}
	}
	return nil
}

// AgentUnfollowAgent lets an agent unfollow another agent.
func (s *FollowService) AgentUnfollowAgent(followerAgentID, targetAgentID string) error {
	result := s.db.Where("follower_agent_id = ? AND target_agent_id = ?", followerAgentID, targetAgentID).
		Delete(&model.AgentPeerFollow{})
	if result.RowsAffected == 0 {
		return fmt.Errorf("not following")
	}
	logActivity(s.db, "agent", followerAgentID, "unfollow", "agent", targetAgentID, nil)
	return nil
}

// GetAgentFollowers returns users who follow the given agent (user→agent).
func (s *FollowService) GetAgentFollowers(agentID string, limit, offset int) ([]model.User, int64, error) {
	var total int64
	s.db.Model(&model.AgentFollow{}).Where("agent_id = ?", agentID).Count(&total)

	var follows []model.AgentFollow
	if err := s.db.Where("agent_id = ?", agentID).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&follows).Error; err != nil {
		return nil, 0, err
	}
	if len(follows) == 0 {
		return []model.User{}, total, nil
	}
	ids := make([]string, len(follows))
	for i, f := range follows {
		ids[i] = f.UserID
	}
	var users []model.User
	if err := s.db.Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, 0, err
	}
	// Preserve follow order.
	byID := make(map[string]model.User, len(users))
	for _, u := range users {
		byID[u.ID] = u
	}
	ordered := make([]model.User, 0, len(follows))
	for _, f := range follows {
		if u, ok := byID[f.UserID]; ok {
			ordered = append(ordered, u)
		}
	}
	return ordered, total, nil
}

// IsAgentFollowingAgent reports whether followerAgent follows targetAgent.
func (s *FollowService) IsAgentFollowingAgent(followerAgentID, targetAgentID string) (bool, error) {
	var count int64
	err := s.db.Model(&model.AgentPeerFollow{}).
		Where("follower_agent_id = ? AND target_agent_id = ?", followerAgentID, targetAgentID).
		Count(&count).Error
	return count > 0, err
}
