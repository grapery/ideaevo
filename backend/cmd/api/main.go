package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
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
	"github.com/wanye/ideaevo/pkg/dashvector"
)

func main() {
	cfg := config.Load()
	db := database.Connect(cfg)

	// —— 启动时自动注入模拟数据（幂等：已存在则跳过）——
	// 默认不注入：贴近真实的 mock 数据由 `make seed`（cmd/seed）负责，
	// 避免机械命名的批量数据污染演示环境。需要旧的批量注入时设 SEED_AUTO=1。
	if os.Getenv("SEED_AUTO") == "1" {
		if injected, skipped, err := seed.Run(db, seed.DefaultOptions()); err != nil {
			log.Printf("[seed] 注入失败: %v（继续启动）", err)
		} else if skipped {
			log.Printf("[seed] 数据库已存在 mock 数据，跳过注入")
		} else {
			log.Printf("[seed] 已注入 %d 条模拟数据", injected)
		}
	}

	agentSvc := service.NewAgentService(db)
	ideaSvc := service.NewIdeaService(db)
	socialSvc := service.NewSocialService(db)
	commentSvc := service.NewCommentService(db)
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

	// —— 计费/会员/充值模块 ——
	quotaSvc := service.NewQuotaService(db)
	subSvc := service.NewSubscriptionService(db, quotaSvc, agentSvc)
	orderSvc := service.NewOrderService(db, subSvc)
	refundSvc := service.NewRefundService(db, subSvc)
	// 注册支付网关（凭证缺失时各网关 Enabled()=false，下单自动降级到 mock）
	payCfg := service.LoadPaymentConfig(cfg)
	orderSvc.RegisterGateway(service.NewAlipayGateway(payCfg))
	orderSvc.RegisterGateway(service.NewWeChatGateway(payCfg))
	orderSvc.RegisterGateway(service.NewStripeGateway(payCfg))
	orderSvc.SetFrontendURL(cfg.FrontendURL)
	// 启用 ChatService 的每日 token 额度计量
	chatSvc.SetSubscription(subSvc)
	notifSvc := service.NewNotificationService(db)
	prefsSvc := service.NewNotificationPreferencesService(db)
	followSvc := service.NewFollowService(db, notifSvc)
	modSvc := service.NewModerationService(db)
	followSvc.SetModerationService(modSvc)
	socialSvc.SetModerationService(modSvc)
	commentSvc.SetModerationService(modSvc)
	chatSvc.SetModerationService(modSvc)
	socialSvc.SetNotificationService(notifSvc)
	commentSvc.SetNotificationService(notifSvc)

	// —— 聊天附件（图片 vision / Markdown 文档）——
	attachmentSvc := service.NewChatAttachmentService(db, assets, subSvc)
	chatSvc.SetAttachmentService(attachmentSvc)

	// 孤儿附件清理：定期删除「上传后从未发送」的附件对象，回收存储配额（#6）。
	// 仅在 OSS 启用时跑；保留 1 小时窗口避免误删正在发送中的附件。
	if assets != nil && assets.Enabled() {
		go func() {
			ticker := time.NewTicker(1 * time.Hour)
			defer ticker.Stop()
			for range ticker.C {
				n, err := attachmentSvc.CleanupOrphans(1 * time.Hour)
				if err != nil {
					log.Printf("[chat] orphan attachment cleanup failed: %v", err)
				} else if n > 0 {
					log.Printf("[chat] cleaned up %d orphan attachments", n)
				}
			}
		}()
	}

	// —— 进化引擎:自动淘汰低参与度想法(模拟自然选择的"环境淘汰") ——
	// 每天 1 次,淘汰创建超过 30 天且 weighted_score=0(零社区信号)的活跃想法。
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			n, err := ideaSvc.AutoBuryStale(30*24*time.Hour, 0.5)
			if err != nil {
				log.Printf("[evolution] auto-bury tick failed: %v", err)
			} else if n > 0 {
				log.Printf("[evolution] auto-bury tick: buried %d stale ideas", n)
			}
		}
	}()

	// —— 向量检索（可选启用：DashVector 或 OSS 向量 Bucket）——
	likeSearcher := service.NewLikeSimilaritySearcher(db)
	searcher := service.SimilaritySearcher(likeSearcher)

	embedSvc := service.NewEmbeddingService(cfg.DashScopeAPIKey, "", cfg.EmbeddingModel, cfg.EmbeddingDimensions)
	vectorStore, backendName, storeErr := service.NewVectorBackend(cfg)
	if storeErr != nil {
		log.Printf("[vector] disabled: %v", storeErr)
	} else if !embedSvc.Enabled() {
		log.Printf("[vector] disabled: DASHSCOPE_API_KEY not set")
	} else if vectorStore == nil || !vectorStore.Enabled() {
		log.Printf("[vector] disabled: backend %s not enabled", backendName)
	} else {
		switch backendName {
		case "dashvector":
			log.Printf("[vector] enabled: backend=dashvector endpoint=%s collection=%s dims=%d",
				cfg.DashVectorEndpoint, cfg.VectorIndexIdeas, cfg.EmbeddingDimensions)
			if dvStore, ok := vectorStore.(*service.DashVectorStore); ok {
				ensureCtx, ensureCancel := context.WithTimeout(context.Background(), 30*time.Second)
				if err := service.EnsureIdeasCollection(ensureCtx, dvStore, cfg.VectorIndexIdeas, cfg.EmbeddingDimensions, dashvector.Metric(cfg.DashVectorMetric)); err != nil {
					log.Printf("[vector] WARN: ensure collection %s: %v", cfg.VectorIndexIdeas, err)
				}
				ensureCancel()
			}
		default:
			log.Printf("[vector] enabled: backend=oss bucket=%s region=%s index=%s dims=%d",
				cfg.AliyunVectorBucket, cfg.AliyunVectorRegion, cfg.VectorIndexIdeas, cfg.EmbeddingDimensions)
		}

		indexer := service.NewIdeaVectorIndexer(db, embedSvc, vectorStore, cfg.VectorIndexIdeas)
		ideaSvc.SetVectorIndexer(indexer)
		socialSvc.SetVectorIndexer(indexer)

		vectorSearcher := service.NewVectorSimilaritySearcher(db, embedSvc, vectorStore, cfg.VectorIndexIdeas)
		searcher = service.NewFallbackSimilaritySearcher(vectorSearcher, likeSearcher)
		chatSvc.SetRAG(embedSvc, searcher)

		if cfg.VectorReindexOnStart {
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
				defer cancel()
				n, err := service.ReconcileAllActiveIdeas(ctx, db, indexer)
				if err != nil {
					log.Printf("[vector] reindex on start failed: %v", err)
				} else {
					log.Printf("[vector] reindex on start queued %d active ideas", n)
				}
			}()
		}
	}
	ideaSvc.SetSearcher(searcher)

	// —— 建议池（suggestions）——
	suggestionSvc := service.NewSuggestionService(db)
	suggestionSvc.SetModerationService(modSvc)
	suggestionSvc.SetNotificationService(notifSvc)
	suggestionSvc.SetObjectStore(assets)

	// —— 工具系统（MCP / REST chat / agent-bridge 三入口共享）——
	// 先创建不含 delegate 的 registry，后面注入 delegate 函数。
	var delegateFn service.DelegateFunc // 延迟设置
	// 存量版本一次性转为 changelog 事件（SourceID 幂等，重复启动自动跳过）
	if n, err := service.BackfillVersionEvents(db); err != nil {
		fmt.Printf("changelog backfill failed: %v\n", err)
	} else if n > 0 {
		fmt.Printf("changelog backfill: %d version events created\n", n)
	}

toolRegistry := service.BootstrapTools(db, ideaSvc, socialSvc, commentSvc, agentSvc, followSvc, assets, nil, suggestionSvc)
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

	// —— 内置火卫二助手 agent（页面聊天默认对话对象）——
	systemAgentID, err := service.EnsureSystemAssistant(db, cfg.SystemAgentID)
	if err != nil {
		log.Printf("[bootstrap] WARN: failed to ensure system assistant: %v (chat with default agent will still work)", err)
	} else {
		log.Printf("[bootstrap] system assistant ready: id=%s", systemAgentID)
	}

	// —— agent-bridge（外部 AI agent 通过 REST 调用工具）——
	bridgeSvc := service.NewAgentBridgeService(db, agentSvc, toolExecutor)

	ideaHandler := handler.NewIdeaHandler(ideaSvc, agentSvc, socialSvc, commentSvc, assets, llmSvc, systemAgentID)
	agentSvc.SetObjectStore(assets)
	agentHandler := handler.NewAgentHandler(agentSvc, ideaSvc, assets, followSvc)
	authHandler := handler.NewAuthHandler(agentSvc)
	authHandler.SetSubscription(subSvc) // 启用 Agent 创建权限校验（需付费会员）
	commentHandler := handler.NewCommentHandler(commentSvc)
	suggestionHandler := handler.NewSuggestionHandler(suggestionSvc, ideaSvc, assets)
	activityHandler := handler.NewActivityHandler(db, followSvc, socialSvc)
	userAuthHandler := handler.NewUserAuthHandler(userSvc, authSvc)
	chatHandler := handler.NewChatHandler(chatSvc)
	chatAttachmentHandler := handler.NewChatAttachmentHandler(attachmentSvc)
	followHandler := handler.NewFollowHandler(followSvc, userSvc)
	userHandler := handler.NewUserHandler(userSvc)
	notifHandler := handler.NewNotificationHandler(notifSvc)
	prefsHandler := handler.NewNotificationPreferencesHandler(prefsSvc)
	settingsHandler := handler.NewUserSettingsHandler(userSvc, smsSvc, assets)
	phoneHandler := handler.NewPhoneAuthHandler(userSvc, smsSvc, authSvc)
	bridgeHandler := handler.NewAgentBridgeHandler(bridgeSvc)
	modHandler := handler.NewModerationHandler(modSvc)
	billingHandler := handler.NewBillingHandler(orderSvc, subSvc, refundSvc)

	// —— A2A（Agent-to-Agent 协议）——
	a2aSvc := a2a.NewService(db, chatSvc)
	frontendURL := cfg.FrontendURL
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	a2aHandler := a2a.NewHandler(a2aSvc, frontendURL)

	r := gin.Default()
	r.Use(middleware.CORS())

	// DIAG(404): 拦截所有未命中已注册路由的请求。
	// Gin 默认返回 "404 page not found" 时必经此处；若是 handler 内部主动 404，则不会走到这里。
	// 排查 view/bookmark/flowers 404 时据此区分「路由树未注册」与「业务层返回 404」。
	r.NoRoute(func(c *gin.Context) {
		log.Printf("[DIAG:NoRoute] UNMATCHED %s %s | referer=%s | ua=%q",
			c.Request.Method, c.Request.URL.Path, c.Request.Referer(), c.Request.UserAgent())
		c.JSON(http.StatusNotFound, gin.H{
			"error":  "route not found",
			"method": c.Request.Method,
			"path":   c.Request.URL.Path,
			"diag":   "gin.NoRoute: 未命中任何已注册路由（handler 未被调用）",
		})
	})

	// Health check
	r.GET("/health", func(c *gin.Context) {
		sqlDB, err := db.DB()
		if err != nil || sqlDB.Ping() != nil {
			c.JSON(503, gin.H{"status": "unhealthy"})
			return
		}
		c.JSON(200, gin.H{"status": "ok"})
	})

	chatRL := middleware.NewRateLimiter(100, time.Minute)

	api := r.Group("/api")
	{
		// Agent 注册要求登录（自动绑定 owner_user_id）
		// MCP 等无浏览器场景用 API Key 认证已有 Agent，不走此路由
		api.POST("/auth/register", middleware.UserAuth(cfg.JWTSecret), authHandler.RegisterAgent)
		api.GET("/agents", agentHandler.List)
		api.GET("/agents/:id", middleware.OptionalUserAuth(cfg.JWTSecret), agentHandler.GetByID)
		api.GET("/agents/:id/ideas", middleware.OptionalUserAuth(cfg.JWTSecret), agentHandler.GetIdeas)
		api.GET("/agents/:id/stats", middleware.OptionalUserAuth(cfg.JWTSecret), agentHandler.GetStats)
		api.GET("/agents/:id/follow", middleware.OptionalUserAuth(cfg.JWTSecret), followHandler.GetAgentFollowStatus)
		api.GET("/agents/:id/following", middleware.OptionalUserAuth(cfg.JWTSecret), agentHandler.GetAgentFollowing)
		api.GET("/agents/:id/followers", middleware.OptionalUserAuth(cfg.JWTSecret), agentHandler.GetAgentFollowers)
		api.GET("/agents/:id/peer-followers", middleware.OptionalUserAuth(cfg.JWTSecret), agentHandler.GetAgentPeerFollowers)
		api.GET("/agents/:id/activity", middleware.OptionalUserAuth(cfg.JWTSecret), agentHandler.GetAgentActivity)
		api.GET("/ideas", ideaHandler.Query)
		api.GET("/ideas/ranking", ideaHandler.Ranking)
		api.GET("/ideas/search", ideaHandler.Search)
		api.GET("/ideas/:id", ideaHandler.GetByID)
		api.GET("/ideas/:id/changelog", ideaHandler.ListChangelog)
		api.GET("/ideas/:id/stats", ideaHandler.GetStats)
		api.GET("/ideas/:id/lineage", ideaHandler.GetLineage)
		api.GET("/ideas/:id/tree", ideaHandler.GetTree)
		api.GET("/ideas/:id/versions", ideaHandler.GetVersions)
		api.GET("/ideas/:id/versions/:versionId", ideaHandler.GetVersion)
		api.GET("/ideas/:id/comments", middleware.OptionalUserAuth(cfg.JWTSecret), ideaHandler.GetComments)
		api.GET("/ideas/:id/suggestions", middleware.OptionalUserAuth(cfg.JWTSecret), suggestionHandler.List)
		api.GET("/ideas/:id/forks", ideaHandler.GetForks)
		api.GET("/ideas/:id/fork-children", ideaHandler.GetForkChildren)
		api.GET("/ideas/:id/flowers", ideaHandler.GetFlowers)
		// Counts are public; OptionalUserAuth enriches the response with the
		// signed-in user's own emoji without blocking anonymous detail views.
		api.GET("/ideas/:id/reactions", middleware.OptionalUserAuth(cfg.JWTSecret), ideaHandler.GetReactions)
		api.POST("/ideas/:id/view", ideaHandler.RecordView)
		api.POST("/ideas/:id/reference", ideaHandler.RecordReference)
		api.GET("/activity", activityHandler.List)
		api.GET("/activity/stats", activityHandler.Stats)
		api.GET("/activity/feed", activityHandler.Feed)

		// User auth — public
		api.POST("/auth/user/register", userAuthHandler.Register)
		api.POST("/auth/user/login", userAuthHandler.Login)
		api.GET("/auth/user/verify", userAuthHandler.VerifyEmail)
		api.POST("/auth/user/forgot-password", userAuthHandler.ForgotPassword)
		api.POST("/auth/user/reset-password", userAuthHandler.ResetPassword)
		api.POST("/auth/user/apple", userAuthHandler.AppleLogin)
		api.POST("/auth/user/google", userAuthHandler.GoogleTokenLogin)
		api.POST("/auth/user/wechat", userAuthHandler.WeChatCodeLogin)
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

			// 实现任务队列（owner 视角：采纳建议后创建的任务的推进与管理）
			userRoutes.GET("/user/implementation-jobs", suggestionHandler.MyJobs)
			userRoutes.PATCH("/user/implementation-jobs/:id", suggestionHandler.UpdateJob)
			userRoutes.POST("/user/implementation-jobs/:id/questions/:qid/answer", suggestionHandler.AnswerJobQuestion)

			// Chat sessions（列表/管理不限流；仅消息发送限流）
			userRoutes.POST("/sessions", chatHandler.CreateSession)
			userRoutes.GET("/sessions", chatHandler.ListSessions)
			userRoutes.GET("/sessions/:id", chatHandler.GetSession)
			userRoutes.PATCH("/sessions/:id", chatHandler.RenameSession)
			userRoutes.DELETE("/sessions/:id", chatHandler.DeleteSession)
			userRoutes.GET("/sessions/:id/messages", chatHandler.GetMessages)
			userRoutes.POST("/sessions/:id/messages/:message_id/feedback", chatHandler.SetMessageFeedback)
			userRoutes.DELETE("/sessions/:id/messages/:message_id/feedback", chatHandler.ClearMessageFeedback)
			userRoutes.POST("/sessions/:id/fork", chatHandler.ForkSession)
			userRoutes.POST("/sessions/:id/archive", chatHandler.ArchiveSession)

			// 聊天附件（图片 / Markdown 文档）
			userRoutes.GET("/user/chat-files/quota", chatAttachmentHandler.GetChatFileQuota)

			chatMsgRoutes := userRoutes.Group("")
			chatMsgRoutes.Use(chatRL.Middleware())
			{
				chatMsgRoutes.POST("/sessions/:id/messages", chatHandler.SendMessage)
				// 流式发送：POST body { content, attachment_id }，支持携带附件且避免 URL 过长。
				chatMsgRoutes.POST("/sessions/:id/stream", chatHandler.SendMessageStream)
				// 附件上传预签名与 finalize（限流，复用聊天速率限制）。
				chatMsgRoutes.POST("/user/chat-files/presign", chatAttachmentHandler.PresignChatFile)
				chatMsgRoutes.POST("/user/chat-files/finalize", chatAttachmentHandler.FinalizeChatFile)
			}

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

			// Notification preferences & devices
			userRoutes.GET("/user/notification-preferences", prefsHandler.Get)
			userRoutes.PATCH("/user/notification-preferences", prefsHandler.Update)
			userRoutes.POST("/user/devices", prefsHandler.RegisterDevice)
			userRoutes.DELETE("/user/devices/:id", prefsHandler.DeleteDevice)

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
			userRoutes.POST("/agents/:id/avatar/reset", agentHandler.ResetAvatar)
			userRoutes.POST("/agents/:id/background/reset", agentHandler.ResetBackground)
			userRoutes.POST("/agents/:id/rotate-api-key", agentHandler.RotateAPIKey)
			userRoutes.POST("/agents/:id/revoke-api-key", agentHandler.RevokeAPIKey)
			userRoutes.GET("/agents/:id/api-key", agentHandler.GetAPIKey)

			// UGC moderation
			userRoutes.GET("/user/blocks", modHandler.ListBlocks)
			userRoutes.GET("/users/:id/block", modHandler.GetBlockStatus)
			userRoutes.POST("/users/:id/block", modHandler.BlockUser)
			userRoutes.DELETE("/users/:id/block", modHandler.UnblockUser)
			userRoutes.POST("/reports", modHandler.SubmitReport)
		}

		// Public user profile (with optional auth for follow status)
		api.GET("/users/:id/profile", middleware.OptionalUserAuth(cfg.JWTSecret), followHandler.GetProfile)
		api.GET("/users/:id/agents", middleware.OptionalUserAuth(cfg.JWTSecret), agentHandler.ListUserAgents)
		api.GET("/users/:id/ideas", ideaHandler.GetUserIdeas)
		api.GET("/users/:id/activity", activityHandler.ListByUser)
		api.GET("/users/:id/followers", middleware.OptionalUserAuth(cfg.JWTSecret), followHandler.GetFollowers)
		api.GET("/users/:id/following", middleware.OptionalUserAuth(cfg.JWTSecret), followHandler.GetFollowing)

		// Idea interactions — Agent API Key or logged-in user session
		ideaActionRoutes := api.Group("")
		ideaActionRoutes.Use(middleware.AgentOrUserAuth(agentSvc, cfg.JWTSecret))
		{
			ideaActionRoutes.POST("/ideas", ideaHandler.Create)
			ideaActionRoutes.GET("/ideas/:id/like", ideaHandler.GetLikeStatus)
			ideaActionRoutes.GET("/ideas/:id/bookmark", ideaHandler.GetBookmarkStatus)
			ideaActionRoutes.POST("/ideas/:id/bookmark", ideaHandler.Bookmark)
			ideaActionRoutes.DELETE("/ideas/:id/bookmark", ideaHandler.Unbookmark)
			ideaActionRoutes.POST("/ideas/:id/like", ideaHandler.Like)
			ideaActionRoutes.DELETE("/ideas/:id/like", ideaHandler.Unlike)
			ideaActionRoutes.GET("/ideas/:id/wish", ideaHandler.GetWishStatus)
			ideaActionRoutes.POST("/ideas/:id/wish", ideaHandler.Wish)
			ideaActionRoutes.DELETE("/ideas/:id/wish", ideaHandler.Unwish)
			ideaActionRoutes.POST("/ideas/:id/flowers", ideaHandler.SendFlowers)
			ideaActionRoutes.GET("/user/flowers", ideaHandler.GetMyFlowerBalance)
			ideaActionRoutes.POST("/ideas/:id/fork", ideaHandler.Fork)
			ideaActionRoutes.POST("/ideas/:id/generate-variant", ideaHandler.GenerateVariant)
			ideaActionRoutes.POST("/ideas/:id/bury", ideaHandler.Bury)
			ideaActionRoutes.POST("/ideas/:id/archive", ideaHandler.Archive)
			ideaActionRoutes.POST("/ideas/:id/implement", ideaHandler.MarkImplemented)
			ideaActionRoutes.POST("/ideas/:id/reactivate", ideaHandler.Reactivate)
			ideaActionRoutes.POST("/ideas/:id/share", ideaHandler.Share)
			ideaActionRoutes.POST("/ideas/:id/reactions", ideaHandler.React)
			ideaActionRoutes.DELETE("/ideas/:id/reactions", ideaHandler.Unreact)
			ideaActionRoutes.POST("/ideas/:id/comments", ideaHandler.CreateComment)
			ideaActionRoutes.POST("/ideas/:id/suggestions", suggestionHandler.Create)
			ideaActionRoutes.DELETE("/ideas/:id/suggestions/:sid", suggestionHandler.Delete)
			ideaActionRoutes.POST("/ideas/:id/suggestions/:sid/vote", suggestionHandler.Vote)
			ideaActionRoutes.DELETE("/ideas/:id/suggestions/:sid/vote", suggestionHandler.Unvote)
			ideaActionRoutes.POST("/ideas/:id/suggestions/:sid/select", suggestionHandler.Select)
			// 注意：不能注册为 /suggestions/upload/presign —— gin 不允许同一段
			// 同时存在静态段 upload 与参数段 :sid，否则启动时 panic。
			ideaActionRoutes.POST("/ideas/:id/suggestions-upload/presign", suggestionHandler.PresignUpload)
			ideaActionRoutes.GET("/comments/:id/like", commentHandler.GetLikeStatus)
			ideaActionRoutes.POST("/comments/:id/like", commentHandler.Like)
			ideaActionRoutes.DELETE("/comments/:id/like", commentHandler.Unlike)
			ideaActionRoutes.POST("/ideas/:id/versions", ideaHandler.PublishVersion)
			ideaActionRoutes.PATCH("/ideas/:id/meta", ideaHandler.UpdateMeta)
			ideaActionRoutes.PATCH("/ideas/:id/description", ideaHandler.UpdateDescription)
			ideaActionRoutes.POST("/ideas/:id/upload/presign", ideaHandler.PresignUpload)
			ideaActionRoutes.POST("/ideas/:id/icon/reset", ideaHandler.ResetIcon)
		}

		// Agent-authenticated routes
		agentRoutes := api.Group("")
		agentRoutes.Use(middleware.AgentAuth(agentSvc))
		{
			agentRoutes.GET("/auth/me", authHandler.Me)
			agentRoutes.PATCH("/ideas/:id/status", ideaHandler.UpdateStatus)
			agentRoutes.PATCH("/comments/:id", commentHandler.Update)
			agentRoutes.DELETE("/comments/:id", commentHandler.Delete)
			agentRoutes.POST("/agents/:id/activity", agentHandler.PostAgentActivity)
			// Keep /agents/:id/follow for JWT-authenticated users. Agent API keys
			// use an explicit endpoint because Gin cannot register the same method/path
			// twice with a different authentication middleware.
			agentRoutes.POST("/agents/:id/agent-follow", agentHandler.AgentFollowAgent)
			agentRoutes.DELETE("/agents/:id/agent-follow", agentHandler.AgentUnfollowAgent)

			// Agent-Bridge：外部 AI agent 通过 REST 调用工具（与 MCP 共享 ToolRegistry）
			bridgeHandler.RegisterRoutes(agentRoutes, nil)
		}

		// Admin routes
		adminRoutes := api.Group("")
		adminRoutes.Use(middleware.AdminAuth(cfg.JWTSecret))
		{
			adminRoutes.GET("/admin/comments", commentHandler.ListAdmin)
			adminRoutes.PATCH("/admin/comments/:id/moderate", commentHandler.Moderate)
			// 退款审批
			adminRoutes.GET("/admin/refunds", billingHandler.ListPendingRefunds)
			adminRoutes.POST("/admin/refunds/:id/approve", billingHandler.ApproveRefund)
			adminRoutes.POST("/admin/refunds/:id/reject", billingHandler.RejectRefund)
		}

		// —— 充值/会员模块 ——
		// 套餐与价格、支付回调：公开
		api.GET("/billing/plans", billingHandler.Plans)
		api.POST("/billing/webhooks/:gateway", billingHandler.Webhook)

		// 会员状态、订单管理：需登录
		billingRoutes := api.Group("")
		billingRoutes.Use(middleware.UserAuth(cfg.JWTSecret))
		{
			billingRoutes.GET("/billing/membership", billingHandler.Membership)
			billingRoutes.POST("/billing/orders", billingHandler.CreateOrder)
			billingRoutes.GET("/billing/orders", billingHandler.ListOrders)
			billingRoutes.GET("/billing/orders/:id", billingHandler.GetOrder)
			billingRoutes.POST("/billing/orders/:id/cancel", billingHandler.CancelOrder)
			billingRoutes.POST("/billing/orders/:id/mock-pay", billingHandler.MockPay)
			billingRoutes.POST("/billing/orders/:id/refund", billingHandler.RequestRefund)
			billingRoutes.GET("/billing/refunds", billingHandler.ListMyRefunds)
		}
	}

	// —— A2A 协议端点（Agent Card 发现 + JSON-RPC task 处理）——
	// Agent Card 发现端点保持公开（A2A 规范要求）。
	// JSON-RPC task 端点要求鉴权（AgentOrUserAuth：API Key 或 JWT）。
	a2aPublic := r.Group("/a2a")
	a2aPublic.GET("/.well-known/agent.json", a2aHandler.GetAgentCards)
	a2aPublic.GET("/agents/:agentId/.well-known/agent.json", a2aHandler.GetAgentCard)

	a2aAuth := r.Group("/a2a")
	a2aAuth.Use(middleware.AgentOrUserAuth(agentSvc, cfg.JWTSecret))
	a2aAuth.POST("/agents/:agentId", a2aHandler.HandleJSONRPC)
	log.Printf("[a2a] endpoints registered at /a2a (discovery=public, tasks=auth)")

	log.Printf("Starting Deimos API server on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
