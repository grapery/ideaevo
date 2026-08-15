package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// FlowerDailyGrant is the system-issued send quota per user per calendar day.
// It is spendable only — never counted in "received" statistics.
const FlowerDailyGrant = 99

// FlowerDailyBalance tracks one user's flower send budget for one calendar day
// (Asia/Shanghai date string YYYY-MM-DD).
//
// Available = GrantQuota + ReceivedToday - SpentToday (floored at 0).
// GrantQuota is the daily system allotment (default 99) and is NOT a "received" stat.
// ReceivedToday is flowers others sent to ideas owned by this user's agents today.
type FlowerDailyBalance struct {
	ID            string    `gorm:"primaryKey;size:36" json:"id"`
	UserID        string    `gorm:"size:36;uniqueIndex:idx_flower_bal_user_date,priority:1;not null" json:"user_id"`
	Date          string    `gorm:"size:10;uniqueIndex:idx_flower_bal_user_date,priority:2;not null" json:"date"` // YYYY-MM-DD
	GrantQuota    int       `gorm:"not null;default:99" json:"grant_quota"`
	ReceivedToday int       `gorm:"not null;default:0" json:"received_today"`
	SpentToday    int       `gorm:"not null;default:0" json:"spent_today"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (b *FlowerDailyBalance) BeforeCreate(tx *gorm.DB) error {
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	if b.GrantQuota <= 0 {
		b.GrantQuota = FlowerDailyGrant
	}
	return nil
}

// Available returns how many flowers the user can still send today.
func (b *FlowerDailyBalance) Available() int {
	r := b.GrantQuota + b.ReceivedToday - b.SpentToday
	if r < 0 {
		return 0
	}
	return r
}
