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

	// WeChat Open Platform
	WeChatAppID       string
	WeChatAppSecret   string
	WeChatRedirectURL string

	// Aliyun OSS user assets
	AliyunAssetsBucket    string
	AliyunAssetsRegion    string
	AliyunAssetsCDNDomain string

	// Aliyun SMS（运行时由 sms_aliyun.go 读 os.Getenv，含 grapery 同款变量与默认值）
	AliyunSMSSignName     string
	AliyunSMSTemplateCode string

	// Frontend
	FrontendURL string

	// LLM
	LLM LLMConfig

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

	// OSS Vector index / DashVector collection name
	VectorIndexIdeas string

	// Vector backend: dashvector | oss (auto-detect when empty)
	VectorBackend      string
	DashVectorEndpoint string
	DashVectorMetric   string
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

		WeChatAppID:       getEnv("WECHAT_APP_ID", ""),
		WeChatAppSecret:   getEnv("WECHAT_APP_SECRET", ""),
		WeChatRedirectURL: getEnv("WECHAT_REDIRECT_URL", ""),

		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:3000"),

		LLM:           ResolveLLMConfig(),
		SystemAgentID: getEnv("SYSTEM_AGENT_ID", ""),

		AliyunAccessKeyID:     resolveAliyunAccessKeyID(),
		AliyunAccessKeySecret: resolveAliyunAccessKeySecret(),
		AliyunVectorBucket:    getEnv("ALIYUN_VECTOR_BUCKET", ""),
		AliyunVectorRegion:    getEnv("ALIYUN_VECTOR_REGION", "cn-shanghai"),
		AliyunVectorAccountID: getEnv("ALIYUN_VECTOR_ACCOUNT_ID", ""),

		AliyunAssetsBucket:    getEnv("ALIYUN_ASSETS_BUCKET", ""),
		AliyunAssetsRegion:    getEnv("ALIYUN_ASSETS_REGION", "cn-shanghai"),
		AliyunAssetsCDNDomain: getEnv("ALIYUN_ASSETS_CDN_DOMAIN", ""),

		AliyunSMSSignName:     getEnv("ALIYUN_SMS_SIGN_NAME", ""),
		AliyunSMSTemplateCode: getEnv("ALIYUN_SMS_TEMPLATE_CODE", ""),

		DashScopeAPIKey:      getEnv("DASHSCOPE_API_KEY", ""),
		EmbeddingModel:       getEnv("EMBEDDING_MODEL", "text-embedding-v4"),
		EmbeddingDimensions:  getEnvInt("EMBEDDING_DIMENSIONS", 1536),

		VectorIndexIdeas: getEnv("VECTOR_INDEX_IDEAS", "ideas"),

		VectorBackend:      getEnv("VECTOR_BACKEND", ""),
		DashVectorEndpoint: getEnv("DASHVECTOR_ENDPOINT", ""),
		DashVectorMetric:   getEnv("DASHVECTOR_METRIC", "cosine"),
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

// LLMConfig holds resolved OpenAI-compatible LLM settings.
type LLMConfig struct {
	Provider string // openai | ark | dashscope | ""
	APIKey   string
	BaseURL  string
	Model    string
}

// DefaultArkTextModel is the fallback when no endpoint/model env is set (grapery-aligned).
const DefaultArkTextModel = "doubao-seed-2-0-lite-260215"

func (c LLMConfig) Enabled() bool {
	return c.APIKey != ""
}

// ResolveLLMConfig picks provider-specific defaults without mixing e.g. Ark endpoint + qwen-plus.
func ResolveLLMConfig() LLMConfig {
	if key := os.Getenv("LLM_API_KEY"); key != "" {
		return LLMConfig{
			Provider: "openai",
			APIKey:   key,
			BaseURL:  firstNonEmpty(os.Getenv("LLM_BASE_URL"), "https://api.openai.com/v1"),
			Model:    firstNonEmpty(os.Getenv("LLM_MODEL"), "gpt-4o"),
		}
	}

	if key := firstNonEmpty(
		os.Getenv("ARK_API_KEY"),
		os.Getenv("HUOSHAN_API_KEY"),
		os.Getenv("HUOSHAN_LLM_API_KEY"),
		os.Getenv("VOLCENGINE_ARK_API_KEY"),
	); key != "" {
		return LLMConfig{
			Provider: "ark",
			APIKey:   key,
			BaseURL: firstNonEmpty(
				os.Getenv("LLM_BASE_URL"),
				os.Getenv("ARK_BASE_URL"),
				os.Getenv("HUOSHAN_BASE_URL"),
				os.Getenv("HUOSHAN_LLM_BASE_URL"),
				"https://ark.cn-beijing.volces.com/api/v3",
			),
			Model: firstNonEmpty(
				os.Getenv("LLM_MODEL"),
				os.Getenv("ARK_MODEL"),
				os.Getenv("HUOSHAN_MODEL"),
				os.Getenv("HUOSHAN_LLM_MODEL"),
				os.Getenv("HUOSHAN_TEXT_MODEL"),
				DefaultArkTextModel,
			),
		}
	}

	if key := os.Getenv("DASHSCOPE_API_KEY"); key != "" {
		return LLMConfig{
			Provider: "dashscope",
			APIKey:   key,
			BaseURL: firstNonEmpty(
				os.Getenv("LLM_BASE_URL"),
				"https://dashscope.aliyuncs.com/compatible-mode/v1",
			),
			Model: firstNonEmpty(os.Getenv("LLM_MODEL"), "qwen-plus"),
		}
	}

	return LLMConfig{}
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

// resolveAliyunAccessKeyID 与 grapery / SMS 共用凭证链，避免 OSS 与 SMS 重复配置。
func resolveAliyunAccessKeyID() string {
	return firstNonEmpty(
		os.Getenv("ALIYUN_OSS_ACCESS_KEY_ID"),
		os.Getenv("ALIYUN_ACCESS_KEY_ID"),
		os.Getenv("ALIYUN_SMS_ACCESS_KEY_ID"),
		os.Getenv("ALIYUN_SMS_ACCESS_ID"),
	)
}

func resolveAliyunAccessKeySecret() string {
	return firstNonEmpty(
		os.Getenv("ALIYUN_OSS_ACCESS_KEY_SECRET"),
		os.Getenv("ALIYUN_ACCESS_KEY_SECRET"),
		os.Getenv("ALIYUN_SMS_ACCESS_KEY_SECRET"),
		os.Getenv("ALIYUN_SMS_ACCESS_SECRET"),
	)
}
