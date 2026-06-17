package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

const maxMessageHistory = 20

type CreateSessionInput struct {
	AgentID string `json:"agent_id" binding:"required"`
	IdeaID  string `json:"idea_id"`
	Title   string `json:"title"`
}

type SendMessageInput struct {
	Content string `json:"content" binding:"required"`
}

type SendMessageResult struct {
	UserMessage      model.ChatMessage  `json:"user_message"`
	AssistantMessage model.ChatMessage  `json:"assistant_message"`
	ToolResults      []ToolCallResult   `json:"tool_results,omitempty"` // 工具调用结果（前端可渲染卡片）
	TokensUsed       int                `json:"tokens_used,omitempty"`
}

type ChatService struct {
	db        *gorm.DB
	ideaSvc   *IdeaService
	agentSvc  *AgentService
	llm       *LLMService
	embed     *EmbeddingService
	searcher  SimilaritySearcher // 可选，用于 RAG 检索
	tools     *ToolExecutor      // 可选，启用后支持 tool use
	toolNames []string           // 给 LLM 暴露的工具白名单（空=全部）
}

func NewChatService(db *gorm.DB, ideaSvc *IdeaService, agentSvc *AgentService, llm *LLMService) *ChatService {
	return &ChatService{db: db, ideaSvc: ideaSvc, agentSvc: agentSvc, llm: llm}
}

// SetRAG 注入 embedding + 相似度检索器以启用 RAG（检索增强生成）。
// 两者任一未启用则 RAG 自动降级为普通对话。
func (s *ChatService) SetRAG(embed *EmbeddingService, searcher SimilaritySearcher) {
	s.embed = embed
	s.searcher = searcher
}

// SetTools 注入工具执行器以启用 tool use（让 LLM 能调用 search/register/like 等操作）。
// toolNames 为空表示暴露全部工具；非空则只暴露白名单内工具（用于按 agent 能力过滤）。
func (s *ChatService) SetTools(executor *ToolExecutor, toolNames []string) {
	s.tools = executor
	s.toolNames = toolNames
}

func (s *ChatService) CreateSession(userID string, input CreateSessionInput) (*model.ChatSession, error) {
	agent, err := s.agentSvc.GetByID(input.AgentID)
	if err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}

	title := input.Title
	if title == "" {
		title = "与 " + agent.Name + " 的对话"
	}

	session := &model.ChatSession{
		UserID:  userID,
		AgentID: input.AgentID,
		Title:   title,
	}
	if input.IdeaID != "" {
		session.IdeaID = &input.IdeaID
	}

	if err := s.db.Create(session).Error; err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	logActivity(s.db, "user", userID, "create_session", "session", session.ID, nil)
	return session, nil
}

func (s *ChatService) GetSession(sessionID, userID string) (*model.ChatSession, error) {
	var session model.ChatSession
	if err := s.db.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error; err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}
	return &session, nil
}

func (s *ChatService) ListSessions(userID string, limit, offset int) ([]model.ChatSession, int64, error) {
	var sessions []model.ChatSession
	var total int64

	s.db.Model(&model.ChatSession{}).Where("user_id = ?", userID).Count(&total)

	if err := s.db.Where("user_id = ?", userID).
		Order("updated_at DESC").
		Limit(limit).Offset(offset).
		Find(&sessions).Error; err != nil {
		return nil, 0, err
	}
	return sessions, total, nil
}

func (s *ChatService) RenameSession(sessionID, userID, title string) error {
	result := s.db.Model(&model.ChatSession{}).
		Where("id = ? AND user_id = ?", sessionID, userID).
		Update("title", title)
	if result.RowsAffected == 0 {
		return fmt.Errorf("session not found")
	}
	return result.Error
}

func (s *ChatService) DeleteSession(sessionID, userID string) error {
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := tx.Where("session_id = ?", sessionID).Delete(&model.ChatMessage{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	result := tx.Where("id = ? AND user_id = ?", sessionID, userID).Delete(&model.ChatSession{})
	if result.RowsAffected == 0 {
		tx.Rollback()
		return fmt.Errorf("session not found")
	}

	return tx.Commit().Error
}

func (s *ChatService) SendMessage(sessionID, userID string, input SendMessageInput) (*SendMessageResult, error) {
	session, err := s.GetSession(sessionID, userID)
	if err != nil {
		return nil, err
	}

	userMsg := model.ChatMessage{
		SessionID: sessionID,
		Role:      "user",
		Content:   input.Content,
	}
	if err := s.db.Create(&userMsg).Error; err != nil {
		return nil, fmt.Errorf("failed to save user message: %w", err)
	}

	// P0 #3: 失败回滚 —— 若 runConversation 失败，把刚写入的 user message 软删除
	// （标记为 error，保留审计痕迹但不会进入 LLM history）
	principal := Principal{
		Source:    "rest",
		UserID:    userID,
		AgentID:   session.AgentID,
		SessionID: sessionID,
	}
	if session.IdeaID != nil {
		principal.IdeaID = *session.IdeaID
	}

	assistantMsg, toolResults, tokensUsed, err := s.runConversation(session, input.Content, principal)
	if err != nil {
		s.markMessageFailed(&userMsg, err)
		return nil, err
	}

	s.db.Model(session).Update("message_count", gorm.Expr("message_count + 1"))
	s.db.Model(session).Update("updated_at", time.Now())

	logActivity(s.db, "user", userID, "send_message", "session", sessionID, nil)

	return &SendMessageResult{
		UserMessage:      userMsg,
		AssistantMessage: *assistantMsg,
		ToolResults:      toolResults,
		TokensUsed:       tokensUsed,
	}, nil
}

// markMessageFailed 把一条消息软删除（role 改为 system_error），避免下次 LLM 读到孤立消息。
// 不物理删除是为了保留审计痕迹。
func (s *ChatService) markMessageFailed(msg *model.ChatMessage, cause error) {
	if msg == nil || msg.ID == "" {
		return
	}
	meta := map[string]string{"error": "conversation failed", "cause": cause.Error()}
	raw, _ := json.Marshal(meta)
	s.db.Model(msg).Updates(map[string]any{
		"role":     "system_error",
		"metadata": string(raw),
	})
}

const (
	maxToolRounds    = 5     // 单次对话最多 5 轮工具调用，防止失控
	maxToolHistoryMs = 60_000 // 整个 tool use 循环不超过 60 秒
)

// runConversation 是核心的 LLM ↔ Tool 对话循环：
//  1. 用 RAG 增强 system prompt
//  2. 调 LLM（带 tools）
//  3. 若 LLM 请求工具 → 执行 → 把结果加入 history → 再次调 LLM
//  4. 直到 LLM finish_reason=stop 或达到 maxToolRounds
//
// 所有中间 tool 消息只在内存中流转，不持久化（避免历史表膨胀）；
// 只有最终的 assistant 回复被保存为 ChatMessage。
func (s *ChatService) runConversation(session *model.ChatSession, userContent string, p Principal) (*model.ChatMessage, []ToolCallResult, int, error) {
	return s.runConversationWithProgress(session, userContent, p, nil)
}

// runConversationWithProgress 与 runConversation 等价，但允许传入一个可选的
// progress channel，每轮工具调用前后会推送 StreamEvent。
// progressCh=nil 时等价于 runConversation。
func (s *ChatService) runConversationWithProgress(session *model.ChatSession, userContent string, p Principal, progressCh chan<- StreamEvent) (*model.ChatMessage, []ToolCallResult, int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), maxToolHistoryMs*time.Millisecond)
	defer cancel()

	systemPrompt := s.buildSystemPromptWithRAG(session, userContent)

	history := s.buildMessageHistory(session.ID)
	history = append(history, LLMMessage{Role: "user", Content: userContent})

	var toolsDef []OpenAITool
	if s.tools != nil {
		toolsDef = s.tools.ToolsDefinition(s.toolNames)
	}

	var allToolResults []ToolCallResult
	var totalTokens int

	for round := 0; round < maxToolRounds; round++ {
		resp, err := s.llm.ChatWithTools(systemPrompt, history, toolsDef)
		if err != nil {
			return nil, nil, 0, fmt.Errorf("LLM call failed (round %d): %w", round, err)
		}
		totalTokens += resp.Usage.PromptTokens + resp.Usage.CompletionTokens

		// 不需要工具调用，直接返回
		if resp.FinishReason != "tool_calls" || len(resp.ToolCalls) == 0 {
			msg := &model.ChatMessage{
				SessionID: session.ID,
				Role:      "assistant",
				Content:   resp.Content,
			}
			if err := s.db.Create(msg).Error; err != nil {
				return nil, nil, 0, fmt.Errorf("failed to save assistant message: %w", err)
			}
			s.pushEvent(progressCh, "assistant_message", map[string]any{
				"id":      msg.ID,
				"content": msg.Content,
			})
			return msg, allToolResults, totalTokens, nil
		}

		// 把 LLM 的 tool_calls 决策加入 history（OpenAI 协议要求保留）
		history = append(history, LLMMessage{
			Role:      "assistant",
			Content:   resp.Content,
			ToolCalls: resp.ToolCalls,
		})

		// P1: 推送工具调用进度事件（"正在搜索 idea..."）
		for _, tc := range resp.ToolCalls {
			s.pushEvent(progressCh, "tool_call", map[string]any{
				"tool":      tc.Name,
				"tool_call": tc.ID,
				"args":      json.RawMessage(tc.ArgsJSON),
			})
		}

		// 执行所有 tool_calls
		results, err := s.tools.ExecuteBatch(ctx, p, resp.ToolCalls)
		if err != nil {
			return nil, nil, 0, fmt.Errorf("tool execution failed: %w", err)
		}
		allToolResults = append(allToolResults, results...)

		// 推送工具结果进度事件
		for _, r := range results {
			s.pushEvent(progressCh, "tool_result", map[string]any{
				"tool":       r.Name,
				"tool_call":  r.ToolCallID,
				"ok":         r.OK,
				"output":     json.RawMessage(r.Output),
				"display":    r.Display,
			})
		}

		s.persistToolActivity(p, results)

		for _, r := range results {
			history = append(history, LLMMessage{
				Role:       "tool",
				ToolCallID: r.ToolCallID,
				ToolName:   r.Name,
				Content:    r.Output,
			})
		}
	}

	// 达到最大轮数仍未结束：让 LLM 收尾总结
	history = append(history, LLMMessage{
		Role:    "user",
		Content: "(系统提示：已达到本轮最大工具调用次数，请基于已有信息给出最终回复，不要再调用工具。)",
	})
	finalResp, err := s.llm.ChatWithTools(systemPrompt, history, nil)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("LLM final call failed: %w", err)
	}
	totalTokens += finalResp.Usage.PromptTokens + finalResp.Usage.CompletionTokens

	msg := &model.ChatMessage{
		SessionID: session.ID,
		Role:      "assistant",
		Content:   finalResp.Content,
	}
	if err := s.db.Create(msg).Error; err != nil {
		return nil, nil, 0, fmt.Errorf("failed to save assistant message: %w", err)
	}
	s.pushEvent(progressCh, "assistant_message", map[string]any{
		"id":      msg.ID,
		"content": msg.Content,
	})
	return msg, allToolResults, totalTokens, nil
}

// pushEvent 向 progress channel 安全推送事件（nil channel / 已关闭均会忽略）。
// 非阻塞，避免消费者过慢阻塞整个对话循环。
func (s *ChatService) pushEvent(ch chan<- StreamEvent, typ string, data any) {
	if ch == nil {
		return
	}
	defer func() { _ = recover() }() // 防止 send on closed channel panic
	select {
	case ch <- StreamEvent{Type: typ, Data: data}:
	default: // 消费者跟不上就丢弃进度事件（不影响业务）
	}
}

// persistToolActivity 把工具调用记录到活动流（"通过对话点赞了 X" 等）。
func (s *ChatService) persistToolActivity(p Principal, results []ToolCallResult) {
	writeTools := map[string]bool{
		"register_idea":  true,
		"fork_idea":      true,
		"like_idea":      true,
		"bury_idea":      true,
		"send_flowers":   true,
		"create_comment": true,
	}
	for _, r := range results {
		if !r.OK || !writeTools[r.Name] {
			continue
		}
		actorType := "agent"
		actorID := p.AgentID
		if actorID == "" && p.UserID != "" {
			actorType = "user"
			actorID = p.UserID
		}
		if actorID == "" {
			continue
		}
		logActivity(s.db, actorType, actorID, "tool:"+r.Name, "session", p.SessionID, map[string]string{
			"tool": r.Name,
		})
	}
}

// SendMessageStream 流式发送消息。
// 当 tools 未启用时：走 ChatStream（真正的逐 token SSE）。
// 当 tools 启用时：走 runConversationWithProgress，通过 progress channel 推送
// tool_call / tool_result / assistant_message 事件给前端（最后整体 done）。
//
// 这样保持流式端点对 tool use 的完整支持（P0 #1 + P1 #5）。
func (s *ChatService) SendMessageStream(sessionID, userID, content string) (<-chan StreamChunk, *model.ChatMessage, error) {
	session, err := s.GetSession(sessionID, userID)
	if err != nil {
		return nil, nil, err
	}

	userMsg := model.ChatMessage{
		SessionID: sessionID,
		Role:      "user",
		Content:   content,
	}
	if err := s.db.Create(&userMsg).Error; err != nil {
		return nil, nil, fmt.Errorf("failed to save user message: %w", err)
	}

	principal := Principal{
		Source:    "rest",
		UserID:    userID,
		AgentID:   session.AgentID,
		SessionID: sessionID,
	}
	if session.IdeaID != nil {
		principal.IdeaID = *session.IdeaID
	}

	// tools 启用时：流式即工具循环 + 进度事件
	if s.tools != nil {
		return s.streamWithTools(session, &userMsg, content, principal)
	}

	// 否则：保持原有 ChatStream（无工具）
	return s.streamNoTools(session, &userMsg, userID, content)
}

func (s *ChatService) streamNoTools(session *model.ChatSession, userMsg *model.ChatMessage, userID, content string) (<-chan StreamChunk, *model.ChatMessage, error) {
	systemPrompt := s.buildSystemPromptWithRAG(session, content)
	history := s.buildMessageHistory(session.ID)

	streamCh, err := s.llm.ChatStream(systemPrompt, history)
	if err != nil {
		s.markMessageFailed(userMsg, err)
		return nil, nil, err
	}

	wrapperCh := make(chan StreamChunk, 64)
	go func() {
		defer close(wrapperCh)
		var fullContent string

		for chunk := range streamCh {
			if chunk.Error != nil {
				s.markMessageFailed(userMsg, chunk.Error)
				wrapperCh <- chunk
				return
			}
			if chunk.Done {
				assistantMsg := model.ChatMessage{
					SessionID: session.ID,
					Role:      "assistant",
					Content:   fullContent,
				}
				s.db.Create(&assistantMsg)
				s.db.Model(session).Updates(map[string]interface{}{
					"message_count": gorm.Expr("message_count + 1"),
					"updated_at":    time.Now(),
				})
				logActivity(s.db, "user", userID, "send_message", "session", session.ID, nil)
				wrapperCh <- StreamChunk{Done: true}
				return
			}
			fullContent += chunk.Content
			wrapperCh <- chunk
		}
	}()

	return wrapperCh, userMsg, nil
}

// streamWithTools 在 goroutine 中跑工具循环，把进度事件转成 StreamChunk 推出。
// 错误时回滚 user message（P0 #3）。
func (s *ChatService) streamWithTools(session *model.ChatSession, userMsg *model.ChatMessage, content string, principal Principal) (<-chan StreamChunk, *model.ChatMessage, error) {
	out := make(chan StreamChunk, 64)

	go func() {
		defer close(out)

		// 转发器：把 progressCh 中的事件封装成 StreamChunk 推到 out
		progressCh := make(chan StreamEvent, 64)
		done := make(chan struct{})
		go func() {
			defer close(done)
			for ev := range progressCh {
				out <- StreamChunk{Event: &ev}
			}
		}()

		_, _, _, err := s.runConversationWithProgress(session, content, principal, progressCh)
		// 无论成功失败，先关掉 progressCh 让转发器退出（避免死锁）
		close(progressCh)
		<-done

		if err != nil {
			s.markMessageFailed(userMsg, err)
			out <- StreamChunk{Error: err}
			return
		}

		s.db.Model(session).Updates(map[string]interface{}{
			"message_count": gorm.Expr("message_count + 1"),
			"updated_at":    time.Now(),
		})
		logActivity(s.db, "user", principal.UserID, "send_message", "session", session.ID, nil)

		out <- StreamChunk{Done: true}
	}()

	return out, userMsg, nil
}

func (s *ChatService) GetMessages(sessionID, userID string, beforeID string, limit int) ([]model.ChatMessage, error) {
	if _, err := s.GetSession(sessionID, userID); err != nil {
		return nil, err
	}

	if limit <= 0 || limit > 100 {
		limit = 50
	}

	q := s.db.Where("session_id = ?", sessionID).Order("created_at DESC").Limit(limit)

	if beforeID != "" {
		var before model.ChatMessage
		if err := s.db.Where("id = ?", beforeID).First(&before).Error; err == nil {
			q = q.Where("created_at < ?", before.CreatedAt)
		}
	}

	var messages []model.ChatMessage
	if err := q.Find(&messages).Error; err != nil {
		return nil, err
	}

	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}
	return messages, nil
}

func (s *ChatService) buildSystemPrompt(session *model.ChatSession) string {
	agent, err := s.agentSvc.GetByID(session.AgentID)
	if err != nil {
		return "你是一个友好的 AI 助手。"
	}

	prompt := fmt.Sprintf("你是 %s。%s", agent.Name, agent.Description)

	if session.IdeaID != nil && *session.IdeaID != "" {
		idea, err := s.ideaSvc.GetByID(*session.IdeaID)
		if err == nil {
			prompt += fmt.Sprintf("\n\n你正在与用户讨论以下想法：\n标题：%s\n描述：%s", idea.Title, idea.Description)
			if idea.Category != "" {
				prompt += fmt.Sprintf("\n分类：%s", idea.Category)
			}
			prompt += "\n\n请根据这个想法的背景，与用户进行深入讨论、评估、或者分享你的看法。"
		}
	}

	return prompt
}

// buildSystemPromptWithRAG 在原 system prompt 基础上，根据用户最新消息检索相关 idea，
// 把它们的标题/描述作为"参考资料"注入到 prompt，让 LLM 引用平台已有的相似想法。
// RAG 配置缺失或检索失败时静默降级为普通 prompt。
func (s *ChatService) buildSystemPromptWithRAG(session *model.ChatSession, userMessage string) string {
	base := s.buildSystemPrompt(session)

	if s.searcher == nil || s.embed == nil || !s.embed.Enabled() {
		return base
	}

	matches, err := s.searcher.Search(userMessage, 0.55, 3)
	if err != nil || len(matches) == 0 {
		return base
	}

	ragSection := "\n\n## 平台中已有的相似想法（可供参考、对比、引用）："
	for i, m := range matches {
		ragSection += fmt.Sprintf("\n%d. 【%s】%s", i+1, m.Idea.Title, m.Idea.Description)
		if m.Idea.Category != "" {
			ragSection += fmt.Sprintf("（分类：%s）", m.Idea.Category)
		}
	}
	ragSection += "\n\n请在回答中适当参考上述想法，但不要简单复述；结合用户的问题给出有针对性的回应。"

	return base + ragSection
}

func (s *ChatService) buildMessageHistory(sessionID string) []LLMMessage {
	var messages []model.ChatMessage
	s.db.Where("session_id = ? AND role IN ?", sessionID, []string{"user", "assistant"}).
		Order("created_at DESC").
		Limit(maxMessageHistory).
		Find(&messages)

	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	var result []LLMMessage
	for _, m := range messages {
		result = append(result, LLMMessage{Role: m.Role, Content: m.Content})
	}
	return result
}
