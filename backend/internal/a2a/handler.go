package a2a

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler 处理 A2A JSON-RPC 请求和 Agent Card 发现。
type Handler struct {
	svc     *Service
	baseURL string // 如 "https://www.ideavalues.xyz"
}

func NewHandler(svc *Service, baseURL string) *Handler {
	return &Handler{svc: svc, baseURL: baseURL}
}

// RegisterDiscoveryRoutes 注册公开的 Agent Card 发现端点（无需鉴权）。
// 已弃用：路由在 main.go 中分别注册（公开 discovery + 鉴权 tasks）。
// 保留以备需要时使用。
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/.well-known/agent.json", h.GetAgentCards)
	rg.GET("/agents/:agentId/.well-known/agent.json", h.GetAgentCard)
	rg.POST("/agents/:agentId", h.HandleJSONRPC)
}

// GetAgentCards 返回所有公开 Agent 的 Card 列表。
func (h *Handler) GetAgentCards(c *gin.Context) {
	cards := h.svc.GetAgentCards(h.baseURL)
	c.JSON(http.StatusOK, gin.H{"agents": cards})
}

// GetAgentCard 返回单个 Agent 的 Card。
func (h *Handler) GetAgentCard(c *gin.Context) {
	agentID := c.Param("agentId")
	card, err := h.svc.GetAgentCard(agentID, h.baseURL)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, card)
}

// HandleJSONRPC 处理所有 A2A JSON-RPC 请求。
// 要求鉴权（AgentOrUserAuth 中间件），调用方身份从 context 获取。
func (h *Handler) HandleJSONRPC(c *gin.Context) {
	agentID := c.Param("agentId")

	// 从鉴权中间件获取调用方身份
	callerAgentID := c.GetString("agent_id")
	callerUserID := c.GetString("user_id")
	callerID := callerAgentID
	if callerID == "" {
		callerID = "user:" + callerUserID
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		h.respondError(c, nil, ErrCodeJSONParseError, "failed to read body")
		return
	}

	var req JSONRPCRequest
	if err := json.Unmarshal(body, &req); err != nil {
		h.respondError(c, nil, ErrCodeJSONParseError, "invalid JSON")
		return
	}

	// 验证 JSON-RPC 版本
	if req.JSONRPC != "2.0" {
		h.respondError(c, req.ID, ErrCodeInvalidRequest, "jsonrpc must be '2.0'")
		return
	}

	switch req.Method {
	case "tasks/send":
		h.handleSendTask(c, &req, agentID, callerID, false)
	case "tasks/sendSubscribe":
		h.handleSendTask(c, &req, agentID, callerID, true)
	case "tasks/get":
		h.handleGetTask(c, &req)
	default:
		h.respondError(c, req.ID, ErrCodeMethodNotFound, fmt.Sprintf("method %q not found", req.Method))
	}
}

// handleSendTask 处理 tasks/send 和 tasks/sendSubscribe。
func (h *Handler) handleSendTask(c *gin.Context, req *JSONRPCRequest, agentID string, callerID string, streaming bool) {
	var params SendTaskParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		h.respondError(c, req.ID, ErrCodeInvalidParams, "invalid params")
		return
	}

	if streaming {
		// 流式：SSE 响应
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		c.Header("X-Accel-Buffering", "no")

		flusher, ok := c.Writer.(http.Flusher)
		if !ok {
			h.respondError(c, req.ID, ErrCodeInternalError, "streaming not supported")
			return
		}

		// 流式推送中间状态
		onChunk := func(text string) {
			// 推送 working 状态更新
			updateEvent := JSONRPCResponse{
				JSONRPC: "2.0",
				ID:      req.ID,
				Result: &Task{
					ID:    params.ID,
					State: TaskStateWorking,
					Artifacts: []Artifact{
						{
							ArtifactID: "stream",
							Parts:      []Part{{Type: "text", Text: text}},
						},
					},
				},
			}
			data, _ := json.Marshal(updateEvent)
			fmt.Fprintf(c.Writer, "data: %s\n\n", data)
			flusher.Flush()
		}

		// 执行任务
		result, err := h.svc.SendTaskSubscribe(c.Request.Context(), params, agentID, callerID, onChunk)
		if err != nil {
			errResp := JSONRPCResponse{
				JSONRPC: "2.0",
				ID:      req.ID,
				Error: &JSONRPCError{
					Code:    ErrCodeInternalError,
					Message: err.Error(),
				},
			}
			data, _ := json.Marshal(errResp)
			fmt.Fprintf(c.Writer, "data: %s\n\n", data)
			flusher.Flush()
			return
		}

		// 推送最终结果
		doneResp := JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result:  result,
		}
		data, _ := json.Marshal(doneResp)
		fmt.Fprintf(c.Writer, "data: %s\n\n", data)
		flusher.Flush()
	} else {
		// 非流式：直接返回
		result, err := h.svc.SendTask(c.Request.Context(), params, agentID, callerID)
		if err != nil {
			h.respondError(c, req.ID, ErrCodeInternalError, err.Error())
			return
		}
		c.JSON(http.StatusOK, JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result:  result,
		})
	}
}

// handleGetTask 处理 tasks/get。
func (h *Handler) handleGetTask(c *gin.Context, req *JSONRPCRequest) {
	var params GetTaskParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		h.respondError(c, req.ID, ErrCodeInvalidParams, "invalid params")
		return
	}

	task, err := h.svc.GetTask(params.ID)
	if err != nil {
		h.respondError(c, req.ID, ErrCodeTaskNotFound, err.Error())
		return
	}

	c.JSON(http.StatusOK, JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  task,
	})
}

// respondError 发送 JSON-RPC 错误响应。
func (h *Handler) respondError(c *gin.Context, id any, code int, msg string) {
	c.JSON(http.StatusOK, JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error: &JSONRPCError{
			Code:    code,
			Message: msg,
		},
	})
}
