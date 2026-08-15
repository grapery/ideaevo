# 万叶 v6 Design System — Flat · Card · Clean

> **当前版本：** v6 · triply-ai 原生 iOS 风格全面结构重构  
> **历史版本：** [v5](./design-tokens-v5.md) · [v4](./design-tokens-v4.md)（已归档）  
> **Ardot File:** `698461866257245` · **Page:** Master Board `47:1`

---

## 设计哲学

万叶 v6 采用 **扁平化设计（Flat Design）** 语言，以 **triply-ai** 原生 iOS App 为设计参考，强调以下核心理念：

| 原则 | 说明 |
|------|------|
| **扁平化设计** | 简单二维元素，摒弃复杂渐变与厚重阴影。色彩明亮清晰，强调可用性 |
| **卡片式布局** | 内容以卡片形式呈现，每张卡片作为独立的内容容器，清晰且视觉吸引 |
| **小圆角修饰** | 卡片 20px / 封面 24px / Hero 28px — 友好但不过分柔软 |
| **白色为主背景** | App 背景 `#FFFFFF` 纯白，中性色调文字，干净通透 |
| **简洁图标与导航** | SF Symbol 风格图标，原生 iOS Tab Bar，大标题模式 |
| **AI 渐变强调** | AI 元素保留紫蓝渐变（`#6BA5F8 → #3A6EDA`）作为品牌识别 |

---

## 1. Color

### Neutral（中性色 · 白色基底）

| Token | Hex | 用途 |
|-------|-----|------|
| `bg-app` | `#FFFFFF` | App 背景（纯白） |
| `bg-muted` | `#F1F3F7` | 返回按钮底、步进器、次要控件 |
| `bg-input` | `#F2F3F5` | 输入框底、清除按钮 |
| `bg-bubble-ai` | `#F1F2F4` | AI 消息气泡 |
| `ink` | `#0F1B2D` | 主文字（标题、卡片标题、正文） |
| `text-secondary` | `#8A94A6` | 副标题、占位符、卡片 footer |
| `text-tertiary` | `#5A6472` | 三级文字（行程摘要等） |
| `text-faint` | `#9AA2AF` | 输入占位、禁用文字 |
| `border` | `#E7EAF0` | 表单/详情卡片边框 |
| `border-profile` | `#EDEFF3` | 个人页卡片边框 |
| `divider` | `#F0F2F5` | 列表行间分隔（极淡） |

### Brand（品牌色）

| Token | Hex | 用途 |
|-------|-----|------|
| `primary` | `#2F6BE4` | 主链接色、激活态 tint |
| `primary-action` | `#3E7BF0` | 主按钮填充、chip 激活 |
| `chat-blue` | `#4388E7` | 用户消息气泡、发送按钮 |
| `hero-blue` | `#5B8DEF` | Hero 卡片渐变起、封面 fallback |
| `badge-bg` | `#E7F0FE` | 统计图标圆底、徽章底 |

### AI Gradient（AI 品牌渐变）

| Token | 值 | 用途 |
|-------|-----|------|
| `ai-gradient` | `#6BA5F8 → #3A6EDA` | AI 头像、AI 按钮、AI Hero 卡片 |

### Semantic

| Token | Hex | 用途 |
|-------|-----|------|
| `destructive` | `#E5484D` | 删除、注销、危险操作 |
| `star` | `#F5B942` | 评分星、鲜花 |
| `success` | `#2FA36B` | 成功、在线状态 |

---

## 2. Typography（Inter / PingFang SC）

> 全局字体 **Inter**，SF Pro 作为系统 fallback。大标题采用 `tracking-tight`。

| Token | Size / LH | Weight | Color | 用途 |
|-------|-----------|--------|-------|------|
| `large-title` | 36 / 40 | ExtraBold (800) | `ink` | Tab 根页大标题（探索/对话/动态/我的） |
| `hero-title` | 26 / 32 | ExtraBold | `#FFFFFF` | Hero 卡片标题、封面标题叠加 |
| `section-header` | 24 / 28 | ExtraBold | `ink` | 区段标题（热门想法、最新动态） |
| `card-title` | 17 / 22 | SemiBold (600) | `ink` | 卡片标题、会话标题 |
| `body` | 17 / 26 | Medium (500) | `ink` | 正文、设置行标签 |
| `subtitle` | 16 / 24 | Medium | `text-secondary` | 副标题、辅助说明 |
| `card-footer` | 15 / 22 | Medium | `text-secondary` | 卡片 footer、创建者信息 |
| `chat-body` | 15 / 21 | Medium/Regular | `ink` / `#1A2436` | 聊天消息（用户 Medium / AI Regular） |
| `caption` | 14 / 20 | Medium | `text-secondary` | 说明、辅助标签 |
| `badge` | 13 / 16 | SemiBold | `#FFFFFF` / `text-secondary` | 状态徽章、Tab 标签 |
| `tab-label` | 10 / 12 | Medium | `primary` / `text-secondary` | Tab Bar 标签 |

---

## 3. Spacing（4pt Grid）

| Token | px | 用途 |
|-------|-----|------|
| `screen-x` | **24** | Tab 根页水平边距（px-6） |
| `detail-x` | 20 | 详情页水平边距（px-5） |
| `card-pad` | 16 | 卡片内 padding（p-4） |
| `card-gap` | **20** | 卡片间距（mt-5） |
| `section-gap` | **32** | 大区段间距（mt-8） |
| `item-gap` | 16 | 列表项间距 |
| `chat-gap` | 14 | 聊天消息间距（mb-3.5） |
| `bottom-clear` | **120** | 内容底部 padding（清除 Tab Bar） |

**布局硬规则：**
- Tab 根页水平 padding = **24px** → 内容宽 **345px**
- 详情页水平 padding = **20px** → 内容宽 **353px**
- 卡片内 padding = **16px**
- 内容区底部 padding = **120px**（浮动 Tab Bar 高度 + safe area）

---

## 4. Radius

| Token | px | 用途 |
|-------|-----|------|
| `card` | **20** | 内容卡片（标准） |
| `card-hero` | **24** | 封面卡片（图片封面卡） |
| `card-large` | **28** | AI Hero 大卡片 |
| `input` | 16 | 输入框 |
| `pill` | **9999** | 所有按钮、chip（全圆角） |
| `avatar` | **9999** | 头像（圆形） |
| `icon-circle` | **9999** | 图标圆底 |

> **关键变化（v5→v6）：** v5 使用 8px 按钮圆角 + pill Tab；v6 全部按钮改为 **pill 全圆角**，卡片从 12px 提升到 **20px**。

---

## 5. Elevation（扁平化 · 极简阴影）

| Level | 样式 | 用途 |
|-------|------|------|
| **E0** | 无阴影 | 扁平按钮、chip、分割线 |
| **E1-card** | `0 8px 16px rgba(15,27,45,0.10)` | 内容卡片、封面卡片 |
| **E1-profile** | `0 6px 12px rgba(15,27,45,0.05)` | 个人资料卡片 |
| **E2-float** | `0 4px 16px rgba(15,27,45,0.15)` | Engagement Bar、Rate Modal |
| **E-tabbar** | 无阴影（顶部 1px border `#E7EAF0`） | 原生 Tab Bar |

> **关键变化（v5→v6）：** v5 的浮动 Tab Bar 使用厚重阴影 + 毛玻璃；v6 Tab Bar 改为 **原生 iOS 标准样式**（顶部细线分隔，无浮动阴影）。卡片阴影颜色从纯黑 `rgba(0,0,0,...)` 改为 **ink 色 `rgba(15,27,45,...)`**，与文字色统一。

---

## 6. 核心组件

| 组件 | 规格 | 说明 |
|------|------|------|
| `NativeTabBar` | 393×83 · edge-to-edge · 白底 95% | 原生 iOS Tab Bar（4 Tab，SF Symbol 图标 + 标签） |
| `IdeaCoverCard` | 345×~290 · r24 · 封面图 210h | 图片封面卡片（scrim + 标题叠加 + footer stats） |
| `PrimaryButton` | 200×56 · pill · `#3E7BF0` | 主按钮（全圆角，白字 17pt Bold） |
| `BackButton` | 36×36 · circle · `#F1F3F7` | 返回按钮（chevron-left 17pt） |
| `SendButton` | 52×52 · circle · `#4388E7` | 聊天发送 FAB（arrow-up 20pt） |
| `AIAvatar` | 50×50 · circle · ai-gradient | AI 头像（sparkles 图标） |
| `ChipActive` | h48 · pill · `#3E7BF0` | 激活 chip（白字 16pt SemiBold） |
| `ChipDefault` | h48 · pill · 白底 + `#E7EAF0` border | 默认 chip（`#8A94A6` 字 16pt SemiBold） |
| `SettingsRow` | 345×~54 · px-16 py-16 | 设置行（图标 22pt 无圆底 + 标签 17pt + chevron 15pt） |
| `LargeTitle` | 36pt ExtraBold · tracking-tight | Tab 根页大标题 |
| `AIHeroCard` | 345×~160 · r28 · 渐变 | AI 引导卡片（渐变底 + 标题 + 白色 pill CTA） |
| `ProfileCard` | 345×~200 · r20 · border `#EDEFF3` | 个人资料卡片（头像 72px + 统计行） |

---

## 7. Navigation · 导航架构（v6 重构）

### 7.1 Tab 根页 — 大标题模式

Tab 根页（Home / Chat List / Activity / Profile）**无 top toolbar**，采用 iOS 大标题模式：

```
┌──────────────────────────────────┐
│ StatusBar 62px                    │
├──────────────────────────────────┤
│  ← 24px padding →                 │
│  副标题 15pt Medium #8A94A6       │
│  大标题 36pt ExtraBold #0F1B2D     │
│  marginTop: 8px                   │
│                                  │
│  [Content cards / lists...]      │
│  paddingBottom: 120px            │
├──────────────────────────────────┤
│ NativeTabBar 83px (49 + 34 safe) │
└──────────────────────────────────┘
```

- 标题区域右侧放 **40×40 圆形操作按钮**（铃铛 / 设置），底色 `#F1F3F7`
- 无返回按钮

### 7.2 Push 子页 — 返回导航栏

Push 子页（Idea Detail / Settings / Search / Comments）使用 **48px 导航栏**：

```
┌──────────────────────────────────┐
│ StatusBar 62px                    │
├──────────────────────────────────┤
│ [‹ 36px circle]  标题 20pt Bold  │
│  #F1F3F7 bg      居中             │
├──────────────────────────────────┤
│  [Content...]                    │
│  paddingBottom: 40px (无 Tab Bar) │
└──────────────────────────────────┘
```

- 返回按钮：36×36 圆形，bg `#F1F3F7`，chevron-left 17pt `#0F1B2D`
- 标题：20pt Bold，居中
- **无 Tab Bar**（Push 子页隐藏 Tab Bar）

### 7.3 封面页 — 透明浮层导航

封面页（Idea Detail / Agent Profile）返回按钮浮于封面图上：

- 返回按钮：**44×44 白色圆形**，浮于封面图左上角
- 右侧操作：fork / share（44×44 白色圆形）

---

## 8. NativeTabBar · 原生 iOS Tab Bar（v6 核心）

### 规格

| 属性 | 值 |
|------|-----|
| **容器** | 393×83px（49pt bar + 34pt safe area） |
| **布局** | HORIZONTAL · SPACE_EVENLY · edge-to-edge |
| **背景** | 白色 95% opacity `rgba(255,255,255,0.95)` |
| **顶部分隔** | 1px border `#E7EAF0` |
| **Tab 数量** | 4 |
| **Tab 宽度** | 98.25px（等分） |
| **Tab 高度** | 49px（+ 34px safe area 底部留白） |
| **图标** | SF Symbol 风格 · 26×26px |
| **标签** | 10pt Medium |
| **激活态** | 图标 `.fill` 变体 + `#2F6BE4` 蓝色 tint · 标签也蓝色 |
| **非激活态** | 灰色 `#8A94A6` |

### Tab 项

| Tab | 标签 | 图标（激活） | 图标（非激活） | 根页面 |
|-----|------|-------------|---------------|--------|
| 1 | 探索 | `house.fill` 蓝 | `house` 灰 | S02 Home |
| 2 | 对话 | `sparkles` 蓝 | `sparkles` 灰 | S06 Chat List |
| 3 | 动态 | `bell.fill` 蓝 | `bell` 灰 | S08 Activity |
| 4 | 我的 | `person.fill` 蓝 | `person` 灰 | S09 Profile |

### 一致性规则

- **4 个 Tab 根页** 必须全部显示 NativeTabBar，结构完全一致
- 每个根页仅 **激活的 Tab 不同**，其余结构相同
- **Push 子页** 隐藏 Tab Bar（无 Tab Bar 覆盖）
- Tab Bar 使用真实 FRAME 构建（非 component instance），确保各页独立可控

---

## 9. IdeaCoverCard · 图片封面卡片（v6 新增）

### 规格

| 属性 | 值 |
|------|-----|
| **宽度** | 345px（fill_container） |
| **圆角** | 24px |
| **封面图** | 345×210px，stock 或 AI 生成图片 |
| **scrim** | 底部 120px 渐变 `transparent → rgba(0,0,0,0.55)` |
| **标题** | 26pt ExtraBold 白色，叠加于 scrim 上 |
| **状态 badge** | pill · `rgba(0,0,0,0.45)` 底 · 13pt SemiBold 白字 |
| **footer** | px-16 py-14 · 创建者头像 28px + 信息 15pt + stats 行 |
| **stats** | fork 12pt + heart 12pt + comment 12pt · 图标 16px · `#8A94A6` |
| **阴影** | `0 8px 16px rgba(15,27,45,0.10)` |
| **边框** | 无 |
| **卡片间距** | 20px（mt-5） |

---

## 10. 屏幕清单（v6 · 已重构）

### ✅ 已完成 v6 重构（8 屏）

| ID | Frame | 屏幕 | 关键变更 |
|----|-------|------|---------|
| DS | `138:33` | Design System v6 | 全新色彩/字体/组件/图标系统 |
| S01 | `138:165` | Login | 深色背景 + pill 按钮 + OAuth 行 |
| S02 | `138:228` | Home | 大标题 + AI Hero + 封面卡片 Feed + 原生 Tab |
| S04 | `138:334` | Idea Detail | 封面图 + 透明返回 + Engagement Bar |
| S06 | `138:474` | Chat List | 大标题 + AI 助手 Hero + 会话卡片 |
| S07 | `138:524` | Chat Thread | AI 头像导航 + 蓝/灰气泡 + 发送 FAB |
| S09 | `138:637` | Profile | 个人卡片 + 统计行 + 想法列表 |
| S11 | `138:796` | Settings | 返回导航 + 分组卡片 + 设置行 |

### 🔄 已更新令牌（未完全重构）

| ID | Frame | 屏幕 | 更新内容 |
|----|-------|------|---------|
| S03 | `138:279` | Search | 白色背景 + 令牌更新 |
| S05 | `138:418` | Comments | 白色背景 + 令牌更新 |
| S08 | `138:588` | Activity | 白色背景 + 原生 Tab Bar |
| S10 | `138:716` | Agent Profile | 白色背景 + 令牌更新 |
| S12–S28 | — | 合规/状态页 | 白色背景 + 令牌更新 |
| S09b | `138:1873` | Other User Profile | 白色背景 + 令牌更新 |

---

## 11. 变更日志（v5 → v6）

### 破坏性变更（Breaking Changes）

| 变更项 | v5 | v6 |
|--------|----|----|
| **App 背景** | `#FAFAFA` 灰 | `#FFFFFF` 纯白 |
| **主文字色** | `#0A0A0A` 纯黑 | `#0F1B2D` 深蓝黑（ink） |
| **次文字色** | `#8E8E93` | `#8A94A6` |
| **主色** | `#0A0A0A`（黑 CTA） | `#2F6BE4`（蓝） |
| **Tab Bar** | 浮动 pill（H62, R36, 距底12, 毛玻璃） | **原生 iOS**（H83, edge-to-edge, 顶部线分隔） |
| **Tab 激活态** | 黑色 pill 填充 | 蓝色 tint（图标 `.fill` + 标签蓝） |
| **按钮圆角** | 8px 矩形 | **pill 全圆角** |
| **卡片圆角** | 12-16px | **20-24px** |
| **卡片边框** | 无（仅阴影） | `#E7EAF0` 1px border + 阴影 |
| **导航模式** | Toolbar（标题左 + 操作右） | **大标题模式**（36pt ExtraBold 内嵌） |
| **Feed 卡片** | 纯文字卡（tint band + 文字） | **图片封面卡**（210px 封面图 + scrim 标题） |
| **阴影颜色** | `rgba(0,0,0,...)` 纯黑 | `rgba(15,27,45,...)` ink 色 |
| **图标风格** | 自定义 SVG（18-28pt） | SF Symbol 风格（12-26pt） |
| **间距系统** | page-x=16 | **screen-x=24** |

### 新增

- `IdeaCoverCard` 图片封面卡片组件
- `AIHeroCard` AI 引导渐变卡片
- `NativeTabBar` 原生 iOS Tab Bar
- SF Symbol 风格图标集（14 个）
- 大标题导航模式（Large Title Mode）
- Push 子页返回按钮（36px 灰色圆）
- 封面页透明浮层导航（44px 白色圆）

### 移除

- `PillTabBar` 浮动毛玻璃 Tab Bar
- `RelationshipTriangle` 三角关系组件
- `EntityBentoCard` Bento 实体卡
- Pastel 实体色（`entity-user/agent/idea`）
- 黑色主按钮 CTA
- `TabScreenHeader` 工具栏式顶栏
