package service

import (
	"fmt"

	"github.com/wanye/ideaevo/internal/a2a"
)

// HandleTask 实现 a2a.TaskHandler 接口。
// 当外部调用方（或其他 Agent）通过 A2A 协议提交任务时，
// 此方法负责加载目标 Agent 配置并执行对话。
func (s *ChatService) HandleTask(task *a2a.Task, agentID string, streaming bool, onChunk func(text string)) (*a2a.Task, error) {
	// 加载目标 Agent
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

	// 构建 system prompt
	sysPrompt := agent.SystemPrompt
	if sysPrompt == "" {
		sysPrompt = fmt.Sprintf("你是 %s。%s 请用中文回答用户的问题。", agent.Name, agent.Description)
	}

	if s.llm == nil {
		// mock 模式
		task.State = a2a.TaskStateCompleted
		task.Messages = append(task.Messages, a2a.Message{
			Role:      "agent",
			MessageID: "response",
			Parts:     []a2a.Part{{Type: "text", Text: fmt.Sprintf("(A2A 回复) 收到任务：%s。我已理解你的需求。", userText)}},
		})
		return task, nil
	}

	history := []LLMMessage{
		{Role: "user", Content: userText},
	}

	if streaming && onChunk != nil {
		reader, err := s.llm.ChatStream(sysPrompt, history)
		if err != nil {
			return nil, err
		}
		fullText := ""
		for chunk := range reader {
			if chunk.Error != nil {
				break
			}
			if chunk.Content != "" {
				onChunk(chunk.Content)
				fullText += chunk.Content
			}
			if chunk.Done {
				break
			}
		}
		task.State = a2a.TaskStateCompleted
		task.Messages = append(task.Messages, a2a.Message{
			Role:      "agent",
			MessageID: "response",
			Parts:     []a2a.Part{{Type: "text", Text: fullText}},
		})
		return task, nil
	}

	// 非流式
	resp, err := s.llm.Chat(sysPrompt, history)
	if err != nil {
		task.State = a2a.TaskStateFailed
		return task, nil
	}

	task.State = a2a.TaskStateCompleted
	task.Messages = append(task.Messages, a2a.Message{
		Role:      "agent",
		MessageID: "response",
		Parts:     []a2a.Part{{Type: "text", Text: resp.Content}},
	})
	return task, nil
}

// 确保 ChatService 实现了 a2a.TaskHandler 接口
var _ a2a.TaskHandler = (*ChatService)(nil)
