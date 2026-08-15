# Deimos iOS

火卫二（ideaevo）iOS 客户端 · SwiftUI + MVVM · 对齐 [Atlas 设计系统](../design-tokens.md)。

## 要求

- Xcode 16+（已在 Xcode 27 / iOS 17 SDK 验证）
- iOS 17.0+
- 本地 API：`make api`（默认 `http://127.0.0.1:9200/api`）

## 打开与运行

```bash
open ideaevoapp/ios/Deimos.xcodeproj
```

1. 选择模拟器（如 iPhone 17 Pro）
2. Run（⌘R）

### 本地 API 地址

Debug 默认连接 `http://127.0.0.1:9200/api`。可在 Scheme → Run → Arguments → Environment Variables 设置：

```
IDEEVO_API_URL=http://127.0.0.1:9200/api
```

`Info.plist` 已开启 `NSAllowsLocalNetworking`，支持连接本机 API。

## 已实现（MVP 骨架）

| 模块 | 状态 |
|------|------|
| Atlas 设计令牌 / 组件 | ✅ IdeaCell、PillTabBar（选中 ink 底）、WireframeAvatar、EngagementBar |
| 认证 | ✅ 邮箱登录/注册、Keychain JWT、AuthRequiredSheet（对齐 Ardot `2:1112`） |
| 首页 | ✅ 广场列表、关注活动流、下拉刷新、骨架屏 |
| 搜索 | ✅ 语义搜索、DEIMOS SEARCH eyebrow、推荐 chips、编辑提示卡（`2:1119`） |
| 首页 | ✅ 广场列表、关注活动流、下拉刷新、广场 Feed 离线缓存（30min） |
| 想法详情 | ✅ Markdown、Reaction Strip、Fork Sheet、点赞状态 toggle |
| 我的 / 设置 | ✅ 背景图上传、头像/背景重置、编辑资料、账户注销 |
| 品牌 | ✅ App Icon + 启动屏（LaunchBackground / LaunchMark） |
| Agent 主页 | ✅ 统计、擅长卡、关注/对话（`2:1173`） |

## 项目结构

```
Deimos/
├── App/              # 入口、RootView
├── Design/           # AtlasColors、MarkdownBody、组件库
├── Models/           # User、Idea、Agent、Comment
├── Services/         # APIClient、Keychain、AuthSession、AppPreferencesStore
├── Features/         # 各功能页面
└── Resources/        # Info.plist、Assets
```

## API 认证

移动端使用 `Authorization: Bearer <JWT>`。登录/注册响应已包含 `token` 字段（后端 `user_auth_handler.go`），并存入 Keychain。

## 生产环境 / TestFlight

Release 构建 API 地址优先级：

1. Scheme 环境变量 `IDEEVO_API_URL`
2. `Info.plist` → `IDEEVOApiBaseURL`（可在 Target → Info 填写）
3. 默认 `https://api.deimos.app/api`

TestFlight 打包步骤：

```bash
# 1. Xcode → Product → Archive
# 2. Distribute App → App Store Connect
# 3. 在 App Store Connect 提交 TestFlight 审核
```

## 下一步

1. APNs 推送通知（需后端 device token 注册接口）
2. 想法详情 / 搜索离线缓存扩展
3. 深色模式

设计稿索引见 [mobile-app-design.md](../mobile-app-design.md) 与 [ardot/](../ardot/)。
