# S11 Settings v5 · 设置

**Ardot frame:** `93:1074`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S11 Settings | 🎯 唯一核心任务：进入账户/偏好/法律子页或退出登录

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐ marginH 16
│ [AtlasPushNavBar H44] ‹ 设置         │ Title 17pt Semibold · Hit 44
├──────────────────────────────────────┤
│ [V-Stack grouped sections gap 16]    │
│ ┌─ Group Card R16 ─────────────────┐ │
│ │ Row 账户与安全  minH44  →         │ │
│ │ ─── Divider #E5E5E5 ────────────  │ │
│ │ Row 编辑资料    minH44  →         │ │
│ └──────────────────────────────────┘ │
│ ┌─ Group Card R16 ─────────────────┐ │
│ │ Row 通知偏好 …                    │ │
│ │ Row 法律与隐私 …                  │ │
│ └──────────────────────────────────┘ │
│ [Destructive 退出 minH 44]           │
│ [Destructive 注销 minH 44]           │
└──────────────────────────────────────┘
```

#### 2. Tokens

* Nav「设置」**17pt Semibold** / 行 **17pt Regular** / 分组标题 **15pt #666**
* 每组 **单卡 r16** + 内部 **Divider** — 禁止每组多卡嵌套
* 行 **minH 44**

#### 3. 状态机

* `[Idle]` → 分组列表
* `[Tap 子页]` → Push B 模式 `settingsBackHeader`；**suppress TabBar**
* `[注销]` → Dialog **326×auto** · 按钮 **minH 44**

#### 4. 动效

* Push parallax **35%**
* Dialog：背景 **dim 0.4**

#### 5. 双重空状态表现细节

* N/A — 设置列表恒有分组项

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 0) {
    AtlasPushNavBar(title: 17.semibold, back: 44)
    ScrollView {
        VStack(spacing: 16) {
            SettingsGroupCard(radius: 16) {
                VStack(spacing: 0) {
                    SettingsRow("账户与安全", minH: 44)
                    Divider().foregroundStyle(#E5E5E5)
                    SettingsRow("编辑资料", minH: 44)
                }
            }
            SettingsGroupCard { /* 通知 / 法律 */ }
            DestructiveButton("退出登录", minH: 44)
            DestructiveButton("注销账户", minH: 44)
        }.padding(.horizontal, 16)
    }
}
.suppressTabBar()
```

## 子页栈

见 `00-navigation-ia.md` 设置栈 · `11-settings-subpages.md`

## API

`PATCH /user/profile` · `DELETE /user/account`
