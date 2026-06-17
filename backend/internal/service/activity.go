package service

import (
	"encoding/json"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

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
