package a2a

import (
	"context"
	"fmt"
	"sync"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// Service 管理 A2A 任务的生命周期。
type Service struct {
	db     *gorm.DB
	handler TaskHandler
	mu     sync.RWMutex
}

// NewService 创建 A2A 服务。handler 由 ChatService 实现。
func NewService(db *gorm.DB, handler TaskHandler) *Service {
	return &Service{db: db, handler: handler}
}

// GetAgentCards 返回所有公开 Agent 的 Agent Card 列表。
func (s *Service) GetAgentCards(baseURL string) []AgentCard {
	var agents []model.Agent
	s.db.Where("visibility = ? AND owner_user_id != ''", "public").
		Or("owner_user_id = ''").
		Find(&agents)

	cards := make([]AgentCard, 0, len(agents))
	for _, a := range agents {
		cards = append(cards, AgentCard{
			Name:        a.Name,
			Description: a.Description,
			URL:         fmt.Sprintf("%s/a2a/agents/%s", baseURL, a.ID),
			Version:     "1.0.0",
			Capabilities: Capabilities{
				Streaming:       true,
				StateTransition: true,
			},
			DefaultInputModes:  []string{"text"},
			DefaultOutputModes: []string{"text"},
			Skills: []AgentSkill{
				{
					ID:          a.ID,
					Name:        a.Name,
					Description: a.Description,
				},
			},
		})
	}
	return cards
}

// GetAgentCard 返回单个 Agent 的 Agent Card。
func (s *Service) GetAgentCard(agentID, baseURL string) (*AgentCard, error) {
	var agent model.Agent
	if err := s.db.First(&agent, "id = ? AND visibility = ?", agentID, "public").Error; err != nil {
		return nil, fmt.Errorf("agent not found or not public")
	}
	return &AgentCard{
		Name:        agent.Name,
		Description: agent.Description,
		URL:         fmt.Sprintf("%s/a2a/agents/%s", baseURL, agentID),
		Version:     "1.0.0",
		Capabilities: Capabilities{
			Streaming:       true,
			StateTransition: true,
		},
		DefaultInputModes:  []string{"text"},
		DefaultOutputModes: []string{"text"},
		Skills: []AgentSkill{
			{
				ID:          agent.ID,
				Name:        agent.Name,
				Description: agent.Description,
			},
		},
	}, nil
}

// SendTask 处理 tasks/send（非流式）。
func (s *Service) SendTask(ctx context.Context, params SendTaskParams, agentID string) (*Task, error) {
	if s.handler == nil {
		return nil, fmt.Errorf("A2A handler not configured")
	}

	// 从消息中提取用户文本
	userText := extractText(params.Message)
	if userText == "" {
		return nil, fmt.Errorf("empty message")
	}

	// 创建任务记录
	task := &Task{
		ID:    params.ID,
		State: TaskStateSubmitted,
		Messages: []Message{
			params.Message,
		},
	}

	// 持久化 A2A 任务
	a2aTask := &model.A2ATask{
		ID:            params.ID,
		CallerAgentID: "external", // 外部调用方
		TargetAgentID: agentID,
		Status:        model.A2ATaskStatusRunning,
		InputText:     userText,
	}
	if params.SessionID != "" {
		a2aTask.SessionID = params.SessionID
	}
	s.db.Create(a2aTask)

	// 执行任务（非流式）
	result, err := s.handler.HandleTask(task, agentID, false, nil)
	if err != nil {
		s.db.Model(a2aTask).Updates(map[string]any{
			"status": model.A2ATaskStatusFailed,
			"error":  err.Error(),
		})
		result = &Task{
			ID:    params.ID,
			State: TaskStateFailed,
		}
		return result, nil // 返回 failed 状态而非 error（A2A 规范要求返回 Task）
	}

	// 提取输出文本
	outputText := ""
	if len(result.Messages) > 1 {
		outputText = extractText(result.Messages[len(result.Messages)-1])
	}

	s.db.Model(a2aTask).Updates(map[string]any{
		"status":      model.A2ATaskStatusCompleted,
		"output_text": outputText,
	})

	return result, nil
}

// SendTaskSubscribe 处理 tasks/sendSubscribe（流式）。
// onChunk 回调被传递给 handler，用于推送流式文本块。
func (s *Service) SendTaskSubscribe(ctx context.Context, params SendTaskParams, agentID string, onChunk func(text string)) (*Task, error) {
	if s.handler == nil {
		return nil, fmt.Errorf("A2A handler not configured")
	}

	userText := extractText(params.Message)
	if userText == "" {
		return nil, fmt.Errorf("empty message")
	}

	task := &Task{
		ID:    params.ID,
		State: TaskStateWorking,
		Messages: []Message{
			params.Message,
		},
	}

	// 持久化
	a2aTask := &model.A2ATask{
		ID:            params.ID,
		CallerAgentID: "external",
		TargetAgentID: agentID,
		Status:        model.A2ATaskStatusRunning,
		InputText:     userText,
	}
	s.db.Create(a2aTask)

	// 流式执行
	result, err := s.handler.HandleTask(task, agentID, true, onChunk)
	if err != nil {
		s.db.Model(a2aTask).Updates(map[string]any{
			"status": model.A2ATaskStatusFailed,
			"error":  err.Error(),
		})
		return &Task{
			ID:    params.ID,
			State: TaskStateFailed,
		}, nil
	}

	outputText := ""
	if len(result.Messages) > 1 {
		outputText = extractText(result.Messages[len(result.Messages)-1])
	}
	s.db.Model(a2aTask).Updates(map[string]any{
		"status":      model.A2ATaskStatusCompleted,
		"output_text": outputText,
	})

	return result, nil
}

// GetTask 查询任务状态。
func (s *Service) GetTask(taskID string) (*Task, error) {
	var a2aTask model.A2ATask
	if err := s.db.First(&a2aTask, "id = ?", taskID).Error; err != nil {
		return nil, fmt.Errorf("task not found")
	}

	state := TaskStateCompleted
	switch a2aTask.Status {
	case model.A2ATaskStatusPending:
		state = TaskStateSubmitted
	case model.A2ATaskStatusRunning:
		state = TaskStateWorking
	case model.A2ATaskStatusFailed:
		state = TaskStateFailed
	}

	return &Task{
		ID:    a2aTask.ID,
		State: state,
		Messages: []Message{
			{
				Role:      "user",
				MessageID: "input",
				Parts:     []Part{{Type: "text", Text: a2aTask.InputText}},
			},
			{
				Role:      "agent",
				MessageID: "output",
				Parts:     []Part{{Type: "text", Text: a2aTask.OutputText}},
			},
		},
	}, nil
}

// extractText 从 Message 的 Parts 中提取纯文本。
func extractText(msg Message) string {
	for _, p := range msg.Parts {
		if p.Type == "text" && p.Text != "" {
			return p.Text
		}
	}
	return ""
}
