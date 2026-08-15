package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"gorm.io/gorm"
)

// 退款相关错误
var (
	ErrRefundNotFound      = errors.New("refund not found")
	ErrOrderNotRefundable  = errors.New("order is not refundable")
	ErrRefundAlreadyExists = errors.New("a pending refund request already exists for this order")
	ErrRefundAlreadyClosed = errors.New("refund request already approved or rejected")
)

// RefundService 管理退款申请的审批流程。
//
// 流程：用户对已支付订单提交退款申请（pending）→ 管理员审批：
//   - approved：反向扣减该订单赋予的会员续期，订单置 refunded，退款记录置 approved；
//   - rejected：会员状态不变，退款记录置 rejected。
type RefundService struct {
	db     *gorm.DB
	subSvc *SubscriptionService
}

func NewRefundService(db *gorm.DB, subSvc *SubscriptionService) *RefundService {
	return &RefundService{db: db, subSvc: subSvc}
}

// RequestRefund 用户对已支付订单提交退款申请。
// 校验：订单属于该用户、已支付、未曾退款、无 pending 申请。
func (s *RefundService) RequestRefund(userID, orderID, reason string) (*model.Refund, error) {
	var order model.Order
	if err := s.db.First(&order, "id = ? AND user_id = ?", orderID, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOrderNotFound
		}
		return nil, err
	}

	// 仅已支付订单可退款
	if order.Status != model.OrderPaid {
		return nil, ErrOrderNotRefundable
	}

	// 防重复：该订单已有 pending 申请，或已退款完成
	var existing model.Refund
	err := s.db.Where("order_id = ?", orderID).First(&existing).Error
	if err == nil {
		if existing.Status == model.RefundPending {
			return nil, ErrRefundAlreadyExists
		}
		// approved/rejected：已审批过的订单不允许再次申请
		return nil, ErrRefundAlreadyClosed
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	refund := &model.Refund{
		OrderID:  orderID,
		UserID:   userID,
		Amount:   order.Amount,
		Currency: order.Currency,
		Reason:   reason,
		Status:   model.RefundPending,
	}
	if err := s.db.Create(refund).Error; err != nil {
		return nil, fmt.Errorf("create refund: %w", err)
	}
	return refund, nil
}

// ListUserRefunds 列出用户的退款申请。
func (s *RefundService) ListUserRefunds(userID string, limit, offset int) ([]model.Refund, int64, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	var refunds []model.Refund
	var total int64
	s.db.Model(&model.Refund{}).Where("user_id = ?", userID).Count(&total)
	if err := s.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&refunds).Error; err != nil {
		return nil, 0, err
	}
	return refunds, total, nil
}

// ListPendingRefunds 列出待审批的退款申请（管理员后台用）。
func (s *RefundService) ListPendingRefunds(limit, offset int) ([]model.Refund, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var refunds []model.Refund
	var total int64
	s.db.Model(&model.Refund{}).Where("status = ?", model.RefundPending).Count(&total)
	if err := s.db.Where("status = ?", model.RefundPending).
		Order("created_at ASC").
		Limit(limit).Offset(offset).
		Find(&refunds).Error; err != nil {
		return nil, 0, err
	}
	return refunds, total, nil
}

// Approve 管理员批准退款。
// 事务内：撤销会员续期 + 订单置 refunded + 退款记录置 approved。
func (s *RefundService) Approve(refundID, adminID, note string) error {
	return s.review(refundID, adminID, note, true)
}

// Reject 管理员拒绝退款。会员状态不变。
func (s *RefundService) Reject(refundID, adminID, note string) error {
	return s.review(refundID, adminID, note, false)
}

func (s *RefundService) review(refundID, adminID, note string, approve bool) error {
	var refund model.Refund
	if err := s.db.First(&refund, "id = ?", refundID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrRefundNotFound
		}
		return err
	}
	if refund.Status != model.RefundPending {
		return ErrRefundAlreadyClosed
	}

	now := time.Now()
	newStatus := model.RefundRejected
	if approve {
		newStatus = model.RefundApproved
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		// 更新退款记录
		if err := tx.Model(&refund).Updates(map[string]any{
			"status":      newStatus,
			"admin_note":  note,
			"reviewed_by": adminID,
			"reviewed_at": &now,
		}).Error; err != nil {
			return err
		}

		if approve {
			// 批准：撤销会员续期 + 订单置 refunded
			var order model.Order
			if err := tx.First(&order, "id = ?", refund.OrderID).Error; err != nil {
				return fmt.Errorf("load order for revoke: %w", err)
			}
			if err := tx.Model(&order).Update("status", model.OrderRefunded).Error; err != nil {
				return fmt.Errorf("mark order refunded: %w", err)
			}
			if err := s.subSvc.revokeOrderWithTx(tx, &order); err != nil {
				return fmt.Errorf("revoke subscription: %w", err)
			}
		}
		return nil
	})
}
