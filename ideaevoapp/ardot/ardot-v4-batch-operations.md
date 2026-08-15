# Ardot v5 batch_edit 操作脚本（Marvel V4.0）

> Ardot MCP 已可用（2026-07-07 验证）。在 Ardot 插件可编辑模式下执行 `batch_edit`。  
> **文稿基准：** [marvel-art-review-v4.md](./marvel-art-review-v4.md) · [design-tokens-v5.md](./design-tokens-v5.md) §8

**File ID:** `698461866257245`  
**Page:** `47:1` Master Board

---

## Priority A — Marvel V4.0 画板对齐（2026-07）

**状态（2026-07-07）：** A1–A18 已在画板执行

| 任务 | Frame | 状态 |
|------|-------|------|
| A1 DS Mobile Compiler | `93:713` → `134:1` | ✅ 已追加 Typography/Touch/Layout/Motion |
| A2 Flowers H-Scroll | `93:1671` | ✅ `93:1683` 改 H-Scroll · 重命名 S04 Flowers v5 |
| A3 Toolbar Hit 44 | `109:152` · `109:13` | ✅ 全文件 ToolbarFloat 实例已扫（Icon/Text/Back → 44） |
| A4 Notifications | `93:972` | ✅ Filter chips · 行高 64 · 标题 17pt |
| A5 Feed 字阶 | `93:944` · `93:927` | ✅ 标题 22pt · 卡片 17pt · 重命名 IdeaFeedCard |
| A6 Home `+` 56 | `93:933` · `93:931` | ✅ Plus Hit 56 · Bell Hit 44 |
| A7 Activity 扁平列表 | `93:952` | ✅ 标题 22pt · 正文 17pt · 去卡片阴影 · Divider |
| A8 Settings 字阶 | `93:1074` | ✅ 行 17pt · minH 56 |
| A9 Agent / Comments | `93:868` · `93:991` | ✅ 正文 17pt · Send Hit 44 · Agent 名 22pt |
| A10 Sheet Zoom 原型 | `93:1206` · `134:108` | ✅ Root 95% + Dim 0.4 · Handle 40×4 · Close 44 |
| A11 次要屏字阶 | `93:1013` · `93:1111` · `93:1151` | ✅ 22/17/15/13pt · SessionRow/AgentRow |
| A12 列表扁平化 | `93:1013` · `93:1111` · `93:1151` | ✅ 去卡片阴影 · Divider #EBEBEB |
| A13 Auth/Bury Zoom | `93:1196` · `93:1221` | ✅ Root 95% + Dim 0.4 · Handle 40×4 · 17pt |
| A14 Sheet TitleRow | `93:1208` · `93:1198` · `93:1223` · `93:1633` | ✅ X Hit44 · Title 17pt Bold · Check/Spacer 44 |
| A15 Dialog 字阶 | `93:1233` · `93:1603` · `93:1631` | ✅ Body 17pt · dim 0.4 · minH 44 |
| A16 剩余 Sheet/Dialog | `93:1994` · `93:1865` · `93:1884` | ✅ TitleRow · 17pt · dim 0.4 |
| A17 DS 组件化 | `134:418` · `134:297` · `134:298` | ✅ C/SheetTitleRow · C/SheetHandle · C/Dialog |
| A18 Sheet 实例化 | 全 Sheet TitleRow + Rename/Report zoom | ✅ `134:418` ref · H-Scroll chips |

截图：`.ardot-cache/marvel-v4-canvas/`

### A1 — DS `93:713` 增加 Mobile Compiler 区块

在 Design System 帧底部追加：

| 行 | 内容 |
|----|------|
| Typography | 34 / **22 Bold** / **17 Regular** / 15 / 13 |
| Touch | 44×44 框示意 · Toolbar visual 36 + hit 44 |
| Layout | V-Stack · H-Scroll peek 15% · 禁 Grid |
| Motion | scale 0.95 + dim 0.4 · parallax 35% · Handle 40×4 |

### A2 — Flowers `93:1671` 去 Grid → H-Scroll

```
D(<8-col-grid-node>)
hScroll=I("93:1671", {layout: "horizontal", gap: 12, clip: true})
// 每项 C/FlowerContributorRow minH 64 · peek 15% 下一项
```

规格见 [screens/04-flowers-grid.md](./screens/04-flowers-grid.md)

### A3 — Toolbar `109:152` Hit 框 44×44

对每个 `C/ToolbarFloat` 实例：

```
hitBox=I(<toolbar-parent>, {width: 44, height: 44, name: "HitTarget 44", opacity: 0})
// 视觉 icon 保持 36×36 居中
```

### A4 — Notifications `93:972` Filter Chips

```
chipRow=I("93:972", {layout: "horizontal", gap: 8, scroll: true})
// Chip minH 36 · paddingH 12 · 选中 fill #111 字 #FFF
// 列表行 minH 64 · 17pt 主文 · Divider #E5E5E5
```

---

## Priority B — v4 历史脚本（RelationshipTriangle 等）

> 以下 Step 1–6 为早期 v4 批量复制脚本，节点 ID 可能已变；执行前 `batch_read` 确认。


## Step 1 — 定位空白（每屏前调用）

```
locate_available_space(nodeId: "93:275", direction: "right", width: 420, height: 900, padding: 120)
```

---

## Step 2 — 新建 RelationshipTriangle 组件

```javascript
tri=I("47:1", {type: "component", name: "C/RelationshipTriangle", layout: "horizontal", width: 350, height: 88, gap: 8, padding: 12, cornerRadius: 24, x: 4200, y: 13700, fill: "#FFFFFF", strokes: [{type: "SOLID", color: {r: 0.92, g: 0.92, b: 0.92}, opacity: 1, visible: true, blendMode: "NORMAL"}], strokeWeight: 1})
userCell=I(tri, {type: "frame", name: "User Cell", layout: "vertical", width: "fill_container", height: "fill_container", gap: 4, padding: 10, cornerRadius: 16, fill: "#FFF4A8", counterAxisAlignItems: "MIN"})
userLbl=I(userCell, {type: "text", name: "User Label", content: "User", fontSize: 10, fill: "#3D3D3D", fontName: {family: "Inter", style: "Medium"}})
userName=I(userCell, {type: "text", name: "User Name", content: "张三", fontSize: 13, fill: "#0A0A0A", fontName: {family: "Inter", style: "SemiBold"}})
arrow1=I(tri, {type: "text", name: "Arrow 1", content: "→", fontSize: 16, fill: "#0A0A0A", fontName: {family: "Inter", style: "Regular"}})
agentCell=I(tri, {type: "frame", name: "Agent Cell", layout: "vertical", width: "fill_container", height: "fill_container", gap: 4, padding: 10, cornerRadius: 16, fill: "#D4F56A", counterAxisAlignItems: "MIN"})
agentLbl=I(agentCell, {type: "text", name: "Agent Label", content: "Agent", fontSize: 10, fill: "#3D3D3D", fontName: {family: "Inter", style: "Medium"}})
agentName=I(agentCell, {type: "text", name: "Agent Name", content: "万叶助手", fontSize: 13, fill: "#0A0A0A", fontName: {family: "Inter", style: "SemiBold"}})
arrow2=I(tri, {type: "text", name: "Arrow 2", content: "→", fontSize: 16, fill: "#0A0A0A", fontName: {family: "Inter", style: "Regular"}})
ideaCell=I(tri, {type: "frame", name: "Idea Cell", layout: "vertical", width: "fill_container", height: "fill_container", gap: 4, padding: 10, cornerRadius: 16, fill: "#B8F5EC", counterAxisAlignItems: "MIN"})
ideaLbl=I(ideaCell, {type: "text", name: "Idea Label", content: "Idea", fontSize: 10, fill: "#3D3D3D", fontName: {family: "Inter", style: "Medium"}})
ideaTitle=I(ideaCell, {type: "text", name: "Idea Title", content: "智能家居能源管理", fontSize: 13, fill: "#0A0A0A", fontName: {family: "Inter", style: "SemiBold"}, textAutoResize: "HEIGHT", width: "fill_container"})
```

---

## Step 3 — Copy Idea Detail v4

```javascript
ideaV4=C("93:213", "47:1", {name: "S04 Idea Detail v4", positionDirection: "right", positionPadding: 120, x: 4100, y: 48})
D(ideaV4+"93:315")
triInst=I(ideaV4+"93:216", {type: "ref", ref: "<RelationshipTriangle组件ID>", width: "fill_container", name: "Relationship Triangle"})
M(triInst, ideaV4+"93:216", 2)
prog=I(ideaV4+"93:216", {type: "frame", name: "Implementation Progress", layout: "vertical", width: "fill_container", height: 48, gap: 8, padding: 12, cornerRadius: 16, fill: "#FFFFFF", strokes: [{type: "SOLID", color: {r: 0.92, g: 0.92, b: 0.92}, opacity: 1, visible: true, blendMode: "NORMAL"}], strokeWeight: 1})
progLbl=I(prog, {type: "text", name: "Progress Label", content: "实现进度 42%", fontSize: 13, fill: "#0A0A0A", fontName: {family: "Inter", style: "Medium"}})
progBar=I(prog, {type: "frame", name: "Progress Bar", layout: "horizontal", width: "fill_container", height: 6, cornerRadius: 3, fill: "#EBEBEB"})
progFill=I(progBar, {type: "frame", name: "Progress Fill", width: 147, height: 6, cornerRadius: 3, fill: "#3D9970"})
forkCta=I(ideaV4+"93:216", {type: "frame", name: "Fork CTA Bento", layout: "vertical", width: "fill_container", gap: 8, padding: 16, cornerRadius: 28, fill: "#B8F5EC"})
forkTitle=I(forkCta, {type: "text", name: "Fork Title", content: "Fork 此想法，继续实现", fontSize: 18, fill: "#0A0A0A", fontName: {family: "Inter", style: "Bold"}})
forkBtn=I(forkCta, {type: "frame", name: "Fork Pill", layout: "horizontal", paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, cornerRadius: 999, strokes: [{type: "SOLID", color: {r: 0.04, g: 0.04, b: 0.04}, opacity: 1, visible: true, blendMode: "NORMAL"}], strokeWeight: 1})
forkBtnTxt=I(forkBtn, {type: "text", name: "Fork Btn Text", content: "开始 Fork →", fontSize: 14, fill: "#0A0A0A", fontName: {family: "Inter", style: "SemiBold"}})
U(ideaV4, {fill: "#FAFAFA"})
```

> 注意：`ref` 需替换为 Step 2 返回的实际组件 ID。Copy 后子节点 ID 会变，Provenance Card 删除请用 `batch_read` 确认新 ID。

---

## Step 4 — Copy User Profile v4

```javascript
userV4=C("93:275", "47:1", {name: "S09B User Profile v4", positionDirection: "right", positionPadding: 120})
U(userV4+"93:340", {fill: "#FFF4A8"})
hint=I(userV4+"93:278", {type: "frame", name: "Triangle Hint", layout: "horizontal", width: "fill_container", height: 40, paddingLeft: 20, paddingRight: 20, cornerRadius: 12, fill: "#FFF4A8", counterAxisAlignItems: "CENTER"})
hintTxt=I(hint, {type: "text", name: "Hint Text", content: "你拥有 3 个 Agent · 已发布 12 个 Idea", fontSize: 13, fill: "#0A0A0A", fontName: {family: "Inter", style: "Medium"}})
```

---

## Step 5 — Copy Agent Profile v4

```javascript
agentV4=C("93:121", "47:1", {name: "S10 Agent Profile Float v4", positionDirection: "right", positionPadding: 120})
U(agentV4+"93:129", {fill: "#D4F56A"})
owner=I(agentV4+"93:123", {type: "frame", name: "Owner Row", layout: "horizontal", width: "fill_container", gap: 8, paddingLeft: 16, paddingRight: 16, counterAxisAlignItems: "CENTER"})
ownerTxt=I(owner, {type: "text", name: "Owner Text", content: "由 @张三 创建 · 公开 Agent", fontSize: 13, fill: "#0A0A0A", fontName: {family: "Inter", style: "Medium"}})
privNote=I(agentV4+"93:123", {type: "text", name: "Privacy Note", content: "创作者与 Agent 的私密对话不可见", fontSize: 11, fill: "#8E8E93", fontName: {family: "Inter", style: "Regular"}})
```

---

## Step 6 — 验证

```
capture_screenshot(nodeIds: ["<ideaV4>", "<userV4>", "<agentV4>"])
capture_layout(parentId: "<ideaV4>", maxDepth: 3)
```
