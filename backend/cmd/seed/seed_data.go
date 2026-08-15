package main

// seed_data.go —— mock 数据定义：人物、Agent、Idea、评论等。
// 命名与文案刻意接近真实用户，用于本地/演示环境的模拟。

import "time"

// seedUser 一个待创建的模拟用户。
type seedUser struct {
	Key      string // 程序内引用 key
	Name     string
	Email    string
	Password string
	Bio      string
	Plan     string // free | pro
	Role     string // user | admin
}

// seedAgent 一个公开的 AI Agent（由某个用户创建）。
type seedAgent struct {
	Key          string // 程序内引用 key（供 idea.Agent 引用）
	Owner        string // 创建者（用户 key）
	Name         string
	Description  string
	Capabilities []string
	LLMModel     string
	Category     string
}

// seedIdea 一条想法。
type seedIdea struct {
	Owner     string // 发布者（用户 key）
	Agent     string // 发布 Agent key；空 = 发布者的个人 Agent
	Title     string
	Desc      string
	Category  string
	Tags      []string
	Status    string // active | implemented | archived | buried
	Impl      string // concept | in_progress | implemented | paused
	RepoURL   string
	DemoURL   string
	BuryReasn string
	DaysAgo   float64
}

// seedComment 一条评论（含可选回复）。
type seedComment struct {
	Idea      int // ideas 下标
	User      string
	Content   string
	Kind      string // general | evidence | risk
	Sentiment string // positive | neutral | constructive
	DaysAgo   float64
	Replies   []seedReply
}

type seedReply struct {
	User    string
	Content string
	DaysAgo float64
}

// seedSuggestion 一条建议（可被采纳）。
type seedSuggestion struct {
	Idea     int
	User     string // 用户 key 或 "agent:xxx"
	Content  string
	DaysAgo  float64
	Selected bool
	Voters   []string // 给这条建议投票的用户 key
}

func daysAgo(n float64) time.Time {
	return time.Now().Add(-time.Duration(n * float64(24*time.Hour)))
}

// ---- 用户（13 个，含 1 个管理员）----

var seedUsers = []seedUser{
	{Key: "chen", Name: "陈铭轩", Email: "chen.mingxuan@deimos.dev", Password: "Mingxuan#2026", Bio: "后端工程师，关注分布式系统与开发者工具。坚信好工具应该自己会说话。", Plan: "pro"},
	{Key: "lin", Name: "林语桐", Email: "lin.yutong@deimos.dev", Password: "Yutong#2026", Bio: "SaaS 产品经理。喜欢小而美的产品，正在寻找下一个值得做的 side project。", Plan: "free"},
	{Key: "zhao", Name: "赵一鸣", Email: "zhao.yiming@deimos.dev", Password: "Yiming#2026", Bio: "独立开发者，全栈。周末造轮子，工作日修轮子。", Plan: "pro"},
	{Key: "wang", Name: "王思远", Email: "wang.siyuan@deimos.dev", Password: "Siyuan#2026", Bio: "数据分析师，Python 重度用户。对数据可视化有执念。", Plan: "free"},
	{Key: "su", Name: "苏晴", Email: "su.qing@deimos.dev", Password: "Suqing#2026", Bio: "UI/UX 设计师，维护一个小型设计系统。无法容忍 4px 的对齐偏差。", Plan: "pro"},
	{Key: "he", Name: "何家豪", Email: "he.jiahao@deimos.dev", Password: "Jiahao#2026", Bio: "DevOps 工程师。K8s、CI/CD、可观测性，哪里有告警哪里有我。", Plan: "free"},
	{Key: "zhou", Name: "周子墨", Email: "zhou.zimo@deimos.dev", Password: "Zimo#2026", Bio: "计算机大三学生，前端方向。边学边做，欢迎拍砖。", Plan: "free"},
	{Key: "zheng", Name: "郑晓岚", Email: "zheng.xiaolan@deimos.dev", Password: "Xiaolan#2026", Bio: "技术写作者。写教程也写工具，相信文档也是产品的一部分。", Plan: "free"},
	{Key: "gao", Name: "高远", Email: "gao.yuan@deimos.dev", Password: "Gaoyuan#2026", Bio: "连续创业者，正在做 AI 效率工具。想法很多，时间很少。", Plan: "pro"},
	{Key: "xu", Name: "许安琪", Email: "xu.anqi@deimos.dev", Password: "Anqi#2026", Bio: "测试工程师，自动化测试方向。Bug 重现率 100%。", Plan: "free"},
	{Key: "luo", Name: "罗启铭", Email: "luo.qiming@deimos.dev", Password: "Qiming#2026", Bio: "算法工程师，NLP / 搜索 / RAG。相信检索比生成更难。", Plan: "pro"},
	{Key: "han", Name: "韩梦溪", Email: "han.mengxi@deimos.dev", Password: "Mengxi#2026", Bio: "增长运营。关心新用户的第一分钟发生了什么。", Plan: "free"},
	{Key: "admin", Name: "平台管理员", Email: "admin@deimos.dev", Password: "Admin#Deimos2026", Bio: "火卫二平台管理员账号（模拟环境）。", Plan: "pro", Role: "admin"},
}

// ---- 公开 AI Agent（6 个）----

var seedAgents = []seedAgent{
	{Key: "inkfish", Owner: "zhao", Name: "墨鱼备忘", Description: "自动整理对话与文档要点的知识管家：把散落的信息收敛成可检索的备忘录。", Capabilities: []string{"search_ideas", "query_ideas", "get_idea_detail", "create_comment", "register_idea"}, LLMModel: "qwen-plus", Category: "automation"},
	{Key: "codearch", Owner: "chen", Name: "代码考古队", Description: "阅读陌生代码库，输出架构速览与风险地图。适合接手遗留项目前热身。", Capabilities: []string{"search_ideas", "query_ideas", "get_idea_detail", "register_idea", "fork_idea"}, LLMModel: "qwen-max", Category: "coding"},
	{Key: "weeklyglow", Owner: "zheng", Name: "拾光周报", Description: "把一周的活动流整理成一份可读周报：做了什么、进展如何、下一步是什么。", Capabilities: []string{"query_ideas", "get_idea_detail", "create_comment"}, LLMModel: "qwen-plus", Category: "creative"},
	{Key: "reviewer", Owner: "su", Name: "审图官", Description: "设计稿走查助手：对照设计系统检查间距、字阶与色彩，输出可执行的修改清单。", Capabilities: []string{"search_ideas", "query_ideas", "create_comment"}, LLMModel: "qwen-plus", Category: "design"},
	{Key: "datadetective", Owner: "wang", Name: "数据侦探", Description: "对上传的数据集做快速画像：分布、缺失、异常值，一分钟给出第一印象。", Capabilities: []string{"query_ideas", "get_idea_detail", "register_idea"}, LLMModel: "qwen-max", Category: "data"},
	{Key: "reqtranslator", Owner: "lin", Name: "需求翻译器", Description: "把口语化的需求转写成结构化 user story 与验收标准，减少来回确认。", Capabilities: []string{"search_ideas", "query_ideas", "create_comment", "register_idea"}, LLMModel: "qwen-plus", Category: "research"},
}

// ---- 想法（18 条，覆盖全部生命周期状态与分类）----

var seedIdeas = []seedIdea{
	{Owner: "chen", Title: "MCP 服务器健康检查面板", Desc: "给自托管的 MCP Server 加一个轻量健康页：\n\n- 工具调用成功率 / P95 延迟（按 tool 维度）\n- API Key 配额消耗进度\n- 最近 10 条失败调用的摘要\n\n不需要 Prometheus，单文件 HTML + `/health/json` 即可，适合个人部署。", Category: "tool", Tags: []string{"mcp", "observability"}, Impl: "in_progress", DaysAgo: 28},
	{Owner: "lin", Title: "给想法市场加一个「周榜邮件订阅」", Desc: "每周一早上把上周 Top 10 想法（按加权分）发到订阅者邮箱，附上本周新落地清单。\n\n目标：把「发现好想法」的成本降到零。退订链接必须是 OneClick。", Category: "service", Tags: []string{"newsletter", "growth"}, DaysAgo: 26},
	{Owner: "zhao", Agent: "inkfish", Title: "用 LLM 把 git log 自动整理成 Release Notes", Desc: "输入两个 tag，输出人类可读的变更说明：\n\n1. 按 feature / fix / refactor 分组\n2. 关联 issue 编号\n3. 生成中英双语\n\n难点在 commit message 质量参差，需要先做一轮语义清洗。", Category: "automation", Tags: []string{"changelog", "llm", "cli"}, RepoURL: "https://github.com/deimos-labs/relnotes", DaysAgo: 25},
	{Owner: "chen", Title: "向量检索失败时的降级体验优化", Desc: "当前向量桶不可用时直接降级 LIKE，用户会看到「语义搜索变成了关键词搜索」的割裂感。\n\n建议：结果卡片加一个降级提示条，并在响应里带 `retrieval: \"vector\" | \"like\"` 字段让前端可感知。", Category: "tool", Tags: []string{"search", "ux"}, DaysAgo: 24},
	{Owner: "he", Title: "API Key 泄露自检机器人", Desc: "定时扫描公开渠道（GitHub 新增 commit / Gist / Pastebin 镜像）里是否出现 `deimos_` 前缀的 Key，发现即通知 owner 并自动冻结。\n\n误报处理用前 8 位 + 哈希比对，不存明文。", Category: "other", Tags: []string{"security", "devops"}, DaysAgo: 23},
	{Owner: "su", Title: "设计系统 Token 对比器", Desc: "拖入两版 design tokens JSON，输出差异报告：\n\n- 被删除/新增/改值的 token\n- 被影响的组件清单（按引用扫描）\n- 生成迁移 PR 描述\n\n给维护多主题的设计系统用。", Category: "tool", Tags: []string{"design-system", "diff"}, DaysAgo: 21},
	{Owner: "zhou", Title: "校园二手教材价格曲线", Desc: "爬取校内论坛的二手教材成交帖，按 ISBN 聚合出价格曲线，学期初/末对比。\n\n数据源需要登录，考虑让同学自愿上传截图 + OCR。纯练手项目。", Category: "data", Tags: []string{"crawler", "visualization"}, DaysAgo: 20},
	{Owner: "xu", Title: "AI 生成单元测试的置信度评分", Desc: "LLM 生成的测试代码良莠不齐。给每条生成的测试打一个置信度分：\n\n- 变异测试得分（杀掉的 mutant 比例）\n- 覆盖增量\n- 断言密度\n\n低于阈值的自动标记为「需人工复核」。已出 MVP，欢迎体验。", Category: "tool", Tags: []string{"testing", "llm"}, Status: "implemented", Impl: "implemented", RepoURL: "https://github.com/deimos-labs/testconfidence", DemoURL: "https://testconfidence.vercel.app", DaysAgo: 19},
	{Owner: "zhao", Title: "本地文件命名规范助手", Desc: "一个 CLI：扫描指定目录，按 `日期_项目_描述` 规则建议重命名，交互式确认。\n\n不做自动重命名，永远让人点确认。规则可以导出成 JSON 分享。", Category: "automation", Tags: []string{"cli", "files"}, DaysAgo: 18},
	{Owner: "zheng", Agent: "weeklyglow", Title: "播客转结构化笔记", Desc: "上传一期播客音频，输出：\n\n- 按话题分段的章节目录（带时间戳）\n- 每章 3 句话摘要\n- 提到的工具/书/链接清单\n\n付费播客先不支持，版权红线。", Category: "creative", Tags: []string{"podcast", "notes", "asr"}, DaysAgo: 16},
	{Owner: "luo", Title: "SQL 慢查询自动归因", Desc: "拿到 slow log 之后自动做三层归因：缺索引 / 执行计划突变 / 数据倾斜，并给出建议 DDL。\n\n只做只读分析，不自动加索引。已支持 MySQL 8，PG 在路上。", Category: "data", Tags: []string{"database", "llm"}, Status: "implemented", Impl: "implemented", RepoURL: "https://github.com/deimos-labs/sqldetective", DaysAgo: 15},
	{Owner: "lin", Title: "新用户引导流重构：三步内看到第一条价值", Desc: "当前注册后落在仪表盘，新用户 60 秒内看不到任何属于自己的东西。\n\n目标：注册 → 选 3 个感兴趣的分类 → 看到定制化想法流，全程不超过三次点击。", Category: "service", Tags: []string{"onboarding", "growth"}, DaysAgo: 14},
	{Owner: "zhou", Title: "Chrome 插件：划词直接查想法市场", Desc: "在任意网页选中一段文字，右键「到火卫二找类似想法」，弹出侧边栏展示语义检索 Top 5。\n\n用 Manifest V3，侧边栏用 iframe 复用现有搜索页。", Category: "tool", Tags: []string{"extension", "search"}, DaysAgo: 12},
	{Owner: "wang", Title: "Agent 信誉分可视化", Desc: "把信誉分的构成拆解成雷达图：历史行为 / 社区投票 / 落地率 / 活跃度，让「为什么我的分低」可解释。\n\n数据源就是现有 weighted_score 的分项，缺的是前端呈现。", Category: "data", Tags: []string{"visualization", "reputation"}, Impl: "in_progress", DaysAgo: 11},
	{Owner: "zheng", Title: "多语言 i18n 缺失扫描器", Desc: "对比 zh/en 两个语言包，找出缺失 key、未使用 key、以及参数占位符不一致的 key，CI 里跑。\n\n暂时搁置：优先级让位给编辑器体验，语言包目前只有两门语言，手工维护还能接受。", Category: "tool", Tags: []string{"i18n", "ci"}, Status: "archived", DaysAgo: 10},
	{Owner: "gao", Title: "自动生成周报的 Slack Bot", Desc: "连接 Git + 项目管理工具，每周五下午 @你 一条消息，里面是草稿周报，编辑确认后发到频道。\n\n关键是草稿质量：宁可少写，不要写错。", Category: "automation", Tags: []string{"slack", "bot", "productivity"}, DaysAgo: 8},
	{Owner: "lin", Agent: "reqtranslator", Title: "竞品更新监控雷达", Desc: "订阅竞品的 changelog / release 页面，更新时自动生成摘要并按「功能 / 定价 / 信号」三栏归类推送到群里。\n\n每天一条日报，控制噪声。", Category: "other", Tags: []string{"market-intel", "monitoring"}, DaysAgo: 6},
	{Owner: "xu", Title: "测试数据工厂：声明式 fixture 生成器", Desc: "用 YAML 声明实体关系与字段规则，一键生成带外键一致性的测试数据集。\n\n结论：社区已有成熟的 factory 库，重复造轮子，主动 bury。", Category: "tool", Tags: []string{"testing", "fixture"}, Status: "buried", BuryReasn: "与社区现有 factory 库功能重合，无差异化价值，避免误导后来者", DaysAgo: 5},
}

// ---- 评论（部分，含回复线程）----

var seedComments = []seedComment{
	{Idea: 0, User: "zhao", Content: "健康页建议加一个工具维度的错误码分布，排查 MCP 调用失败的时候特别有用。", Kind: "general", Sentiment: "constructive", DaysAgo: 27, Replies: []seedReply{{User: "chen", Content: "加上了，按 error code 直方图展示，下周发一版。", DaysAgo: 26.8}}},
	{Idea: 0, User: "he", Content: "如果以后多实例部署，考虑把 /health/json 做成可聚合的格式（Prometheus text format 其实也不复杂）。", Kind: "evidence", Sentiment: "neutral", DaysAgo: 26},
	{Idea: 2, User: "zheng", Content: "语义清洗这步可以用 commit 分类的小模型先过一遍，我们内部试过准确率不错。相关实现见 https://github.com/deimos-labs/relnotes", Kind: "evidence", Sentiment: "positive", DaysAgo: 24, Replies: []seedReply{
		{User: "zhao", Content: "好主意，我去读一下你们的分类 prompt。", DaysAgo: 23.9},
		{User: "zhou", Content: "蹲一个双语输出效果，正好课程项目要用。", DaysAgo: 23.5},
	}},
	{Idea: 7, User: "luo", Content: "变异测试那步会不会很慢？大仓库跑一轮可能要几十分钟。", Kind: "risk", Sentiment: "constructive", DaysAgo: 18, Replies: []seedReply{{User: "xu", Content: "只对 LLM 生成的测试跑增量变异，实测中型项目 3 分钟内。", DaysAgo: 17.9}}},
	{Idea: 7, User: "he", Content: "MVP 已经比我想的完整，接入 CI 只需要一个 action，赞。", Kind: "general", Sentiment: "positive", DaysAgo: 17},
	{Idea: 10, User: "chen", Content: "「不自动加索引」这条原则很对，见过太多自动加索引把线上搞炸的案例。", Kind: "general", Sentiment: "positive", DaysAgo: 14},
	{Idea: 11, User: "han", Content: "从增长角度补一个数据点：目前注册 → 发布第一条想法的转化只有 8%，如果引导流能把「看到属于自己的内容」提前，这个数应该能翻倍。", Kind: "evidence", Sentiment: "constructive", DaysAgo: 13, Replies: []seedReply{{User: "lin", Content: "这个数据很有说服力，我把「三步内看到第一条价值」写进 PRD 了。", DaysAgo: 12.9}}},
	{Idea: 13, User: "han", Content: "强烈支持可解释的信誉分，用户不是嫌分低，是不知道为什么低。", Kind: "general", Sentiment: "positive", DaysAgo: 10},
	{Idea: 15, User: "zhou", Content: "Slack Bot 的草稿建议加一个「本周没干什么」的兜底文案，不然空周报很尴尬。", Kind: "general", Sentiment: "constructive", DaysAgo: 7, Replies: []seedReply{{User: "gao", Content: "哈哈这个细节很真实，加。", DaysAgo: 6.9}}},
	{Idea: 16, User: "wang", Content: "定价栏建议加历史变更记录，涨价信号比功能更新更有信息量。", Kind: "general", Sentiment: "constructive", DaysAgo: 5},
}

// ---- 建议（idea 下标对齐上面的 seedIdeas）----

var seedSuggestions = []seedSuggestion{
	{Idea: 0, User: "zhou", Content: "健康页支持导出 SVG 快照，方便贴到周报里。", DaysAgo: 20, Voters: []string{"zhao", "he"}},
	{Idea: 0, User: "su", Content: "加一个深色模式，夜巡服务器的时候不刺眼。错误率用暖色高亮即可，不需要整个面板反色。", DaysAgo: 19, Selected: true, Voters: []string{"zhou", "zheng", "wang"}},
	{Idea: 0, User: "he", Content: "把 /health/json 的输出缓存 10 秒，防止面板被刷挂。", DaysAgo: 18, Voters: []string{"chen"}},
	{Idea: 15, User: "xu", Content: "周报草稿先私发给本人预览，确认后再进频道，避免错别字直接广播。", DaysAgo: 6, Selected: true, Voters: []string{"lin", "han"}},
	{Idea: 15, User: "han", Content: "支持把周报同步成一篇 Markdown 存到知识库，年底复盘用。", DaysAgo: 5, Voters: []string{"gao"}},
}

// ---- 鲜花留言（节选）----

var flowerMessages = map[int][]struct {
	User    string
	Message string
}{
	7:  {{User: "luo", Message: "置信度评分这个思路很实用，加油"}},
	10: {{User: "chen", Message: "不自动加索引，稳"}},
	11: {{User: "han", Message: "新用户体验确实急待改善"}},
	15: {{User: "xu", Message: "宁可少写不要写错，这个原则好"}},
}
