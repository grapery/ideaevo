package main

// smoke —— 全功能 API 验证工具：基于 seed 灌入的 mock 数据，
// 对认证/想法/互动/评论/Fork/版本/建议池/发现/关注/通知/API Key 等做端到端断言。
//
// 用法：
//
//	ENV_LOAD + go run ./cmd/smoke            # 默认 http://localhost:9200
//	API_BASE=http://host:9200 go run ./cmd/smoke
//
// 退出码 0 = 全部通过；1 = 存在失败项。

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"os"
	"regexp"
	"strings"
)

var (
	base     string
	client   *http.Client // 匿名
	clientU  *http.Client // chen（独立 cookie jar）
	clientU2 *http.Client // lin（独立 cookie jar）
	token    string
	token2   string
	apiKey   string

	passed, failed int
)

type msi = map[string]any

func check(name string, cond bool, detail string) {
	if cond {
		passed++
		fmt.Printf("  ✓ %s\n", name)
	} else {
		failed++
		fmt.Printf("  ✗ %s  — %s\n", name, detail)
	}
}

// req 发送请求；auth: ""=匿名, "u"=chen 会话, "u2"=lin 会话, "key"=API Key
func req(method, path string, body msi, auth string) (int, msi, []byte) {
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	r, _ := http.NewRequest(method, base+path, rd)
	r.Header.Set("Content-Type", "application/json")
	c := client
	switch auth {
	case "u":
		r.Header.Set("Authorization", "Bearer "+token)
		c = clientU
	case "u2":
		r.Header.Set("Authorization", "Bearer "+token2)
		c = clientU2
	case "key":
		r.Header.Set("X-API-Key", apiKey)
	}
	resp, err := c.Do(r)
	if err != nil {
		return 0, nil, []byte(err.Error())
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var out msi
	_ = json.Unmarshal(raw, &out)
	return resp.StatusCode, out, raw
}

func str(v msi, keys ...string) string {
	cur := v
	for i, k := range keys {
		if i == len(keys)-1 {
			s, _ := cur[k].(string)
			return s
		}
		next, ok := cur[k].(msi)
		if !ok {
			return ""
		}
		cur = next
	}
	return ""
}

func num(v msi, key string) float64 {
	f, _ := v[key].(float64)
	return f
}

func main() {
	flag.StringVar(&base, "base", "http://localhost:9200", "API base URL")
	accts := flag.String("accounts", "../mock-accounts.md", "mock 账号文件（解析 API Key）")
	flag.Parse()

	jar, _ := cookiejar.New(nil)
	client = &http.Client{Jar: jar}
	jarU, _ := cookiejar.New(nil)
	clientU = &http.Client{Jar: jarU}
	jarU2, _ := cookiejar.New(nil)
	clientU2 = &http.Client{Jar: jarU2}

	// 从账号文件解析第一个 API Key
	raw, err := os.ReadFile(*accts)
	if err == nil {
		re := regexp.MustCompile("deimos_[a-f0-9]{64}")
		if m := re.Find(raw); m != nil {
			apiKey = string(m)
		}
	}

	fmt.Println("== 1. 认证 ==")
	code, body, _ := req("POST", "/api/auth/user/login", msi{"email": "chen.mingxuan@deimos.dev", "password": "Mingxuan#2026"}, "")
	token = str(body, "token")
	check("登录（正确密码）返回 200 + token", code == 200 && token != "", fmt.Sprint(code))

	code, _, _ = req("POST", "/api/auth/user/login", msi{"email": "chen.mingxuan@deimos.dev", "password": "wrong"}, "")
	check("登录（错误密码）被拒绝", code == 400 || code == 401, fmt.Sprint(code))

	code, body, _ = req("POST", "/api/auth/user/login", msi{"email": "lin.yutong@deimos.dev", "password": "Yutong#2026"}, "")
	token2 = str(body, "token")
	check("第二个账号登录", code == 200 && token2 != "", fmt.Sprint(code))

	code, body, _ = req("GET", "/api/auth/user/me", nil, "u")
	check("GET /auth/user/me 返回当前用户", code == 200 && str(body, "user", "email") == "chen.mingxuan@deimos.dev", fmt.Sprint(code))

	fmt.Println("== 2. 想法列表与详情 ==")
	code, body, _ = req("GET", "/api/ideas?limit=5", nil, "")
	check("公开列表可访问且 total ≥ 200", code == 200 && num(body, "total") >= 200, fmt.Sprint(code))

	code, body, _ = req("GET", "/api/ideas?status=buried&limit=50", nil, "")
	allBuried := true
	if items, ok := body["ideas"].([]any); ok {
		for _, it := range items {
			if s, _ := it.(msi); s["status"] != "buried" {
				allBuried = false
			}
		}
		check("状态过滤 status=buried 生效", code == 200 && allBuried && len(body["ideas"].([]any)) > 0, "")
	} else {
		check("状态过滤 status=buried 生效", false, "无返回")
	}

	code, body, _ = req("GET", "/api/ideas?category=tool&limit=50", nil, "")
	allTool := true
	if items, ok := body["ideas"].([]any); ok {
		for _, it := range items {
			if s, _ := it.(msi); s["category"] != "tool" {
				allTool = false
			}
		}
		check("分类过滤 category=tool 生效", code == 200 && allTool && len(body["ideas"].([]any)) > 0, "")
	} else {
		check("分类过滤 category=tool 生效", false, "无返回")
	}

	// 取一个活跃想法作为后续测试对象
	var targetID string
	code, body, _ = req("GET", "/api/ideas?limit=1&sort=popular", nil, "")
	if items, ok := body["ideas"].([]any); ok && len(items) > 0 {
		it, _ := items[0].(msi)
		targetID, _ = it["id"].(string)
	}
	check("获取目标测试想法", targetID != "", "列表为空")

	code, body, _ = req("GET", "/api/ideas/"+targetID, nil, "")
	check("GET 想法详情（含 Agent 归属）", code == 200 && str(body, "agent", "id") != "", fmt.Sprint(code))

	code, _, _ = req("GET", "/api/ideas/"+targetID+"/stats", nil, "")
	check("GET 想法统计", code == 200, fmt.Sprint(code))

	code, _, _ = req("GET", "/api/ideas/"+targetID+"/lineage", nil, "")
	check("GET 想法谱系", code == 200, fmt.Sprint(code))

	code, _, _ = req("GET", "/api/ideas/"+targetID+"/versions", nil, "")
	check("GET 版本列表", code == 200, fmt.Sprint(code))

	fmt.Println("== 3. 想法创建与更新 ==")
	code, body, _ = req("POST", "/api/ideas", msi{
		"title": "smoke 验证用想法（可删除）", "description": "由 cmd/smoke 创建，用于验证创建/更新/版本/状态流转接口。",
		"category": "tool", "tags": []string{"smoke"},
	}, "u")
	smokeIdea := str(body, "id")
	check("POST 创建想法", code == 201 && smokeIdea != "", fmt.Sprint(code)+string(fmt.Sprint(body["error"])))

	code, _, _ = req("PATCH", "/api/ideas/"+smokeIdea+"/meta", msi{"repo_url": "https://github.com/deimos-labs/smoke-test"}, "u")
	check("PATCH 更新 meta", code == 200, fmt.Sprint(code))

	code, _, _ = req("PATCH", "/api/ideas/"+smokeIdea+"/description", msi{"description": "更新后的描述：smoke v2。", "changelog": "smoke 更新"}, "u")
	check("PATCH 更新描述", code == 200, fmt.Sprint(code))

	code, body, _ = req("POST", "/api/ideas/"+smokeIdea+"/versions", msi{
		"title": "smoke 验证用想法（可删除）", "description": "v2 描述", "category": "tool", "changelog": "发布 v2",
		"tags": []string{"smoke"}, "impl_status": "in_progress",
	}, "u")
	check("POST 发布新版本", code == 200 || code == 201, fmt.Sprint(code))

	code, body, _ = req("GET", "/api/ideas/"+smokeIdea+"/versions", nil, "")
	check("版本列表包含新版本", code == 200 && len(body["versions"].([]any)) >= 1, "")

	// 状态流转：非 owner 拒绝，owner 成功
	code, _, _ = req("POST", "/api/ideas/"+smokeIdea+"/bury", msi{"reason": "smoke 测试"}, "u2")
	check("非 owner bury 被拒（403）", code == 403, fmt.Sprint(code))
	code, _, _ = req("POST", "/api/ideas/"+smokeIdea+"/archive", msi{"reason": "smoke 暂存"}, "u")
	check("owner archive 成功", code == 200, fmt.Sprint(code))
	code, body, _ = req("POST", "/api/ideas/"+smokeIdea+"/reactivate", nil, "u")
	check("owner 重新激活", code == 200, fmt.Sprint(code))

	fmt.Println("== 4. 互动：点赞 / 期待 / 收藏 / 表情 / 鲜花 ==")
	code, body, _ = req("POST", "/api/ideas/"+smokeIdea+"/like", nil, "u2")
	code2, body2, _ := req("GET", "/api/ideas/"+smokeIdea+"/like", nil, "u2")
	check("点赞 + 状态查询", (code == 200 || code == 400) && code2 == 200 && body2["liked"] == true, fmt.Sprint(code, "/", code2))
	req("DELETE", "/api/ideas/"+smokeIdea+"/like", nil, "u2")
	code, body2, _ = req("GET", "/api/ideas/"+smokeIdea+"/like", nil, "u2")
	check("取消点赞", code == 200 && body2["liked"] == false, "")

	req("POST", "/api/ideas/"+smokeIdea+"/wish", nil, "u2")
	code, body, _ = req("GET", "/api/ideas/"+smokeIdea+"/wish", nil, "u2")
	check("期待 + 状态查询", code == 200 && body["wished"] == true, "")
	req("DELETE", "/api/ideas/"+smokeIdea+"/wish", nil, "u2")

	req("POST", "/api/ideas/"+smokeIdea+"/bookmark", nil, "u2")
	code, body, _ = req("GET", "/api/ideas/"+smokeIdea+"/bookmark", nil, "u2")
	check("收藏 + 状态查询", code == 200 && body["bookmarked"] == true, "")
	req("DELETE", "/api/ideas/"+smokeIdea+"/bookmark", nil, "u2")

	code, _, _ = req("POST", "/api/ideas/"+smokeIdea+"/reactions", msi{"emoji": "👍"}, "u2")
	code, body, _ = req("GET", "/api/ideas/"+smokeIdea+"/reactions", nil, "")
	counts, _ := body["counts"].(msi)
	emojiN, _ := counts["👍"].(float64)
	check("表情回应 + 聚合查询", code == 200 && emojiN >= 1, fmt.Sprint(code))
	req("DELETE", "/api/ideas/"+smokeIdea+"/reactions", msi{"emoji": "👍"}, "u2")

	code, body, _ = req("POST", "/api/ideas/"+smokeIdea+"/flowers", msi{"message": "smoke 送花"}, "u2")
	okFlower := code == 200 || (code == 400 && strings.Contains(string(fmt.Sprint(body["code"])), "insufficient"))
	check("送花（或配额不足被拒也算通过）", okFlower, fmt.Sprint(code))
	code, body, _ = req("GET", "/api/ideas/"+smokeIdea+"/flowers", nil, "")
	check("送花名单查询", code == 200, fmt.Sprint(code))

	fmt.Println("== 5. 评论 ==")
	code, body, _ = req("POST", "/api/ideas/"+smokeIdea+"/comments", msi{"content": "smoke 顶层评论", "sentiment": "neutral", "kind": "general"}, "u2")
	commentID := str(body, "id")
	check("创建评论", (code == 201 || code == 200) && commentID != "", fmt.Sprint(code))

	code, body, _ = req("POST", "/api/ideas/"+smokeIdea+"/comments", msi{"content": "smoke 回复", "parent_id": commentID}, "u")
	replyID := str(body, "id")
	check("创建回复", (code == 201 || code == 200) && replyID != "", fmt.Sprint(code))

	code, _, rawC := req("GET", "/api/ideas/"+smokeIdea+"/comments", nil, "")
	var comments []msi
	_ = json.Unmarshal(rawC, &comments)
	hasThread := false
	for _, c0 := range comments {
		if c0["id"] == commentID {
			if replies, ok := c0["replies"].([]any); ok && len(replies) > 0 {
				hasThread = true
			}
		}
	}
	check("评论列表（裸数组）含回复线程", code == 200 && len(comments) > 0 && hasThread, fmt.Sprint(len(comments)))

	code, body, _ = req("POST", "/api/comments/"+commentID+"/like", nil, "u")
	check("评论点赞", code == 200, fmt.Sprint(code))
	code, _, _ = req("DELETE", "/api/comments/"+commentID+"/like", nil, "u")
	check("评论取消点赞", code == 200, fmt.Sprint(code))

	// /comments/:id 的 PATCH/DELETE 路由仅 API Key 认证（agent 通道）
	code, body, _ = req("POST", "/api/ideas/"+smokeIdea+"/comments", msi{"content": "API Key 评论（编辑删除用）"}, "key")
	agentCommentID := str(body, "id")
	code, _, _ = req("PATCH", "/api/comments/"+agentCommentID, msi{"content": "API Key 评论（已编辑）"}, "key")
	check("Agent 编辑自己的评论", code == 200, fmt.Sprint(code))
	code, _, _ = req("DELETE", "/api/comments/"+agentCommentID, nil, "key")
	check("Agent 删除自己的评论", code == 200, fmt.Sprint(code))

	fmt.Println("== 6. Fork ==")
	code, body, _ = req("POST", "/api/ideas/"+smokeIdea+"/fork", msi{"title": "smoke fork", "description": "smoke fork 描述", "category": "tool"}, "u2")
	forkID := str(body, "id")
	check("Fork 创建新想法", (code == 200 || code == 201) && forkID != "", fmt.Sprint(code))

	code, body, _ = req("GET", "/api/ideas/"+smokeIdea+"/fork-children", nil, "")
	hasFork := false
	if items, ok := body["ideas"].([]any); ok {
		for _, it := range items {
			if s, _ := it.(msi); s["id"] == forkID {
				hasFork = true
			}
		}
	}
	check("fork-children 包含新 fork", code == 200 && hasFork, "")
	code, body, _ = req("GET", "/api/ideas/"+forkID+"/lineage", nil, "")
	check("fork 的谱系含来源", code == 200 && str(body, "source_idea", "id") == smokeIdea, "")

	fmt.Println("== 7. 建议池 ==")
	code, _, _ = req("GET", "/api/ideas/"+smokeIdea+"/suggestions", nil, "")
	check("公开获取建议列表", code == 200, fmt.Sprint(code))

	code, body, _ = req("POST", "/api/ideas/"+smokeIdea+"/suggestions", msi{"content": "smoke 建议：加个导出功能"}, "u2")
	sugID := str(body, "suggestion", "id")
	check("提交建议", code == 201 && sugID != "", fmt.Sprint(code))

	code, body, _ = req("POST", "/api/ideas/"+smokeIdea+"/suggestions/"+sugID+"/vote", nil, "u2")
	check("投票", code == 200 && body["voted"] == true, fmt.Sprint(code))
	code, _, _ = req("POST", "/api/ideas/"+smokeIdea+"/suggestions/"+sugID+"/vote", nil, "u2")
	check("重复投票返回 409", code == 409, fmt.Sprint(code))
	code, _, _ = req("DELETE", "/api/ideas/"+smokeIdea+"/suggestions/"+sugID+"/vote", nil, "u2")
	check("取消投票", code == 200, fmt.Sprint(code))

	code, _, _ = req("POST", "/api/ideas/"+smokeIdea+"/suggestions/"+sugID+"/select", nil, "u2")
	check("非 owner 采纳被拒（403）", code == 403, fmt.Sprint(code))
	code, body, _ = req("POST", "/api/ideas/"+smokeIdea+"/suggestions/"+sugID+"/select", nil, "u")
	jobID := str(body, "job_id")
	check("owner 采纳并创建实现任务", code == 200 && jobID != "", fmt.Sprint(code))
	code, body, _ = req("POST", "/api/ideas/"+smokeIdea+"/suggestions/"+sugID+"/select", nil, "u")
	check("重复采纳幂等（不新建任务）", code == 200 && str(body, "job_id") == "", fmt.Sprint(code))

	code, _, _ = req("DELETE", "/api/ideas/"+smokeIdea+"/suggestions/"+sugID, nil, "u2")
	check("已采纳的建议不可删除", code == 400, fmt.Sprint(code))

	fmt.Println("== 8. 搜索 / 排行 / 活动流 ==")
	code, body, _ = req("GET", "/api/ideas/search?q=MCP", nil, "")
	check("语义搜索（向量或 LIKE 降级）返回结果", code == 200 && len(body["results"].([]any)) > 0, fmt.Sprint(code))

	code, body, _ = req("GET", "/api/ideas/ranking?window=week&metric=weighted&limit=5", nil, "")
	check("热榜接口", code == 200 && len(body["ranking"].([]any)) > 0, fmt.Sprint(code))

	code, body, _ = req("GET", "/api/activity?limit=10", nil, "")
	check("全局活动流", code == 200 && len(body["activities"].([]any)) > 0, fmt.Sprint(code))

	code, body, _ = req("GET", "/api/activity/stats", nil, "")
	check("活动统计", code == 200 && num(body, "total_actions") > 0, fmt.Sprint(code))

	fmt.Println("== 9. Agent 与用户 ==")
	code, body, _ = req("GET", "/api/agents?limit=10", nil, "")
	check("公开 Agent 列表", code == 200 && num(body, "total") >= 6, fmt.Sprint(code))

	var aiAgentID string
	if items, ok := body["agents"].([]any); ok && len(items) > 0 {
		it, _ := items[0].(msi)
		aiAgentID, _ = it["id"].(string)
	}
	code, body, _ = req("GET", "/api/agents/"+aiAgentID, nil, "")
	check("Agent 详情", code == 200 && str(body, "id") != "", fmt.Sprint(code))

	code, _, _ = req("POST", "/api/agents/"+aiAgentID+"/follow", nil, "u")
	check("关注 Agent", code == 200 || code == 201, fmt.Sprint(code))
	code, _, _ = req("DELETE", "/api/agents/"+aiAgentID+"/follow", nil, "u")
	check("取关 Agent", code == 200, fmt.Sprint(code))

	code, body, _ = req("GET", "/api/auth/user/me", nil, "u")
	userID := str(body, "user", "id")
	code, body, _ = req("GET", "/api/users/"+userID+"/profile", nil, "")
	check("用户主页", code == 200 && str(body, "profile", "user", "id") == userID, fmt.Sprint(code))

	code, body, _ = req("GET", "/api/users/"+userID+"/ideas", nil, "")
	check("用户的想法列表", code == 200, fmt.Sprint(code))

	code, body, _ = req("GET", "/api/user/profile", nil, "u")
	check("本人资料", code == 200, fmt.Sprint(code))

	fmt.Println("== 10. 通知 ==")
	code, body, _ = req("GET", "/api/notifications", nil, "u")
	check("通知列表", code == 200, fmt.Sprint(code))
	code, body, _ = req("GET", "/api/notifications/unread-count", nil, "u")
	check("未读计数", code == 200, fmt.Sprint(code))
	code, _, _ = req("POST", "/api/notifications/read-all", nil, "u")
	check("全部已读", code == 200, fmt.Sprint(code))

	fmt.Println("== 11. 浏览计数 ==")
	code, body, _ = req("GET", "/api/ideas/"+smokeIdea+"/stats", nil, "")
	before := num(body, "view_count")
	code, _, _ = req("POST", "/api/ideas/"+smokeIdea+"/view", nil, "")
	code, body, _ = req("GET", "/api/ideas/"+smokeIdea+"/stats", nil, "")
	after := num(body, "view_count")
	check("浏览计数递增", code == 200 && after > before, fmt.Sprintf("%v -> %v", before, after))

	fmt.Println("== 12. Agent API Key（MCP/REST 模拟）==")
	check("API Key 已从账号文件解析", apiKey != "", "mock-accounts.md 中无 key")
	code, body, _ = req("GET", "/api/ideas?limit=1", nil, "key")
	check("API Key 匿名读列表", code == 200, fmt.Sprint(code))
	code, body, _ = req("POST", "/api/ideas/"+smokeIdea+"/comments", msi{"content": "API Key 发布的评论（smoke）"}, "key")
	check("API Key 写评论", code == 201 || code == 200, fmt.Sprint(code))
	code, body, _ = req("GET", "/api/ideas/"+smokeIdea+"/suggestions", nil, "key")
	check("API Key 读建议列表", code == 200, fmt.Sprint(code))
	code, body, _ = req("POST", "/api/ideas/"+smokeIdea+"/suggestions", msi{"content": "API Key 提交的建议（smoke）"}, "key")
	check("API Key 提交建议", code == 201 || code == 200, fmt.Sprint(code))

	fmt.Printf("\n===== 结果：%d 通过 / %d 失败 =====\n", passed, failed)
	if failed > 0 {
		os.Exit(1)
	}
}
