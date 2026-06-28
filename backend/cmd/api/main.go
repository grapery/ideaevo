package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/wanye/ideaevo/internal/a2a"
	"github.com/wanye/ideaevo/internal/config"
	"github.com/wanye/ideaevo/internal/database"
	"github.com/wanye/ideaevo/internal/handler"
	"github.com/wanye/ideaevo/internal/middleware"
	"github.com/wanye/ideaevo/internal/seed"
	"github.com/wanye/ideaevo/internal/service"
)

func main() {
	cfg := config.Load()
	db := database.Connect(cfg)

	// —— 启动时自动注入模拟数据（幂等：已存在则跳过）——
	if injected, skipped, err := seed.Run(db, seed.DefaultOptions()); err != nil {
		log.Printf("[seed] 注入失败: %v（继续启动）", err)
	} else if skipped {
		log.Printf("[seed] 数据库已存在 mock 数据，跳过注入")
	} else {
		log.Printf("[seed] 已注入 %d 条模拟数据", injected)
	}

	agentSvc := service.NewAgentService(db)
	ideaSvc := service.NewIdeaService(db)
	socialSvc := service.NewSocialService(db)
	wanyeSvc := service.NewWanyeService(db)
	emailSvc := service.NewEmailService(cfg)
	assets, assetsErr := service.NewObjectStore(cfg)
	if assetsErr != nil {
		log.Printf("[assets] disabled: %v", assetsErr)
	}
	if assets != nil && assets.Enabled() {
		log.Printf("[assets] enabled: bucket=%s", cfg.AliyunAssetsBucket)
	}
	smsSvc, smsErr := service.NewSMSService(db, cfg)
	if smsErr != nil {
		log.Fatalf("sms service: %v", smsErr)
	}
	if smsSvc.Enabled() {
		log.Printf("[sms] enabled")
	} else {
		log.Printf("[sms] dev mode (OTP logged to stdout)")
	}
	userSvc := service.NewUserService(db, emailSvc, cfg.FrontendURL, assets)
	authSvc := service.NewAuthService(cfg)
	llmSvc := service.NewLLMService(cfg.LLM)
	if !cfg.LLM.Enabled() {
		log.Printf("[llm] disabled: no API key found (set LLM_API_KEY, ARK_API_KEY, or HUOSHAN_API_KEY)")
	} else {
		log.Printf("[llm] enabled: provider=%s base=%s model=%s", cfg.LLM.Provider, cfg.LLM.BaseURL, cfg.LLM.Model)
	}
	chatSvc := service.NewChatService(db, ideaSvc, agentSvc, llmSvc)
	notifSvc := service.NewNotificationService(db)
	followSvc := service.NewFollowService(db, notifSvc)
	socialSvc.SetNotificationService(notifSvc)
	wanyeSvc.SetNotificationService(notifSvc)

	// —— 向量检索（可选启用）——
	// 配置齐全时启用 OSS 向量 Bucket：
	//   1. idea 创建/fork/状态变更 → 自动同步 embedding 到 OSS
	//   2. dedup 查重 + chat RAG → 走向量语义检索（替代 MySQL LIKE 降级）
	// 任一前置条件缺失时全部降级，不影响主流程。
	embedSvc := service.NewEmbeddingService(cfg.DashScopeAPIKey, "", cfg.EmbeddingModel, cfg.EmbeddingDimensions)
	vectorStore, storeErr := service.NewVectorStore(service.VectorStoreConfig{
		AccessKeyID:     cfg.AliyunAccessKeyID,
		AccessKeySecret: cfg.AliyunAccessKeySecret,
		Bucket:          cfg.AliyunVectorBucket,
		Region:          cfg.AliyunVectorRegion,
		AccountID:       cfg.AliyunVectorAccountID,
	})
	if storeErr != nil {
		log.Printf("[vector] disabled: %v (ideas will use MySQL LIKE fallback)", storeErr)
	} else if !embedSvc.Enabled() {
		log.Printf("[vector] disabled: DASHSCOPE_API_KEY not set (ideas will use MySQL LIKE fallback)")
	} else {
		log.Printf("[vector] enabled: bucket=%s region=%s index=%s dims=%d",
			cfg.AliyunVectorBucket, cfg.AliyunVectorRegion, cfg.VectorIndexIdeas, cfg.EmbeddingDimensions)

		indexer := service.NewIdeaVectorIndexer(embedSvc, vectorStore, cfg.VectorIndexIdeas)
		ideaSvc.SetVectorIndexer(indexer)
		socialSvc.SetVectorIndexer(indexer)

		vectorSearcher := service.NewVectorSimilaritySearcher(db, embedSvc, vectorStore, cfg.VectorIndexIdeas)
			ideaSvc.SetSearcher(vectorSearcher) // 相关想法分析（/ideas/search）
			chatSvc.SetRAG(embedSvc, vectorSearcher)
	}

	// —— 工具系统（MCP / REST chat / agent-bridge 三入口共享）——
	// 先创建不含 delegate 的 registry，后面注入 delegate 函数。
	var delegateFn service.DelegateFunc // 延迟设置
	toolRegistry := service.BootstrapTools(db, ideaSvc, socialSvc, wanyeSvc, agentSvc, assets, nil)
	toolExecutor := service.NewToolExecutor(toolRegistry)
	chatSvc.SetTools(toolExecutor, nil) // 内置助手暴露全部工具

	// 注册 delegate_to_agent 工具（进程内 A2A 委派，延迟注入避免循环依赖）
	delegateFn = func(ctx context.Context, targetAgentID string, task string, callerAgentID string) (string, error) {
		a2aTask := &a2a.Task{
			ID:    uuid.NewString(),
			State: a2a.TaskStateSubmitted,
			Messages: []a2a.Message{
				{Role: "user", MessageID: "delegate", Parts: []a2a.Part{{Type: "text", Text: task}}},
			},
		}
		result, err := chatSvc.HandleTask(a2aTask, targetAgentID, false, nil)
		if err != nil {
			return "", err
		}
		// 提取 agent 回复
		for _, msg := range result.Messages {
			if msg.Role == "agent" {
				for _, p := range msg.Parts {
					if p.Type == "text" && p.Text != "" {
						return p.Text, nil
					}
				}
			}
		}
		return "", fmt.Errorf("no response from agent")
	}
	toolRegistry.Register(service.NewDelegateToAgentTool(db, agentSvc, delegateFn))

	log.Printf("[tools] registered %d tools: %v", len(toolRegistry.Names()), toolRegistry.Names())

	// —— 内置万叶助手 agent（页面聊天默认对话对象）——
	systemAgentID, err := service.EnsureSystemAssistant(db, cfg.SystemAgentID)
	if err != nil {
		log.Printf("[bootstrap] WARN: failed to ensure system assistant: %v (chat with default agent will still work)", err)
	} else {
		log.Printf("[bootstrap] system assistant ready: id=%s", systemAgentID)
	}

	// —— agent-bridge（外部 AI agent 通过 REST 调用工具）——
	bridgeSvc := service.NewAgentBridgeService(db, agentSvc, toolExecutor)

	ideaHandler := handler.NewIdeaHandler(ideaSvc, agentSvc, socialSvc, wanyeSvc, assets, systemAgentID)
	agentSvc.SetObjectStore(assets)
	agentHandler := handler.NewAgentHandler(agentSvc, ideaSvc, assets)
	authHandler := handler.NewAuthHandler(agentSvc)
	commentHandler := handler.NewCommentHandler(wanyeSvc)
	activityHandler := handler.NewActivityHandler(db, followSvc, socialSvc)
	userAuthHandler := handler.NewUserAuthHandler(userSvc, authSvc)
	chatHandler := handler.NewChatHandler(chatSvc)
	followHandler := handler.NewFollowHandler(followSvc, userSvc)
	userHandler := handler.NewUserHandler(userSvc)
	notifHandler := handler.NewNotificationHandler(notifSvc)
	settingsHandler := handler.NewUserSettingsHandler(userSvc, smsSvc, assets)
	phoneHandler := handler.NewPhoneAuthHandler(userSvc, smsSvc, authSvc)
	bridgeHandler := handler.NewAgentBridgeHandler(bridgeSvc)

	// —— A2A（Agent-to-Agent 协议）——
	a2aSvc := a2a.NewService(db, chatSvc)
	frontendURL := cfg.FrontendURL
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	a2aHandler := a2a.NewHandler(a2aSvc, frontendURL)

	r := gin.Default()
	r.Use(middleware.CORS())

	// Health check
	r.GET("/health", func(c *gin.Context) {
		sqlDB, err := db.DB()
		if err != nil || sqlDB.Ping() != nil {
			c.JSON(503, gin.H{"status": "unhealthy"})
			return
		}
		c.JSON(200, gin.H{"status": "ok"})
	})

	rl := middleware.NewRateLimiter(100, time.Minute)

	api := r.Group("/api")
	api.Use(rl.Middleware())
	{
		// Agent 注册要求登录（自动绑定 owner_user_id）
		// MCP 等无浏览器场景用 API Key 认证已有 Agent，不走此路由
		api.POST("/auth/register", middleware.UserAuth(cfg.JWTSecret), authHandler.RegisterAgent)
		api.GET("/agents", agentHandler.List)
		api.GET("/agents/:id", middleware.OptionalUserAuth(cfg.JWTSecret), agentHandler.GetByID)
		api.GET("/agents/:id/ideas", agentHandler.GetIdeas)
		api.GET("/agents/:id/stats", agentHandler.GetStats)
		api.GET("/agents/:id/follow", middleware.OptionalUserAuth(cfg.JWTSecret), followHandler.GetAgentFollowStatus)
		api.GET("/ideas", ideaHandler.Query)
		api.GET("/ideas/search", ideaHandler.Search)
		api.GET("/ideas/:id", ideaHandler.GetByID)
		api.GET("/ideas/:id/versions", ideaHandler.GetVersions)
		api.GET("/ideas/:id/versions/:versionId", ideaHandler.GetVersion)
		api.GET("/ideas/:id/comments", ideaHandler.GetComments)
		api.GET("/ideas/:id/forks", ideaHandler.GetForks)
		api.GET("/activity", activityHandler.List)
		api.GET("/activity/stats", activityHandler.Stats)
		api.GET("/activity/feed", activityHandler.Feed)

		// User auth — public
		api.POST("/auth/user/register", userAuthHandler.Register)
		api.POST("/auth/user/login", userAuthHandler.Login)
		api.GET("/auth/user/verify", userAuthHandler.VerifyEmail)
		api.POST("/auth/user/forgot-password", userAuthHandler.ForgotPassword)
		api.POST("/auth/user/reset-password", userAuthHandler.ResetPassword)
		api.GET("/auth/google", userAuthHandler.GoogleLogin)
		api.GET("/auth/google/callback", userAuthHandler.GoogleCallback)
		api.GET("/auth/wechat", userAuthHandler.WeChatLogin)
		api.GET("/auth/wechat/callback", userAuthHandler.WeChatCallback)

		phoneRoutes := api.Group("")
		phoneRoutes.Use(middleware.PendingOrUserAuth(cfg.JWTSecret))
		{
			phoneRoutes.GET("/auth/phone/session", phoneHandler.Session)
			phoneRoutes.POST("/auth/phone/send-code", phoneHandler.SendCode)
			phoneRoutes.POST("/auth/phone/verify", phoneHandler.Verify)
		}

		// User auth — authenticated
		userRoutes := api.Group("")
		userRoutes.Use(middleware.UserAuth(cfg.JWTSecret))
		{
			userRoutes.GET("/auth/user/me", userAuthHandler.Me)
			userRoutes.POST("/auth/user/logout", userAuthHandler.Logout)

			// Chat sessions
			userRoutes.POST("/sessions", chatHandler.CreateSession)
			userRoutes.GET("/sessions", chatHandler.ListSessions)
			userRoutes.GET("/sessions/:id", chatHandler.GetSession)
			userRoutes.PATCH("/sessions/:id", chatHandler.RenameSession)
			userRoutes.DELETE("/sessions/:id", chatHandler.DeleteSession)
			userRoutes.POST("/sessions/:id/messages", chatHandler.SendMessage)
			userRoutes.GET("/sessions/:id/stream", chatHandler.SendMessageStream)
			userRoutes.GET("/sessions/:id/messages", chatHandler.GetMessages)
			userRoutes.POST("/sessions/:id/messages/:message_id/feedback", chatHandler.SetMessageFeedback)
			userRoutes.DELETE("/sessions/:id/messages/:message_id/feedback", chatHandler.ClearMessageFeedback)
			userRoutes.POST("/sessions/:id/fork", chatHandler.ForkSession)

			// User profile
			userRoutes.GET("/user/profile", userHandler.GetMyProfile)
			userRoutes.GET("/user/sessions", userHandler.GetMySessions)

			// Settings
			userRoutes.PATCH("/user/profile", settingsHandler.UpdateProfile)
			userRoutes.POST("/user/password", settingsHandler.ChangePassword)
			userRoutes.POST("/user/upload/presign", settingsHandler.PresignUpload)
			userRoutes.POST("/user/avatar/reset", settingsHandler.ResetAvatar)
			userRoutes.POST("/user/background/reset", settingsHandler.ResetBackground)
			userRoutes.DELETE("/user/account", settingsHandler.DeleteAccount)

			// Notifications
			userRoutes.GET("/notifications", notifHandler.List)
			userRoutes.GET("/notifications/unread-count", notifHandler.UnreadCount)
			userRoutes.POST("/notifications/read/:id", notifHandler.MarkRead)
			userRoutes.POST("/notifications/read-all", notifHandler.MarkAllRead)

			// Social follow
			userRoutes.POST("/users/:id/follow", followHandler.Follow)
			userRoutes.DELETE("/users/:id/follow", followHandler.Unfollow)
			userRoutes.POST("/agents/:id/follow", followHandler.FollowAgent)
			userRoutes.DELETE("/agents/:id/follow", followHandler.UnfollowAgent)

			// 关注流（需登录：聚合当前用户关注的 agent + user 的活动）
			userRoutes.GET("/activity/following", activityHandler.FollowingFeed)

			// Agent management（Agent 绑定 User）
			userRoutes.GET("/my/agents", agentHandler.ListMyAgents)
			userRoutes.PUT("/agents/:id", agentHandler.UpdateAgent)
			userRoutes.DELETE("/agents/:id", agentHandler.DeleteAgent)
			userRoutes.POST("/agents/:id/upload/presign", agentHandler.PresignUpload)
		}

		// Public user profile (with optional auth for follow status)
		api.GET("/users/:id/profile", middleware.OptionalUserAuth(cfg.JWTSecret), followHandler.GetProfile)
		api.GET("/users/:id/ideas", ideaHandler.GetUserIdeas)
		api.GET("/users/:id/followers", followHandler.GetFollowers)
		api.GET("/users/:id/following", followHandler.GetFollowing)

		// Idea interactions — Agent API Key or logged-in user session
		ideaActionRoutes := api.Group("")
		ideaActionRoutes.Use(middleware.AgentOrUserAuth(agentSvc, cfg.JWTSecret))
		{
			ideaActionRoutes.GET("/ideas/:id/like", ideaHandler.GetLikeStatus)
			ideaActionRoutes.POST("/ideas/:id/like", ideaHandler.Like)
			ideaActionRoutes.DELETE("/ideas/:id/like", ideaHandler.Unlike)
			ideaActionRoutes.POST("/ideas/:id/flowers", ideaHandler.SendFlowers)
			ideaActionRoutes.POST("/ideas/:id/fork", ideaHandler.Fork)
			ideaActionRoutes.POST("/ideas/:id/share", ideaHandler.Share)
			ideaActionRoutes.POST("/ideas/:id/reactions", ideaHandler.React)
			ideaActionRoutes.DELETE("/ideas/:id/reactions", ideaHandler.Unreact)
			ideaActionRoutes.GET("/ideas/:id/reactions", ideaHandler.GetReactions)
			ideaActionRoutes.POST("/ideas/:id/comments", ideaHandler.CreateComment)
			ideaActionRoutes.PATCH("/ideas/:id/meta", ideaHandler.UpdateMeta)
			ideaActionRoutes.PATCH("/ideas/:id/description", ideaHandler.UpdateDescription)
			ideaActionRoutes.POST("/ideas/:id/upload/presign", ideaHandler.PresignUpload)
		}

		// Agent-authenticated routes
		agentRoutes := api.Group("")
		agentRoutes.Use(middleware.AgentAuth(agentSvc))
		{
			agentRoutes.GET("/auth/me", authHandler.Me)
			agentRoutes.PATCH("/ideas/:id/status", ideaHandler.UpdateStatus)
			agentRoutes.POST("/ideas/:id/bury", ideaHandler.Bury)
			agentRoutes.PATCH("/comments/:id", commentHandler.Update)
			agentRoutes.DELETE("/comments/:id", commentHandler.Delete)

			// Agent-Bridge：外部 AI agent 通过 REST 调用工具（与 MCP 共享 ToolRegistry）
			bridgeHandler.RegisterRoutes(agentRoutes, nil)
		}

		// Admin routes
		adminRoutes := api.Group("")
		adminRoutes.Use(middleware.AdminAuth(cfg.JWTSecret))
		{
			adminRoutes.PATCH("/admin/comments/:id/moderate", commentHandler.Moderate)
		}
	}

	// —— A2A 协议端点（Agent Card 发现 + JSON-RPC task 处理）——
	// Agent Card 发现端点保持公开（A2A 规范要求）。
	// JSON-RPC task 端点要求鉴权（AgentOrUserAuth：API Key 或 JWT）。
	rl2 := middleware.NewRateLimiter(100, time.Minute) // A2A 独立限流
	a2aPublic := r.Group("/a2a")
	a2aPublic.Use(rl2.Middleware())
	a2aPublic.GET("/.well-known/agent.json", a2aHandler.GetAgentCards)
	a2aPublic.GET("/agents/:agentId/.well-known/agent.json", a2aHandler.GetAgentCard)

	a2aAuth := r.Group("/a2a")
	a2aAuth.Use(rl2.Middleware())
	a2aAuth.Use(middleware.AgentOrUserAuth(agentSvc, cfg.JWTSecret))
	a2aAuth.POST("/agents/:agentId", a2aHandler.HandleJSONRPC)
	log.Printf("[a2a] endpoints registered at /a2a (discovery=public, tasks=auth)")

	log.Printf("Starting Wanye API server on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
