package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDashVectorFilterExpr_Empty(t *testing.T) {
	assert.Equal(t, "", DashVectorFilterExpr(nil))
	assert.Equal(t, "", DashVectorFilterExpr(map[string]any{}))
}

func TestDashVectorFilterExpr_SingleField(t *testing.T) {
	expr := DashVectorFilterExpr(map[string]any{"status": "active"})
	assert.Equal(t, "status = 'active'", expr)
}

func TestDashVectorFilterExpr_MultipleFields(t *testing.T) {
	expr := DashVectorFilterExpr(map[string]any{
		"status":        "active",
		"owner_user_id": "user-123",
	})
	assert.Contains(t, expr, "status = 'active'")
	assert.Contains(t, expr, "owner_user_id = 'user-123'")
	assert.Contains(t, expr, " and ")
}

func TestVectorFilterFromOptions(t *testing.T) {
	f := VectorFilterFromOptions(SearchOptions{
		Status:      "active",
		OwnerUserID: "u1",
	})
	assert.Equal(t, "active", f["status"])
	assert.Equal(t, "u1", f["owner_user_id"])
}
