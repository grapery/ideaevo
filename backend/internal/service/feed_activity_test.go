package service

import (
	"fmt"
	"testing"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// testDB 尝试连接本地 MySQL；连不上则跳过依赖 DB 的测试（CI 用 MySQL service container）。
func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "root:12345678@tcp(localhost:3306)/wanye?charset=utf8mb4&parseTime=True&loc=Local"
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Skipf("local MySQL unavailable, skipping DB test: %v", err)
	}
	// 确保测试用的表存在（AutoMigrate 幂等）。
	if err := db.AutoMigrate(&model.ActivityLog{}, &model.Idea{}, &model.Agent{}, &model.User{}, &model.Follow{}, &model.AgentFollow{}); err != nil {
		t.Skipf("auto-migrate failed: %v", err)
	}
	return db
}

// uniqueSuffix 生成一个短随机串，避免测试数据与现有行冲突。
func uniqueSuffix() string {
	return fmt.Sprintf("%x", time.Now().UnixNano())
}

// ---- 常量 / 白名单（纯逻辑，无需 DB）----

func TestFeedActions_ContainsCreateForkShare(t *testing.T) {
	want := map[string]bool{ActionRegister: true, ActionFork: true, ActionShare: true}
	if len(FeedActions) != len(want) {
		t.Fatalf("FeedActions has %d entries, want %d: %v", len(FeedActions), len(want), FeedActions)
	}
	for _, a := range FeedActions {
		if !want[a] {
			t.Errorf("unexpected action in FeedActions: %q", a)
		}
	}
}

func TestFeedActions_ExcludesHighFrequencyNoise(t *testing.T) {
	// 点赞/送花/发消息/关注等高频动作不应进 feed 白名单。
	noise := []string{"like", "flower", "send_message", "create_session", "follow", "unfollow", "bury"}
	inSet := make(map[string]bool, len(FeedActions))
	for _, a := range FeedActions {
		inSet[a] = true
	}
	for _, n := range noise {
		if inSet[n] {
			t.Errorf("noise action %q should NOT be in FeedActions", n)
		}
	}
}

// ---- ShareIdea（需 DB）----

func TestShareIdea_RecordsActivityAndDoesNotDuplicateIdea(t *testing.T) {
	db := testDB(t)
	suffix := uniqueSuffix()

	// 准备一个 agent（idea 的外键父级）+ 一个 active idea
	agent := &model.Agent{Name: "share-agent-" + suffix, APIKeyHash: "hash-" + suffix}
	if err := db.Create(agent).Error; err != nil {
		t.Fatalf("create agent: %v", err)
	}
	idea := &model.Idea{
		AgentID:     agent.ID,
		Title:       "share-test-" + suffix,
		Description: "d",
		Status:      model.IdeaStatusActive,
		Category:    "tool",
	}
	if err := db.Create(idea).Error; err != nil {
		t.Fatalf("create idea: %v", err)
	}
	t.Cleanup(func() {
		db.Where("target_id = ?", idea.ID).Delete(&model.ActivityLog{})
		db.Delete(&model.Idea{}, idea.ID)
		db.Delete(&model.Agent{}, agent.ID)
	})

	svc := NewSocialService(db)
	actorID := "user-share-test-" + suffix

	before := countActivities(db, ActionShare, "idea", idea.ID)
	ideaCountBefore := countIdeas(db)

	if err := svc.ShareIdea(idea.ID, "user", actorID); err != nil {
		t.Fatalf("ShareIdea failed: %v", err)
	}

	after := countActivities(db, ActionShare, "idea", idea.ID)
	if after != before+1 {
		t.Errorf("share activity count: before=%d after=%d, want +1", before, after)
	}

	// 轻量语义：不应新增 idea 行。
	ideaCountAfter := countIdeas(db)
	if ideaCountAfter != ideaCountBefore {
		t.Errorf("ShareIdea must NOT create a new idea: before=%d after=%d", ideaCountBefore, ideaCountAfter)
	}
}

func TestShareIdea_RejectsMissingActor(t *testing.T) {
	db := testDB(t)
	suffix := uniqueSuffix()
	agent := &model.Agent{Name: "share-noid-agent-" + suffix, APIKeyHash: "hash-noid-" + suffix}
	if err := db.Create(agent).Error; err != nil {
		t.Fatalf("create agent: %v", err)
	}
	idea := &model.Idea{AgentID: agent.ID, Title: "share-noid-" + suffix, Description: "d", Status: model.IdeaStatusActive, Category: "tool"}
	if err := db.Create(idea).Error; err != nil {
		t.Fatalf("create idea: %v", err)
	}
	t.Cleanup(func() {
		db.Delete(&model.Idea{}, idea.ID)
		db.Delete(&model.Agent{}, agent.ID)
	})

	svc := NewSocialService(db)
	if err := svc.ShareIdea(idea.ID, "user", ""); err == nil {
		t.Error("ShareIdea should reject empty actorID")
	}
}

func TestShareIdea_RejectsMissingIdea(t *testing.T) {
	db := testDB(t)
	svc := NewSocialService(db)
	if err := svc.ShareIdea("nonexistent-idea-id", "user", "u1"); err == nil {
		t.Error("ShareIdea should reject nonexistent idea")
	}
}

// ---- FollowedActors（需 DB）----

func TestFollowedActors_UnionsAgentsAndUsers(t *testing.T) {
	db := testDB(t)
	suffix := uniqueSuffix()
	followSvc := NewFollowService(db, nil)

	// 准备一个 agent + 一个 user 作为被关注对象
	agent := &model.Agent{Name: "followed-agent-" + suffix, APIKeyHash: "hash-agent-" + suffix}
	if err := db.Create(agent).Error; err != nil {
		t.Fatalf("create agent: %v", err)
	}
	user := &model.User{Email: "followed-" + suffix + "@test.com", Name: "u-" + suffix, AuthProvider: "email"}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	follower := &model.User{Email: "follower-" + suffix + "@test.com", Name: "f-" + suffix, AuthProvider: "email"}
	if err := db.Create(follower).Error; err != nil {
		t.Fatalf("create follower: %v", err)
	}
	t.Cleanup(func() {
		db.Where("user_id = ? AND agent_id = ?", follower.ID, agent.ID).Delete(&model.AgentFollow{})
		db.Where("follower_id = ? AND following_id = ?", follower.ID, user.ID).Delete(&model.Follow{})
		db.Delete(follower)
		db.Delete(user)
		db.Delete(agent)
	})

	// follower 关注 agent + user
	af := &model.AgentFollow{UserID: follower.ID, AgentID: agent.ID}
	if err := db.Create(af).Error; err != nil {
		t.Fatalf("create agent_follow: %v", err)
	}
	uf := &model.Follow{FollowerID: follower.ID, FollowingID: user.ID}
	if err := db.Create(uf).Error; err != nil {
		t.Fatalf("create follow: %v", err)
	}

	actors, err := followSvc.FollowedActors(follower.ID)
	if err != nil {
		t.Fatalf("FollowedActors: %v", err)
	}
	if len(actors) != 2 {
		t.Fatalf("want 2 followed actors, got %d: %+v", len(actors), actors)
	}

	got := map[string]string{} // type -> id
	for _, a := range actors {
		got[a.Type] = a.ID
	}
	if got["agent"] != agent.ID {
		t.Errorf("agent actor missing: got %+v", got)
	}
	if got["user"] != user.ID {
		t.Errorf("user actor missing: got %+v", got)
	}
}

func TestFollowedActors_EmptyWhenFollowingNobody(t *testing.T) {
	db := testDB(t)
	followSvc := NewFollowService(db, nil)
	actors, err := followSvc.FollowedActors("nobody-" + uniqueSuffix())
	if err != nil {
		t.Fatalf("FollowedActors: %v", err)
	}
	if len(actors) != 0 {
		t.Errorf("want 0 actors for nobody, got %d", len(actors))
	}
}

// ---- QueryFilter.OwnerUserID 聚合（需 DB）----

// TestQuery_ByOwnerUserID_AggregatesAcrossAgents 验证 owner_user_id 过滤
// 能跨该用户拥有的所有 agent 聚合 idea（idea 属于 agent，agent 属于 user）。
func TestQuery_ByOwnerUserID_AggregatesAcrossAgents(t *testing.T) {
	db := testDB(t)
	suffix := uniqueSuffix()

	// owner 用户 + 它拥有的两个 agent
	owner := &model.User{Email: "owner-" + suffix + "@test.com", Name: "o-" + suffix, AuthProvider: "email"}
	if err := db.Create(owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}
	agentA := &model.Agent{Name: "agentA-" + suffix, OwnerUserID: owner.ID, APIKeyHash: "hashA-" + suffix}
	agentB := &model.Agent{Name: "agentB-" + suffix, OwnerUserID: owner.ID, APIKeyHash: "hashB-" + suffix}
	if err := db.Create(agentA).Error; err != nil {
		t.Fatalf("create agentA: %v", err)
	}
	if err := db.Create(agentB).Error; err != nil {
		t.Fatalf("create agentB: %v", err)
	}
	// 另一个用户 + 它的 agent（不应计入）
	other := &model.User{Email: "other-" + suffix + "@test.com", Name: "x-" + suffix, AuthProvider: "email"}
	if err := db.Create(other).Error; err != nil {
		t.Fatalf("create other: %v", err)
	}
	agentX := &model.Agent{Name: "agentX-" + suffix, OwnerUserID: other.ID, APIKeyHash: "hashX-" + suffix}
	if err := db.Create(agentX).Error; err != nil {
		t.Fatalf("create agentX: %v", err)
	}

	ideaA1 := &model.Idea{AgentID: agentA.ID, Title: "ia1-" + suffix, Description: "d", Status: model.IdeaStatusActive, Category: "tool"}
	ideaA2 := &model.Idea{AgentID: agentA.ID, Title: "ia2-" + suffix, Description: "d", Status: model.IdeaStatusActive, Category: "tool"}
	ideaB1 := &model.Idea{AgentID: agentB.ID, Title: "ib1-" + suffix, Description: "d", Status: model.IdeaStatusActive, Category: "tool"}
	ideaX1 := &model.Idea{AgentID: agentX.ID, Title: "ix1-" + suffix, Description: "d", Status: model.IdeaStatusActive, Category: "tool"}
	for _, idea := range []*model.Idea{ideaA1, ideaA2, ideaB1, ideaX1} {
		if err := db.Create(idea).Error; err != nil {
			t.Fatalf("create idea: %v", err)
		}
	}
	t.Cleanup(func() {
		db.Delete(&model.Idea{}, ideaA1.ID)
		db.Delete(&model.Idea{}, ideaA2.ID)
		db.Delete(&model.Idea{}, ideaB1.ID)
		db.Delete(&model.Idea{}, ideaX1.ID)
		db.Delete(agentA)
		db.Delete(agentB)
		db.Delete(agentX)
		db.Delete(owner)
		db.Delete(other)
	})

	svc := NewIdeaService(db)

	// owner 应聚合到 3 条（agentA 的 2 条 + agentB 的 1 条），不含 other 的。
	ideas, total, err := svc.Query(QueryFilter{OwnerUserID: owner.ID, Limit: 50})
	if err != nil {
		t.Fatalf("Query by owner: %v", err)
	}
	if total != 3 {
		t.Errorf("want total=3 for owner, got %d", total)
	}
	if len(ideas) != 3 {
		t.Errorf("want 3 ideas returned, got %d", len(ideas))
	}
	// 确保没有 other 的 idea 混入。
	for _, idea := range ideas {
		if idea.AgentID == agentX.ID {
			t.Error("other user's idea leaked into owner aggregation")
		}
	}

	// other 只应有 1 条。
	_, otherTotal, err := svc.Query(QueryFilter{OwnerUserID: other.ID, Limit: 50})
	if err != nil {
		t.Fatalf("Query by other: %v", err)
	}
	if otherTotal != 1 {
		t.Errorf("want total=1 for other, got %d", otherTotal)
	}
}

// ---- helpers ----

func countActivities(db *gorm.DB, action, targetType, targetID string) int64 {
	var n int64
	db.Model(&model.ActivityLog{}).
		Where("action = ? AND target_type = ? AND target_id = ?", action, targetType, targetID).
		Count(&n)
	return n
}

func countIdeas(db *gorm.DB) int64 {
	var n int64
	db.Model(&model.Idea{}).Count(&n)
	return n
}
