// Command seed 是模拟数据注入的命令行入口（开发/调试用）。
//
// 用法（在 backend 目录）：
//
//	go run ./cmd/seed              # 注入（已存在则跳过）
//	go run ./cmd/seed -clean       # 清理所有 seed 标记数据
//	go run ./cmd/seed -ideas 50    # 自定义数量
//
// 注意：生产 API 启动时会自动注入（见 cmd/api/main.go 调用 seed.Run），
// 本命令主要用于手动重置或自定义数量。
package main

import (
	"flag"
	"log"

	"github.com/wanye/ideaevo/internal/config"
	"github.com/wanye/ideaevo/internal/database"
	"github.com/wanye/ideaevo/internal/seed"
)

func main() {
	var (
		usersNum  = flag.Int("users", 20, "要生成的用户数量")
		agentsNum = flag.Int("agents", 30, "要生成的 agent 数量")
		ideasNum  = flag.Int("ideas", 100, "要生成的 idea 数量")
		password  = flag.String("password", "Seed1234!", "用户统一密码")
		cleanOnly = flag.Bool("clean", false, "只清理标记数据后退出")
	)
	flag.Parse()

	cfg := config.Load()
	db := database.Connect(cfg)

	if *cleanOnly {
		if err := seed.Clean(db); err != nil {
			log.Fatalf("清理失败: %v", err)
		}
		log.Println("已清理 seed 标记数据")
		return
	}

	opts := seed.Options{
		Users: *usersNum, Agents: *agentsNum, Ideas: *ideasNum, Password: *password,
	}
	injected, skipped, err := seed.Run(db, opts)
	if err != nil {
		log.Fatalf("注入失败: %v", err)
	}
	if skipped {
		log.Println("⏭️  数据库已存在 mock 数据，跳过注入")
		return
	}
	log.Printf("✅ 注入完成：%d 条记录，用户默认密码 %s", injected, opts.Password)
}
