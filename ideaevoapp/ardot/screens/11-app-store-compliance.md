# App Store 过审 · 合规页面

**Row 9 · y=7172**  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 模块：App Store Compliance | 🎯 任务：满足审核 Guideline 的页面与交互规格

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

**法律页通用**
```
[settingsBackHeader H44]
[ScrollView V-Stack marginH 16]
  Body 17pt Regular #222 — 纯文本流
  NO nested cards
```

**UGC Report Sheet**
```
[Sheet D: Handle 40×4 + Title 17pt Bold]
[Chip row H-Scroll peek 15%]
[TextField 17pt h50]
[Submit minH 44]
Root: scale 0.95 dim 0.4
```

## 页面清单

| Frame | ID | Guideline | V4.0 UI 要点 |
|-------|-----|-----------|--------------|
| S00 Tab IA | `93:1805` | 5.1.1(v) 游客 | Tab Hit **44** |
| S02 Guest | `93:1905` | 5.1.1(v) | 可浏览 Feed **17pt** |
| S01 Login | `93:1035` | 4.8 SIWA | Apple btn **minH 44** |
| S11 Privacy | `93:1818` | 5.1.1(i) | 正文 **17pt** 可滚动 |
| S11 Terms | `93:1834` | 5.1.1(i) | 同上 |
| S11 Community | `93:1850` | 1.2 UGC | 同上 |
| S11 Support | `93:1893` | 1.5 | 链接 **Hit 44** |
| S12 Report | `93:1865` | 1.2 | Sheet · chips **H-Scroll** |
| S12 Block | `93:1884` | 1.2 | Dialog btn **44** |
| S12 Delete Account | `93:1233` | 5.1.1(v) | destructive **minH 44** |
| S11F About | `93:1262` | 1.5 | 见 `11f-about.md` |

## 法律页布局（V4.0）

```
[settingsBackHeader H44]
[ScrollView V-Stack]
  Markdown / Web 正文 17pt Regular
  无嵌套卡片 — 纯文本流
```

## 登录页合规链接

- 协议文案 **13pt #999**
- 《用户协议》《隐私政策》**独立 Hit 44** — 未登录可访问

## UGC 流程

```
Idea Detail ⋯ → 分享(Hit44) / 举报(Sheet) / 拉黑(Dialog)
```

## 审核检查清单

- [ ] Privacy Policy URL 与 App 内一致
- [ ] Support URL / support@wanye.app
- [ ] SIWA 与 Google/微信并列 **minH 44**
- [ ] 注销：设置 → 账户与安全 → 永久注销 **44**
- [ ] 举报入口在 UGC 详情可见
- [ ] Demo 账号 Review Notes

#### 3. 上下文状态机切换逻辑

* `[Guest 浏览]` → Tab Bar 可见 · Feed **17pt** 可读
* `[UGC 举报]` → Sheet D · chips **H-Scroll** · Submit **44**
* `[注销确认]` → Dialog **dim 0.4** · destructive **44**

#### 4. 物理微动效 · 5. 空状态 · 6. Swift

* Sheet/Dialog：同 `12-popups.md`
* 法律页无空态 — 纯 Markdown **17pt** 流
* 伪代码：见 `11f-about.md` LinkRow + `12-popups.md` Report Sheet

```swift
// 法律页
ScrollView {
    MarkdownBody(font: 17).padding(.horizontal, 16)
}
// UGC Report Sheet
.sheet {
    HandleBar(40, 4)
    ChipRowHScroll(peek: 0.15)
    TextField("说明", font: 17).frame(height: 50)
    PrimaryButton("提交举报", minH: 44)
}
```
