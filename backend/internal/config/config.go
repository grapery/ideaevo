package config

import (
	"fmt"
	"os"
	"time"
)

type Config struct {
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
	JWTSecret  string
	JWTExpiry  time.Duration
	Port       string
	MCPTransport string

	// SMTP
	SMTPHost     string
	SMTPPort     int
	SMTPUser     string
	SMTPPassword string
	SMTPFrom     string

	// Google OAuth
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string

	// Frontend
	FrontendURL string

	// LLM
	LLMAPIKey     string
	LLMBaseURL    string
	LLMModel      string
	SystemAgentID string

	// Aliyun OSS Vector Bucket
	// 认证与 grapery 一致（AccessKey 直连），仅 bucket name 和 region 不同
	AliyunAccessKeyID     string
	AliyunAccessKeySecret string
	AliyunVectorBucket    string
	AliyunVectorRegion    string
	AliyunVectorAccountID string // 阿里云主账号 ID（向量 SDK 签名需要）

	// DashScope (通义/百炼) Embedding —— OpenAI 兼容接口
	DashScopeAPIKey      string
	EmbeddingModel       string
	EmbeddingDimensions  int

	// OSS Vector index name (per datatype: ideas / agents)
	VectorIndexIdeas string
}

func Load() *Config {
	return &Config{
		DBHost:       getEnv("DB_HOST", "localhost"),
		DBPort:       getEnv("DB_PORT", "3306"),
		DBUser:       getEnv("DB_USER", "wanye"),
		DBPassword:   getEnv("DB_PASSWORD", "wanye"),
		DBName:       getEnv("DB_NAME", "wanye"),
		DBSSLMode:    getEnv("DB_SSLMODE", "disable"),
		JWTSecret:    getEnv("JWT_SECRET", "change-me-in-production"),
		JWTExpiry:    getEnvDuration("JWT_EXPIRY", 24*time.Hour),
		Port:         getEnv("PORT", "8080"),
		MCPTransport: getEnv("MCP_TRANSPORT", "stdio"),

		SMTPHost:     getEnv("SMTP_HOST", ""),
		SMTPPort:     getEnvInt("SMTP_PORT", 587),
		SMTPUser:     getEnv("SMTP_USER", ""),
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:     getEnv("SMTP_FROM", ""),

		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURL:  getEnv("GOOGLE_REDIRECT_URL", ""),

		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:3000"),

		LLMAPIKey:     getEnv("LLM_API_KEY", ""),
		LLMBaseURL:    getEnv("LLM_BASE_URL", "https://api.openai.com/v1"),
		LLMModel:      getEnv("LLM_MODEL", "gpt-4o"),
		SystemAgentID: getEnv("SYSTEM_AGENT_ID", ""),

		AliyunAccessKeyID:     getEnv("ALIYUN_OSS_ACCESS_KEY_ID", getEnv("ALIYUN_ACCESS_KEY_ID", "")),
		AliyunAccessKeySecret: getEnv("ALIYUN_OSS_ACCESS_KEY_SECRET", getEnv("ALIYUN_ACCESS_KEY_SECRET", "")),
		AliyunVectorBucket:    getEnv("ALIYUN_VECTOR_BUCKET", ""),
		AliyunVectorRegion:    getEnv("ALIYUN_VECTOR_REGION", "cn-shanghai"),
		AliyunVectorAccountID: getEnv("ALIYUN_VECTOR_ACCOUNT_ID", ""),

		DashScopeAPIKey:      getEnv("DASHSCOPE_API_KEY", ""),
		EmbeddingModel:       getEnv("EMBEDDING_MODEL", "text-embedding-v3"),
		EmbeddingDimensions:  getEnvInt("EMBEDDING_DIMENSIONS", 1024),

		VectorIndexIdeas: getEnv("VECTOR_INDEX_IDEAS", "ideas"),
	}
}

func (c *Config) DSN() string {
	// MySQL DSN: https://github.com/go-sql-driver/mysql#dsn-data-source-name
	//   charset / parseTime=true 让 DATETIME 自动映射到 time.Time
	//   loc=Local 让时间用本地时区
	return c.DBUser + ":" + c.DBPassword +
		"@tcp(" + c.DBHost + ":" + c.DBPort + ")/" + c.DBName +
		"?charset=utf8mb4&parseTime=True&loc=Local&multiStatements=True"
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		n := 0
		if _, err := fmt.Sscanf(v, "%d", &n); err == nil {
			return n
		}
	}
	return fallback
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}
