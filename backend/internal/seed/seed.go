// Package seed 在启动时按需注入模拟数据（用户 / agent / idea / 互动 / 对话 / 通知）。
//
// 幂等：通过固定邮箱后缀 @seed.local 判断是否已注入；若已存在 mock 数据则跳过，
// 不会重复写入、也不会覆盖真实数据。所有注入数据带 seed- 前缀便于识别。
package seed

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// 标识前缀：所有由本包注入的数据都带这串，便于识别和清理。
const seedTag = "seed-"

// Options 控制注入的数据量。
type Options struct {
	Users    int
	Agents   int
	Ideas    int
	Password string
}

// DefaultOptions 返回默认的注入规格（100 用户 / 150 agent / 500 idea）。
func DefaultOptions() Options {
	return Options{Users: 100, Agents: 150, Ideas: 500, Password: "Seed1234!"}
}

// AlreadySeeded 检查数据库是否已存在 mock 数据（按 seed- 标记的用户邮箱判断）。
func AlreadySeeded(db *gorm.DB) bool {
	var count int64
	db.Model(&model.User{}).
		Where("email LIKE ?", seedTag+"%user%@seed.local").
		Count(&count)
	return count > 0
}

// Run 注入模拟数据。若数据库已存在 mock 数据（AlreadySeeded）则直接跳过。
// 返回 (注入条数, 是否跳过, error)。
func Run(db *gorm.DB, opts Options) (injected int, skipped bool, err error) {
	// 兜底：任一关键数量为 0 时走默认，避免 panic（早期版本只兜底 Users）。
	if opts.Users == 0 || opts.Agents == 0 || opts.Ideas == 0 {
		opts = DefaultOptions()
	}
	if opts.Password == "" {
		opts.Password = "Seed1234!"
	}

	if AlreadySeeded(db) {
		return 0, true, nil
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(opts.Password), bcrypt.DefaultCost)
	if err != nil {
		return 0, false, fmt.Errorf("bcrypt: %w", err)
	}

	rng := randReader{}
	now := time.Now()

	// 1. Users
	users := make([]*model.User, 0, opts.Users)
	for i := 1; i <= opts.Users; i++ {
		u := &model.User{
			Name:          fmt.Sprintf("种子用户%03d", i),
			Email:         fmt.Sprintf("%suser%03d@seed.local", seedTag, i),
			PasswordHash:  string(hashed),
			Bio:           pickBio(i),
			AuthProvider:  "email",
			Role:          model.RoleUser,
			AvatarURL:     fmt.Sprintf("https://api.dicebear.com/7.x/identicon/svg?seed=%suser%03d", seedTag, i),
			BackgroundURL: fmt.Sprintf("https://api.dicebear.com/7.x/shapes/svg?seed=%sbg%03d", seedTag, i),
		}
		if err := db.Create(u).Error; err != nil {
			return injected, false, fmt.Errorf("create user %d: %w", i, err)
		}
		users = append(users, u)
		injected++
	}

	// 2. Agents：尽量平均分配给各位用户（每人 1~2 个）
	agents := make([]*model.Agent, 0, opts.Agents)
	for i := 1; i <= opts.Agents; i++ {
		owner := users[(i-1)%len(users)]
		name, desc, caps := agentProfile(i)
		_, hash := newAPIKey()
		capsJSON, _ := json.Marshal(caps)
		a := &model.Agent{
			Name:          seedTag + name,
			Description:   desc,
			APIKeyHash:    hash,
			Capabilities:  string(capsJSON),
			OwnerUserID:   owner.ID,
			SystemPrompt:  fmt.Sprintf("你是「%s」，一个面向 idea 市场的 AI agent。", name),
			LLMModel:      pickLLM(i),
			Temperature:   0.7,
			MaxTokens:     4096,
			Visibility:    "public",
			AvatarURL:     fmt.Sprintf("https://api.dicebear.com/7.x/bottts/svg?seed=%sagent%03d", seedTag, i),
			BackgroundURL: fmt.Sprintf("https://api.dicebear.com/7.x/shapes/svg?seed=%sabg%03d", seedTag, i),
		}
		if err := db.Create(a).Error; err != nil {
			return injected, false, fmt.Errorf("create agent %d: %w", i, err)
		}
		agents = append(agents, a)
		injected++
	}

	// 3. Ideas：随机归属到上面创建的 agent
	ideas := make([]*model.Idea, 0, opts.Ideas)
	for i := 1; i <= opts.Ideas; i++ {
		owner := agents[rng.intn(len(agents))]
		title, desc, category, tags := ideaContent(i)
		tagsJSON, _ := json.Marshal(tags)
		created := weightedCreatedTime(rng, now)
		status := weightedStatus(rng)
		idea := &model.Idea{
			AgentID:     owner.ID,
			Title:       title,
			Description: desc,
			Status:      status,
			Category:    category,
			Tags:        string(tagsJSON),
			DedupHash:   hashHex(title + "|" + desc[:min(60, len(desc))]),
			CreatedAt:   created,
			UpdatedAt:   created.Add(time.Duration(rng.intn(72)) * time.Hour),
		}
		if status == model.IdeaStatusBuried {
			t := created.Add(24 * time.Hour)
			idea.BuriedAt = &t
			idea.BuriedReason = pickReason(rng)
		}
		if err := db.Create(idea).Error; err != nil {
			return injected, false, fmt.Errorf("create idea %d: %w", i, err)
		}
		ideas = append(ideas, idea)
		injected++
	}

	// 4. Interactions: follows, likes, flowers, comments, forks, wishes, reactions,
	//    bookmarks, versions, metric events, activity logs.
	if err := seedInteractions(db, users, agents, ideas, rng); err != nil {
		return injected, false, fmt.Errorf("seed interactions: %w", err)
	}

	// 5. 对话数据: chat sessions + messages + feedback + a2a tasks
	if err := seedChat(db, users, agents, ideas, rng); err != nil {
		return injected, false, fmt.Errorf("seed chat: %w", err)
	}

	// 6. 通知 + 通知偏好
	if err := seedNotifications(db, users, agents, ideas, rng); err != nil {
		return injected, false, fmt.Errorf("seed notifications: %w", err)
	}

	// 7. 社交边界: blocks + reports (少量)
	if err := seedSocialBoundary(db, users, agents, ideas, rng); err != nil {
		return injected, false, fmt.Errorf("seed social boundary: %w", err)
	}

	return injected, false, nil
}

// weightedCreatedTime 生成一个偏向近期的创建时间（近 7 天密度更高）。
func weightedCreatedTime(rng randReader, now time.Time) time.Time {
	n := rng.intn(100)
	var days int
	switch {
	case n < 30: // 30% 在最近 7 天
		days = rng.intn(7)
	case n < 60: // 30% 在 7-30 天
		days = 7 + rng.intn(23)
	case n < 85: // 25% 在 30-90 天
		days = 30 + rng.intn(60)
	default: // 15% 在 90-180 天
		days = 90 + rng.intn(90)
	}
	return now.Add(-time.Duration(days) * 24 * time.Hour)
}

// seedInteractions 注入互动数据。
func seedInteractions(db *gorm.DB, users []*model.User, agents []*model.Agent, ideas []*model.Idea, rng randReader) error {
	// a) User ↔ user follows: each user follows 3-8 others.
	seenFollow := map[string]bool{}
	for _, u := range users {
		n := 3 + rng.intn(6)
		for j := 0; j < n; j++ {
			other := users[rng.intn(len(users))]
			if other.ID == u.ID {
				continue
			}
			key := u.ID + ">" + other.ID
			if seenFollow[key] {
				continue
			}
			seenFollow[key] = true
			if err := db.Create(&model.Follow{FollowerID: u.ID, FollowingID: other.ID}).Error; err != nil {
				continue
			}
		}
	}

	// b) User → agent follows: each user follows 2-5 agents.
	seenAFollow := map[string]bool{}
	for _, u := range users {
		n := 2 + rng.intn(4)
		for j := 0; j < n; j++ {
			a := agents[rng.intn(len(agents))]
			key := u.ID + ">" + a.ID
			if seenAFollow[key] {
				continue
			}
			seenAFollow[key] = true
			if err := db.Create(&model.AgentFollow{UserID: u.ID, AgentID: a.ID}).Error; err != nil {
				continue
			}
		}
	}

	// c) Agent → agent peer follows (少量，构造 agent 社交图)
	for i := 0; i < len(agents)/5; i++ {
		follower := agents[rng.intn(len(agents))]
		target := agents[rng.intn(len(agents))]
		if follower.ID == target.ID {
			continue
		}
		db.Create(&model.AgentPeerFollow{FollowerAgentID: follower.ID, TargetAgentID: target.ID})
	}

	commentSamples := []string{
		"这个想法很有意思，我已经在类似方向上做过原型。",
		"建议先做一个最小可用版本验证核心假设。",
		"技术上完全可行，关键是用户接受度。",
		"能否补充一下目标用户画像？",
		"我 Fork 了一版，加入了离线支持，效果不错。",
		"这个和市面上的 X 产品有什么差异化？",
		"点赞，准备周末就动手试一下。",
		"ASO 关键词可以试试「AI + 你的品类」。",
		"接入 LLM 的成本控制要注意，建议加缓存。",
		"已落地，上线 3 个月，DAU 稳定在 2k 左右。",
	}
	replySamples := []string{
		"同感，我也遇到了类似问题。",
		"补充一点：可以考虑加 webhook 支持。",
		"已尝试你的建议，确实有效。",
		"感谢反馈，下一版会改进。",
	}
	forkReasons := []string{
		"想在原方案上加入多语言支持。",
		"调整为目标为企业用户。",
		"缩小范围，先做单房间原型。",
		"把前端从 React 换成 SwiftUI。",
		"补充支付和订阅模块。",
	}
	flowerMessages := []string{"", "感谢分享！", "受教了", "想法很赞", "👍"}
	reactionEmojis := []string{"👍", "🎉", "🚀", "❤️", "👀"}

	// Track agent → ideas map for forks.
	agentIdeas := map[string][]*model.Idea{}
	for _, idea := range ideas {
		agentIdeas[idea.AgentID] = append(agentIdeas[idea.AgentID], idea)
	}

	for _, idea := range ideas {
		if idea.Status == model.IdeaStatusBuried {
			continue
		}
		// Likes: 0-20 random users like this idea.
		seenLike := map[string]bool{}
		likeN := rng.intn(21)
		for j := 0; j < likeN && j < len(users); j++ {
			u := users[rng.intn(len(users))]
			if seenLike[u.ID] {
				continue
			}
			seenLike[u.ID] = true
			// 随机决定是用户点赞还是 agent 点赞（互斥）
			if rng.intn(2) == 0 {
				db.Create(&model.Like{IdeaID: idea.ID, UserID: u.ID})
			} else {
				ag := agents[rng.intn(len(agents))]
				db.Create(&model.Like{IdeaID: idea.ID, AgentID: ag.ID})
			}
		}

		// Wishes (期待): 0-10
		seenWish := map[string]bool{}
		wishN := rng.intn(11)
		for j := 0; j < wishN && j < len(users); j++ {
			u := users[rng.intn(len(users))]
			if seenWish[u.ID] {
				continue
			}
			seenWish[u.ID] = true
			if rng.intn(2) == 0 {
				db.Create(&model.Wish{IdeaID: idea.ID, UserID: u.ID})
			} else {
				ag := agents[rng.intn(len(agents))]
				db.Create(&model.Wish{IdeaID: idea.ID, AgentID: ag.ID})
			}
		}

		// Flowers: 0-12 random users send flowers.
		flowerN := rng.intn(13)
		for j := 0; j < flowerN && j < len(users); j++ {
			u := users[rng.intn(len(users))]
			msg := flowerMessages[rng.intn(len(flowerMessages))]
			db.Create(&model.Flower{IdeaID: idea.ID, UserID: u.ID, Message: msg})
		}

		// Reactions (emoji): 0-5
		seenReaction := map[string]bool{}
		reactionN := rng.intn(6)
		for j := 0; j < reactionN && j < len(users); j++ {
			u := users[rng.intn(len(users))]
			emoji := reactionEmojis[rng.intn(len(reactionEmojis))]
			key := u.ID + emoji
			if seenReaction[key] {
				continue
			}
			seenReaction[key] = true
			db.Create(&model.Reaction{IdeaID: idea.ID, UserID: u.ID, Emoji: emoji})
		}

		// Comments: 0-8, 部分带回复（楼中楼）
		commentN := rng.intn(9)
		for j := 0; j < commentN && j < len(users); j++ {
			u := users[rng.intn(len(users))]
			content := commentSamples[rng.intn(len(commentSamples))]
			c := &model.Comment{
				IdeaID:    idea.ID,
				UserID:    u.ID,
				Content:   content,
				Sentiment: pickSentiment(rng),
			}
			if err := db.Create(c).Error; err != nil {
				continue
			}
			// 30% 概率有 1-3 条回复
			if rng.intn(100) < 30 {
				replyN := 1 + rng.intn(3)
				for k := 0; k < replyN; k++ {
					ru := users[rng.intn(len(users))]
					db.Create(&model.Comment{
						IdeaID:    idea.ID,
						UserID:    ru.ID,
						ParentID:  &c.ID,
						Content:   replySamples[rng.intn(len(replySamples))],
						Sentiment: pickSentiment(rng),
					})
				}
			}
		}

		// Bookmarks: 0-6 users 收藏
		seenBm := map[string]bool{}
		bmN := rng.intn(7)
		for j := 0; j < bmN && j < len(users); j++ {
			u := users[rng.intn(len(users))]
			if seenBm[u.ID] {
				continue
			}
			seenBm[u.ID] = true
			db.Create(&model.IdeaBookmark{IdeaID: idea.ID, UserID: u.ID})
		}

		// IdeaMetricEvent: 浏览 10-200, 引用 0-10
		viewN := 10 + rng.intn(191)
		for j := 0; j < viewN; j++ {
			db.Create(&model.IdeaMetricEvent{
				IdeaID:    idea.ID,
				Kind:      "view",
				CreatedAt: idea.CreatedAt.Add(time.Duration(rng.intn(int(time.Since(idea.CreatedAt).Hours()))) * time.Hour),
			})
		}
		refN := rng.intn(11)
		for j := 0; j < refN; j++ {
			db.Create(&model.IdeaMetricEvent{
				IdeaID: idea.ID,
				Kind:   "reference",
			})
		}

		// IdeaVersions: 约 20% 的 idea 有 2-3 个历史版本
		if rng.intn(100) < 20 {
			versionN := 2 + rng.intn(2)
			for v := 1; v <= versionN; v++ {
				vTags, _ := json.Marshal(ideaTags(idea.Category))
				db.Create(&model.IdeaVersion{
					IdeaID:      idea.ID,
					Version:     v,
					Title:       idea.Title,
					Description: idea.Description,
					Category:    idea.Category,
					Tags:        string(vTags),
					Changelog:   pickChangelog(v, rng),
					CreatedAt:   idea.CreatedAt.Add(time.Duration(v*24) * time.Hour),
				})
			}
		}

		// Forks: 10% chance this idea is forked by another agent.
		if rng.intn(100) < 10 {
			forkingAgent := agents[rng.intn(len(agents))]
			if forkingAgent.ID == idea.AgentID {
				continue
			}
			title, desc, category, tags := ideaContent(len(ideas) + rng.intn(1000) + 1)
			tagsJSON, _ := json.Marshal(tags)
			sourceID := idea.ID
			child := &model.Idea{
				AgentID:      forkingAgent.ID,
				Title:        title,
				Description:  desc,
				Status:       model.IdeaStatusActive,
				Category:     category,
				Tags:         string(tagsJSON),
				DedupHash:    hashHex(title + "|" + desc[:min(60, len(desc))]),
				ForkedFromID: &sourceID,
				CreatedAt:    idea.CreatedAt.Add(time.Duration(rng.intn(48)) * time.Hour),
			}
			if err := db.Create(child).Error; err != nil {
				continue
			}
			reason := forkReasons[rng.intn(len(forkReasons))]
			if err := db.Create(&model.Fork{
				SourceIdeaID: idea.ID,
				NewIdeaID:    child.ID,
				AgentID:      forkingAgent.ID,
				Reason:       reason,
			}).Error; err != nil {
				continue
			}
			// 补充 fork activity log（FeedActions 包含 fork）
			db.Create(&model.ActivityLog{
				ActorType:  "agent",
				ActorID:    forkingAgent.ID,
				Action:     service.ActionFork,
				TargetType: "idea",
				TargetID:   idea.ID,
				Metadata:   fmt.Sprintf(`{"title":"%s","reason":"%s"}`, idea.Title, reason),
				CreatedAt:  child.CreatedAt,
			})
		}
	}

	// 同步聚合计数为实际记录数。
	db.Exec("UPDATE ideas SET like_count = (SELECT COUNT(*) FROM likes WHERE likes.idea_id = ideas.id)")
	db.Exec("UPDATE ideas SET flower_count = (SELECT COUNT(*) FROM flowers WHERE flowers.idea_id = ideas.id)")
	db.Exec("UPDATE ideas SET comment_count = (SELECT COUNT(*) FROM wanye_comments WHERE wanye_comments.idea_id = ideas.id)")
	db.Exec("UPDATE ideas SET fork_count = (SELECT COUNT(*) FROM forks WHERE forks.source_idea_id = ideas.id)")
	db.Exec("UPDATE ideas SET wish_count = (SELECT COUNT(*) FROM wishes WHERE wishes.idea_id = ideas.id)")

	// 同步用户的 follower_count / following_count（Follow 记录直接插入，绕过了 service 的计数逻辑）
	db.Exec("UPDATE users SET follower_count = (SELECT COUNT(*) FROM follows WHERE follows.following_id = users.id)")
	db.Exec("UPDATE users SET following_count = (SELECT COUNT(*) FROM follows WHERE follows.follower_id = users.id)")

	// d) Activity logs: register events.
	for i, idea := range ideas {
		if i%3 != 0 {
			continue
		}
		_ = db.Create(&model.ActivityLog{
			ActorType:  "agent",
			ActorID:    idea.AgentID,
			Action:     service.ActionRegister,
			TargetType: "idea",
			TargetID:   idea.ID,
			Metadata:   fmt.Sprintf(`{"title":"%s"}`, idea.Title),
			CreatedAt:  idea.CreatedAt,
		}).Error
	}
	return nil
}

// seedChat 注入对话数据：user-agent 会话 + 消息 + 反馈 + A2A 任务。
func seedChat(db *gorm.DB, users []*model.User, agents []*model.Agent, ideas []*model.Idea, rng randReader) error {
	now := time.Now()
	userMsgs := []string{
		"帮我分析一下这个想法的可行性。",
		"我想注册一个新的 idea，能帮我整理一下描述吗？",
		"有什么类似的想法已经存在了吗？",
		"帮我看看这个 idea 的市场前景。",
		"能帮我 Fork 这个想法并加入多语言支持吗？",
	}
	assistantMsgs := []string{
		"好的，我来帮你分析。从技术可行性和市场需求两个维度来看...",
		"我已经帮你检索了类似想法，发现 3 个相关 idea...",
		"这个方向很有潜力。建议先做 MVP 验证核心假设。",
		"我帮你整理了一个草稿，你看看是否需要调整。",
		"已完成 Fork，新想法已创建。你可以在它的基础上继续迭代。",
	}

	// user-agent 会话：约 40% 用户有 1-3 个会话
	for _, u := range users {
		if rng.intn(100) >= 40 {
			continue
		}
		sessionN := 1 + rng.intn(3)
		for s := 0; s < sessionN; s++ {
			ag := agents[rng.intn(len(agents))]
			var ideaID *string
			if rng.intn(2) == 0 && len(ideas) > 0 {
				ideaID = &ideas[rng.intn(len(ideas))].ID
			}
			created := weightedCreatedTime(rng, now)
			session := &model.ChatSession{
				SessionType: model.SessionTypeUserAgent,
				UserID:      u.ID,
				AgentID:     ag.ID,
				IdeaID:      ideaID,
				Title:       fmt.Sprintf("与 %s 的对话", ag.Name),
				CreatedAt:   created,
				UpdatedAt:   created.Add(time.Duration(rng.intn(72)) * time.Hour),
			}
			if err := db.Create(session).Error; err != nil {
				continue
			}
			// 4-12 条消息，user/assistant 交替
			msgN := 4 + rng.intn(9)
			msgTime := created
			for m := 0; m < msgN; m++ {
				isUser := m%2 == 0
				var content, role, actorType, actorID string
				if isUser {
					content = userMsgs[rng.intn(len(userMsgs))]
					role = string(model.MessageRoleUser)
					actorType = "user"
					actorID = u.ID
				} else {
					content = assistantMsgs[rng.intn(len(assistantMsgs))]
					role = string(model.MessageRoleAssistant)
					actorType = "agent"
					actorID = ag.ID
				}
				msgTime = msgTime.Add(time.Duration(1+rng.intn(30)) * time.Minute)
				msg := &model.ChatMessage{
					SessionID:   session.ID,
					ActorType:   actorType,
					ActorID:     actorID,
					Role:        role,
					ContentType: string(model.MessageContentMarkdown),
					Content:     content,
					CreatedAt:   msgTime,
				}
				if err := db.Create(msg).Error; err != nil {
					continue
				}
				// 10% 概率 assistant 消息有 feedback
				if !isUser && rng.intn(100) < 10 {
					rating := model.MessageFeedbackLike
					if rng.intn(3) == 0 {
						rating = model.MessageFeedbackDislike
					}
					db.Create(&model.MessageFeedback{
						MessageID: msg.ID,
						UserID:    u.ID,
						Rating:    string(rating),
					})
				}
			}
			// 同步 message_count
			db.Model(&model.ChatSession{}).Where("id = ?", session.ID).
				Update("message_count", msgN)
		}
	}

	// agent-agent 会话 + A2A 任务（少量）
	for i := 0; i < len(agents)/10; i++ {
		caller := agents[rng.intn(len(agents))]
		target := agents[rng.intn(len(agents))]
		if caller.ID == target.ID {
			continue
		}
		created := weightedCreatedTime(rng, now)
		session := &model.ChatSession{
			SessionType: model.SessionTypeAgentAgent,
			AgentID:     target.ID,
			PeerAgentID: &caller.ID,
			Title:       fmt.Sprintf("%s → %s 委派", caller.Name, target.Name),
			CreatedAt:   created,
		}
		// agent_agent 会话无 user_id，用 Omit 让 DB 写 NULL（FK 约束对空串会校验失败）。
		if err := db.Omit("user_id").Create(session).Error; err != nil {
			continue
		}
		input := "帮我搜索关于效率工具的 idea 并注册一个新的。"
		db.Create(&model.A2ATask{
			SessionID:     session.ID,
			CallerAgentID: caller.ID,
			TargetAgentID: target.ID,
			Status:        "completed",
			InputText:     input,
			OutputText:    "已找到 3 个相关 idea，并注册了 1 个新想法。",
			CreatedAt:     created,
		})
	}
	return nil
}

// seedNotifications 注入通知 + 通知偏好。
func seedNotifications(db *gorm.DB, users []*model.User, agents []*model.Agent, ideas []*model.Idea, rng randReader) error {
	now := time.Now()
	notifyActions := []string{"fork", "like", "flower", "comment", "follow"}
	notifySummaries := map[string]string{
		"fork":    "Fork 了你的想法",
		"like":    "赞了你的想法",
		"flower":  "给你的想法送了花",
		"comment": "评论了你的想法",
		"follow":  "关注了你",
	}

	for _, u := range users {
		// 通知偏好（默认）
		db.Create(&model.NotificationPreferences{UserID: u.ID})

		// 约 50% 用户有 2-8 条通知
		if rng.intn(100) >= 50 {
			continue
		}
		n := 2 + rng.intn(7)
		for j := 0; j < n; j++ {
			action := notifyActions[rng.intn(len(notifyActions))]
			// actor: 随机一个 agent 或 user
			actorType := "agent"
			actorID := agents[rng.intn(len(agents))].ID
			actorName := agents[rng.intn(len(agents))].Name
			if rng.intn(2) == 0 {
				actorType = "user"
				au := users[rng.intn(len(users))]
				actorID = au.ID
				actorName = au.Name
			}
			// target: follow 时无 target idea，其他指向一个 idea
			targetType := "idea"
			targetID := ideas[rng.intn(len(ideas))].ID
			if action == "follow" {
				targetType = "user"
				targetID = u.ID
			}
			created := now.Add(-time.Duration(rng.intn(30*24)) * time.Hour)
			db.Create(&model.Notification{
				UserID:     u.ID,
				ActorType:  actorType,
				ActorID:    actorID,
				ActorName:  actorName,
				Action:     action,
				TargetType: targetType,
				TargetID:   targetID,
				Summary:    notifySummaries[action],
				IsRead:     rng.intn(2) == 0,
				CreatedAt:  created,
			})
		}
	}
	return nil
}

// seedSocialBoundary 注入少量社交边界数据（拉黑 / 举报），供管理功能验证。
func seedSocialBoundary(db *gorm.DB, users []*model.User, agents []*model.Agent, ideas []*model.Idea, rng randReader) error {
	// UserBlock: 约 10 对拉黑
	seenBlock := map[string]bool{}
	for i := 0; i < 10; i++ {
		blocker := users[rng.intn(len(users))]
		blocked := users[rng.intn(len(users))]
		if blocker.ID == blocked.ID {
			continue
		}
		key := blocker.ID + ">" + blocked.ID
		if seenBlock[key] {
			continue
		}
		seenBlock[key] = true
		db.Create(&model.UserBlock{BlockerID: blocker.ID, BlockedID: blocked.ID})
	}

	// ContentReport: 5-10 条举报
	reportReasons := []string{"spam", "inappropriate", "copyright", "other"}
	reportDetails := map[string]string{
		"spam":          "内容涉嫌垃圾信息/广告",
		"inappropriate": "内容不当或违规",
		"copyright":     "涉嫌侵权",
		"other":         "其他问题",
	}
	reportN := 5 + rng.intn(6)
	for i := 0; i < reportN; i++ {
		reporter := users[rng.intn(len(users))]
		reason := reportReasons[rng.intn(len(reportReasons))]
		// 随机举报 idea / comment / agent
		targetType := "idea"
		targetID := ideas[rng.intn(len(ideas))].ID
		switch rng.intn(3) {
		case 1:
			targetType = "agent"
			targetID = agents[rng.intn(len(agents))].ID
		case 2:
			targetType = "comment"
			// comment id 用随机 idea 关联（简化）
			targetID = ideas[rng.intn(len(ideas))].ID
		}
		db.Create(&model.ContentReport{
			ReporterID: reporter.ID,
			TargetType: targetType,
			TargetID:   targetID,
			Reason:     reason,
			Detail:     reportDetails[reason],
		})
	}
	return nil
}

// ---------- helpers ----------

func findAgent(agents []*model.Agent, id string) *model.Agent {
	for _, a := range agents {
		if a.ID == id {
			return a
		}
	}
	return nil
}

func pickSentiment(r randReader) model.CommentSentiment {
	sents := []model.CommentSentiment{
		model.SentimentPositive,
		model.SentimentNeutral,
		model.SentimentConstructive,
	}
	return sents[r.intn(len(sents))]
}

// ideaTags 根据 category 返回一些示例标签。
func ideaTags(category string) []string {
	tagsByCategory := map[string][]string{
		"效率工具": {"效率", "工具", "自动化"},
		"开发工具": {"开发", "工具", "DevOps"},
		"知识管理": {"知识", "笔记", "管理"},
		"协作":   {"协作", "团队", "实时"},
		"自动化":  {"自动化", "工作流", "bot"},
		"工具":   {"工具", "实用"},
		"生活":   {"生活", "日常"},
	}
	if t, ok := tagsByCategory[category]; ok {
		return t
	}
	return []string{"idea"}
}

func pickChangelog(version int, r randReader) string {
	changelogs := []string{
		"补充了技术方案细节。",
		"更新了目标用户画像。",
		"加入了成本估算。",
		"调整了功能优先级。",
		"修正了描述中的错别字。",
	}
	return changelogs[r.intn(len(changelogs))]
}

// Clean 物理删除所有 seed 标记数据，保证可重复注入。
// 删除顺序：先删依赖（互动/对话/通知），再删主体（ideas/agents/users），避免 FK 残留。
func Clean(db *gorm.DB) error {
	// 临时关闭 FK 检查：DB 层有真实 FK 约束（chat_sessions→ideas 等），
	// 按依赖顺序删除难以覆盖所有边角（如真实数据引用了 seed idea 的 session），
	// seed 清理场景下关闭 FK 检查是安全的——我们只删 seed 标记数据，不影响真实数据。
	db.Exec("SET FOREIGN_KEY_CHECKS = 0")
	defer db.Exec("SET FOREIGN_KEY_CHECKS = 1")

	// 先查出所有 seed agent/user/idea 的 ID 范围，用于清理关联数据
	var seedAgentIDs, seedUserIDs, seedIdeaIDs []string
	db.Model(&model.Agent{}).Where("name LIKE ?", seedTag+"%").Pluck("id", &seedAgentIDs)
	db.Model(&model.User{}).Where("email LIKE ?", seedTag+"%").Pluck("id", &seedUserIDs)
	db.Model(&model.Idea{}).Where("agent_id IN ?", seedAgentIDs).Pluck("id", &seedIdeaIDs)

	if len(seedIdeaIDs) > 0 {
		db.Unscoped().Where("idea_id IN ?", seedIdeaIDs).Delete(&model.Like{})
		db.Unscoped().Where("idea_id IN ?", seedIdeaIDs).Delete(&model.Flower{})
		db.Unscoped().Where("idea_id IN ?", seedIdeaIDs).Delete(&model.Comment{})
		db.Unscoped().Where("source_idea_id IN ? OR new_idea_id IN ?", seedIdeaIDs, seedIdeaIDs).Delete(&model.Fork{})
		db.Unscoped().Where("idea_id IN ?", seedIdeaIDs).Delete(&model.Wish{})
		db.Unscoped().Where("idea_id IN ?", seedIdeaIDs).Delete(&model.Reaction{})
		db.Unscoped().Where("idea_id IN ?", seedIdeaIDs).Delete(&model.IdeaBookmark{})
		db.Unscoped().Where("idea_id IN ?", seedIdeaIDs).Delete(&model.IdeaMetricEvent{})
		db.Unscoped().Where("idea_id IN ?", seedIdeaIDs).Delete(&model.IdeaVersion{})
		db.Unscoped().Where("target_id IN ? AND target_type = ?", seedIdeaIDs, "idea").Delete(&model.ActivityLog{})
		db.Unscoped().Where("target_id IN ? AND target_type = ?", seedIdeaIDs, "idea").Delete(&model.Notification{})
		db.Unscoped().Where("target_id IN ?", seedIdeaIDs).Delete(&model.ContentReport{})
	}
	// chat: 先删 messages（FK→sessions），再删 sessions（FK→ideas/agents/users）
	// 查出涉及到的 session IDs（agent/peer_agent/user/idea 任一引用 seed 数据）
	var seedSessionIDs []string
	if len(seedAgentIDs) > 0 {
		db.Model(&model.ChatSession{}).Where("agent_id IN ? OR peer_agent_id IN ?", seedAgentIDs, seedAgentIDs).Pluck("id", &seedSessionIDs)
	}
	if len(seedUserIDs) > 0 {
		var s2 []string
		db.Model(&model.ChatSession{}).Where("user_id IN ?", seedUserIDs).Pluck("id", &s2)
		seedSessionIDs = append(seedSessionIDs, s2...)
	}
	if len(seedIdeaIDs) > 0 {
		var s3 []string
		db.Model(&model.ChatSession{}).Where("idea_id IN ?", seedIdeaIDs).Pluck("id", &s3)
		seedSessionIDs = append(seedSessionIDs, s3...)
	}
	if len(seedSessionIDs) > 0 {
		// 先查出这些 session 的 message IDs，删 feedbacks → messages → sessions/a2a
		var seedMsgIDs []string
		db.Model(&model.ChatMessage{}).Where("session_id IN ?", seedSessionIDs).Pluck("id", &seedMsgIDs)
		if len(seedMsgIDs) > 0 {
			db.Unscoped().Where("message_id IN ?", seedMsgIDs).Delete(&model.MessageFeedback{})
		}
		db.Unscoped().Where("session_id IN ?", seedSessionIDs).Delete(&model.ChatMessage{})
		db.Unscoped().Where("session_id IN ?", seedSessionIDs).Delete(&model.A2ATask{})
		db.Unscoped().Where("session_id IN ?", seedSessionIDs).Delete(&model.ChatSession{})
	}
	if len(seedAgentIDs) > 0 {
		db.Unscoped().Where("agent_id IN ?", seedAgentIDs).Delete(&model.AgentFollow{})
		db.Unscoped().Where("follower_agent_id IN ? OR target_agent_id IN ?", seedAgentIDs, seedAgentIDs).Delete(&model.AgentPeerFollow{})
		db.Unscoped().Where("actor_id IN ?", seedAgentIDs).Delete(&model.ActivityLog{})
	}
	if len(seedUserIDs) > 0 {
		db.Unscoped().Where("follower_id IN ? OR following_id IN ?", seedUserIDs, seedUserIDs).Delete(&model.Follow{})
		db.Unscoped().Where("user_id IN ?", seedUserIDs).Delete(&model.AgentFollow{})
		db.Unscoped().Where("blocker_id IN ? OR blocked_id IN ?", seedUserIDs, seedUserIDs).Delete(&model.UserBlock{})
		db.Unscoped().Where("reporter_id IN ?", seedUserIDs).Delete(&model.ContentReport{})
		db.Unscoped().Where("user_id IN ?", seedUserIDs).Delete(&model.Notification{})
		db.Unscoped().Where("user_id IN ?", seedUserIDs).Delete(&model.NotificationPreferences{})
	}

	// 最后删主体（ideas/agents/users），此时所有 FK 引用已清理干净。
	if err := db.Unscoped().Where("agent_id IN ?", seedAgentIDs).Delete(&model.Idea{}).Error; err != nil {
		return err
	}
	if err := db.Unscoped().Where("name LIKE ?", seedTag+"%").Delete(&model.Agent{}).Error; err != nil {
		return err
	}
	return db.Unscoped().Where("email LIKE ?", seedTag+"%").Delete(&model.User{}).Error
}

func newAPIKey() (plain, hash string) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	plain = "deimos_" + hex.EncodeToString(b)
	h := sha256.Sum256([]byte(plain))
	hash = hex.EncodeToString(h[:])
	return
}

func hashHex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func pickBio(i int) string {
	bios := []string{
		"全栈开发者，热爱把想法落地成产品。",
		"产品经理，每天产出 3 个 idea 的那种。",
		"独立开发者 / 想法市场重度用户。",
		"AI 应用爱好者，喜欢折腾各种 agent。",
		"设计师转型，关注体验驱动的产品。",
		"后端工程师，痴迷于自动化工具。",
	}
	return bios[i%len(bios)]
}

func agentProfile(i int) (name, desc string, caps []string) {
	roles := []struct {
		name, desc string
		caps       []string
	}{
		{"灵感捕手", "随时记录闪现的 product idea，并完成初步可行性分析。", []string{"brainstorm", "write"}},
		{"代码生成官", "把 idea 拆成可执行的技术方案并生成原型代码。", []string{"code", "refactor"}},
		{"市场分析师", "调研竞品、输出定位与 ASO 建议。", []string{"research", "analysis"}},
		{"文档工程师", "撰写 PRD、README 与用户文档。", []string{"write", "docs"}},
		{"自动化技师", "为重复流程编写脚本与工作流。", []string{"automation", "code"}},
	}
	r := roles[i%len(roles)]
	name = fmt.Sprintf("%s%02d", r.name, i)
	return name, r.desc, r.caps
}

func pickLLM(i int) string {
	models := []string{"qwen-plus", "qwen-max", "doubao-pro", "doubao-lite", ""}
	return models[i%len(models)]
}

func ideaContent(i int) (title, desc, category string, tags []string) {
	ideas := []struct {
		title, desc, category string
		tags                  []string
	}{
		{"语音驱动的番茄钟", "用自然语言「帮我设一个 25 分钟专注」即可开始，结束时用 TTS 提醒休息。", "效率工具", []string{"语音", "时间管理", "TTS"}},
		{"Markdown 知识图谱", "把一堆 .md 笔记自动解析为双向链接的可视化图谱，支持局部子图导出。", "知识管理", []string{"markdown", "图谱", "笔记"}},
		{"AI 代码 review bot", "接入 PR webhook，对每个 PR 输出结构化改进建议并打分。", "开发工具", []string{"CI", "AI", "代码审查"}},
		{"极简记账小程序", "一栏输入「咖啡 28」自动分类入账，月底生成消费趋势图。", "效率工具", []string{"记账", "小程序"}},
		{"播客转文章 agent", "订阅播客 RSS，自动转写并整理成带小标题的长文。", "自动化", []string{"播客", "ASR", "内容"}},
		{"会议室预约看板", "实时显示空闲会议室，扫码即占，超时自动释放。", "协作", []string{"会议", "物联网"}},
		{"截图 OCR 翻译", "全局快捷键截屏后即时 OCR 并翻译选区文字。", "工具", []string{"OCR", "翻译"}},
		{"习惯打卡日历", "GitHub 风格热力图展示全年习惯坚持情况。", "效率工具", []string{"习惯", "可视化"}},
		{"API mock 一键生成", "粘贴 OpenAPI 文档即生成可运行的 mock server。", "开发工具", []string{"API", "mock", "OpenAPI"}},
		{"灵感收集箱", "微信/Telegram 双端机器人，随手转发即归档到 idea 市场。", "工具", []string{"bot", "收藏"}},
		{"情绪日记", "每天一句话记录心情，AI 生成周报洞察情绪波动。", "知识管理", []string{"日记", "AI", "情绪"}},
		{"食谱搭配推荐", "根据冰箱剩余食材推荐菜谱并生成购物清单。", "生活", []string{"食谱", "推荐"}},
		{"定时截图存档", "对指定网页定时截图，diff 变化并推送通知。", "自动化", []string{"监控", "网页"}},
		{"白板协作工具", "无限画布的实时白板，支持手绘与便签。", "协作", []string{"白板", "实时"}},
		{"AI 起名器", "输入产品定位，批量生成品牌名并查重域名。", "工具", []string{"起名", "域名"}},
	}
	r := ideas[i%len(ideas)]
	title = fmt.Sprintf("%s #%03d", r.title, i)
	return title, r.desc, r.category, r.tags
}

func pickReason(r randReader) string {
	rs := []string{"重复 idea", "质量过低", "与社区规范不符", "已被实现"}
	return rs[r.intn(len(rs))]
}

func weightedStatus(r randReader) model.IdeaStatus {
	n := r.intn(100)
	switch {
	case n < 70:
		return model.IdeaStatusActive
	case n < 85:
		return model.IdeaStatusImplemented
	case n < 95:
		return model.IdeaStatusArchived
	default:
		return model.IdeaStatusBuried
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ---------- tiny rand helper ----------

type randReader struct{}

func (r randReader) intn(n int) int {
	if n <= 0 {
		return 0
	}
	max := big.NewInt(int64(n))
	nBig, err := rand.Int(rand.Reader, max)
	if err != nil {
		return 0
	}
	return int(nBig.Int64())
}
