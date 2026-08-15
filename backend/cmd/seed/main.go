package main

// seed —— 为本地/演示环境灌入接近真实的 mock 数据。
//
// 用法（在 backend/ 目录或通过 make seed）：
//
//	go run ./cmd/seed            # 幂等：已灌过则跳过
//	go run ./cmd/seed -reset     # 清空全部业务数据后重新灌入
//
// 账号（邮箱/密码/Agent API Key）写入 -out 指定的文件（默认 ../mock-accounts.md）。

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/wanye/ideaevo/internal/config"
	"github.com/wanye/ideaevo/internal/database"
	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service"
)

// resetTables --reset 时清空的业务表，保证「整体初始化」后的环境干净。
var resetTables = []string{
	"idea_metric_events", "idea_bookmarks", "forks", "likes", "wishes",
	"flowers", "flower_daily_balances", "reactions", "wanye_comments",
	"wanye_comment_likes", "idea_suggestions", "suggestion_votes", "implementation_jobs",
	"activity_logs", "notifications", "notification_preferences",
	"chat_sessions", "chat_messages", "chat_attachments", "message_feedbacks",
	"follows", "agent_follows", "agent_peer_follows", "user_devices",
	"phone_verifications", "a2_a_tasks", "user_blocks", "content_reports",
	"orders", "daily_quota", "refunds", "idea_versions", "ideas", "agents", "users",
}

type seededAccount struct {
	User  seedUser
	ID    string
	Agent model.Agent // 个人 Agent
}

func main() {
	reset := flag.Bool("reset", false, "清空全部业务数据后重新灌入")
	out := flag.String("out", "../mock-accounts.md", "账号文件输出路径")
	flag.Parse()

	cfg := config.Load()
	db := database.Connect(cfg) // AutoMigrate 保证新表存在

	if *reset {
		log.Printf("[seed] reset: 清空 %d 张业务表", len(resetTables))
		// 存在真实外键（如 wanye_comments.parent_id 自引用），重灌期间关闭检查
		db.Exec("SET FOREIGN_KEY_CHECKS = 0")
		for _, t := range resetTables {
			// 表可能不存在（如尚未启用的模块），跳过
			var exists int
			db.Raw("SELECT COUNT(1) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?", t).Scan(&exists)
			if exists == 0 {
				continue
			}
			if err := db.Exec("DELETE FROM " + t).Error; err != nil {
				db.Exec("SET FOREIGN_KEY_CHECKS = 1")
				log.Fatalf("[seed] 清空 %s 失败: %v", t, err)
			}
		}
		db.Exec("SET FOREIGN_KEY_CHECKS = 1")
	}

	// 幂等：标记账号已存在则跳过
	var count int64
	db.Model(&model.User{}).Where("email = ?", seedUsers[0].Email).Count(&count)
	if count > 0 {
		log.Printf("[seed] 检测到种子数据已存在（%s），跳过。需要重灌请加 -reset", seedUsers[0].Email)
		return
	}

	rng := rand.New(rand.NewSource(42)) // 固定种子保证可复现
	agentSvc := service.NewAgentService(db)

	// ---- 1. 用户（核心 13 + 生成 27 = 40）----
	allUsers := append(append([]seedUser{}, seedUsers...), genExtraUsers()...)
	accounts := make(map[string]*seededAccount, len(allUsers))
	for _, su := range allUsers {
		hash, err := bcrypt.GenerateFromPassword([]byte(su.Password), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("hash password: %v", err)
		}
		role := su.Role
		if role == "" {
			role = "user"
		}
		user := &model.User{
			Name:          su.Name,
			Email:         su.Email,
			PasswordHash:  string(hash),
			AuthProvider:  "email",
			EmailVerified: true, // 直接可登录
			Role:          model.UserRole(role),
			PlanTier:      model.PlanTier(su.Plan),
			Bio:           su.Bio,
		}
		if su.Plan == "pro" {
			exp := time.Now().AddDate(1, 0, 0)
			user.PlanExpiresAt = &exp
		}
		if err := db.Create(user).Error; err != nil {
			log.Fatalf("创建用户 %s: %v", su.Email, err)
		}
		avatar, bg := service.ApplyDefaultProfileMedia(user.ID)
		db.Model(user).Updates(map[string]interface{}{
			"avatar_url": avatar, "background_url": bg, "avatar_source": "dicebear",
		})
		accounts[su.Key] = &seededAccount{User: su, ID: user.ID}
	}
	log.Printf("[seed] 用户 %d 个就绪", len(accounts))

	// ---- 2. 个人 Agent（沿用「<用户名>的想法」命名约定 → 前端识别为本人发布）----
	for key, acc := range accounts {
		res, err := agentSvc.Register(service.RegisterAgentInput{
			Name:         acc.User.Name + "的想法",
			Description:  "通过火卫二助手创建 idea 时自动绑定的个人 Agent",
			Capabilities: service.DefaultUserAgentCapabilities,
			OwnerUserID:  acc.ID,
			Visibility:   "private",
		})
		if err != nil {
			log.Fatalf("创建个人 Agent(%s): %v", key, err)
		}
		acc.Agent = res.Agent
	}

	// ---- 3. 公开 AI Agent ----
	aiAgents := make(map[string]model.Agent)
	for _, sa := range seedAgents {
		res, err := agentSvc.Register(service.RegisterAgentInput{
			Name:         sa.Name,
			Description:  sa.Description,
			Capabilities: sa.Capabilities,
			OwnerUserID:  accounts[sa.Owner].ID,
			LLMModel:     sa.LLMModel,
			Visibility:   "public",
			AllowFollow:  boolPtr(true),
			AllowChat:    boolPtr(true),
		})
		if err != nil {
			log.Fatalf("创建 AI Agent(%s): %v", sa.Name, err)
		}
		aiAgents[sa.Key] = res.Agent
		if err := db.Model(&res.Agent).UpdateColumn("category", sa.Category).Error; err != nil {
			log.Printf("[seed] 设置 Agent 分类失败（忽略）: %v", err)
		}
	}
	log.Printf("[seed] Agent 就绪：个人 %d + AI %d", len(accounts), len(aiAgents))

	// owner key → AI Agent key 映射（生成器用于让部分想法由 AI Agent 发布）
	aiAgentsByOwner := make(map[string]string, len(seedAgents))
	for _, sa := range seedAgents {
		aiAgentsByOwner[sa.Owner] = sa.Key
	}

	// ---- 4. 想法：手工核心 + 程序化生成，共 200+ ----
	ownerKeys := make([]string, 0, len(accounts))
	for k := range accounts {
		if k != "admin" {
			ownerKeys = append(ownerKeys, k)
		}
	}
	generated := generateIdeas(rng, 192, ownerKeys, aiAgentsByOwner, nil)
	allSeedIdeas := append(append([]seedIdea{}, seedIdeas...), generated...)
	coreIdeaN := len(seedIdeas)

	ideas := make([]*model.Idea, 0, len(allSeedIdeas))
	for i, si := range allSeedIdeas {
		agent := accounts[si.Owner].Agent
		if si.Agent != "" {
			agent = aiAgents[si.Agent]
		}
		tags, _ := json.Marshal(si.Tags)
		idea := &model.Idea{
			AgentID:     agent.ID,
			Title:       si.Title,
			Description: si.Desc,
			Status:      model.IdeaStatus(orDefault(si.Status, "active")),
			Category:    si.Category,
			Tags:        string(tags),
			RepoURL:     si.RepoURL,
			DemoURL:     si.DemoURL,
			ImplStatus:  model.ImplStatus(orDefault(si.Impl, "concept")),
			IsMarkdown:  true,
			CreatedAt:   daysAgo(si.DaysAgo),
			UpdatedAt:   daysAgo(si.DaysAgo - 0.5),
		}
		switch idea.Status {
		case model.IdeaStatusImplemented:
			t := daysAgo(si.DaysAgo - 2)
			idea.ImplementedAt = &t
			idea.ImplementedReason = "MVP 已上线"
		case model.IdeaStatusArchived:
			t := daysAgo(si.DaysAgo - 2)
			idea.ArchivedAt = &t
			idea.ArchivedReason = "优先级让位，暂缓执行"
		case model.IdeaStatusBuried:
			t := daysAgo(si.DaysAgo - 2)
			idea.BuriedAt = &t
			idea.BuriedReason = si.BuryReasn
		}
		if err := db.Create(idea).Error; err != nil {
			log.Fatalf("创建 idea #%d %s: %v", i, si.Title, err)
		}
		ideas = append(ideas, idea)

		db.Create(&model.ActivityLog{
			ActorType: "agent", ActorID: agent.ID, Action: "register",
			TargetType: "idea", TargetID: idea.ID, CreatedAt: idea.CreatedAt,
		})
	}
	log.Printf("[seed] 想法 %d 条就绪", len(ideas))

	// ---- 5. 互动：点赞 / 期待 ----
	userKeys := make([]string, 0, len(accounts))
	for k := range accounts {
		userKeys = append(userKeys, k)
	}
	for i, idea := range ideas {
		likeN := 2 + rng.Intn(7)
		wishN := rng.Intn(5)
		days := int(allSeedIdeas[i].DaysAgo)
		if days < 1 {
			days = 1
		}
		for _, uk := range pickOthers(rng, userKeys, allSeedIdeas[i].Owner, likeN) {
			db.Create(&model.Like{IdeaID: idea.ID, UserID: accounts[uk].ID,
				CreatedAt: daysAgo(float64(1 + rng.Intn(days)))})
		}
		for _, uk := range pickOthers(rng, userKeys, allSeedIdeas[i].Owner, wishN) {
			db.Create(&model.Wish{IdeaID: idea.ID, UserID: accounts[uk].ID,
				CreatedAt: daysAgo(float64(1 + rng.Intn(days)))})
		}
	}

	// ---- 6. 鲜花（带留言）----
	for ideaIdx, msgs := range flowerMessages {
		for _, m := range msgs {
			db.Create(&model.Flower{
				IdeaID: ideas[ideaIdx].ID, UserID: accounts[m.User].ID,
				Message: m.Message, CreatedAt: daysAgo(seedIdeas[ideaIdx].DaysAgo - 1),
			})
		}
	}

	// ---- 7. 评论（核心手写 + 生成，含回复线程）----
	genComments := generateComments(rng, coreIdeaN, len(allSeedIdeas), ownerKeys)
	allComments := append(append([]seedComment{}, seedComments...), genComments...)
	for _, sc := range allComments {
		idea := ideas[sc.Idea]
		root := &model.Comment{
			IdeaID: idea.ID, UserID: accounts[sc.User].ID,
			Content: sc.Content, Kind: model.CommentKind(sc.Kind),
			Sentiment: model.CommentSentiment(sc.Sentiment),
			CreatedAt: daysAgo(sc.DaysAgo),
		}
		if err := db.Create(root).Error; err != nil {
			log.Fatalf("创建评论失败: %v", err)
		}
		for _, r := range sc.Replies {
			db.Create(&model.Comment{
				IdeaID: idea.ID, UserID: accounts[r.User].ID, ParentID: &root.ID,
				Content: r.Content, Kind: model.CommentKindGeneral,
				Sentiment: model.SentimentNeutral, CreatedAt: daysAgo(r.DaysAgo),
			})
		}
	}

	// ---- 8. Fork 链（两条，制造谱系图数据）----
	forkChain := []struct {
		Src    int
		Agent  string // 用户 key：用其个人 Agent fork
		Suffix string
		Reason string
		Days   float64
	}{
		{Src: 0, Agent: "zhou", Suffix: "只读版", Reason: "想做一个纯前端的只读版健康页，降低部署门槛", Days: 12},
		{Src: 8, Agent: "zhao", Suffix: "规则库版", Reason: "在命名规范助手里复用规则引擎，改成库形态", Days: 9},
	}
	for _, f := range forkChain {
		src := ideas[f.Src]
		forked := &model.Idea{
			AgentID:     accounts[f.Agent].Agent.ID,
			Title:       src.Title + "（" + f.Suffix + "）",
			Description: "Fork 自《" + src.Title + "》。\n\n" + f.Reason + "。改动计划：\n\n- 拆出可复用的核心模块\n- 保持与上游的 API 兼容\n",
			Status:      model.IdeaStatusActive, Category: seedIdeas[f.Src].Category,
			Tags: src.Tags, ImplStatus: model.ImplStatusInProgress, IsMarkdown: true,
			ForkedFromID: &src.ID, CreatedAt: daysAgo(f.Days), UpdatedAt: daysAgo(f.Days - 1),
		}
		if err := db.Create(forked).Error; err != nil {
			log.Fatalf("创建 fork idea: %v", err)
		}
		db.Create(&model.Fork{
			SourceIdeaID: src.ID, NewIdeaID: forked.ID,
			AgentID: accounts[f.Agent].Agent.ID, Reason: f.Reason, CreatedAt: daysAgo(f.Days),
		})
		db.Create(&model.ActivityLog{
			ActorType: "agent", ActorID: accounts[f.Agent].Agent.ID, Action: "fork",
			TargetType: "idea", TargetID: forked.ID, CreatedAt: daysAgo(f.Days),
		})
	}

	// ---- 9. 关注关系（用户互关 + 关注 AI Agent）----
	followPairs := [][2]string{
		{"chen", "zhao"}, {"zhao", "chen"}, {"lin", "gao"}, {"gao", "lin"},
		{"zhou", "chen"}, {"zhou", "zhao"}, {"zheng", "lin"}, {"han", "lin"},
		{"wang", "luo"}, {"luo", "chen"}, {"su", "zheng"}, {"xu", "he"}, {"he", "chen"},
	}
	for _, p := range followPairs {
		db.Create(&model.Follow{FollowerID: accounts[p[0]].ID, FollowingID: accounts[p[1]].ID,
			CreatedAt: daysAgo(float64(3 + rng.Intn(20)))})
	}
	// 生成用户之间的随机关注（每人 1-3 个）
	for _, ek := range genExtraUserKeys() {
		for _, tk := range pickOthers(rng, ownerKeys, ek, 1+rng.Intn(3)) {
			db.Create(&model.Follow{FollowerID: accounts[ek].ID, FollowingID: accounts[tk].ID,
				CreatedAt: daysAgo(float64(1 + rng.Intn(30)))})
		}
	}
	agentFollows := []struct{ User, Agent string }{
		{"zhou", "inkfish"}, {"zheng", "inkfish"}, {"gao", "inkfish"},
		{"zhao", "codearch"}, {"luo", "codearch"}, {"lin", "reqtranslator"},
		{"han", "weeklyglow"}, {"gao", "weeklyglow"}, {"su", "reviewer"}, {"wang", "datadetective"},
	}
	for _, f := range agentFollows {
		db.Create(&model.AgentFollow{
			UserID: accounts[f.User].ID, AgentID: aiAgents[f.Agent].ID,
			CreatedAt: daysAgo(float64(2 + rng.Intn(15))),
		})
	}

	// ---- 10. 建议 + 投票 + 采纳（核心手写 + 生成）----
	activeIdxs := []int{}
	for i := coreIdeaN; i < len(allSeedIdeas); i++ {
		if allSeedIdeas[i].Status == "active" || allSeedIdeas[i].Status == "" {
			activeIdxs = append(activeIdxs, i)
		}
	}
	genSugs := generateSuggestions(rng, activeIdxs, ownerKeys, 3)
	allSugs := append(append([]seedSuggestion{}, seedSuggestions...), genSugs...)
	for _, ss := range allSugs {
		idea := ideas[ss.Idea]
		authorID := accounts[ss.User].ID
		actorType := "user"
		if strings.HasPrefix(ss.User, "agent:") {
			actorType = "agent"
			authorID = aiAgents[strings.TrimPrefix(ss.User, "agent:")].ID
		}
		sug := &model.IdeaSuggestion{
			IdeaID: idea.ID, UserID: authorID, Content: ss.Content,
			ImageURLs: "[]", CreatedAt: daysAgo(ss.DaysAgo),
		}
		if err := db.Create(sug).Error; err != nil {
			log.Fatalf("创建建议失败: %v", err)
		}
		for _, vk := range ss.Voters {
			db.Create(&model.SuggestionVote{
				SuggestionID: sug.ID, UserID: accounts[vk].ID,
				CreatedAt: daysAgo(ss.DaysAgo - 0.5),
			})
		}
		db.Model(sug).UpdateColumn("vote_count", len(ss.Voters))
		db.Create(&model.ActivityLog{
			ActorType: actorType, ActorID: authorID, Action: "suggest",
			TargetType: "idea", TargetID: idea.ID, CreatedAt: daysAgo(ss.DaysAgo),
		})
		if !ss.Selected {
			continue
		}
		// 采纳：置 selected_at + 建实现任务 + 推进 impl_status
		selAt := daysAgo(ss.DaysAgo - 1)
		db.Model(sug).UpdateColumn("selected_at", selAt)
		brief, _ := json.Marshal(map[string]any{
			"idea_id": idea.ID, "idea_title": idea.Title,
			"idea_description": idea.Description, "idea_repo_url": idea.RepoURL,
			"suggestion_id": sug.ID, "suggestion_content": ss.Content,
			"suggestion_images": []string{}, "created_by": "suggestion_selected",
		})
		owner := accounts[allSeedIdeas[ss.Idea].Owner]
		db.Create(&model.ImplementationJob{
			IdeaID: idea.ID, SuggestionID: &sug.ID, OwnerUserID: owner.ID,
			Status: "pending", Brief: string(brief), CreatedAt: selAt,
		})
		db.Model(idea).Updates(map[string]interface{}{
			"impl_status": model.ImplStatusInProgress, "updated_at": selAt,
		})
		db.Create(&model.ActivityLog{
			ActorType: "user", ActorID: owner.ID, Action: "suggestion_selected",
			TargetType: "idea", TargetID: idea.ID, CreatedAt: selAt,
		})
	}

	// ---- 11. 结案类活动流 ----
	for _, idea := range ideas {
		switch idea.Status {
		case model.IdeaStatusImplemented:
			db.Create(&model.ActivityLog{ActorType: "agent", ActorID: idea.AgentID, Action: "implement", TargetType: "idea", TargetID: idea.ID, CreatedAt: *idea.ImplementedAt})
		case model.IdeaStatusArchived:
			db.Create(&model.ActivityLog{ActorType: "agent", ActorID: idea.AgentID, Action: "archive", TargetType: "idea", TargetID: idea.ID, CreatedAt: *idea.ArchivedAt})
		case model.IdeaStatusBuried:
			db.Create(&model.ActivityLog{ActorType: "agent", ActorID: idea.AgentID, Action: "bury", TargetType: "idea", TargetID: idea.ID, CreatedAt: *idea.BuriedAt})
		}
	}

	// ---- 12. 少量通知（让通知页有内容）----
	commentNotifs := []struct {
		To, ActorKey string
		IdeaIdx      int
	}{
		{To: "chen", ActorKey: "zhou", IdeaIdx: 0},
		{To: "chen", ActorKey: "he", IdeaIdx: 0},
		{To: "gao", ActorKey: "xu", IdeaIdx: 15},
		{To: "lin", ActorKey: "han", IdeaIdx: 11},
	}
	for _, n := range commentNotifs {
		idea := ideas[n.IdeaIdx]
		actor := accounts[n.ActorKey]
		db.Create(&model.Notification{
			UserID:    accounts[n.To].ID,
			ActorType: "user", ActorID: actor.ID, ActorName: actor.User.Name,
			Action: "comment", TargetType: "idea", TargetID: idea.ID,
			Summary:   truncate(allSeedIdeas[n.IdeaIdx].Title, 40),
			CreatedAt: daysAgo(1),
		})
	}

	// ---- 13. 重算去规范化计数 + 热榜加权分 ----
	recountSQL := []string{
		`UPDATE ideas i SET
			like_count    = (SELECT COUNT(*) FROM likes WHERE idea_id = i.id),
			wish_count    = (SELECT COUNT(*) FROM wishes WHERE idea_id = i.id),
			flower_count  = (SELECT COUNT(*) FROM flowers WHERE idea_id = i.id),
			comment_count = (SELECT COUNT(*) FROM wanye_comments WHERE idea_id = i.id AND is_moderated = 0),
			fork_count    = (SELECT COUNT(*) FROM forks WHERE source_idea_id = i.id)`,
		`UPDATE ideas SET weighted_score = like_count * 0.4 + wish_count * 0.8 + flower_count * 1.5 + fork_count * 2.0`,
		`UPDATE ideas i SET suggestion_count = (SELECT COUNT(*) FROM idea_suggestions WHERE idea_id = i.id)`,
		`UPDATE users u SET
			follower_count  = (SELECT COUNT(*) FROM follows WHERE following_id = u.id),
			following_count = (SELECT COUNT(*) FROM follows WHERE follower_id = u.id)`,
	}
	for _, q := range recountSQL {
		if err := db.Exec(q).Error; err != nil {
			log.Fatalf("重算计数失败: %v\n%s", err, q)
		}
	}

	// ---- 14. 输出账号文件（-out - 时打印到 stdout，便于容器日志查看）----
	if err := writeAccountsFile(*out, allUsers, accounts, aiAgents); err != nil {
		log.Fatalf("写账号文件失败: %v", err)
	}

	var usersN, ideasN, commentsN, agentsN int64
	db.Model(&model.User{}).Count(&usersN)
	db.Model(&model.Idea{}).Count(&ideasN)
	db.Model(&model.Comment{}).Count(&commentsN)
	db.Model(&model.Agent{}).Count(&agentsN)
	log.Printf("[seed] 完成：用户 %d / Agent %d / 想法 %d / 评论 %d，账号文件 → %s",
		usersN, agentsN, ideasN, commentsN, *out)
}

// pickOthers 从 keys 中随机挑 n 个不等于 exclude 与 admin 的 key。
func pickOthers(rng *rand.Rand, keys []string, exclude string, n int) []string {
	pool := make([]string, 0, len(keys))
	for _, k := range keys {
		if k != exclude && k != "admin" {
			pool = append(pool, k)
		}
	}
	rng.Shuffle(len(pool), func(i, j int) { pool[i], pool[j] = pool[j], pool[i] })
	if n > len(pool) {
		n = len(pool)
	}
	return pool[:n]
}

func boolPtr(b bool) *bool { return &b }

func orDefault(v, d string) string {
	if v == "" {
		return d
	}
	return v
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

func writeAccountsFile(path string, allUsers []seedUser, accounts map[string]*seededAccount, aiAgents map[string]model.Agent) error {
	var b strings.Builder
	defer func() {
		// 容器部署时账号信息同时打到日志，便于 docker logs seed 查看
		if path == "-" {
			fmt.Println(b.String())
		}
	}()
	b.WriteString("# Mock 账号（模拟环境）\n\n")
	b.WriteString("> 由 `backend/cmd/seed` 生成，仅用于本地/演示环境模拟登录与 MCP 调用。\n\n")

	b.WriteString("## 用户账号\n\n| 姓名 | 邮箱（登录名） | 密码 | 会员 | 角色 |\n|---|---|---|---|---|\n")
	for _, su := range allUsers {
		role := su.Role
		if role == "" {
			role = "user"
		}
		fmt.Fprintf(&b, "| %s | `%s` | `%s` | %s | %s |\n",
			su.Name, su.Email, su.Password, su.Plan, role)
	}

	b.WriteString("\n## AI Agent（公开，API Key 可用于 MCP/REST 模拟）\n\n| Agent | 分类 | 创建者 | API Key |\n|---|---|---|---|\n")
	for _, sa := range seedAgents {
		fmt.Fprintf(&b, "| %s | %s | %s | `%s` |\n",
			sa.Name, sa.Category, accounts[sa.Owner].User.Name, aiAgents[sa.Key].APIKey)
	}

	b.WriteString(`
## 数据概览

- 40 个用户（含 1 个管理员）+ 6 个公开 AI Agent，每人一个个人 Agent
- 212 条想法（18 条手工精撰 + 194 条程序化生成）+ 2 条 fork 链，覆盖 active / implemented / archived / buried 全生命周期与主要分类
- 点赞 / 期待 / 鲜花（带留言）/ 评论（含回复线程）/ 关注按真实分布生成
- 20+ 条建议（含多条已采纳并创建 pending 实现任务）
- 活动流覆盖 register / fork / suggest / suggestion_selected / implement / archive / bury

## 常用模拟入口

- 前端: http://localhost:3000 （登录用上表邮箱 + 密码）
- API: http://localhost:9200/api
- MCP 调用: 携带任一 Agent 的 API Key（X-API-Key 或 api_key 参数）
- 重灌数据: cd backend && go run ./cmd/seed -reset
`)
	if path == "-" {
		return nil
	}
	return os.WriteFile(path, []byte(b.String()), 0644)
}
