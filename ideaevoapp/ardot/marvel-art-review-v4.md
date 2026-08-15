# Marvel Art V4.0 · Ardot 设计文稿合规评审

**评审日期：** 2026-07-07（第三轮 · 六段式补全）  
**基准：** `.cursor/skills/marvel-art` (Mobile UI Compiler V4.0)  
**范围：** `ideaevoapp/ardot/` 全部规格

---

## 评审结论

| 维度 | 状态 |
|------|------|
| Marvel 标记 | ✅ 43/43 `screens/*.md` |
| ASCII Wireframe | ✅ 43/43 |
| 状态机矩阵 | ✅ 43/43（Legacy 指向主 spec） |
| Swift 伪代码 | ✅ 43/43 |
| 动效物理参数 | ✅ 43/43 |
| 字阶 17/22pt | ✅ |
| 触控 44×44 | ✅ |
| 1D 流 / 禁 Grid | ✅ |
| 双重空状态 | ✅ `12-states.md` |
| DS 组件索引 | ✅ `design-tokens-v5.md` §9 |

**文稿侧 Marvel V4.0 六段式已 100% 闭合。**

---

## 第三轮更新清单

| 文档 | 更新 |
|------|------|
| `01-login` · `01-register` | §6 Swift 伪代码 |
| `04-publish` · `04d-fork` · `04e-owner-edit` | §4–6 动效/空态/Swift |
| `04-flowers-grid` | 区块标题 14pt→**15pt** |
| `06c-agent-picker` | 空态 + Swift |
| `10-agent-profile` · `13-agent-explore` | §4–6 |
| `11-settings` · `11-settings-subpages` | §5–6 |
| `14-agent-editor` | §4–6 |
| `00-idea-identity` · `00-ideahub-ia` · `00-triangle` | §2–6 原则类补全 |
| `00-navigation-ia` | §7 导航 Swift 骨架 |
| `12-states` | §4 动效 + §6 EmptyState Swift |
| `10-gap` · `11-app-store` · API 映射 · Legacy | 状态/动效/Swift 引用闭合 |
| `design-tokens-v5` | **§9 组件 Marvel 合规索引** |

---

## 后续待办（画板 / iOS）

（iOS Marvel V4.0 字阶扫尾已完成；后续按新功能增量对齐。）

---

## 文档索引

**Token：** [design-tokens-v5.md](./design-tokens-v5.md) §8–§9 · [tokens/profile-float.md](./tokens/profile-float.md)  
**入口：** [README.md](./README.md)  
**画板脚本：** [ardot-v4-batch-operations.md](./ardot-v4-batch-operations.md)

**Legacy：**
- `01-discover` → `02-home` · `01-auth` → `01-login`/`01-register` · `08-notifications` → `08n-notifications`

---

## 画板同步（2026-07-07 · Ardot MCP）

| 任务 | 状态 |
|------|------|
| DS `134:1` Marvel Compiler | ✅ |
| Flowers `93:1671` H-Scroll + 去 4×2 Grid | ✅ |
| Toolbar 全文件实例 Hit 44 | ✅ |
| Notifications `93:972` chips + row 64 | ✅ |
| Feed / Home 字阶 22/17pt | ✅ `93:927` `93:944` |
| Home `+` Hit 56 / Bell 44 | ✅ `93:933` `93:931` |
| Activity 扁平 V-Stack + 17pt | ✅ `93:952` |
| Settings 行 17pt / minH 56 | ✅ `93:1074` |
| Agent Profile / Comments 17pt | ✅ `93:868` `93:991` |
| Sheet zoom 原型 | ✅ `93:1206` Fork Sheet Zoom · `134:108` Motion Spec |
| Chat List 扁平 V-Stack | ✅ `93:1013` |
| Auth/Bury Sheet Zoom | ✅ `93:1196` `93:1221` |
| Sheet TitleRow 三栏 | ✅ 全 Sheet 换用 `C/SheetTitleRow` `134:418` 实例 |
| Sheet zoom 背景 | ✅ Rename/Report 补 scale 0.95 · dim 0.4 |
| Report chips H-Scroll | ✅ `93:1871` clipsContent + peek 15% |
| Dialog 17pt + dim 0.4 | ✅ Delete · Block User · `C/Dialog` `134:298` |
| DS Sheet/Dialog 组件 | ✅ `134:418` `134:297` `134:298` |
| iOS 实现对齐 | ✅ 全量：Toolbar 44 · Sheet zoom/TitleRow · Feed/Detail/Publish 17·22pt · 扁平行 |

截图：`.ardot-cache/marvel-v4-canvas/`
