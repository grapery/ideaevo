package main

// seed_generate.go —— 程序化生成的补充 mock 数据：在手工精撰的核心数据之外，
// 用「主题 × 变体 × 片段」组合生成足够规模且不重复的真实感内容。

import (
	"fmt"
	"math/rand"
)

// extraUsers 补充用户（27 个，与核心 13 个合计 40）。
type extraUser struct {
	seedUser
}

var extraUsers = []seedUser{
	{Key: "deng", Name: "邓紫琪", Email: "deng.ziqi@deimos.dev", Password: "Ziqi#2026", Bio: "前端工程师，动画与交互细节控。", Plan: "free"},
	{Key: "feng", Name: "冯凯文", Email: "feng.kaiwen@deimos.dev", Password: "Kaiwen#2026", Bio: "嵌入式工程师，玩单片机也玩智能家居。", Plan: "free"},
	{Key: "gong", Name: "龚雪", Email: "gong.xue@deimos.dev", Password: "Gongxue#2026", Bio: "游戏策划，桌游收藏家。", Plan: "free"},
	{Key: "jiang", Name: "姜博文", Email: "jiang.bowen@deimos.dev", Password: "Bowen#2026", Bio: "安全工程师，CTF 选手。", Plan: "pro"},
	{Key: "kang", Name: "康雨薇", Email: "kang.yuwei@deimos.dev", Password: "Yuwei#2026", Bio: "运营增长，A/B 测试信徒。", Plan: "free"},
	{Key: "liu", Name: "刘畅", Email: "liu.chang@deimos.dev", Password: "Liuchang#2026", Bio: "后端工程师，Go 与消息队列。", Plan: "pro"},
	{Key: "lu", Name: "卢俊义", Email: "lu.junyi@deimos.dev", Password: "Junyi#2026", Bio: "技术经理，带团队也写代码。", Plan: "free"},
	{Key: "ma", Name: "马思纯", Email: "ma.sichun@deimos.dev", Password: "Sichun#2026", Bio: "视觉设计师，字体排印爱好者。", Plan: "free"},
	{Key: "nie", Name: "聂海涛", Email: "nie.haitao@deimos.dev", Password: "Haitao#2026", Bio: "DBA，MySQL/Redis 双修。", Plan: "free"},
	{Key: "ouyang", Name: "欧阳靖", Email: "ouyang.jing@deimos.dev", Password: "Jing#2026", Bio: "独立游戏开发者，像素风。", Plan: "free"},
	{Key: "pan", Name: "潘婷婷", Email: "pan.tingting@deimos.dev", Password: "Tingting#2026", Bio: "客户成功经理，最懂用户抱怨的人。", Plan: "free"},
	{Key: "qi", Name: "祁一鸣", Email: "qi.yiming@deimos.dev", Password: "YimingQi#2026", Bio: "量化分析师，Python + Jupyter。", Plan: "pro"},
	{Key: "qin", Name: "秦岚", Email: "qin.lan@deimos.dev", Password: "Qinlan#2026", Bio: "内容运营，播客主播。", Plan: "free"},
	{Key: "shao", Name: "邵伟", Email: "shao.wei@deimos.dev", Password: "Shaowei#2026", Bio: "测试开发，混沌工程实践者。", Plan: "free"},
	{Key: "song", Name: "宋佳音", Email: "song.jiayin@deimos.dev", Password: "Jiayin#2026", Bio: "产品设计师，Figma 重度用户。", Plan: "pro"},
	{Key: "tang", Name: "唐子豪", Email: "tang.zihao@deimos.dev", Password: "Zihao#2026", Bio: "移动端工程师，Swift/Kotlin。", Plan: "free"},
	{Key: "wu", Name: "吴倩", Email: "wu.qian@deimos.dev", Password: "Wuqian#2026", Bio: "数据工程师，天天和 Airflow 打交道。", Plan: "free"},
	{Key: "xia", Name: "夏铭泽", Email: "xia.mingze@deimos.dev", Password: "Mingze#2026", Bio: "区块链审计，合约安全方向。", Plan: "free"},
	{Key: "xiong", Name: "熊睿", Email: "xiong.rui@deimos.dev", Password: "Xiongrui#2026", Bio: "SRE，值班专业户，SLI/SLO 布道者。", Plan: "pro"},
	{Key: "yan", Name: "严嘉懿", Email: "yan.jiayi@deimos.dev", Password: "Jiayi#2026", Bio: "法学转产品，合规科技方向。", Plan: "free"},
	{Key: "yao", Name: "姚星辰", Email: "yao.xingchen@deimos.dev", Password: "Xingchen#2026", Bio: "大三学生，ACM 退役选手。", Plan: "free"},
	{Key: "ye", Name: "叶知秋", Email: "ye.zhiqiu@deimos.dev", Password: "Zhiqiu#2026", Bio: "文档工程师，开源社区贡献者。", Plan: "free"},
	{Key: "you", Name: "尤佳", Email: "you.jia@deimos.dev", Password: "Youjia#2026", Bio: "SEO 顾问，内容策略。", Plan: "free"},
	{Key: "yu", Name: "余思远", Email: "yu.siyuan@deimos.dev", Password: "SiyuanYu#2026", Bio: "音频算法工程师，语音识别方向。", Plan: "free"},
	{Key: "zhang", Name: "张芷若", Email: "zhang.zhiruo@deimos.dev", Password: "Zhiruo#2026", Bio: "HR Tech 产品经理。", Plan: "free"},
	{Key: "zhaojun", Name: "赵君豪", Email: "zhao.junhao@deimos.dev", Password: "Junhao#2026", Bio: "爬虫工程师，数据合规关注者。", Plan: "free"},
	{Key: "zhu", Name: "朱锐", Email: "zhu.rui@deimos.dev", Password: "RuiZhu#2026", Bio: "视频剪辑师，转码自动化工具控。", Plan: "free"},
}

// 想法主题池（按分类）——具体的、真实世界里会被提出的主题。
var topicPools = map[string][]string{
	"tool": {
		"命令行 JSON 格式化", "Git 提交信息模板", "Markdown 表格对齐", "终端配色方案生成", "正则表达式可视化",
		"cron 表达式翻译", "API 文档预览", "本地环境变量管理", "代码片段管理", "数据库 ER 图导出",
		"截图美化", "十六进制编辑", "颜色对比度检查", "SVG 压缩", "字体子集化",
		"时间戳转换", "URL 编码调试", "diff 语法高亮", "Shell 补全生成", "日志高亮过滤",
		"依赖许可证扫描", "TODO 聚合面板", "浏览器缓存清理", "DNS 解析追踪", "证书到期监控",
		"接口 Mock 数据生成", "密码强度评估", "二维码批量生成", "PDF 拆分合并", "图片格式批量转换",
		"剪贴板历史", "窗口布局管理", "快捷键速查", "代码行数统计", "翻译对照阅读",
	},
	"service": {
		"简历一键排版", "会议纪要代整理", "租房合同审阅", "报销发票识别归档", "旅行行程规划",
		"宠物寄养对接", "二手书估价", "家宴厨师预约", "班车拼车", "社区团购",
		"线上自习室", "技能交换平台", "闲置物品图书馆", "代排队服务", "家电维修比价",
		"双语绘本借阅", "老人手机教学", "跑腿取号", "活动场地比价", "课程表共享",
	},
	"integration": {
		"GitHub Issue 同步到飞书", "Jira 到 Obsidian", "Slack 消息转邮件摘要", "Notion 数据库镜像备份", "日历空闲时段查询机器人",
		"微信读书笔记导出", "B 站收藏夹同步", "RSS 全文抓取", "网盘相册同步", "智能家居联动规则",
		"支付账单聚合", "快递追踪聚合", "播客订阅同步", "浏览器书签同步", "代码审查提醒到手表",
		"待办聚合看板", "文档变更通知", "监控告警分级路由", "工单系统互通", "考勤打卡同步",
	},
	"automation": {
		"周报自动草稿", "会议预订自动化", "发票自动报销", "代码评审分派", "测试环境定时重置",
		"文档过期提醒", "新成员入群引导", "生日祝福自动化", "域名续费提醒", "证书自动续期",
		"数据日报生成", "异常日志汇总", "竞品价格监控", "招聘流程跟进", "合同到期预警",
		"社群精华整理", "代码仓库初始化脚手架", "发布检查清单", "值班表轮换", "知识库全文索引",
		"图片版权扫描", "链接有效性巡检", "API 配额预警", "慢查询日报", "依赖漏洞周报",
	},
	"creative": {
		"AI 藏头诗生成", "剧本杀线索编排", "手写体字体生成", "播客片头制作", "电子杂志排版",
		"表情包工坊", "歌词押韵助手", "漫画分镜草图", "故事接龙社区", "摄影参数笔记",
		"白噪音混合器", "字体搭配推荐", "配色灵感抓取", "游戏 NPC 对话树", "互动小说引擎",
		"老照片修复", "视频字幕美化", "音乐采样管理", "拼贴诗生成器", "梦境日记插画",
	},
	"data": {
		"个人财务流水分析", "通勤路线优化", "睡眠质量关联分析", "阅读时长统计", "健身数据看板",
		"外卖营养估算", "电费峰值分析", "电影口味画像", "招聘市场薪资分布", "城市空气质量对比",
		"开源项目活跃度", "社交媒体情绪追踪", "房价走势提醒", "交通违章高发地图", "疫苗接种记录",
		"碳排放个人账本", "股票财报摘要", "论文引用网络", "代码提交热力图", "用户流失漏斗",
		"搜索词云生成", "问卷交叉分析", "API 调用画像", "日志聚类归因", "A/B 测试功效计算",
	},
	"other": {
		"无障碍朗读优化", "开源协议选择器", "技术债务登记簿", "团队值班体验", "面试题库共建",
		"远程办公时区协调", "程序员礼物清单", "开发者健康提醒", "代码考古博物馆", "失败项目纪念册",
		"实习内推信息流", "技术会议日历", "中文技术写作规范", "开源赞助透明化", "社区行为准则生成",
	},
}

// titleSuffixes 标题变体后缀（与主题组合出足量不重复标题）。
var titleSuffixes = []string{"", "小工具", "助手", "方案", "面板", "工作流"}

// descFragments 描述片段池（按句式组合）。
var descOpeners = []string{
	"每次%s都要重复一遍机械操作，受够了。",
	"在 %s 的场景里，现有工具总是差最后一步。",
	"团队里%s的流程全靠人肉，出错率居高不下。",
	"给%s做一个够用就好的轻量方案。",
	"把%s这件事的成本压到一分钟以内。",
	"%s 的信息散落在五个地方，找一个东西要翻半天。",
}
var descBodies = []string{
	"核心思路是%s。",
	"第一步先跑通最小闭环：%s。",
	"关键约束：%s。",
	"和现有方案的区别在于%s。",
	"技术上打算用%s实现。",
}
var descBodyFills = []string{
	"把重复判断交给规则，把例外留给人",
	"全部本地运行，数据不出机器",
	"先做只读，验证价值后再加写入",
	"接口优先，界面后面补",
	"用现成的开源组件拼装，不重造轮子",
	"把配置收敛成一份声明文件",
	"异步化 + 队列削峰",
	"缓存一切可缓存的查询",
	"用 LLM 做摘要，人做决策",
	"失败必须可回滚",
}
var descClosers = []string{
	"求共建，尤其需要前端。", "已经有原型，欢迎体验提意见。", "先立个 flag，周末开工。", "找个搭子一起搞。", "长期项目，慢慢磨。", "欢迎拍砖，方案还很粗糙。",
}
var commentOpeners = []string{"这个方向不错", "踩过同样的坑", "补充一个场景", "有个疑问", "期待已久", "说点不同意见", "亲测有效", "占个坑", "同需求 +1", "做过类似的"}
var commentBodies = []string{
	"建议先做 MVP 验证需求，别一上来追求大而全。",
	"数据源这块是个难点，我们之前卡了两周。",
	"如果加上导入导出就完美了。",
	"性能方面要注意长列表的渲染。",
	"移动端体验也要考虑进去。",
	"安全边界想清楚了吗？这种工具最容易忽略权限。",
	"定价可以参考同类产品，别免费到底。",
	"已经有竞品做了，差异点需要更明确。",
	"开源的话我愿意贡献代码。",
	"文档先行，代码后写，别倒过来。",
	"这个能和现有工作流打通吗？",
	"建议支持插件化，方便扩展。",
}
var buryReasons = []string{
	"调研后发现已有成熟方案，不再重复造轮子",
	"需求验证不通过，目标用户付费意愿低",
	"精力有限，优先级让位给主线项目",
	"技术方案走不通，成本远超预期",
	"团队方向调整，项目整体搁置",
}
var archiveReasons = []string{
	"暂时搁置，等依赖的基础能力就绪后重启",
	"优先级让位，下季度再评估",
	"先归档积累需求，等社区有更多声音再动手",
}
var repoSlugWords = []string{"kit", "lab", "flow", "hub", "mate", "gen", "scope", "forge", "pilot", "craft"}

func fillDesc(rng *rand.Rand, topic, suffix string) string {
	opener := fmt.Sprintf(descOpeners[rng.Intn(len(descOpeners))], topic)
	b1 := fmt.Sprintf(descBodies[rng.Intn(len(descBodies))], descBodyFills[rng.Intn(len(descBodyFills))])
	b2 := fmt.Sprintf(descBodies[rng.Intn(len(descBodies))], descBodyFills[rng.Intn(len(descBodyFills))])
	closer := descClosers[rng.Intn(len(descClosers))]
	title := topic + suffix
	return fmt.Sprintf("%s\n\n- %s\n- %s\n\n%s", opener, b1, b2, closer) + "\n\n（主题：" + title + "）"
}

// genExtraUsers 返回补充用户（打乱顺序由调用方决定）。
func genExtraUsers() []seedUser { return extraUsers }

// generateIdeas 程序化生成 n 条补充想法（标题全库不重复）。
// ownerKeys 为可担任发布者的用户 key 池；aiAgentKeys 为可担任发布者的 AI Agent（owner 同步给定）。
func generateIdeas(rng *rand.Rand, n int, ownerKeys []string, aiAgentsByOwner map[string]string, userNames map[string]string) []seedIdea {
	used := map[string]bool{}
	out := make([]seedIdea, 0, n)
	categories := []string{"tool", "service", "integration", "automation", "creative", "data", "other"}
	tagPool := map[string][]string{
		"tool":        {"cli", "productivity", "devx", "utilities"},
		"service":     {"marketplace", "life", "b2c"},
		"integration": {"sync", "webhook", "workflow", "api"},
		"automation":  {"bot", "ci", "scheduler", "rpa"},
		"creative":    {"ai-art", "writing", "audio", "design"},
		"data":        {"visualization", "analytics", "personal-data"},
		"other":       {"community", "docs", "meta"},
	}
	for len(out) < n {
		cat := categories[rng.Intn(len(categories))]
		topics := topicPools[cat]
		topic := topics[rng.Intn(len(topics))]
		suffix := titleSuffixes[rng.Intn(len(titleSuffixes))]
		title := topic
		if suffix != "" {
			title = topic + suffix
		}
		if used[title] {
			continue
		}
		used[title] = true

		// 状态分布：active ~75% / implemented ~8% / archived ~9% / buried ~8%
		status, impl := "active", "concept"
		switch r := rng.Intn(100); {
		case r < 75:
			switch r2 := rng.Intn(100); {
			case r2 < 55:
				impl = "concept"
			case r2 < 80:
				impl = "in_progress"
			case r2 < 92:
				impl = "paused"
			default:
				impl = "implemented"
			}
		case r < 83:
			status, impl = "implemented", "implemented"
		case r < 92:
			status, impl = "archived", "paused"
		default:
			status, impl = "buried", "concept"
		}

		owner := ownerKeys[rng.Intn(len(ownerKeys))]
		// ~18% 由 AI Agent 发布
		agentKey := ""
		if rng.Intn(100) < 18 {
			if ak, ok := aiAgentsByOwner[owner]; ok {
				agentKey = ak
			}
		}

		tags := tagPool[cat][rng.Intn(len(tagPool[cat]))]
		if rng.Intn(3) == 0 {
			tags = tags + ", " + tagPool[cat][rng.Intn(len(tagPool[cat]))]
		}

		var repo, demo, buryReason string
		if status == "implemented" {
			repo = "https://github.com/deimos-labs/" + repoSlugWords[rng.Intn(len(repoSlugWords))] + "-" + fmt.Sprint(rng.Intn(900)+100)
			if rng.Intn(2) == 0 {
				demo = "https://" + repoSlugWords[rng.Intn(len(repoSlugWords))] + ".vercel.app"
			}
		}
		if status == "buried" {
			buryReason = buryReasons[rng.Intn(len(buryReasons))]
		}

		out = append(out, seedIdea{
			Owner: owner, Agent: agentKey, Title: title,
			Desc: fillDesc(rng, topic, suffix), Category: cat,
			Tags: []string{tags}, Status: status, Impl: impl,
			RepoURL: repo, DemoURL: demo, BuryReasn: buryReason,
			DaysAgo: float64(1 + rng.Intn(88)),
		})
	}
	return out
}

// generateComments 给 startIdx 之后（含）的想法生成评论。
func generateComments(rng *rand.Rand, startIdx, ideaCount int, userKeys []string) []seedComment {
	out := []seedComment{}
	for i := startIdx; i < ideaCount; i++ {
		if rng.Intn(100) >= 32 { // 约 1/3 的想法有评论
			continue
		}
		n := 1 + rng.Intn(3)
		for j := 0; j < n; j++ {
			content := commentOpeners[rng.Intn(len(commentOpeners))] + "：" + commentBodies[rng.Intn(len(commentBodies))]
			kind := []string{"general", "evidence", "risk"}[rng.Intn(3)]
			sent := []string{"positive", "neutral", "constructive"}[rng.Intn(3)]
			sc := seedComment{
				Idea: i, User: userKeys[rng.Intn(len(userKeys))],
				Content: content, Kind: kind, Sentiment: sent,
				DaysAgo: float64(1 + rng.Intn(40)),
			}
			// 30% 概率带一条回复
			if rng.Intn(100) < 30 {
				sc.Replies = []seedReply{{
					User:    userKeys[rng.Intn(len(userKeys))],
					Content: commentBodies[rng.Intn(len(commentBodies))],
					DaysAgo: sc.DaysAgo - 0.4,
				}}
			}
			out = append(out, sc)
		}
	}
	return out
}

// generateSuggestions 给部分活跃想法生成建议（票数随机，少数被采纳）。
func generateSuggestions(rng *rand.Rand, ideaIdxs []int, userKeys []string, selectedCount int) []seedSuggestion {
	out := []seedSuggestion{}
	sugContents := []string{
		"先做浏览器插件版本，比独立网站获客成本低得多。",
		"建议加导出 JSON 的能力，方便和其他工具打通。",
		"移动端适配优先级应该提前，通勤场景使用频率最高。",
		"考虑一下离线模式，地铁里经常没网。",
		"加一个模板市场，让用户互相分享配置。",
		"支持 webhook 通知，接入现有工作流。",
		"免费额度可以再宽松一点，先积累种子用户。",
		"文档里补一个 5 分钟上手的 quickstart。",
		"夜间模式是刚需，长时间使用不刺眼。",
		"提供 Docker 镜像，自部署友好。",
		"批量操作入口太深了，建议提级。",
		"支持中文搜索分词优化。",
		"加个键盘快捷键速查表。",
		"数据导出格式支持 CSV。",
		"错误提示可以更友好一些，现在太技术向。",
		"建议提供英文界面，国际化迟早要做。",
	}
	usedSug := map[int]bool{}
	// 被采纳的建议
	for k := 0; k < selectedCount && k < len(ideaIdxs); k++ {
		idx := ideaIdxs[k]
		if usedSug[idx] {
			continue
		}
		usedSug[idx] = true
		voters := []string{}
		for v := 0; v < 1+rng.Intn(4); v++ {
			voters = append(voters, userKeys[rng.Intn(len(userKeys))])
		}
		out = append(out, seedSuggestion{
			Idea: idx, User: userKeys[rng.Intn(len(userKeys))],
			Content: sugContents[rng.Intn(len(sugContents))],
			DaysAgo: float64(1 + rng.Intn(20)), Selected: true, Voters: voters,
		})
	}
	// 待定建议
	for _, idx := range ideaIdxs {
		if usedSug[idx] || rng.Intn(100) >= 18 {
			continue
		}
		usedSug[idx] = true
		voters := []string{}
		for v := 0; v < rng.Intn(4); v++ {
			voters = append(voters, userKeys[rng.Intn(len(userKeys))])
		}
		out = append(out, seedSuggestion{
			Idea: idx, User: userKeys[rng.Intn(len(userKeys))],
			Content: sugContents[rng.Intn(len(sugContents))],
			DaysAgo: float64(1 + rng.Intn(15)), Voters: voters,
		})
	}
	return out
}

// genExtraUserKeys 返回补充用户的 key 列表（用于生成关注关系）。
func genExtraUserKeys() []string {
	keys := make([]string, 0, len(extraUsers))
	for _, u := range extraUsers {
		keys = append(keys, u.Key)
	}
	return keys
}
