package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/wanye/ideaevo/internal/model"
	"github.com/wanye/ideaevo/internal/service"
)

// AgentBridgeHandler 暴露 agent-bridge REST 端点：
//
//	GET  /api/agent-bridge/tools          — 列出当前 agent 可用工具
//	POST /api/agent-bridge/execute         — 执行单个工具调用
//	POST /api/agent-bridge/execute-batch   — 批量执行（LLM tool_calls）
//
// 所有端点通过 api_key 头部认证（与 MCP 一致），由 AgentAuth 中间件完成。
type AgentBridgeHandler struct {
	bridgeSvc *service.AgentBridgeService
}

func NewAgentBridgeHandler(bridgeSvc *service.AgentBridgeService) *AgentBridgeHandler {
	return &AgentBridgeHandler{bridgeSvc: bridgeSvc}
}

// RegisterRoutes 注册路由。
//   - 若 r 上已经有 AgentAuth 中间件，authMiddleware 传 nil 即可
//   - 若 r 是裸 router，则需要传入 AgentAuth 中间件
func (h *AgentBridgeHandler) RegisterRoutes(r gin.IRouter, authMiddleware gin.HandlerFunc) {
	g := r.Group("/agent-bridge")
	if authMiddleware != nil {
		g.Use(authMiddleware)
	}
	{
		g.GET("/tools", h.ListTools)
		g.POST("/execute", h.Execute)
		g.POST("/execute-batch", h.ExecuteBatch)
	}
}

// ListTools 返回 OpenAI tools 数组格式，外部 agent 可直接喂给它自己的 LLM。
func (h *AgentBridgeHandler) ListTools(c *gin.Context) {
	agent := c.MustGet("agent").(*model.Agent)
	tools, err := h.bridgeSvc.ListTools(agent)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"tools": tools})
}

// executeRequest 是单次工具调用的请求体。
type executeRequest struct {
	// Tool 是工具名（snake_case）
	Tool string `json:"tool" binding:"required"`
	// Args 是工具参数（任意 JSON object）
	Args json.RawMessage `json:"args"`
}

func (h *AgentBridgeHandler) Execute(c *gin.Context) {
	agent := c.MustGet("agent").(*model.Agent)

	var req executeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	result, err := h.bridgeSvc.ExecuteTool(ctx, agent, req.Tool, req.Args)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// executeBatchRequest 让外部 agent 一次性把 LLM 返回的所有 tool_calls 转发过来。
type executeBatchRequest struct {
	Calls []service.ToolCall `json:"calls" binding:"required"`
}

func (h *AgentBridgeHandler) ExecuteBatch(c *gin.Context) {
	agent := c.MustGet("agent").(*model.Agent)

	var req executeBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	results, err := h.bridgeSvc.ExecuteBatch(ctx, agent, req.Calls)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"results": results})
}
