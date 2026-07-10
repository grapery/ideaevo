# S11 Settings 子页 v5

**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md) · 父页 [`11-settings.md`](./11-settings.md)

### 📱 模块：S11 Settings 子页 | 🎯 任务：完成单项设置（资料/安全/通知/法律/偏好）

所有子页：**settingsBackHeader H44** · **suppressTabBar** · 列表 **单卡 r16 + Divider** · 行 **minH 44**

#### 1. 画布级可视化解构蓝图 (ASCII Wireframe)

```
┌──────────────────────────────────────┐ marginH 16
│ [settingsBackHeader H44] ‹ 子页标题   │
├──────────────────────────────────────┤
│ ┌─ Single Card R16 ─────────────────┐ │
│ │ Row label 15pt #666              │ │
│ │ Field / Toggle row minH 44       │ │
│ │ ─── Divider #E5E5E5 ───────────  │ │
│ │ Row …                            │ │
│ └──────────────────────────────────┘ │
│ [Primary 保存 minH 44] (编辑资料)     │
└──────────────────────────────────────┘
```

#### 3. 上下文状态机切换逻辑（通用）

| 状态 | UI |
|------|-----|
| `[Idle · 浏览]` | `settingsBackHeader` + 单卡列表 |
| `[Editing · 输入]` | 键盘升起；保存按钮 **minH 44** 贴底或 Nav trailing |
| `[Destructive 确认]` | Dialog **dim 0.4** · 红按钮 **44** |
| `[Dismiss]` | Pop · parallax **35%** |

#### 4. 物理微动效

* Push/Pop：**parallax 35%**
* 注销 Dialog：**dim 0.4**

#### 5. 双重空状态表现细节

* 各子页列表空态见 `12-states.md`（如黑名单空、通知偏好无额外空态）
* 法律文档页：纯文本流 — **禁止** 空容器卡

#### 6. 声明式 UI 架构伪代码

```swift
// 通用子页模板
VStack(spacing: 0) {
    settingsBackHeader(title: subpageTitle, back: 44)
    ScrollView {
        Card(radius: 16) {
            VStack(spacing: 0) {
                ForEach(rows) { SettingsRow($0, minH: 44) }
                Divider().foregroundStyle(#E5E5E5)
            }
        }
        .padding(.horizontal, 16)
    }
}
.suppressTabBar()
```

| 屏幕 | Frame | iOS | 单屏单任务 |
|------|-------|-----|------------|
| 编辑资料 | `93:1450` | `EditProfileView` | 保存个人资料 |
| 账户与安全 | `93:1471` | `AccountSecurityView` | 管理登录与注销 |
| 通知偏好 | `93:1494` | `NotificationPreferencesView` | 配置推送开关 |
| 法律与隐私 | `93:1517` | `LegalPrivacyView` | 打开法律文档 |
| App 偏好 | `93:1581` | `AppPreferencesView` | 选择语言等 |

---

## 编辑资料 `93:1450`

```
‹ 编辑资料
[Banner #FFF4A8 + Avatar64 tap]
[V-Stack fields]
  Label 15pt #666
  Field 昵称 h50 17pt
  Field 简介 multiline 17pt
[Primary 保存 minH 44]
```

- 更换头像/背景：**Hit 44** 热区

## 账户与安全 `93:1471`

```
‹ 账户与安全
[Info Card R16]
  Row 邮箱 17pt + 验证状态 13pt
  Divider
  Row 登录方式
[Row 修改密码 minH 44]
[Destructive 注销账户 minH 44] → S12 Delete Dialog
```

## 通知偏好 `93:1494`

```
‹ 通知
[Status Card 系统推送状态 17pt]
[Toggle Group Card R16]
  启用推送 / 送花 / 评论 / 关注与 Fork
  each row minH 44 + Divider
```

- Toggle 行 **minH 44**（开关本身 + 整行）

## 法律与隐私 `93:1517`

```
‹ 法律与隐私
[Link List Card R16]
  隐私政策 → 17pt row minH 44
  Divider
  用户协议 →
  Divider
  社区规范 →
  Divider
  联系支持 →
[Info Card 注销说明 15pt #666]
```

- 外链页：正文 **17pt** Markdown 流

## App 偏好 `93:1581`

```
‹ 偏好
[Card R16]
  Picker 语言 17pt minH 44
```

## 动效

* 子页 Push：**parallax 35%**
* 注销 Dialog：**dim 0.4**
