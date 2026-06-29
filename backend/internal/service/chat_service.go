package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/wanye/ideaevo/internal/llm"
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

type ChatMessageView struct {
	model.ChatMessage
	UserFeedback string `json:"user_feedback,omitempty"` // like | dislike
}

type ForkSessionInput struct {
	BeforeMessageID string `json:"before_message_id"`
	Title           string `json:"title"`
}

type ChatService struct {
	db            *gorm.DB
	ideaSvc       *IdeaService
	agentSvc      *AgentService
	llm           *LLMService
	embed         *EmbeddingService
	searcher      SimilaritySearcher // 可选，用于 RAG 检索
	ideaRetriever *IdeaContextRetriever
	tools         *ToolExecutor      // 可选，启用后支持 tool use
	toolNames     []string           // 给 LLM 暴露的工具白名单（空=全部）
}

func NewChatService(db *gorm.DB, ideaSvc *IdeaService, agentSvc *AgentService, llm *LLMService) *ChatService {
	return &ChatService{db: db, ideaSvc: ideaSvc, agentSvc: agentSvc, llm: llm}
}

// SetRAG 注入 embedding + 相似度检索器以启用 RAG（检索增强生成）。
// 两者任一未启用则 RAG 自动降级为普通对话。
func (s *ChatService) SetRAG(embed *EmbeddingService, searcher SimilaritySearcher) {
	s.embed = embed
	s.searcher = searcher
	s.ideaRetriever = NewIdeaContextRetriever(searcher, embed, s.ideaSvc)
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

	// 权限校验：agent 关闭了对话（owner 自己不受限）
	if agent.AllowChat != nil && !*agent.AllowChat && agent.OwnerUserID != userID {
		return nil, fmt.Errorf("this agent does not accept chats")
	}

	// Reuse an existing idea-bound session to avoid duplicate conversations.
	if input.IdeaID != "" {
		var existing model.ChatSession
		if err := s.db.Where("user_id = ? AND agent_id = ? AND idea_id = ?", userID, input.AgentID, input.IdeaID).
			First(&existing).Error; err == nil {
			return &existing, nil
		}
	} else {
		var existing model.ChatSession
		if err := s.db.Where("user_id = ? AND agent_id = ? AND idea_id IS NULL", userID, input.AgentID).
			Order("updated_at DESC").
			First(&existing).Error; err == nil {
			return &existing, nil
		}
	}

	title := input.Title
	if title == "" {
		title = "与 " + agent.Name + " 的对话"
	}

	session := &model.ChatSession{
		SessionType: model.SessionTypeUserAgent,
		UserID:      userID,
		AgentID:     input.AgentID,
		Title:       title,
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

// CreateAgentSession starts an agent-to-agent conversation session.
func (s *ChatService) CreateAgentSession(initiatorAgentID, peerAgentID string, title string) (*model.ChatSession, error) {
	if initiatorAgentID == "" || peerAgentID == "" {
		return nil, fmt.Errorf("agent ids are required")
	}
	if initiatorAgentID == peerAgentID {
		return nil, fmt.Errorf("cannot chat with self")
	}
	if _, err := s.agentSvc.GetByID(initiatorAgentID); err != nil {
		return nil, fmt.Errorf("initiator agent not found: %w", err)
	}
	peer, err := s.agentSvc.GetByID(peerAgentID)
	if err != nil {
		return nil, fmt.Errorf("peer agent not found: %w", err)
	}

	var existing model.ChatSession
	if err := s.db.Where(
		"session_type = ? AND agent_id = ? AND peer_agent_id = ?",
		model.SessionTypeAgentAgent, initiatorAgentID, peerAgentID,
	).First(&existing).Error; err == nil {
		return &existing, nil
	}

	if title == "" {
		initiator, _ := s.agentSvc.GetByID(initiatorAgentID)
		initName := initiatorAgentID[:8]
		if initiator != nil {
			initName = initiator.Name
		}
		title = initName + " ↔ " + peer.Name
	}

	session := &model.ChatSession{
		SessionType: model.SessionTypeAgentAgent,
		AgentID:     initiatorAgentID,
		PeerAgentID: &peerAgentID,
		Title:       title,
	}
	if err := s.db.Create(session).Error; err != nil {
		return nil, fmt.Errorf("failed to create agent session: %w", err)
	}
	logActivity(s.db, "agent", initiatorAgentID, "create_session", "session", session.ID, nil)
	return session, nil
}

func (s *ChatService) newUserMessage(session *model.ChatSession, actorID, content string) model.ChatMessage {
	actorType := model.MessageActorUser
	if session.SessionType == model.SessionTypeAgentAgent {
		actorType = model.MessageActorAgent
	}
	return model.ChatMessage{
		SessionID:   session.ID,
		Role:        "user",
		ActorType:   actorType,
		ActorID:     actorID,
		ContentType: model.MessageContentText,
		Content:     content,
	}
}

func (s *ChatService) newAssistantMessage(session *model.ChatSession, contentType, content string) model.ChatMessage {
	if contentType == "" {
		contentType = model.MessageContentMarkdown
	}
	return model.ChatMessage{
		SessionID:   session.ID,
		Role:        "assistant",
		ActorType:   model.MessageActorAgent,
		ActorID:     session.AgentID,
		ContentType: contentType,
		Content:     content,
	}
}

func (s *ChatService) assistantFromLLM(session *model.ChatSession, raw string) model.ChatMessage {
	contentType, content := ParseAssistantResponse(raw)
	return s.newAssistantMessage(session, contentType, content)
}

// ---- tool-use message persistence ----
//
// OpenAI 协议要求多轮 tool use 的历史完整保留：
//   assistant(tool_calls=[...]) -> tool(tool_call_id=..., content=result) -> ...
// 为了让两步确认（register_idea 等）能跨请求生效，这些中间消息必须落库，
// 在下一轮请求的 buildMessageHistory 中按 OpenAI 格式重建。
// tool 相关字段（tool_calls / tool_call_id / tool_name）序列化进 Metadata JSON，
// 不需要改表结构。GetMessages 会过滤掉 role=tool 行，不返回给前端展示。

// messageMeta 定义见 chat_message_display.go。
//
// OpenAI 协议要求多轮 tool use 的历史完整保留：
//   assistant(tool_calls=[...]) -> tool(tool_call_id=..., content=result) -> ...
// llm_only 行仅用于 buildMessageHistory；activity 行仅用于用户 UI。

// newToolCallAssistantMessage 构造 LLM 决定调用工具时的 assistant 消息
// （OpenAI role=assistant + tool_calls）。content 可能为空。
func (s *ChatService) newToolCallAssistantMessage(session *model.ChatSession, content string, toolCalls []ToolCall) model.ChatMessage {
	meta := messageMeta{
		DisplayKind: displayKindLLMOnly,
		ToolCalls:   toolCalls,
	}
	return model.ChatMessage{
		SessionID:   session.ID,
		Role:        model.MessageRoleAssistant,
		ActorType:   model.MessageActorAgent,
		ActorID:     session.AgentID,
		ContentType: model.MessageContentText,
		Content:     content,
		Metadata:    marshalMessageMeta(meta),
	}
}

// newToolResultMessage 构造工具执行结果消息（OpenAI role=tool）。
func (s *ChatService) newToolResultMessage(session *model.ChatSession, toolCallID, toolName, output string) model.ChatMessage {
	meta := messageMeta{
		DisplayKind: displayKindLLMOnly,
		ToolCallID:  toolCallID,
		ToolName:    toolName,
	}
	return model.ChatMessage{
		SessionID:   session.ID,
		Role:        model.MessageRoleTool,
		ActorType:   model.MessageActorAgent,
		ActorID:     session.AgentID,
		ContentType: model.MessageContentJSON,
		Content:     output,
		Metadata:    marshalMessageMeta(meta),
	}
}

// newActivityMessage 构造用户可见的工具进度消息（role=system, display_kind=activity）。
func (s *ChatService) newActivityMessage(session *model.ChatSession, toolCallID, toolName, content string, activity map[string]any) model.ChatMessage {
	meta := messageMeta{
		DisplayKind: displayKindActivity,
		ToolCallID:  toolCallID,
		ToolName:    toolName,
		Activity:    activity,
	}
	return model.ChatMessage{
		SessionID:   session.ID,
		Role:        model.MessageRoleSystem,
		ActorType:   model.MessageActorAgent,
		ActorID:     session.AgentID,
		ContentType: model.MessageContentText,
		Content:     content,
		Metadata:    marshalMessageMeta(meta),
	}
}

func (s *ChatService) updateActivityMessage(msgID, content string, activity map[string]any) error {
	var existing model.ChatMessage
	if err := s.db.First(&existing, "id = ?", msgID).Error; err != nil {
		return err
	}
	meta := parseMessageMeta(existing.Metadata)
	meta.DisplayKind = displayKindActivity
	meta.Activity = mergeActivityMaps(meta.Activity, activity)
	return s.db.Model(&existing).Updates(map[string]any{
		"content":  content,
		"metadata": marshalMessageMeta(meta),
	}).Error
}

// chatMessageToLLMMessage 把持久化的 ChatMessage 还原为 LLM 可用的 LLMMessage，
// 从 Metadata 恢复 tool_calls / tool_call_id / tool_name（OpenAI 协议格式）。
func chatMessageToLLMMessage(m model.ChatMessage) LLMMessage {
	msg := LLMMessage{Role: m.Role, Content: m.Content}
	if m.Metadata == "" || m.Metadata == "{}" {
		return msg
	}
	var meta messageMeta
	if err := json.Unmarshal([]byte(m.Metadata), &meta); err != nil {
		return msg
	}
	msg.ToolCalls = meta.ToolCalls
	msg.ToolCallID = meta.ToolCallID
	msg.ToolName = meta.ToolName
	return msg
}

func (s *ChatService) bumpSessionMessageCount(session *model.ChatSession, delta int) {
	s.db.Model(session).Updates(map[string]interface{}{
		"message_count": gorm.Expr("message_count + ?", delta),
		"updated_at":    time.Now(),
	})
}

// persistConversationFailure keeps the user message and stores an assistant-side error reply.
func (s *ChatService) persistConversationFailure(session *model.ChatSession, cause error) {
	meta := map[string]any{"error": "conversation_failed", "cause": cause.Error()}
	var llmErr *llm.Error
	if errors.As(cause, &llmErr) {
		meta["provider"] = llmErr.Provider
		meta["model"] = llmErr.Model
		meta["code"] = llmErr.Code
		meta["request_id"] = llmErr.RequestID
		if llmErr.Hint != "" {
			meta["hint"] = llmErr.Hint
		}
	}
	raw, _ := json.Marshal(meta)
	display := fmt.Sprintf("⚠️ 对话失败：%s", cause.Error())
	if errors.As(cause, &llmErr) {
		display = llmErr.UserMessage()
	}
	msg := s.newAssistantMessage(session, model.MessageContentText, display)
	msg.Metadata = string(raw)
	_ = s.db.Create(&msg).Error
	s.bumpSessionMessageCount(session, 2)
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
		Preload("Agent").
		Preload("Idea").
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

	userMsg := s.newUserMessage(session, userID, input.Content)
	if err := s.db.Create(&userMsg).Error; err != nil {
		return nil, fmt.Errorf("failed to save user message: %w", err)
	}

	principal, err := s.buildPrincipal(session, userID, sessionID)
	if err != nil {
		return nil, err
	}

	assistantMsg, toolResults, tokensUsed, err := s.runConversation(session, input.Content, principal)
	if err != nil {
		s.persistConversationFailure(session, err)
		return nil, err
	}

	s.bumpSessionMessageCount(session, 2)

	logActivity(s.db, "user", userID, "send_message", "session", sessionID, nil)

	return &SendMessageResult{
		UserMessage:      userMsg,
		AssistantMessage: *assistantMsg,
		ToolResults:      toolResults,
		TokensUsed:       tokensUsed,
	}, nil
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
// 中间的 assistant(tool_calls) 与 tool 结果消息会持久化进 chat_messages
// （Metadata 承载 tool_calls / tool_call_id），以便两步确认等跨请求流程
// 能在 buildMessageHistory 中按 OpenAI 格式重建。GetMessages 会过滤掉
// role=tool 行，前端历史列表不展示这些中间消息。
func (s *ChatService) runConversation(session *model.ChatSession, userContent string, p Principal) (*model.ChatMessage, []ToolCallResult, int, error) {
	return s.runConversationWithProgress(session, userContent, p, nil)
}

// runConversationWithProgress 与 runConversation 等价，但允许传入一个可选的
// progress channel，每轮工具调用前后会推送 StreamEvent。
// progressCh=nil 时等价于 runConversation。
func (s *ChatService) runConversationWithProgress(session *model.ChatSession, userContent string, p Principal, progressCh chan<- StreamEvent) (*model.ChatMessage, []ToolCallResult, int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), maxToolHistoryMs*time.Millisecond)
	defer cancel()

	systemPrompt := s.buildSystemPromptWithRAG(session, userContent, s.buildMessageHistory(session.ID))

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
			msg := s.assistantFromLLM(session, resp.Content)
			if err := s.db.Create(&msg).Error; err != nil {
				return nil, nil, 0, fmt.Errorf("failed to save assistant message: %w", err)
			}
			s.pushEvent(progressCh, "assistant_message", map[string]any{
				"id":           msg.ID,
				"content":      msg.Content,
				"content_type": msg.ContentType,
			})
			return &msg, allToolResults, totalTokens, nil
		}

		// 把 LLM 的 tool_calls 决策加入 history（OpenAI 协议要求保留）
		history = append(history, LLMMessage{
			Role:      "assistant",
			Content:   resp.Content,
			ToolCalls: resp.ToolCalls,
		})

		// 持久化 assistant(tool_calls) 消息，使两步确认等跨请求流程可见（失败仅记录，不中断对话）
		tcMsg := s.newToolCallAssistantMessage(session, resp.Content, resp.ToolCalls)
		if err := s.db.Create(&tcMsg).Error; err != nil {
			log.Printf("[chat] persist tool_calls message failed: %v", err)
		}

		// P1: 推送工具调用进度事件（"正在搜索 idea..."）并落库 activity 消息
		activityByToolCall := make(map[string]string, len(resp.ToolCalls))
		for _, tc := range resp.ToolCalls {
			eventData := map[string]any{
				"tool":      tc.Name,
				"tool_call": tc.ID,
				"args":      json.RawMessage(tc.ArgsJSON),
			}
			activity := map[string]any{
				"type":      "tool_call",
				"tool":      tc.Name,
				"tool_call": tc.ID,
			}
			// delegate_to_agent 特殊处理：解析目标 Agent 名
			if tc.Name == "delegate_to_agent" {
				activity["is_a2a"] = true
				var argsMap map[string]any
				if json.Unmarshal(tc.ArgsJSON, &argsMap) == nil {
					if targetID, ok := argsMap["target_agent_id"].(string); ok {
						if targetAgent, err := s.agentSvc.GetByID(targetID); err == nil {
							eventData["target_agent_name"] = targetAgent.Name
							eventData["target_agent_id"] = targetID
							activity["target_agent_name"] = targetAgent.Name
							activity["target_agent_id"] = targetID
							if task, ok := argsMap["task"].(string); ok {
								eventData["task"] = task
								activity["task"] = task
							}
						}
					}
				}
			}
			targetName, _ := eventData["target_agent_name"].(string)
			actMsg := s.newActivityMessage(session, tc.ID, tc.Name,
				buildToolCallActivityContent(tc.Name, targetName), activity)
			if err := s.db.Create(&actMsg).Error; err != nil {
				log.Printf("[chat] persist activity message failed: %v", err)
			} else {
				activityByToolCall[tc.ID] = actMsg.ID
				eventData["id"] = actMsg.ID
			}
			s.pushEvent(progressCh, "tool_call", eventData)
		}

		// 执行所有 tool_calls
		results, err := s.tools.ExecuteBatch(ctx, p, resp.ToolCalls)
		if err != nil {
			return nil, nil, 0, fmt.Errorf("tool execution failed: %w", err)
		}
		allToolResults = append(allToolResults, results...)

		// 推送工具结果进度事件并更新 activity 消息
		for _, r := range results {
			eventData := map[string]any{
				"tool":      r.Name,
				"tool_call": r.ToolCallID,
				"ok":        r.OK,
				"output":    json.RawMessage(r.Output),
				"display":   r.Display,
			}
			activity := map[string]any{
				"type":      "tool_result",
				"tool":      r.Name,
				"tool_call": r.ToolCallID,
				"ok":        r.OK,
			}
			// delegate_to_agent 结果：解析目标 Agent 名和回复摘要
			var responseSummary string
			if r.Name == "delegate_to_agent" && r.OK {
				activity["is_a2a"] = true
				var outMap map[string]any
				if json.Unmarshal([]byte(r.Output), &outMap) == nil {
					if name, ok := outMap["target_agent"].(string); ok {
						eventData["target_agent_name"] = name
						activity["target_agent_name"] = name
					}
					if response, ok := outMap["response"].(string); ok {
						summary := response
						if len(summary) > 200 {
							summary = summary[:200] + "…"
						}
						eventData["response_summary"] = summary
						responseSummary = summary
						activity["response_summary"] = summary
					}
				}
			}
			if r.OK {
				activity["a2a_completed"] = r.Name == "delegate_to_agent"
			}
			targetName, _ := eventData["target_agent_name"].(string)
			resultContent := buildToolResultActivityContent(r.Name, targetName, r.OK, responseSummary)
			if actID, ok := activityByToolCall[r.ToolCallID]; ok {
				eventData["id"] = actID
				if err := s.updateActivityMessage(actID, resultContent, activity); err != nil {
					log.Printf("[chat] update activity message failed: %v", err)
				}
			}
			s.pushEvent(progressCh, "tool_result", eventData)
		}

		s.persistToolActivity(p, results)

		for _, r := range results {
			history = append(history, LLMMessage{
				Role:       "tool",
				ToolCallID: r.ToolCallID,
				ToolName:   r.Name,
				Content:    r.Output,
			})
			// 持久化 tool 结果消息，使两步确认等跨请求流程可见（失败仅记录，不中断对话）
			trMsg := s.newToolResultMessage(session, r.ToolCallID, r.Name, r.Output)
			if err := s.db.Create(&trMsg).Error; err != nil {
				log.Printf("[chat] persist tool result message failed: %v", err)
			}
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

	msg := s.assistantFromLLM(session, finalResp.Content)
	if err := s.db.Create(&msg).Error; err != nil {
		return nil, nil, 0, fmt.Errorf("failed to save assistant message: %w", err)
	}
	s.pushEvent(progressCh, "assistant_message", map[string]any{
		"id":           msg.ID,
		"content":      msg.Content,
		"content_type": msg.ContentType,
	})
	return &msg, allToolResults, totalTokens, nil
}

// pushEvent 向 progress channel 安全推送事件（nil channel / 已关闭均会忽略）。
// 带持久化 id 的关键事件阻塞发送，避免 UI 丢失 upsert 目标。
func (s *ChatService) pushEvent(ch chan<- StreamEvent, typ string, data any) {
	if ch == nil {
		return
	}
	defer func() { _ = recover() }() // 防止 send on closed channel panic
	ev := StreamEvent{Type: typ, Data: data}
	switch typ {
	case "user_message", "assistant_message", "tool_call", "tool_result":
		ch <- ev
		return
	}
	select {
	case ch <- ev:
	default: // 非关键进度事件可丢弃
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

	userMsg := s.newUserMessage(session, userID, content)
	if err := s.db.Create(&userMsg).Error; err != nil {
		return nil, nil, fmt.Errorf("failed to save user message: %w", err)
	}

	principal, err := s.buildPrincipal(session, userID, sessionID)
	if err != nil {
		return nil, nil, err
	}

	// tools 启用时：流式即工具循环 + 进度事件
	if s.tools != nil {
		return s.streamWithTools(session, &userMsg, content, principal)
	}

	// 否则：保持原有 ChatStream（无工具）
	return s.streamNoTools(session, &userMsg, userID, content)
}

func (s *ChatService) streamNoTools(session *model.ChatSession, userMsg *model.ChatMessage, userID, content string) (<-chan StreamChunk, *model.ChatMessage, error) {
	systemPrompt := s.buildSystemPromptWithRAG(session, content, s.buildMessageHistory(session.ID))
	history := s.buildMessageHistory(session.ID)

	streamCh, err := s.llm.ChatStream(systemPrompt, history)
	if err != nil {
		s.persistConversationFailure(session, err)
		return nil, nil, err
	}

	wrapperCh := make(chan StreamChunk, 64)
	go func() {
		defer close(wrapperCh)
		var fullContent string

		for chunk := range streamCh {
			if chunk.Error != nil {
				s.persistConversationFailure(session, chunk.Error)
				wrapperCh <- chunk
				return
			}
			if chunk.Done {
				assistantMsg := s.assistantFromLLM(session, fullContent)
				s.db.Create(&assistantMsg)
				s.bumpSessionMessageCount(session, 2)
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
			s.persistConversationFailure(session, err)
			out <- StreamChunk{Error: err}
			return
		}

		s.bumpSessionMessageCount(session, 2)
		logActivity(s.db, "user", principal.UserID, "send_message", "session", session.ID, nil)

		out <- StreamChunk{Done: true}
	}()

	return out, userMsg, nil
}

func (s *ChatService) GetMessages(sessionID, userID string, beforeID string, limit int) ([]ChatMessageView, error) {
	if _, err := s.GetSession(sessionID, userID); err != nil {
		return nil, err
	}

	if limit <= 0 || limit > 100 {
		limit = 50
	}

	// 多取若干倍再按 UI 可见性过滤，避免 llm_only / 空 assistant 行挤掉可见消息。
	fetchLimit := limit * 4
	if fetchLimit > 200 {
		fetchLimit = 200
	}

	// 前端历史列表不展示 role=tool 的中间消息（流式期间已通过 SSE tool_call/tool_result 事件展示）；
	// 这些行仅用于 buildMessageHistory 重建 LLM 上下文。
	q := s.db.Where("session_id = ? AND role != ?", sessionID, model.MessageRoleTool).
		Order("created_at DESC").Limit(fetchLimit)

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

	messages = filterVisibleMessages(messages, limit)

	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	feedbackMap := s.feedbackMapForMessages(userID, messages)
	out := make([]ChatMessageView, len(messages))
	for i, m := range messages {
		out[i] = ChatMessageView{
			ChatMessage:  m,
			UserFeedback: feedbackMap[m.ID],
		}
	}
	return out, nil
}

func (s *ChatService) feedbackMapForMessages(userID string, messages []model.ChatMessage) map[string]string {
	out := map[string]string{}
	if userID == "" || len(messages) == 0 {
		return out
	}
	ids := make([]string, len(messages))
	for i, m := range messages {
		ids[i] = m.ID
	}
	var rows []model.MessageFeedback
	s.db.Where("user_id = ? AND message_id IN ?", userID, ids).Find(&rows)
	for _, r := range rows {
		out[r.MessageID] = r.Rating
	}
	return out
}

func (s *ChatService) verifyMessageInSession(sessionID, messageID, userID string) (*model.ChatMessage, error) {
	if _, err := s.GetSession(sessionID, userID); err != nil {
		return nil, err
	}
	var msg model.ChatMessage
	if err := s.db.Where("id = ? AND session_id = ?", messageID, sessionID).First(&msg).Error; err != nil {
		return nil, fmt.Errorf("message not found")
	}
	return &msg, nil
}

func (s *ChatService) SetMessageFeedback(sessionID, messageID, userID, rating string) (string, error) {
	if rating != model.MessageFeedbackLike && rating != model.MessageFeedbackDislike {
		return "", fmt.Errorf("invalid rating")
	}
	if _, err := s.verifyMessageInSession(sessionID, messageID, userID); err != nil {
		return "", err
	}

	var existing model.MessageFeedback
	err := s.db.Where("message_id = ? AND user_id = ?", messageID, userID).First(&existing).Error
	if err == nil {
		if existing.Rating == rating {
			return rating, nil
		}
		existing.Rating = rating
		if err := s.db.Save(&existing).Error; err != nil {
			return "", err
		}
		return rating, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", err
	}
	if err := s.db.Create(&model.MessageFeedback{
		MessageID: messageID,
		UserID:    userID,
		Rating:    rating,
	}).Error; err != nil {
		return "", err
	}
	return rating, nil
}

func (s *ChatService) ClearMessageFeedback(sessionID, messageID, userID string) error {
	if _, err := s.verifyMessageInSession(sessionID, messageID, userID); err != nil {
		return err
	}
	return s.db.Where("message_id = ? AND user_id = ?", messageID, userID).
		Delete(&model.MessageFeedback{}).Error
}

func (s *ChatService) ForkSession(sessionID, userID string, input ForkSessionInput) (*model.ChatSession, error) {
	source, err := s.GetSession(sessionID, userID)
	if err != nil {
		return nil, err
	}

	// 保留 role=tool 行：分叉会话也需要完整的 tool-use 上下文（两步确认等）。
	q := s.db.Where("session_id = ? AND role IN ?", sessionID, []string{"user", "assistant", "tool"}).
		Order("created_at ASC")

	if input.BeforeMessageID != "" {
		anchor, err := s.verifyMessageInSession(sessionID, input.BeforeMessageID, userID)
		if err != nil {
			return nil, err
		}
		q = q.Where("created_at <= ?", anchor.CreatedAt)
	}

	var sourceMessages []model.ChatMessage
	if err := q.Find(&sourceMessages).Error; err != nil {
		return nil, err
	}
	if len(sourceMessages) == 0 {
		return nil, fmt.Errorf("no messages to fork")
	}

	title := input.Title
	if title == "" {
		title = "分支: " + source.Title
	}

	forkedFrom := source.ID
	var forkedBefore *string
	if input.BeforeMessageID != "" {
		forkedBefore = &input.BeforeMessageID
	}

	newSession := &model.ChatSession{
		SessionType:           source.SessionType,
		UserID:                source.UserID,
		AgentID:               source.AgentID,
		PeerAgentID:           source.PeerAgentID,
		IdeaID:                source.IdeaID,
		Title:                 title,
		MessageCount:          len(sourceMessages),
		ForkedFromID:          &forkedFrom,
		ForkedBeforeMessageID: forkedBefore,
	}
	if err := s.db.Create(newSession).Error; err != nil {
		return nil, fmt.Errorf("failed to create forked session: %w", err)
	}

	copies := make([]model.ChatMessage, len(sourceMessages))
	for i, m := range sourceMessages {
		copies[i] = model.ChatMessage{
			SessionID:   newSession.ID,
			ActorType:   m.ActorType,
			ActorID:     m.ActorID,
			Role:        m.Role,
			ContentType: m.ContentType,
			Content:     m.Content,
			Metadata:    m.Metadata,
			CreatedAt:   m.CreatedAt,
		}
	}
	if err := s.db.Create(&copies).Error; err != nil {
		return nil, fmt.Errorf("failed to copy messages: %w", err)
	}

	logActivity(s.db, "user", userID, "fork_session", "session", newSession.ID, map[string]string{
		"source_session_id": source.ID,
	})
	return newSession, nil
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

// buildPrincipal 构造工具执行身份。万叶助手会话中写操作归属用户默认 Agent。
func (s *ChatService) buildPrincipal(session *model.ChatSession, userID, sessionID string) (Principal, error) {
	p := Principal{
		Source:    "rest",
		UserID:    userID,
		AgentID:   session.AgentID,
		SessionID: sessionID,
	}
	if session.IdeaID != nil {
		p.IdeaID = *session.IdeaID
	}
	if userID != "" && IsSystemAgent(s.db, session.AgentID) {
		p.IsSystemAssistant = true
		agent, err := s.agentSvc.EnsureDefaultUserAgent(userID)
		if err != nil {
			return Principal{}, fmt.Errorf("failed to resolve user agent for write operations: %w", err)
		}
		p.AgentID = agent.ID
		p.AuthorAgentReady = true
	}
	return p, nil
}

// buildSystemPromptWithRAG 在原 system prompt 基础上，按意图注入 idea 检索结果。
func (s *ChatService) buildSystemPromptWithRAG(session *model.ChatSession, userMessage string, history []LLMMessage) string {
	base := s.buildSystemPrompt(session)
	intent := DetectIdeaIntent(session, userMessage, history)

	switch intent {
	case IdeaIntentCreateOrRefine:
		if section := s.buildCreateIntentRAG(session, userMessage, history); section != "" {
			return base + section + responseFormatInstructions
		}
	case IdeaIntentExplore:
		if section := s.buildExploreIntentRAG(session, userMessage, history); section != "" {
			return base + section + responseFormatInstructions
		}
	}
	return base + responseFormatInstructions
}

func (s *ChatService) buildCreateIntentRAG(session *model.ChatSession, userMessage string, history []LLMMessage) string {
	if s.ideaRetriever != nil && s.ideaRetriever.Enabled() {
		bundle, err := s.ideaRetriever.Retrieve(session, userMessage, history)
		if err == nil && bundle != nil {
			if section := FormatIdeaContextSection(bundle); section != "" {
				return section
			}
		}
	}
	if s.ideaRetriever != nil {
		bundle, err := s.ideaRetriever.RetrievePortfolioFallback(session)
		if err == nil && bundle != nil {
			return FormatPortfolioFallbackSection(bundle)
		}
	}
	return ""
}

func (s *ChatService) buildExploreIntentRAG(session *model.ChatSession, userMessage string, history []LLMMessage) string {
	if s.ideaRetriever != nil && s.ideaRetriever.Enabled() {
		bundle, err := s.ideaRetriever.RetrieveExplore(session, userMessage, history)
		if err == nil {
			return FormatExploreContextSection(bundle)
		}
	}
	return exploreSearchToolHint
}

func formatRAGIdeaLine(n int, m IdeaMatch) string {
	line := fmt.Sprintf("\n%d. 【%s】%s", n, m.Idea.Title, m.Idea.Description)
	if m.Idea.Category != "" {
		line += fmt.Sprintf("（分类：%s）", m.Idea.Category)
	}
	return line
}

func (s *ChatService) buildMessageHistory(sessionID string) []LLMMessage {
	var messages []model.ChatMessage
	// 包含 role=tool 行：OpenAI 多轮 tool use 要求 assistant(tool_calls) → tool 结果
	// 完整保留，两步确认（register_idea 等）跨请求时才能在历史里看到上轮的 token。
	s.db.Where("session_id = ? AND role IN ?", sessionID, []string{"user", "assistant", "tool"}).
		Order("created_at DESC").
		Limit(maxMessageHistory).
		Find(&messages)

	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	result := make([]LLMMessage, 0, len(messages))
	for _, m := range messages {
		// 从 Metadata 恢复 tool_calls / tool_call_id / tool_name（OpenAI 协议格式）
		result = append(result, chatMessageToLLMMessage(m))
	}
	return result
}
