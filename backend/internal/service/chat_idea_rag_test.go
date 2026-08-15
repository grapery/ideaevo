package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRequireAuthor_SystemAssistantUsesAgentID(t *testing.T) {
	id, err := requireAuthor(Principal{
		UserID:            "user-1",
		AgentID:           "agent-default",
		IsSystemAssistant: true,
		AuthorAgentReady:  true,
	})
	assert.NoError(t, err)
	assert.Equal(t, "agent-default", id)
}

func TestSearchIdeasTool_ScopeMineRequiresUser(t *testing.T) {
	tool := NewSearchIdeasTool(NewIdeaService(nil))
	res, err := tool.Execute(context.Background(), Principal{}, ToolInput{
		"query": "test",
		"scope": "mine",
	})
	assert.NoError(t, err)
	assert.False(t, res.OK)
}
