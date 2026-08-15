# S09 Profile v5 · 我的

**Ardot frame:** `93:1049`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S09 Profile · 我的 | 🎯 唯一核心任务：进入设置 / Agents / 发布 / 通知

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐ marginH 16
│ [TabScreenHeader H44] 我的    [设置] │ 22pt · Text pill Hit 44
├──────────────────────────────────────┤
│ [V-Stack gap 12]                     │
│ ┌─ Identity Card R16 P16 ──────────┐ │
│ │ Avatar64 name 22pt Bold          │ │
│ │ bio 17pt · stats row             │ │
│ └──────────────────────────────────┘ │
│ ┌─ Menu Card R16 (single) ─────────┐ │
│ │ Row 我的 Agents          →       │ │ Divider between rows
│ │ ─── 1px #EBEBEB ───────────────  │ │
│ │ Row 发布想法             →       │ │
│ │ Row 通知                 →       │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ [PillTabBar]                         │
└──────────────────────────────────────┘
```

#### 2. Tokens

* **排版**：Screen **22pt Bold** / 菜单行 **17pt Regular** / 副文 **15pt #666**
* **容器**：Card **r16 p16**；菜单 **单卡 + Divider**，禁止每行独立卡片
* **热区**：每菜单行 **minH 44** / 设置 **44×44**

#### 3. 状态机

* `[Guest]` → 登录引导卡替换身份区；Tab Bar 保留
* `[Logged in Idle]` → 完整身份 + 菜单
* `[Tap 设置]` → Push Settings；隐藏 Tab Bar

#### 4. 动效 · 空状态

* Push **parallax 35%**
* Guest：全屏 CTA **minH 44**「登录」— 非空菜单卡墙

#### 5. 伪代码

```swift
VStack {
    TabScreenHeader("我的", trailing: SettingsTextButton(44))
    ScrollView {
        VStack(spacing: 12) {
            ProfileIdentityCard(radius: 16)
            Card(radius: 16) {
                VStack(spacing: 0) {
                    menuRow("我的 Agents", minH: 44, font: 17)
                    Divider()
                    menuRow("发布想法", minH: 44)
                    Divider()
                    menuRow("通知", minH: 44)
                }
            }
        }.padding(.horizontal, 16)
    }
    PillTabBar()
}
```

## API

`GET /user/me` · profile endpoints
