# S01 Login v5 · 登录

**Ardot frame:** `93:1035`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S01 Login | 🎯 唯一核心任务：完成一次登录或跳转注册

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐ marginH 16
│ [V-Stack center - fullscreen]        │
│ Logo / Wordmark                      │
│ Spacer(24)                           │
│ Text("欢迎回来", 22pt Bold)          │
│ Spacer(8)                            │
│ [TextField email h50 r12 17pt]       │
│ [TextField password h50]             │
│ Spacer(16)                           │
│ [PrimaryButton 登录 minH 44]         │
│ OAuth rows Apple/Google/WeChat Hit44 │
│ Spacer(12)                           │
│ Link 注册 15pt #666                   │
│ 合规文案 13pt #999                   │
└──────────────────────────────────────┘
```

#### 2. Tokens

* 标题 **22pt Bold** / 输入 **17pt** / 链接 **15pt #666** / 合规 **13pt #999**
* 输入框 **h50 r12** · 按钮 **minH 44**
* **禁止** 登录表单外包双层卡片 — 单 `V-Stack` + 字段间 **12px** 间距

#### 3. 状态机

* `[Idle]` → 表单
* `[Submitting]` → 主按钮 loading；禁用输入
* `[Success]` → dismiss / 切换 Tab 根

#### 4. 动效

* Sheet 呈现：背景 **scale 0.95 dim 0.4**（若以 Sheet 打开）
* 错误：字段下 **15pt #FF3B30** 文案

#### 5. 空状态

* N/A（登录页即全屏任务）

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 12) {
    Logo()
    Text("欢迎回来").font(.system(size: 22, weight: .bold))
    TextField("邮箱", font: .body17).frame(height: 50).cornerRadius(12)
    SecureField("密码", font: .body17).frame(height: 50).cornerRadius(12)
    PrimaryButton("登录", minH: 44)
    OAuthStack(appleFirst: true, minH: 44)
    Link("注册", font: 15, target: 44)
    LegalFooter(font: 13, linksHit: 44)
}
.padding(.horizontal, 16)
// NO nested form Card
```

## API

`POST /auth/login` · `POST /auth/register`
