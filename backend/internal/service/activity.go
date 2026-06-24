package service

import (
	"encoding/json"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// 活动动作动词的单一来源。feed 流（全局 / 关注）只展示以下白名单动作，
// 避免点赞/送花/发消息等高频噪声淹没真正的创作类事件（GitHub 式 feed）。
const (
	ActionRegister = "register" // 创建想法（create idea）
	ActionFork     = "fork"     // fork 想法
	ActionShare    = "share"    // 分享想法（轻量转推，不复制 idea）
)

// FeedActions 是 feed 流允许出现的动作白名单。
var FeedActions = []string{ActionRegister, ActionFork, ActionShare}

func logActivity(db *gorm.DB, actorType, actorID, action, targetType, targetID string, meta map[string]string) {
	metadata, _ := json.Marshal(meta)
	db.Create(&model.ActivityLog{
		ActorType:  actorType,
		ActorID:    actorID,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Metadata:   string(metadata),
	})
}
