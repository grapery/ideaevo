package database

import (
	"log"

	"github.com/wanye/ideaevo/internal/config"
	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Connect 打开 MySQL 连接并执行 AutoMigrate。
//
// 切换历史：原本用 PostgreSQL（依赖 pg_trgm 做相似度检索 + jsonb 存标签），
// 现改用 MySQL：相似度检索统一走 OSS 向量 Bucket（在 main.go 中注入），
// 失败时降级到 MySQL LIKE（见 service/similarity.go）。
func Connect(cfg *config.Config) *gorm.DB {
	db, err := gorm.Open(mysql.Open(cfg.DSN()), &gorm.Config{
		// MySQL 默认不区分表名字段名大小写（Linux 部署坑），
		// GORM 自动转 snake_case + lowercase，与 latin1/utf8mb4 兼容
		NamingStrategy: nil,
		Logger:         logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	if err := db.AutoMigrate(
		&model.Agent{},
		&model.User{},
		&model.Idea{},
		&model.IdeaVersion{},
		&model.IdeaMetricEvent{},
		&model.IdeaBookmark{},
		&model.Fork{},
		&model.Like{},
		&model.Wish{},
		&model.Flower{},
		&model.Reaction{},
		&model.WanyeComment{},
		&model.ActivityLog{},
		&model.ChatSession{},
		&model.ChatMessage{},
		&model.MessageFeedback{},
		&model.Follow{},
		&model.AgentFollow{},
		&model.AgentPeerFollow{},
		&model.Notification{},
		&model.NotificationPreferences{},
		&model.UserDevice{},
		&model.PhoneVerification{},
		&model.A2ATask{},
		&model.UserBlock{},
		&model.ContentReport{},
	); err != nil {
		log.Fatalf("failed to migrate: %v", err)
	}

	// 复合索引：消息分页查询用（session_id + created_at DESC）
	// MySQL 不支持 CREATE INDEX IF NOT EXISTS，所以先查 information_schema
	var idxExists int64
	db.Raw(`SELECT COUNT(1) FROM information_schema.statistics
		WHERE table_schema = DATABASE() AND table_name = 'chat_messages'
		AND index_name = 'idx_chat_messages_session_created'`).Scan(&idxExists)
	if idxExists == 0 {
		db.Exec("CREATE INDEX idx_chat_messages_session_created ON chat_messages(session_id, created_at DESC)")
	}

	// MySQL reserved word: rename notifications.read -> is_read
	var readColExists int64
	db.Raw(`SELECT COUNT(1) FROM information_schema.columns
		WHERE table_schema = DATABASE() AND table_name = 'notifications' AND column_name = 'read'`).Scan(&readColExists)
	var isReadColExists int64
	db.Raw(`SELECT COUNT(1) FROM information_schema.columns
		WHERE table_schema = DATABASE() AND table_name = 'notifications' AND column_name = 'is_read'`).Scan(&isReadColExists)
	if readColExists > 0 && isReadColExists == 0 {
		db.Exec("ALTER TABLE notifications CHANGE COLUMN `read` is_read TINYINT(1) NOT NULL DEFAULT 0")
	}

	// Unset phone must be NULL so unique index allows multiple users without a phone.
	db.Exec("UPDATE users SET phone = NULL WHERE phone = ''")

	// 历史 seed 用 "publish_idea" 记录创建想法的动态，但 feed 白名单是
	// register/fork/share，导致动态页为空。统一为 "register"。
	db.Exec("UPDATE activity_logs SET action = 'register' WHERE action = 'publish_idea'")

	// Fork uniqueness is version-scoped: an Agent may branch from different
	// versions of the same Idea, while duplicate branches from one version remain blocked.
	var legacyForkIndex int64
	db.Raw(`SELECT COUNT(1) FROM information_schema.statistics
		WHERE table_schema = DATABASE() AND table_name = 'forks'
		AND index_name = 'idx_fork_source_agent'`).Scan(&legacyForkIndex)
	if legacyForkIndex > 0 {
		db.Exec("ALTER TABLE forks DROP INDEX idx_fork_source_agent")
	}

	// Legacy versions only stored title/description. The current Idea projection
	// can safely hydrate the latest snapshot; older snapshots remain untouched
	// because their historical metadata cannot be reconstructed reliably.
	db.Exec(`UPDATE idea_versions iv
		JOIN (SELECT idea_id, MAX(version) AS max_version FROM idea_versions GROUP BY idea_id) latest
			ON latest.idea_id = iv.idea_id AND latest.max_version = iv.version
		JOIN ideas i ON i.id = iv.idea_id
		SET iv.category = i.category,
			iv.tags = i.tags,
			iv.repo_url = i.repo_url,
			iv.demo_url = i.demo_url,
			iv.impl_status = i.impl_status
		WHERE iv.category IS NULL OR iv.category = ''`)

	return db
}
