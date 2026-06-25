package service

import (
	"fmt"

	"github.com/wanye/ideaevo/internal/a2a"
	"github.com/wanye/ideaevo/internal/model"
)

// HandleTask 实现 a2a.TaskHandler 接口。
// 当外部调用方（或其他 Agent）通过 A2A 协议提交任务时，
// 此方法负责加载目标 Agent 配置并执行对话。
//
// 与早期实现不同，现在走完整的工具循环（runConversationWithProgress），
// 使被委派的目标 Agent 能调用 register_idea / search_ideas 等工具。
// 这是 idea 创建的三条路径之一（A2A 协议路径）。
func (s *ChatService) HandleTask(task *a2a.Task, agentID string, streaming bool, onChunk func(string)) (*a2a.Task, error) {
	// 加载目标 Agent（响应者 / 资源作者）
	agent, err := s.agentSvc.GetByID(agentID)
	if err != nil {
		return nil, fmt.Errorf("target agent not found: %w", err)
	}

	// 从任务消息中提取用户输入
	var userText string
	for _, msg := range task.Messages {
		if msg.Role == "user" {
			for _, p := range msg.Parts {
				if p.Type == "text" && p.Text != "" {
					userText = p.Text
					break
				}
			}
		}
	}
	if userText == "" {
		return nil, fmt.Errorf("no user text in task message")
	}

	// 构造 callerID（委派方身份）：用于 agent-agent 会话的 PeerAgentID。
	// 注意：当前 HandleTask 签名不传 callerID，A2A 委派时由 delegateFn 构造 task；
	// 若无 caller 信息，会话仍可工作（仅缺 PeerAgentID 归属记录）。
	callerAgentID := ""

	// 创建/复用 agent-agent 会话。
	// 关键：AgentID = 目标 agent（响应者），因为 buildSystemPrompt 用 session.AgentID 构建人设。
	session := s.getOrCreateA2ASession(agentID, callerAgentID, agent.Name)

	// 持久化用户（委派方）消息
	userMsg := s.newUserMessage(session, firstNonEmpty(callerAgentID, agentID), userText)
	if err := s.db.Create(&userMsg).Error; err != nil {
		return nil, fmt.Errorf("persist a2a user message: %w", err)
	}

	// 构造 Principal：目标 agent 是任何创建资源的作者（requireAuthor 返回 AgentID）
	principal := Principal{
		Source:    "agent_bridge",
		AgentID:   agentID,
		SessionID: session.ID,
	}

	var replyText string

	// 工具启用时走完整工具循环；否则降级为直接 LLM 调用
	if s.tools != nil && s.llm != nil {
		msg, _, _, err := s.runConversationWithProgress(session, userText, principal, nil)
		if err != nil {
			task.State = a2a.TaskStateFailed
			return task, err
		}
		replyText = msg.Content
	} else if s.llm != nil {
		// 无工具环境（mock / 工具未配置）
		sysPrompt := agent.SystemPrompt
		if sysPrompt == "" {
			sysPrompt = fmt.Sprintf("你是 %s。%s 请用中文回答用户的问题。", agent.Name, agent.Description)
		}
		history := []LLMMessage{{Role: "user", Content: userText}}
		resp, err := s.llm.Chat(sysPrompt, history)
		if err != nil {
			task.State = a2a.TaskStateFailed
			return task, nil
		}
		replyText = resp.Content
		// mock 模式（s.llm == nil）
	} else {
		replyText = fmt.Sprintf("(A2A 回复) 收到任务：%s。我已理解你的需求。", userText)
	}

	// 流式回调：工具循环结束后一次性推送完整回复（事件级，非逐 token）
	if streaming && onChunk != nil && replyText != "" {
		onChunk(replyText)
	}

	task.State = a2a.TaskStateCompleted
	task.Messages = append(task.Messages, a2a.Message{
		Role:      "agent",
		MessageID: "response",
		Parts:     []a2a.Part{{Type: "text", Text: replyText}},
	})
	return task, nil
}

// getOrCreateA2ASession 复用或创建一个 agent-agent 会话。
// AgentID = 目标 agent（响应者），PeerAgentID = 委派方（发起者）。
func (s *ChatService) getOrCreateA2ASession(targetAgentID, callerAgentID, targetAgentName string) *model.ChatSession {
	session := &model.ChatSession{
		SessionType: model.SessionTypeAgentAgent,
		AgentID:     targetAgentID,
		Title:       "A2A → " + targetAgentName,
	}
	if callerAgentID != "" {
		session.PeerAgentID = &callerAgentID
	}

	// 按目标 agent + 委派方去重复用
	query := s.db.Where("session_type = ? AND agent_id = ?", model.SessionTypeAgentAgent, targetAgentID)
	if callerAgentID != "" {
		query = query.Where("peer_agent_id = ?", callerAgentID)
	}
	query.FirstOrCreate(session)
	return session
}

// 确保 ChatService 实现了 a2a.TaskHandler 接口
var _ a2a.TaskHandler = (*ChatService)(nil)
