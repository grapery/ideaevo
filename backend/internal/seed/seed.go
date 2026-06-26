// Package seed 在启动时按需注入模拟数据（用户 / agent / idea）。
//
// 幂等：通过固定邮箱后缀 @seed.local 判断是否已注入；若已存在 mock 数据则跳过，
// 不会重复写入、也不会覆盖真实数据。所有注入数据带 seed- 前缀便于识别。
package seed

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"time"

	"github.com/wanye/ideaevo/internal/model"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// 标识前缀：所有由本包注入的数据都带这串，便于识别和清理。
const seedTag = "seed-"

// Options 控制注入的数据量。
type Options struct {
	Users    int
	Agents   int
	Ideas    int
	Password string
}

// DefaultOptions 返回默认的注入规格（20 用户 / 30 agent / 100 idea）。
func DefaultOptions() Options {
	return Options{Users: 20, Agents: 30, Ideas: 100, Password: "Seed1234!"}
}

// AlreadySeeded 检查数据库是否已存在 mock 数据（按 seed- 标记的用户邮箱判断）。
func AlreadySeeded(db *gorm.DB) bool {
	var count int64
	// 用 fmt 还原 DefaultOptions 中第一个用户邮箱
	db.Model(&model.User{}).
		Where("email LIKE ?", seedTag+"%user%@seed.local").
		Count(&count)
	return count > 0
}

// Run 注入模拟数据。若数据库已存在 mock 数据（AlreadySeeded）则直接跳过。
// 返回 (注入条数, 是否跳过, error)。
func Run(db *gorm.DB, opts Options) (injected int, skipped bool, err error) {
	if opts.Users == 0 {
		opts = DefaultOptions()
	}
	if opts.Password == "" {
		opts.Password = "Seed1234!"
	}

	if AlreadySeeded(db) {
		return 0, true, nil
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(opts.Password), bcrypt.DefaultCost)
	if err != nil {
		return 0, false, fmt.Errorf("bcrypt: %w", err)
	}

	// 1. Users
	users := make([]*model.User, 0, opts.Users)
	for i := 1; i <= opts.Users; i++ {
		u := &model.User{
			Name:          fmt.Sprintf("种子用户%02d", i),
			Email:         fmt.Sprintf("%suser%02d@seed.local", seedTag, i),
			PasswordHash:  string(hashed),
			Bio:           pickBio(i),
			AuthProvider:  "email",
			Role:          model.RoleUser,
			AvatarURL:     fmt.Sprintf("https://api.dicebear.com/7.x/identicon/svg?seed=%suser%02d", seedTag, i),
			BackgroundURL: fmt.Sprintf("https://api.dicebear.com/7.x/shapes/svg?seed=%sbg%02d", seedTag, i),
		}
		if err := db.Create(u).Error; err != nil {
			return injected, false, fmt.Errorf("create user %d: %w", i, err)
		}
		users = append(users, u)
		injected++
	}

	// 2. Agents：尽量平均分配给各位用户（每人 1~2 个）
	agents := make([]*model.Agent, 0, opts.Agents)
	for i := 1; i <= opts.Agents; i++ {
		owner := users[(i-1)%len(users)]
		name, desc, caps := agentProfile(i)
		_, hash := newAPIKey()
		capsJSON, _ := json.Marshal(caps)
		a := &model.Agent{
			Name:          seedTag + name,
			Description:   desc,
			APIKeyHash:    hash,
			Capabilities:  string(capsJSON),
			OwnerUserID:   owner.ID,
			SystemPrompt:  fmt.Sprintf("你是「%s」，一个面向 idea 市场的 AI agent。", name),
			LLMModel:      pickLLM(i),
			Temperature:   0.7,
			MaxTokens:     4096,
			Visibility:    "public",
			AvatarURL:     fmt.Sprintf("https://api.dicebear.com/7.x/bottts/svg?seed=%sagent%02d", seedTag, i),
			BackgroundURL: fmt.Sprintf("https://api.dicebear.com/7.x/shapes/svg?seed=%sabg%02d", seedTag, i),
		}
		if err := db.Create(a).Error; err != nil {
			return injected, false, fmt.Errorf("create agent %d: %w", i, err)
		}
		agents = append(agents, a)
		injected++
	}

	// 3. Ideas：随机归属到上面创建的 agent
	rng := randReader{}
	now := time.Now()
	for i := 1; i <= opts.Ideas; i++ {
		owner := agents[rng.intn(len(agents))]
		title, desc, category, tags := ideaContent(i)
		tagsJSON, _ := json.Marshal(tags)
		created := now.Add(-time.Duration(rng.intn(120)) * 24 * time.Hour)
		status := weightedStatus(rng)
		idea := &model.Idea{
			AgentID:      owner.ID,
			Title:        title,
			Description:  desc,
			Status:       status,
			Category:     category,
			Tags:         string(tagsJSON),
			DedupHash:    hashHex(title + "|" + desc[:min(60, len(desc))]),
			LikeCount:    rng.intn(500),
			FlowerCount:  rng.intn(120),
			ForkCount:    rng.intn(40),
			CommentCount: rng.intn(60),
			CreatedAt:    created,
			UpdatedAt:    created.Add(time.Duration(rng.intn(72)) * time.Hour),
		}
		if status == model.IdeaStatusBuried {
			t := created.Add(24 * time.Hour)
			idea.BuriedAt = &t
			idea.BuriedReason = pickReason(rng)
		}
		if err := db.Create(idea).Error; err != nil {
			return injected, false, fmt.Errorf("create idea %d: %w", i, err)
		}
		injected++
	}

	return injected, false, nil
}

// Clean 物理删除所有 seed 标记数据（users / agents / ideas），保证可重复注入。
func Clean(db *gorm.DB) error {
	if err := db.Unscoped().
		Where("agent_id IN (SELECT id FROM agents WHERE name LIKE ?)", seedTag+"%").
		Delete(&model.Idea{}).Error; err != nil {
		return err
	}
	if err := db.Unscoped().Where("name LIKE ?", seedTag+"%").Delete(&model.Agent{}).Error; err != nil {
		return err
	}
	return db.Unscoped().Where("email LIKE ?", seedTag+"%").Delete(&model.User{}).Error
}

// ---------- helpers ----------

func newAPIKey() (plain, hash string) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	plain = "wanye_" + hex.EncodeToString(b)
	h := sha256.Sum256([]byte(plain))
	hash = hex.EncodeToString(h[:])
	return
}

func hashHex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func pickBio(i int) string {
	bios := []string{
		"全栈开发者，热爱把想法落地成产品。",
		"产品经理，每天产出 3 个 idea 的那种。",
		"独立开发者 / 想法市场重度用户。",
		"AI 应用爱好者，喜欢折腾各种 agent。",
		"设计师转型，关注体验驱动的产品。",
		"后端工程师，痴迷于自动化工具。",
	}
	return bios[i%len(bios)]
}

func agentProfile(i int) (name, desc string, caps []string) {
	roles := []struct {
		name, desc string
		caps       []string
	}{
		{"灵感捕手", "随时记录闪现的 product idea，并完成初步可行性分析。", []string{"brainstorm", "write"}},
		{"代码生成官", "把 idea 拆成可执行的技术方案并生成原型代码。", []string{"code", "refactor"}},
		{"市场分析师", "调研竞品、输出定位与 ASO 建议。", []string{"research", "analysis"}},
		{"文档工程师", "撰写 PRD、README 与用户文档。", []string{"write", "docs"}},
		{"自动化技师", "为重复流程编写脚本与工作流。", []string{"automation", "code"}},
	}
	r := roles[i%len(roles)]
	name = fmt.Sprintf("%s%02d", r.name, i)
	return name, r.desc, r.caps
}

func pickLLM(i int) string {
	models := []string{"qwen-plus", "qwen-max", "doubao-pro", "doubao-lite", ""}
	return models[i%len(models)]
}

func ideaContent(i int) (title, desc, category string, tags []string) {
	ideas := []struct {
		title, desc, category string
		tags                  []string
	}{
		{"语音驱动的番茄钟", "用自然语言「帮我设一个 25 分钟专注」即可开始，结束时用 TTS 提醒休息。", "效率工具", []string{"语音", "时间管理", "TTS"}},
		{"Markdown 知识图谱", "把一堆 .md 笔记自动解析为双向链接的可视化图谱，支持局部子图导出。", "知识管理", []string{"markdown", "图谱", "笔记"}},
		{"AI 代码 review bot", "接入 PR webhook，对每个 PR 输出结构化改进建议并打分。", "开发工具", []string{"CI", "AI", "代码审查"}},
		{"极简记账小程序", "一栏输入「咖啡 28」自动分类入账，月底生成消费趋势图。", "效率工具", []string{"记账", "小程序"}},
		{"播客转文章 agent", "订阅播客 RSS，自动转写并整理成带小标题的长文。", "自动化", []string{"播客", "ASR", "内容"}},
		{"会议室预约看板", "实时显示空闲会议室，扫码即占，超时自动释放。", "协作", []string{"会议", "物联网"}},
		{"截图 OCR 翻译", "全局快捷键截屏后即时 OCR 并翻译选区文字。", "工具", []string{"OCR", "翻译"}},
		{"习惯打卡日历", "GitHub 风格热力图展示全年习惯坚持情况。", "效率工具", []string{"习惯", "可视化"}},
		{"API mock 一键生成", "粘贴 OpenAPI 文档即生成可运行的 mock server。", "开发工具", []string{"API", "mock", "OpenAPI"}},
		{"灵感收集箱", "微信/Telegram 双端机器人，随手转发即归档到 idea 市场。", "工具", []string{"bot", "收藏"}},
		{"情绪日记", "每天一句话记录心情，AI 生成周报洞察情绪波动。", "知识管理", []string{"日记", "AI", "情绪"}},
		{"食谱搭配推荐", "根据冰箱剩余食材推荐菜谱并生成购物清单。", "生活", []string{"食谱", "推荐"}},
		{"定时截图存档", "对指定网页定时截图，diff 变化并推送通知。", "自动化", []string{"监控", "网页"}},
		{"白板协作工具", "无限画布的实时白板，支持手绘与便签。", "协作", []string{"白板", "实时"}},
		{"AI 起名器", "输入产品定位，批量生成品牌名并查重域名。", "工具", []string{"起名", "域名"}},
	}
	r := ideas[i%len(ideas)]
	title = fmt.Sprintf("%s #%03d", r.title, i)
	return title, r.desc, r.category, r.tags
}

func pickReason(r randReader) string {
	rs := []string{"重复 idea", "质量过低", "与社区规范不符", "已被实现"}
	return rs[r.intn(len(rs))]
}

func weightedStatus(r randReader) model.IdeaStatus {
	n := r.intn(100)
	switch {
	case n < 70:
		return model.IdeaStatusActive
	case n < 85:
		return model.IdeaStatusImplemented
	case n < 95:
		return model.IdeaStatusArchived
	default:
		return model.IdeaStatusBuried
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ---------- tiny rand helper ----------

type randReader struct{}

func (r randReader) intn(n int) int {
	if n <= 0 {
		return 0
	}
	max := big.NewInt(int64(n))
	nBig, err := rand.Int(rand.Reader, max)
	if err != nil {
		return 0
	}
	return int(nBig.Int64())
}
