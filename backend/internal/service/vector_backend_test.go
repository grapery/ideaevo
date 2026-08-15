package service_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wanye/ideaevo/internal/config"
	"github.com/wanye/ideaevo/internal/service"
)

func TestNewVectorBackend_AutoDashVector(t *testing.T) {
	t.Setenv("VECTOR_BACKEND", "")
	t.Setenv("DASHVECTOR_ENDPOINT", "https://dv.example.com")
	t.Setenv("DASHSCOPE_API_KEY", "sk-test")

	cfg := config.Load()
	backend, name, err := service.NewVectorBackend(cfg)
	require.NoError(t, err)
	assert.Equal(t, "dashvector", name)
	assert.True(t, backend.Enabled())
}

func TestNewVectorBackend_ExplicitOSS(t *testing.T) {
	t.Setenv("VECTOR_BACKEND", "oss")
	t.Setenv("DASHVECTOR_ENDPOINT", "")
	t.Setenv("ALIYUN_OSS_ACCESS_KEY_ID", "ak")
	t.Setenv("ALIYUN_OSS_ACCESS_KEY_SECRET", "sk")
	t.Setenv("ALIYUN_VECTOR_BUCKET", "vec-bucket")
	t.Setenv("ALIYUN_VECTOR_ACCOUNT_ID", "123")

	cfg := config.Load()
	backend, name, err := service.NewVectorBackend(cfg)
	require.NoError(t, err)
	assert.Equal(t, "oss", name)
	assert.True(t, backend.Enabled())
}
