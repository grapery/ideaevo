// Package billing 封装充值/会员/配额的业务概念定义：套餐、额度、限额。
// 它是纯定义层，不依赖 gorm，便于单测与跨服务复用。
package billing

import "time"

// Plan 描述一个可购买的订阅套餐。
//
// Duration 为单次购买赋予的会员有效期（手动续期，无自动续费）。
// Prices 按币种给出最小货币单位整数价格：
//   - CNY: 1990 = ¥19.90
//   - USD:  990 = $9.90
type Plan struct {
	ID          string
	Name        string
	Duration    time.Duration
	Prices      map[string]int // currency -> 最小单位价格
	DailyTokens int            // 每日 token 额度
	MaxAgents   int            // 可创建 Agent 上限
}

// 免费用户额度（不作为可购买套餐，仅用于额度计算）。
const (
	FreeDailyTokens = 10_000       // 1W / 天
	FreeMaxAgents   = 0            // 免费用户不能创建 Agent
	ProDailyTokens  = 10_000_000   // 1000W / 天
	ProMaxAgents    = 10           // 付费用户上限 10 个 Agent
)

// ProMonthly 月度订阅套餐：19.9 RMB / 9.9 USD，30 天有效。
var ProMonthly = Plan{
	ID:       "pro_monthly",
	Name:     "火卫二 Pro 月度会员",
	Duration: 30 * 24 * time.Hour,
	Prices: map[string]int{
		"CNY": 1990,
		"USD": 990,
	},
	DailyTokens: ProDailyTokens,
	MaxAgents:   ProMaxAgents,
}

// Plans 所有可购买套餐，按 PlanID 索引。
var Plans = map[string]Plan{
	ProMonthly.ID: ProMonthly,
}

// GetPlan 按 ID 查找套餐，找不到返回 ok=false。
func GetPlan(id string) (Plan, bool) {
	p, ok := Plans[id]
	return p, ok
}

// SupportedCurrencies 支持的币种。
var SupportedCurrencies = []string{"CNY", "USD"}

// IsSupportedCurrency 判断币种是否可购买。
func IsSupportedCurrency(c string) bool {
	for _, sc := range SupportedCurrencies {
		if sc == c {
			return true
		}
	}
	return false
}
