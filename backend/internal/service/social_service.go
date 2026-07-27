package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

type SocialService struct {
	db      *gorm.DB
	indexer *IdeaVectorIndexer
	notif   *NotificationService
}

func NewSocialService(db *gorm.DB) *SocialService {
	return &SocialService{db: db}
}

// SetVectorIndexer 注入向量索引器（可选，关闭时 fork 不写入向量）。
func (s *SocialService) SetVectorIndexer(indexer *IdeaVectorIndexer) {
	s.indexer = indexer
}

// SetNotificationService 注入通知服务（可选，用于点赞/送花/Fork 通知）。
func (s *SocialService) SetNotificationService(notif *NotificationService) {
	s.notif = notif
}

// notifyIdeaOwner 向 idea 的 owner（agent 的创建者）发送通知（非阻塞）。
func (s *SocialService) notifyIdeaOwner(tx *gorm.DB, ideaID, actorType, actorID, actorName, action, summary string) {
	if s.notif == nil {
		return
	}
	// 通过 idea → agent → owner_user_id 解析通知接收者
	var agentID string
	if err := tx.Model(&model.Idea{}).Where("id = ?", ideaID).Pluck("agent_id", &agentID).Error; err != nil || agentID == "" {
		return
	}
	var ownerUserID string
	if err := tx.Model(&model.Agent{}).Where("id = ?", agentID).Pluck("owner_user_id", &ownerUserID).Error; err != nil || ownerUserID == "" {
		return
	}
	// self-action 守卫已在 Create 内部处理
	_ = s.notif.Create(ownerUserID, actorType, actorID, actorName, action, "idea", ideaID, summary)
}

// resolveVotingOwnerID 解析投票者的「去重主体」ownerUserID。
//   - user 直接投票 → ownerUserID = userID
//   - agent 投票 → ownerUserID = agent.owner_user_id(空则回退 agentID,即系统 agent 各自独立)
//
// 用于防刷:同一 user 拥有的所有 agent + 该 user 本人,对一个 idea 的投票合并为一个有效主体。
func (s *SocialService) resolveVotingOwnerID(tx *gorm.DB, userID, agentID string) string {
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
		return agentID // 系统 agent(无 owner):各自独立,不参与同 owner 去重
	}
	return ownerID
}

// hasOwnerVoted 检查该 ownerUserID(及其拥有的所有 agent)是否已对某 idea 投过票。
// table 为 "likes" / "wishes"。ownerID 为去重主体。
func (s *SocialService) hasOwnerVoted(tx *gorm.DB, table, ideaID, ownerID string) (bool, error) {
	if ownerID == "" {
		return false, nil
	}
	// 该 owner 本人投的票
	var ownCount int64
	if err := tx.Table(table).Where("idea_id = ? AND user_id = ?", ideaID, ownerID).Count(&ownCount).Error; err != nil {
		return false, err
	}
	if ownCount > 0 {
		return true, nil
	}
	// 该 owner 名下所有 agent 投的票
	var agentIDs []string
	if err := tx.Model(&model.Agent{}).Where("owner_user_id = ?", ownerID).Pluck("id", &agentIDs).Error; err != nil {
		return false, err
	}
	if len(agentIDs) > 0 {
		var agentCount int64
		if err := tx.Table(table).Where("idea_id = ? AND agent_id IN ?", ideaID, agentIDs).Count(&agentCount).Error; err != nil {
			return false, err
		}
		if agentCount > 0 {
			return true, nil
		}
	}
	return false, nil
}

// addWeightedScore 按投票者信誉分累加 idea 的加权分。
// 在投票成功后调用,reputation 由调用方解析。
func (s *SocialService) addWeightedScore(tx *gorm.DB, ideaID string, reputation float64) error {
	return tx.Model(&model.Idea{}).Where("id = ?", ideaID).
		UpdateColumn("weighted_score", gorm.Expr("weighted_score + ?", reputation)).Error
}

// resolveVoterReputation 解析投票者的信誉分(用于加权)。
func (s *SocialService) resolveVoterReputation(tx *gorm.DB, userID, agentID string) float64 {
	if userID != "" {
		var user model.User
		if err := tx.First(&user, "id = ?", userID).Error; err != nil {
			return 0.3
		}
		return UserReputation(&user)
	}
	if agentID != "" {
		var agent model.Agent
		if err := tx.First(&agent, "id = ?", agentID).Error; err != nil {
			return 0.3
		}
		var owner model.User
		if agent.OwnerUserID != "" {
			if err := tx.First(&owner, "id = ?", agent.OwnerUserID).Error; err != nil {
				return 0.5
			}
			return AgentReputation(&agent, &owner)
		}
		return AgentReputation(&agent, nil)
	}
	return 0.3
}

func (s *SocialService) LikeIdea(ideaID, userID, agentID string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 防刷:同一 owner(user 本人 + 其所有 agent)对一个 idea 只能投一票
		ownerID := s.resolveVotingOwnerID(tx, userID, agentID)
		if voted, err := s.hasOwnerVoted(tx, "likes", ideaID, ownerID); err != nil {
			return err
		} else if voted {
			return fmt.Errorf("已经点赞过这个想法")
		}

		like := model.Like{
			IdeaID:  ideaID,
			UserID:  userID,
			AgentID: agentID,
		}
		if err := tx.Create(&like).Error; err != nil {
			return fmt.Errorf("already liked or error: %w", err)
		}
		if err := tx.Model(&model.Idea{}).Where("id = ?", ideaID).UpdateColumn("like_count", gorm.Expr("like_count + 1")).Error; err != nil {
			return err
		}
		// 加权:按投票者信誉分累加 weighted_score
		reputation := s.resolveVoterReputation(tx, userID, agentID)
		if err := s.addWeightedScore(tx, ideaID, reputation); err != nil {
			return err
		}

		actorType := "agent"
		actorID := agentID
		if userID != "" {
			actorType = "user"
			actorID = userID
		}
		logActivity(tx, actorType, actorID, "like", "idea", ideaID, nil)
		s.notifyIdeaOwner(tx, ideaID, actorType, actorID, "", "like", "")
		return nil
	})
}

func (s *SocialService) UnlikeIdea(ideaID, userID, agentID string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		result := tx.Where("idea_id = ? AND (user_id = ? OR agent_id = ?)", ideaID, userID, agentID).Delete(&model.Like{})
		if result.RowsAffected > 0 {
			if err := tx.Model(&model.Idea{}).Where("id = ?", ideaID).UpdateColumn("like_count", gorm.Expr("GREATEST(like_count - 1, 0)")).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *SocialService) HasLikedIdea(ideaID, userID, agentID string) bool {
	var count int64
	q := s.db.Model(&model.Like{}).Where("idea_id = ?", ideaID)
	if userID != "" {
		q = q.Where("user_id = ?", userID)
	} else if agentID != "" {
		q = q.Where("agent_id = ?", agentID)
	} else {
		return false
	}
	q.Count(&count)
	return count > 0
}

// WishIdea 表达「期待」（与 LikeIdea 同构）。作为轻量排序信号，不进 Feed、不推送。
// 同样有防刷:同一 owner 只能投一次。
func (s *SocialService) WishIdea(ideaID, userID, agentID string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 防刷:同一 owner(user 本人 + 其所有 agent)对一个 idea 只能投一票
		ownerID := s.resolveVotingOwnerID(tx, userID, agentID)
		if voted, err := s.hasOwnerVoted(tx, "wishes", ideaID, ownerID); err != nil {
			return err
		} else if voted {
			return fmt.Errorf("已经期待过这个想法")
		}

		wish := model.Wish{
			IdeaID:  ideaID,
			UserID:  userID,
			AgentID: agentID,
		}
		if err := tx.Create(&wish).Error; err != nil {
			return fmt.Errorf("already wished or error: %w", err)
		}
		if err := tx.Model(&model.Idea{}).Where("id = ?", ideaID).UpdateColumn("wish_count", gorm.Expr("wish_count + 1")).Error; err != nil {
			return err
		}
		// 加权:按投票者信誉分累加 weighted_score(wish 是热榜主指标,加权尤其重要)
		reputation := s.resolveVoterReputation(tx, userID, agentID)
		if err := s.addWeightedScore(tx, ideaID, reputation); err != nil {
			return err
		}
		return nil
	})
}

func (s *SocialService) UnwishIdea(ideaID, userID, agentID string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		result := tx.Where("idea_id = ? AND (user_id = ? OR agent_id = ?)", ideaID, userID, agentID).Delete(&model.Wish{})
		if result.RowsAffected > 0 {
			if err := tx.Model(&model.Idea{}).Where("id = ?", ideaID).UpdateColumn("wish_count", gorm.Expr("GREATEST(wish_count - 1, 0)")).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *SocialService) HasWishedIdea(ideaID, userID, agentID string) bool {
	var count int64
	q := s.db.Model(&model.Wish{}).Where("idea_id = ?", ideaID)
	if userID != "" {
		q = q.Where("user_id = ?", userID)
	} else if agentID != "" {
		q = q.Where("agent_id = ?", agentID)
	} else {
		return false
	}
	q.Count(&count)
	return count > 0
}

type SendFlowersInput struct {
	IdeaID  string `json:"idea_id"`
	UserID  string `json:"user_id"`
	AgentID string `json:"agent_id"`
	Message string `json:"message"`
}

func (s *SocialService) SendFlowers(input SendFlowersInput) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		flower := model.Flower{
			IdeaID:  input.IdeaID,
			UserID:  input.UserID,
			AgentID: input.AgentID,
			Message: input.Message,
		}
		if err := tx.Create(&flower).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.Idea{}).Where("id = ?", input.IdeaID).UpdateColumn("flower_count", gorm.Expr("flower_count + 1")).Error; err != nil {
			return err
		}

		actorType := "agent"
		actorID := input.AgentID
		if input.UserID != "" {
			actorType = "user"
			actorID = input.UserID
		}
		logActivity(tx, actorType, actorID, "flower", "idea", input.IdeaID, map[string]string{"message": input.Message})
		s.notifyIdeaOwner(tx, input.IdeaID, actorType, actorID, "", "flower", input.Message)
		return nil
	})
}

type ForkIdeaInput struct {
	IdeaID          string `json:"idea_id"`
	SourceVersionID string `json:"source_version_id"`
	AgentID         string `json:"agent_id"`
	Title           string `json:"title" binding:"required"`
	Description     string `json:"description" binding:"required"`
	Reason          string `json:"reason" binding:"required"`
	Category        string `json:"category"`
}

func (s *SocialService) ForkIdea(input ForkIdeaInput) (*model.Idea, error) {
	var idea *model.Idea
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var original model.Idea
		if err := tx.First(&original, "id = ?", input.IdeaID).Error; err != nil {
			return fmt.Errorf("original idea not found: %w", err)
		}

		var sourceVersion model.IdeaVersion
		versionQuery := tx.Where("idea_id = ?", input.IdeaID)
		if input.SourceVersionID != "" {
			versionQuery = versionQuery.Where("id = ?", input.SourceVersionID)
		} else {
			versionQuery = versionQuery.Order("version DESC")
		}
		if err := versionQuery.First(&sourceVersion).Error; err != nil {
			return fmt.Errorf("source version not found: %w", err)
		}

		// 同一 Agent 可从同一 Idea 的不同版本建立分支，但不能重复
		// Fork 同一个不可变版本。
		var existing model.Fork
		if err := tx.Where("source_idea_id = ? AND source_version_id = ? AND agent_id = ?", input.IdeaID, sourceVersion.ID, input.AgentID).First(&existing).Error; err == nil {
			return fmt.Errorf("you have already forked this version: %s", existing.NewIdeaID)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		cat := input.Category
		if cat == "" {
			cat = sourceVersion.Category
			if cat == "" {
				cat = original.Category
			}
		}
		tags := sourceVersion.Tags
		if tags == "" {
			tags = original.Tags
		}

		idea = &model.Idea{
			AgentID:      input.AgentID,
			Title:        input.Title,
			Description:  input.Description,
			Status:       model.IdeaStatusActive,
			Category:     cat,
			Tags:         tags,
			RepoURL:      sourceVersion.RepoURL,
			DemoURL:      sourceVersion.DemoURL,
			ImplStatus:   sourceVersion.ImplStatus,
			ForkedFromID: &input.IdeaID,
		}
		if err := tx.Create(idea).Error; err != nil {
			return err
		}

		if err := AppendIdeaVersion(tx, idea, "初始版本"); err != nil {
			return err
		}

		fork := &model.Fork{
			SourceIdeaID:    input.IdeaID,
			SourceVersionID: &sourceVersion.ID,
			NewIdeaID:       idea.ID,
			AgentID:         input.AgentID,
			Reason:          input.Reason,
		}
		if err := tx.Create(fork).Error; err != nil {
			return err
		}

		if err := tx.Model(&model.Idea{}).Where("id = ?", input.IdeaID).UpdateColumn("fork_count", gorm.Expr("fork_count + 1")).Error; err != nil {
			return err
		}

		logActivity(tx, "agent", input.AgentID, ActionFork, "idea", input.IdeaID, map[string]string{"new_idea_id": idea.ID})
		s.notifyIdeaOwner(tx, input.IdeaID, "agent", input.AgentID, "", "fork", "")
		return nil
	})

	// fork 出来的新 idea 也要索引（事务外异步执行）
	if err == nil && s.indexer != nil && idea != nil {
		s.indexer.IndexIdea(idea)
	}

	return idea, err
}

func (s *SocialService) GetForks(ideaID string) ([]model.Fork, error) {
	var forks []model.Fork
	if err := s.db.Where("source_idea_id = ?", ideaID).Find(&forks).Error; err != nil {
		return nil, err
	}
	return forks, nil
}

type IdeaLineageStats struct {
	TotalForks     int `json:"total_forks"`
	ActiveBranches int `json:"active_branches"`
	Contributors   int `json:"contributors"`
}

type IdeaLineage struct {
	Idea           model.Idea         `json:"idea"`
	CurrentVersion model.IdeaVersion  `json:"current_version"`
	Origin         *model.Fork        `json:"origin,omitempty"`
	SourceIdea     *model.Idea        `json:"source_idea,omitempty"`
	SourceVersion  *model.IdeaVersion `json:"source_version,omitempty"`
	Children       []model.Idea       `json:"children"`
	Stats          IdeaLineageStats   `json:"stats"`
}

// GetIdeaLineage returns authoritative version-aware provenance in one query
// contract so clients never infer a fork's source from the parent's latest version.
func (s *SocialService) GetIdeaLineage(ideaID string) (*IdeaLineage, error) {
	var idea model.Idea
	if err := s.db.Preload("Agent").First(&idea, "id = ?", ideaID).Error; err != nil {
		return nil, err
	}
	EnrichIdea(&idea)
	if err := s.ensureVersions(ideaID); err != nil {
		return nil, err
	}

	var currentVersion model.IdeaVersion
	if err := s.db.Where("idea_id = ?", ideaID).Order("version DESC").First(&currentVersion).Error; err != nil {
		return nil, err
	}

	children, err := s.GetPublicForkChildren(ideaID)
	if err != nil {
		return nil, err
	}
	if children == nil {
		children = []model.Idea{}
	}
	contributors := map[string]struct{}{}
	for _, child := range children {
		contributors[child.AgentID] = struct{}{}
	}

	result := &IdeaLineage{
		Idea:           idea,
		CurrentVersion: currentVersion,
		Children:       children,
		Stats: IdeaLineageStats{
			TotalForks:     idea.ForkCount,
			ActiveBranches: len(children),
			Contributors:   len(contributors),
		},
	}

	var origin model.Fork
	if err := s.db.Where("new_idea_id = ?", ideaID).Order("created_at DESC").First(&origin).Error; err == nil {
		result.Origin = &origin
		var source model.Idea
		if err := s.db.Preload("Agent").First(&source, "id = ?", origin.SourceIdeaID).Error; err != nil {
			return nil, err
		}
		EnrichIdea(&source)
		result.SourceIdea = &source
		if origin.SourceVersionID != nil {
			var sourceVersion model.IdeaVersion
			if err := s.db.First(&sourceVersion, "id = ? AND idea_id = ?", *origin.SourceVersionID, origin.SourceIdeaID).Error; err != nil {
				return nil, err
			}
			result.SourceVersion = &sourceVersion
		}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	return result, nil
}

func (s *SocialService) ensureVersions(ideaID string) error {
	var count int64
	if err := s.db.Model(&model.IdeaVersion{}).Where("idea_id = ?", ideaID).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	var idea model.Idea
	if err := s.db.First(&idea, "id = ?", ideaID).Error; err != nil {
		return err
	}
	return AppendIdeaVersion(s.db, &idea, "初始版本")
}

// GetPublicForkChildren 返回从该 idea 直接 fork 出来的、公开可见的子 idea。
func (s *SocialService) GetPublicForkChildren(ideaID string) ([]model.Idea, error) {
	var forkIDs []string
	if err := s.db.Model(&model.Fork{}).
		Where("source_idea_id = ?", ideaID).
		Pluck("new_idea_id", &forkIDs).Error; err != nil {
		return nil, err
	}
	if len(forkIDs) == 0 {
		return nil, nil
	}

	var ideas []model.Idea
	err := s.db.Preload("Agent").
		Joins("JOIN agents ON agents.id = ideas.agent_id").
		Where("ideas.id IN ?", forkIDs).
		Where("ideas.status = ?", model.IdeaStatusActive).
		Where("(agents.visibility = ? OR agents.visibility = ? OR agents.visibility IS NULL OR agents.visibility = '')", "public", "").
		Order("ideas.created_at DESC").
		Find(&ideas).Error
	if err != nil {
		return nil, err
	}
	EnrichIdeas(ideas)
	return ideas, nil
}

// FlowerDonorView 送花者展示信息（头像 + 名称）。
type FlowerDonorView struct {
	UserID    string    `json:"user_id,omitempty"`
	AgentID   string    `json:"agent_id,omitempty"`
	Name      string    `json:"name"`
	AvatarURL string    `json:"avatar_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// GetFlowerDonors 返回某 idea 的去重送花者列表（按最近一次送花时间排序）。
func (s *SocialService) GetFlowerDonors(ideaID string, limit int) ([]FlowerDonorView, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	var flowers []model.Flower
	if err := s.db.Where("idea_id = ?", ideaID).
		Order("created_at DESC").
		Find(&flowers).Error; err != nil {
		return nil, err
	}

	type actorSlot struct {
		userID    string
		agentID   string
		createdAt time.Time
	}
	seen := make(map[string]struct{})
	slots := make([]actorSlot, 0, limit)
	userIDs := make([]string, 0)
	agentIDs := make([]string, 0)

	for _, f := range flowers {
		var key string
		slot := actorSlot{createdAt: f.CreatedAt}
		switch {
		case f.UserID != "":
			key = "u:" + f.UserID
			slot.userID = f.UserID
		case f.AgentID != "":
			key = "a:" + f.AgentID
			slot.agentID = f.AgentID
		default:
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		slots = append(slots, slot)
		if slot.userID != "" {
			userIDs = append(userIDs, slot.userID)
		} else {
			agentIDs = append(agentIDs, slot.agentID)
		}
		if len(slots) >= limit {
			break
		}
	}

	userMap := make(map[string]model.User)
	if len(userIDs) > 0 {
		var users []model.User
		if err := s.db.Where("id IN ?", userIDs).Find(&users).Error; err != nil {
			return nil, err
		}
		for _, u := range users {
			userMap[u.ID] = u
		}
	}
	agentMap := make(map[string]model.Agent)
	if len(agentIDs) > 0 {
		var agents []model.Agent
		if err := s.db.Where("id IN ?", agentIDs).Find(&agents).Error; err != nil {
			return nil, err
		}
		for _, a := range agents {
			agentMap[a.ID] = a
		}
	}

	donors := make([]FlowerDonorView, 0, len(slots))
	for _, slot := range slots {
		if slot.userID != "" {
			user, ok := userMap[slot.userID]
			if !ok {
				continue
			}
			avatar := user.AvatarURL
			if avatar == "" {
				avatar = DefaultAvatarURL(user.ID)
			}
			donors = append(donors, FlowerDonorView{
				UserID:    user.ID,
				Name:      user.Name,
				AvatarURL: avatar,
				CreatedAt: slot.createdAt,
			})
			continue
		}
		agent, ok := agentMap[slot.agentID]
		if !ok {
			continue
		}
		avatar := agent.AvatarURL
		if avatar == "" {
			avatar = DefaultAgentAvatarURL(agent.ID)
		}
		donors = append(donors, FlowerDonorView{
			AgentID:   agent.ID,
			Name:      agent.Name,
			AvatarURL: avatar,
			CreatedAt: slot.createdAt,
		})
	}
	return donors, nil
}

// ShareIdea 记录一次"分享"活动事件（轻量转推语义，类似 GitHub/Twitter 转发）：
// 不复制 idea、不改任何计数，只在活动流里留下一条 share 记录，
// 这样它能出现在全局 / 关注 feed 流的白名单里。
// actorType/actorID 由调用方解析（agent 或 user）。
func (s *SocialService) ShareIdea(ideaID, actorType, actorID string) error {
	var count int64
	if err := s.db.Model(&model.Idea{}).Where("id = ? AND status = ?", ideaID, model.IdeaStatusActive).Count(&count).Error; err != nil {
		return fmt.Errorf("check idea failed: %w", err)
	}
	if count == 0 {
		return fmt.Errorf("idea not found or not active")
	}
	if actorID == "" {
		return fmt.Errorf("share requires an authenticated actor")
	}
	logActivity(s.db, actorType, actorID, ActionShare, "idea", ideaID, nil)
	return nil
}

// ---- emoji 反应（针对 idea，单选切换语义）----

// ReactToIdea 给 idea 加或切换 emoji 反应。同一 actor（user 或 agent）对同一 idea
// 只保留一个 emoji：已存在则 UPDATE，不存在则 INSERT。不记 activity（避免刷屏）。
func (s *SocialService) ReactToIdea(ideaID, userID, agentID, emoji string) error {
	if !model.IsAllowedEmoji(emoji) {
		return fmt.Errorf("unsupported emoji: %s", emoji)
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		var existing model.Reaction
		err := tx.Where("idea_id = ? AND (user_id = ? OR agent_id = ?)", ideaID, userID, agentID).First(&existing).Error
		if err == nil {
			// 已有反应 → 更新 emoji
			return tx.Model(&existing).Update("emoji", emoji).Error
		}
		// 不存在 → 新建
		r := &model.Reaction{IdeaID: ideaID, UserID: userID, AgentID: agentID, Emoji: emoji}
		return tx.Create(r).Error
	})
}

// UnreactIdea 移除当前 actor 对 idea 的反应。
func (s *SocialService) UnreactIdea(ideaID, userID, agentID string) error {
	return s.db.Where("idea_id = ? AND (user_id = ? OR agent_id = ?)", ideaID, userID, agentID).
		Delete(&model.Reaction{}).Error
}

// GetReactionCounts 返回某 idea 各 emoji 的计数 {👍:3, 🎉:1, ...}。
func (s *SocialService) GetReactionCounts(ideaID string) (map[string]int, error) {
	type emojiCount struct {
		Emoji string
		Cnt   int
	}
	var rows []emojiCount
	if err := s.db.Model(&model.Reaction{}).
		Select("emoji, COUNT(*) as cnt").
		Where("idea_id = ?", ideaID).
		Group("emoji").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	counts := make(map[string]int, len(rows))
	for _, r := range rows {
		counts[r.Emoji] = r.Cnt
	}
	return counts, nil
}

// GetMyReaction 返回当前 actor 对 idea 的 emoji（空=未反应）。
func (s *SocialService) GetMyReaction(ideaID, userID, agentID string) (string, error) {
	var r model.Reaction
	err := s.db.Where("idea_id = ? AND (user_id = ? OR agent_id = ?)", ideaID, userID, agentID).First(&r).Error
	if err != nil {
		return "", nil // 未反应不报错
	}
	return r.Emoji, nil
}

// GetBulkReactionCounts 批量返回多个 idea 的 reaction 计数，供 activity hydrate 用。
// 返回 map[ideaID]map[emoji]count。
func (s *SocialService) GetBulkReactionCounts(ideaIDs []string) (map[string]map[string]int, error) {
	result := make(map[string]map[string]int)
	if len(ideaIDs) == 0 {
		return result, nil
	}
	type row struct {
		IdeaID string
		Emoji  string
		Cnt    int
	}
	var rows []row
	if err := s.db.Model(&model.Reaction{}).
		Select("idea_id, emoji, COUNT(*) as cnt").
		Where("idea_id IN ?", ideaIDs).
		Group("idea_id, emoji").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		if result[r.IdeaID] == nil {
			result[r.IdeaID] = make(map[string]int)
		}
		result[r.IdeaID][r.Emoji] = r.Cnt
	}
	return result, nil
}
