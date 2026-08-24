package service

// overview_service.go —— 私域自查视图（双视图宗旨的第一翼：用户了解自己在做什么、做的如何）。
//
// OverviewService: 跨 idea 的进度总览 + 实现任务计数。
// Web 工作区（GET /api/user/overview）与 MCP get_my_overview 共用，
// 让用户在网页和自己的 AI 工具里看到同一份事实。

import (
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// IdeaProgressSummary 单个 idea 的进度摘要。
type IdeaProgressSummary struct {
	IdeaID         string     `json:"idea_id"`
	Title          string     `json:"title"`
	Status         string     `json:"status"`
	ImplStatus     string     `json:"impl_status,omitempty"`
	Todos          int        `json:"todos"`
	Dones          int        `json:"dones"`
	LastProgressAt *time.Time `json:"last_progress_at,omitempty"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// WorkspaceOverview 私域总览：idea 进度（按更新时间倒序，上限 50）+ 未结任务计数。
type WorkspaceOverview struct {
	Ideas []IdeaProgressSummary `json:"ideas"`
	// pending / in_progress 任务计数（建议派生的实现任务）
	Jobs        map[string]int `json:"jobs"`
	GeneratedAt time.Time      `json:"generated_at"`
}

type OverviewService struct {
	db *gorm.DB
}

func NewOverviewService(db *gorm.DB) *OverviewService {
	return &OverviewService{db: db}
}

// OwnerOverview 聚合某用户名下全部 agent 的 idea 进度与任务计数。
func (s *OverviewService) OwnerOverview(ownerUserID string) (*WorkspaceOverview, error) {
	return s.overview("agents.owner_user_id = ?", ownerUserID, ownerUserID)
}

// AgentOverview 聚合单个 agent 的 idea 进度（owner 的任务计数一并给出，MCP 用）。
func (s *OverviewService) AgentOverview(agentID string) (*WorkspaceOverview, error) {
	var agent model.Agent
	if err := s.db.First(&agent, "id = ?", agentID).Error; err != nil {
		return nil, err
	}
	return s.overview("ideas.agent_id = ?", agentID, agent.OwnerUserID)
}

func (s *OverviewService) overview(where, arg, jobsOwner string) (*WorkspaceOverview, error) {
	out := &WorkspaceOverview{Ideas: []IdeaProgressSummary{}, Jobs: map[string]int{}, GeneratedAt: time.Now()}

	if err := s.db.Table("ideas").
		Select("ideas.id AS idea_id, ideas.title, ideas.status, ideas.impl_status, ideas.updated_at").
		Joins("JOIN agents ON agents.id = ideas.agent_id").
		Where(where, arg).
		Order("ideas.updated_at DESC").
		Limit(50).
		Scan(&out.Ideas).Error; err != nil {
		return nil, err
	}

	ids := make([]string, 0, len(out.Ideas))
	idx := make(map[string]*IdeaProgressSummary, len(out.Ideas))
	for i := range out.Ideas {
		ids = append(ids, out.Ideas[i].IdeaID)
		idx[out.Ideas[i].IdeaID] = &out.Ideas[i]
	}
	if len(ids) > 0 {
		type cntRow struct {
			IdeaID string
			Status string
			Cnt    int
		}
		var cnts []cntRow
		if err := s.db.Table("idea_progress_items").
			Select("idea_id, status, COUNT(*) AS cnt").
			Where("idea_id IN ?", ids).
			Group("idea_id, status").Scan(&cnts).Error; err != nil {
			return nil, err
		}
		for _, c := range cnts {
			if sum, ok := idx[c.IdeaID]; ok {
				if c.Status == ProgressStatusDone {
					sum.Dones = c.Cnt
				} else {
					sum.Todos = c.Cnt
				}
			}
		}
		// 最近一次进度动作时间（完成时间与创建时间取大）
		type lastRow struct {
			IdeaID string
			LastAt time.Time
		}
		var lasts []lastRow
		if err := s.db.Table("idea_progress_items").
			Select("idea_id, MAX(GREATEST(IFNULL(done_at, created_at), created_at)) AS last_at").
			Where("idea_id IN ?", ids).
			Group("idea_id").Scan(&lasts).Error; err == nil {
			for _, l := range lasts {
				if sum, ok := idx[l.IdeaID]; ok {
					sum.LastProgressAt = &l.LastAt
				}
			}
		}
	}

	if jobsOwner != "" {
		type jobRow struct {
			Status string
			Cnt    int
		}
		var jc []jobRow
		if err := s.db.Table("implementation_jobs").
			Select("status, COUNT(*) AS cnt").
			Where("owner_user_id = ? AND status IN ?", jobsOwner, []string{"pending", "in_progress"}).
			Group("status").Scan(&jc).Error; err == nil {
			for _, j := range jc {
				out.Jobs[j.Status] = j.Cnt
			}
		}
	}
	return out, nil
}

// =====================================================================
// Agent 社会信号（双视图宗旨：别人对你的工作的反馈要能传到你的 Agent）
// =====================================================================

// AgentSignal 单条社会信号。
type AgentSignal struct {
	Kind      string    `json:"kind"` // wish | flower | comment | follower
	IdeaID    string    `json:"idea_id,omitempty"`
	IdeaTitle string    `json:"idea_title,omitempty"`
	ActorType string    `json:"actor_type"` // user | agent
	ActorID   string    `json:"actor_id,omitempty"`
	ActorName string    `json:"actor_name,omitempty"`
	Detail    string    `json:"detail,omitempty"` // 花语 / 评论摘要
	At        time.Time `json:"at"`
}

type AgentSignalService struct {
	db *gorm.DB
}

func NewAgentSignalService(db *gorm.DB) *AgentSignalService {
	return &AgentSignalService{db: db}
}

// RecentForAgent 某 agent 名下 idea 最近收到的 wish/flower/comment,以及新粉丝。
// 按 signal 的 actor 是 user 还是 agent 解析展示名;owner 自己的评论不算信号。
func (s *AgentSignalService) RecentForAgent(agentID string, limit int) ([]AgentSignal, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	var agent model.Agent
	if err := s.db.First(&agent, "id = ?", agentID).Error; err != nil {
		return nil, err
	}

	var ideas []model.Idea
	if err := s.db.Select("id, title").Where("agent_id = ?", agentID).Limit(200).Find(&ideas).Error; err != nil {
		return nil, err
	}
	titles := make(map[string]string, len(ideas))
	ideaIDs := make([]string, 0, len(ideas))
	for _, i := range ideas {
		titles[i.ID] = i.Title
		ideaIDs = append(ideaIDs, i.ID)
	}

	signals := make([]AgentSignal, 0, limit*4)
	collect := func(kind, ideaID string, actorUser, actorAgent, detail string, at time.Time) {
		actorType, actorID := "user", actorUser
		if actorAgent != "" {
			actorType, actorID = "agent", actorAgent
		}
		signals = append(signals, AgentSignal{
			Kind: kind, IdeaID: ideaID, IdeaTitle: titles[ideaID],
			ActorType: actorType, ActorID: actorID,
			Detail: detail, At: at,
		})
	}

	if len(ideaIDs) > 0 {
		var wishes []model.Wish
		if err := s.db.Where("idea_id IN ?", ideaIDs).
			Order("created_at DESC").Limit(limit).Find(&wishes).Error; err == nil {
			for _, w := range wishes {
				collect("wish", w.IdeaID, w.UserID, w.AgentID, "", w.CreatedAt)
			}
		}
		var flowers []model.Flower
		if err := s.db.Where("idea_id IN ?", ideaIDs).
			Order("created_at DESC").Limit(limit).Find(&flowers).Error; err == nil {
			for _, f := range flowers {
				collect("flower", f.IdeaID, f.UserID, f.AgentID, f.Message, f.CreatedAt)
			}
		}
		var comments []model.Comment
		if err := s.db.Where("idea_id IN ? AND user_id <> ?", ideaIDs, agent.OwnerUserID).
			Order("created_at DESC").Limit(limit).Find(&comments).Error; err == nil {
			for _, cm := range comments {
				collect("comment", cm.IdeaID, cm.UserID, "", truncate(cm.Content, 80), cm.CreatedAt)
			}
		}
	}
	var follows []model.AgentFollow
	if err := s.db.Where("agent_id = ?", agentID).
		Order("created_at DESC").Limit(limit).Find(&follows).Error; err == nil {
		for _, f := range follows {
			collect("follower", "", f.UserID, "", "", f.CreatedAt)
		}
	}

	resolveNames(s.db, signals)
	// 时间倒序 + 截断
	sortSignalsDesc(signals)
	if len(signals) > limit {
		signals = signals[:limit]
	}
	if signals == nil {
		signals = []AgentSignal{}
	}
	return signals, nil
}

// resolveNames 按 ActorID 批量解析展示名(agents/users 各一次 IN 查询)。
func resolveNames(db *gorm.DB, signals []AgentSignal) {
	agentIDs := make([]string, 0, len(signals))
	userIDs := make([]string, 0, len(signals))
	for _, s := range signals {
		if s.ActorID == "" {
			continue
		}
		if s.ActorType == "agent" {
			agentIDs = append(agentIDs, s.ActorID)
		} else {
			userIDs = append(userIDs, s.ActorID)
		}
	}
	agentNames := map[string]string{}
	if len(agentIDs) > 0 {
		var rows []model.Agent
		db.Select("id, name").Where("id IN ?", agentIDs).Find(&rows)
		for _, a := range rows {
			agentNames[a.ID] = a.Name
		}
	}
	userNames := map[string]string{}
	if len(userIDs) > 0 {
		var rows []model.User
		db.Select("id, name").Where("id IN ?", userIDs).Find(&rows)
		for _, u := range rows {
			userNames[u.ID] = u.Name
		}
	}
	for i := range signals {
		id := signals[i].ActorID
		if id == "" {
			continue
		}
		if signals[i].ActorType == "agent" {
			signals[i].ActorName = agentNames[id]
		} else {
			signals[i].ActorName = userNames[id]
		}
	}
}

func sortSignalsDesc(signals []AgentSignal) {
	for i := 1; i < len(signals); i++ {
		for j := i; j > 0 && signals[j].At.After(signals[j-1].At); j-- {
			signals[j], signals[j-1] = signals[j-1], signals[j]
		}
	}
}
