# 万叶 iOS — Ardot 设计稿 v6

> **当前版本：** v6 · triply-ai 原生 iOS 风格（扁平 · 卡片 · 清爽）  
> **历史版本：** [v5](./design-tokens-v5.md) · [v4](./design-tokens-v4.md)（已归档）

**File ID:** `698461866257245` · **Page:** Master Board `47:1`

## 设计风格

| 原则 | 说明 |
|------|------|
| **扁平化设计** | 简单二维元素，摒弃复杂渐变与厚重阴影 |
| **卡片式布局** | 内容以卡片形式呈现，每张卡片为独立内容容器 |
| **小圆角修饰** | 卡片 20px / 封面 24px / Hero 28px |
| **白色为主背景** | `#FFFFFF` 纯白，中性色调文字 |
| **简洁图标与导航** | SF Symbol 风格，原生 iOS Tab Bar，大标题模式 |

→ 完整令牌文档：[design-tokens-v6.md](./design-tokens-v6.md)

## 布局常量（v6）

| Token | 值 | 说明 |
|-------|-----|------|
| `screen-x` | **24px** | Tab 根页水平边距 |
| `detail-x` | **20px** | 详情页水平边距 |
| `card-pad` | **16px** | 卡片内 padding |
| `card-gap` | **20px** | 卡片间距 |
| `section-gap` | **32px** | 大区段间距 |
| `bottom-clear` | **120px** | 内容底部 padding（清除 Tab Bar） |

## 屏幕清单（完整）

### 系统 & 组件
| ID | Frame | 名称 |
|----|-------|------|
| DS | `93:713` | Design System v5 |
| C | `93:747` | C/RelationshipTriangle |
| C | `93:1789` | C/PillTabBar · 全局 4 Tab |
| C | `109:152`+ | C/ToolbarFloat · Visual 36 · **HitTarget 44×44** |
| C | `129:18` | C/IdeaIdentityHero · 头像+创建者+时间+stats |
| C | `129:41` | C/IdeaCardHero · Feed tint 顶栏 |
| C | `129:62`+ | C/IdeaAvatar · 32/48/56 |
| C | `129:86` | C/IdeaSearchCard · 搜索 Idea 行 |
| C | `93:957` | C/ActivityRepoEvent · 协作事件行 |
| C | `129:155` | C/IdeaContextBar · Comments/Flowers 上下文 |
| C | `93:865` | C/IdeaCardCompact · Profile/Guest 紧凑卡片 |
| C | `129:235` | C/IdeaPublishIdentity · 发布头像+slug |
| C | `93:921` | C/IdeaChatCard · Chat Idea 推荐 |
| C | `93:2046` | C/IdeaChatCTA · 带着 Idea 问 Agent |
| C | `93:1212` | C/IdeaForkSource · Fork Sheet 原想法卡 |
| C | `129:287` | C/FlowerContributorRow · 送花者明细行 |
| C | `129:299` | C/IdeaMenuHeader · Action Menu 迷你身份 |
| C | `134:418` | C/SheetTitleRow · Close44 · Title 17 Bold · Check/Spacer44 |
| C | `134:297` | C/SheetHandle · 40×4 r2 `#EBEBEB` |
| C | `134:298` | C/Dialog · r20 · Title/Body 17pt · btn minH44 |
| IA | `129:2` | S00 IdeaHub IA · GitHub for Ideas 原则 |

### Tab 主路径（4 Tab）
| ID | Frame | 名称 |
|----|-------|------|
| S02 | `93:927` | Home · 广场/关注 + 搜索 |
| S08 | `93:952` | Activity · 全局动态 |
| S06 | `93:1013` | Chat List · 对话列表 |
| S09 | `93:1049` | Profile · 我的 |

### Idea 链路
| ID | Frame | 名称 |
|----|-------|------|
| S04 | `93:759` | Idea Detail |
| S05 | `93:991` | Comments |
| S04P | `93:1123` | Publish Idea |
| S04D | `93:1136` | Fork 谱系 |

### User / Agent
| ID | Frame | 名称 |
|----|-------|------|
| S09B | `93:833` | User Profile（他人） |
| S09C | `93:1151` | 粉丝/关注列表 |
| S10 | `93:868` | Agent Profile |
| S13 | `93:1111` | Agent Explore |
| S14B | `93:1093` | My Agents |

### Chat
| ID | Frame | 名称 |
|----|-------|------|
| S03 | `93:904` | Chat Thread · 万叶助手 |
| S03S | `93:1170` | Search Results |

### Auth & 设置
| ID | Frame | 名称 |
|----|-------|------|
| S01 | `93:1035` | Login |
| S01R | `93:1358` | Register |
| S01C | `93:1185` | Forgot Password |
| S08N | `93:972` | Notifications |
| S11 | `93:1074` | Settings |
| S11F | `93:1262` | About 火卫二 |

### Sheets & Dialogs（Row 4）
| ID | Frame | 名称 |
|----|-------|------|
| S12A | `93:1196` | Auth Sheet Zoom（scale 0.95 + dim 0.4） |
| S12F | `93:1206` | Fork Sheet Zoom（scale 0.95 + dim 0.4 原型） |
| S12B | `93:1221` | Bury Sheet Zoom |
| S12D | `93:1233` | Delete Account Dialog |
| S06C | `93:1242` | Agent Picker |

### States & Empty（Row 5）
| ID | Frame | 名称 |
|----|-------|------|
| S02L | `93:1279` | Home Loading Skeleton |
| S02E | `93:1305` | Home Empty |
| S02O | `93:1376` | Home Offline |
| S12T | `93:1317` | Toast（Success / Error） |
| S03E | `93:1324` | Search Empty |
| S09CE | `93:1335` | Following Empty |
| S14BE | `93:1348` | My Agents Empty |

### Editor & Settings（Row 6）
| ID | Frame | 名称 |
|----|-------|------|
| S14 | `93:1393` | Agent Editor |
| S14N | `93:1612` | Create Agent |
| S04E | `93:1422` | Idea Owner Edit |
| S11E | `93:1450` | Edit Profile |
| S11A | `93:1471` | Account Security |
| S11N | `93:1494` | Notification Prefs |
| S11L | `93:1517` | Legal & Privacy |
| S03F | `93:1535` | Chat Feedback |
| S06E | `93:1556` | Chat Empty |

### More States（Row 7）
| ID | Frame | 名称 |
|----|-------|------|
| S08F | `93:1567` | Following Login Prompt |
| S11P | `93:1581` | App Preferences |
| S04V | `93:1590` | Version Compare |
| S12G | `93:1603` | Delete Agent Dialog |

### Detail & Sheets（Row 8）
| ID | Frame | 名称 |
|----|-------|------|
| S11PH | `93:1631` | Phone Bind Sheet |
| S08E | `93:1646` | Activity Empty |
| S04F | `93:1671` | Flowers 送花者（H-Scroll + V-Stack） |

### Tab Bar & App Store（Row 9 · y=7172）
| ID | Frame | 名称 |
|----|-------|------|
| S00 | `93:1805` | Tab IA · 显示规则与映射 |
| S02G | `93:1905` | Guest Browse · 未登录首页 |
| S11P | `93:1818` | Privacy Policy |
| S11T | `93:1834` | Terms of Service |
| S11G | `93:1850` | Community Guidelines |
| S11S | `93:1893` | Contact Support |
| S12R | `93:1865` | Report Content Sheet Zoom |
| S12BU | `93:1884` | Block User Dialog Marvel |
| S04M | `93:1940` | Idea Action Menu (举报/拉黑) · `C/IdeaMenuHeader` |

### iOS 缺口补全（Row 10 · y=8036）
| ID | Frame | 名称 |
|----|-------|------|
| S08A | `93:1951` | Activity Full · 统计+排行+筛选 |
| S06RN | `93:1994` | Chat Rename Sheet Zoom |
| S06DL | `93:2003` | Delete Session Dialog |
| S01V | `93:2012` | Verify Email Link Sheet |
| S01RL | `93:2020` | Reset Password Link Sheet |
| S11WX | `93:2031` | WeChat OAuth Phone Bind |
| S04CTA | `93:2044` | Idea Chat CTA 组件 |
| S04SIM | `93:2052` | Similar Ideas Warning |
| S09M | `93:2063` | User Action Menu |
| S14AK | `93:2074` | API Key Reveal Sheet |
| S00L | `93:2084` | App Bootstrap Loading |
| S08NE | `93:2088` | Notifications Empty |
| S05E | `93:2096` | Comments Empty |
| S11BL | `93:2108` | Blocklist 黑名单 |

## 信息架构

```
Tab: 首页(S02) | 对话(S06) | 动态(S08) | 我的(S09)
  ├─ Idea 详情(S04) → 评论(S05) / Fork 谱系(S04D)
  ├─ Agent 主页(S10) / 发现 Agent(S13)
  ├─ 用户主页(S09B) → 粉丝(S09C)
  ├─ 聊天(S03) ← 对话列表(S06)
  ├─ 通知(S08N)
  └─ 设置(S11) / 我的 Agents(S14B) / 发布(S04P)
```

## 规格文档

### v6 当前版本（triply-ai 风格）

→ **[design-tokens-v6.md](./design-tokens-v6.md)** · 当前令牌系统  
→ [00 Tab Bar](./screens/00-tab-bar.md) · NativeTabBar 原生 iOS  
→ [00 Navigation IA](./screens/00-navigation-ia.md) · 大标题模式 + 返回导航栏

### v5/v4 历史版本（已归档）

→ [design-tokens-v5.md](./design-tokens-v5.md) · v5 PillTabBar + Bento  
→ [design-tokens-v4.md](./design-tokens-v4.md) · v4 原始版本  
→ [Marvel Art V4.0 评审](./marvel-art-review-v4.md) · 移动端编译器合规
→ [00 三角原则](./screens/00-triangle-principle.md)  
→ [00 IdeaHub IA](./screens/00-ideahub-ia.md) · **GitHub for Ideas**  
→ [00 Idea Identity](./screens/00-idea-identity.md) · **头像 / 创建者 / Tint**

| 分类 | 文档 |
|------|------|
| **Marvel V4.0** | [合规评审](./marvel-art-review-v4.md) · [Token §8](./design-tokens-v5.md#8-marvel-art-v40--mobile-compiler-对齐) · [组件 §9](./design-tokens-v5.md#9-组件-marvel-v40-合规索引) |
| Tab 主路径 | [S02 Home](./screens/02-home.md) · [S06 Chat List](./screens/06-chat-list.md) · [S08 Activity](./screens/08-activity.md) · [S09 Profile](./screens/09-profile.md) |
| Idea | [S04 Detail](./screens/04-idea-detail.md) · [S04 Flowers](./screens/04-flowers-grid.md) · [S05 Comments](./screens/05-comments.md) · [Publish](./screens/04-publish-idea.md) · [Fork 谱系](./screens/04d-fork-lineage.md) |
| User/Agent | [S09B User](./screens/09b-user-profile.md) · [S09C Follow](./screens/09c-follow-list.md) · [S10 Agent](./screens/10-agent-profile.md) · [S13 Explore](./screens/13-agent-explore.md) · [S14B My Agents](./screens/14b-my-agents.md) |
| Chat/Search | [S03 Chat](./screens/03-chat.md) · [S07 Thread](./screens/07-chat-thread.md) · [S03 Search](./screens/03-search.md) · [S03 Results](./screens/03-search-results.md) |
| Auth/设置 | [S01 Login](./screens/01-login.md) · [S01 Register](./screens/01-register.md) · [S01C Forgot](./screens/01c-forgot-password.md) · [S08N Notifications](./screens/08n-notifications.md) · [S11 Settings](./screens/11-settings.md) · [S11 子页](./screens/11-settings-subpages.md) · [S11F About](./screens/11f-about.md) |
| Editor | [S14 Agent Editor](./screens/14-agent-editor.md) · [S04E Owner Edit](./screens/04e-idea-owner-edit.md) |
| Sheets/弹窗 | [S12 Popups](./screens/12-popups.md) · [S06C Agent Picker](./screens/06c-agent-picker.md) · [Phone Bind](./screens/11-phone-bind-sheet.md) |
| 状态/空态 | [S12 States](./screens/12-states.md) |
| IA / 原则 | [IdeaHub IA](./screens/00-ideahub-ia.md) · [三角原则](./screens/00-triangle-principle.md) · [导航 IA](./screens/00-navigation-ia.md) |
| 合规/缺口 | [App Store](./screens/11-app-store-compliance.md) · [Gap Completion](./screens/10-gap-completion.md) · [API 映射](./screens/10-agent-profile-api-mapping.md) |
| Tab Bar | [00 Tab Bar](./screens/00-tab-bar.md) |
