# S01 Register v5 · 注册

**Ardot frame:** `93:1358`  
**iOS:** `LoginView(initialRegister: true)`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S01 Register | 🎯 唯一核心任务：创建账号

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐ marginH 16
│ [V-Stack center]                     │
│ Logo                                 │
│ Text("创建账号", 22pt Bold)          │
│ Text(subtitle, 17pt Regular)         │
│ Field 邮箱 h50 17pt                  │
│ Field 密码 h50                       │
│ [Primary 注册 minH 44]               │
│ ─── 或 ───                           │
│ Apple / Google / 微信 minH 44        │
│ Link「已有账号？登录」15pt Hit 44     │
│ Legal 13pt #999                      │
└──────────────────────────────────────┘
```

#### 2. Tokens · 3. 状态机 · 4. 动效

* 与 [`01-login.md`](./01-login.md) 相同字阶与热区
* **禁止** 双层表单卡
* `[Idle]` → 表单 · `[Submit]` → loading · success → dismiss
* Sheet 模式：**scale 0.95 dim 0.4** · Push：**parallax 35%**

#### 5. 空状态

* N/A

#### 6. 声明式 UI 架构伪代码

```swift
// 同 Login — 替换 copy + Primary「注册」
VStack(spacing: 12) {
    Text("创建账号").font(.system(size: 22, weight: .bold))
    Text(subtitle).font(.body17)
    authFields(height: 50, font: 17)
    PrimaryButton("注册", minH: 44)
    OAuthDivider()
    OAuthStack(minH: 44)
    Link("已有账号？登录", target: 44)
}
.padding(.horizontal, 16)
```

## API

`POST /auth/register`
