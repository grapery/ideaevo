# S11F About v5 · 关于

**Ardot frame:** `93:1262`  
**iOS:** `AboutDeimosView`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S11F About | 🎯 唯一核心任务：查看版本信息与法律链接

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐ marginH 16
│ [settingsBackHeader H44] ‹ 关于火卫二    │
├──────────────────────────────────────┤
│ [V-Stack center gap 12]              │
│ AppIcon 72×72 r16                    │
│ 火卫二 22pt Bold                     │
│ 版本 13pt #999                       │
│ 副文 17pt Regular #222 居中          │
│ Spacer(24)                           │
│ ┌─ Link Card R16 single ────────────┐ │
│ │ 用户协议 row minH 44 →           │ │
│ │ ─── Divider ───────────────────  │ │
│ │ 隐私政策 row minH 44 →           │ │
│ └──────────────────────────────────┘ │
│ Footer © 13pt #999                   │
└──────────────────────────────────────┘
```

#### 2. Tokens · 规则

* 品牌名 **22pt Bold** / 描述 **17pt** / 版本 **13pt #999**
* 链接列表 **单卡 + Divider** — 禁止每项独立卡
* 行 **minH 44**

#### 3. 动效

* Push parallax **35%**

#### 4. 上下文状态机切换逻辑

* `[Idle · 静态信息]` → 只读展示 · 无编辑态
* `[Tap 法律链接]` → Push 法律页 · parallax **35%**

#### 5. 双重空状态表现细节

* 不适用 — 关于页无列表

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 12) {
    settingsBackHeader(height: 44)
    AppIcon(72).cornerRadius(16)
    Text("火卫二").font(.system(size: 22, weight: .bold))
    Text(version).font(.caption13)
    Card(radius: 16) {
        VStack(spacing: 0) {
            LinkRow("用户协议", minH: 44)
            Divider().foregroundStyle(#E5E5E5)
            LinkRow("隐私政策", minH: 44)
        }
    }
}
```

## 入口

设置 → 关于 · App Store 合规见 [`11-app-store-compliance.md`](./11-app-store-compliance.md)
