# S01 Auth v5 · 登录/注册（Legacy 参考）

> **主规格：** [`01-login.md`](./01-login.md) · [`01-register.md`](./01-register.md)  
> **Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)  
> 本文档保留 App Store 合规与历史 Layer 对照；新设计以 V4.0 蓝图为准。

#### 1. 画布级可视化解构蓝图 (Legacy 速查)

```
[OAuth Stack V-Stack gap 12 marginH 16]
  Apple minH 44 (首位)
  Google / 微信 outline minH 44
  Divider「或」15pt #666
  Email Field h50 17pt
  Primary 登录 minH 44
```

#### 3–6. 状态机 / 动效 / 空态 / Swift

* 完整实现见 [`01-login.md`](./01-login.md) · [`01-register.md`](./01-register.md)
* `[Idle]` 表单 · `[Submit]` loading · Sheet **zoom 0.95 dim 0.4**
* 空态 N/A

```swift
// Legacy — 见 01-login.md
VStack(spacing: 12) {
    SignInWithAppleButton().frame(minHeight: 44)
    OAuthButton("Google", minH: 44)
    DividerText("或", font: 15)
    authFields(height: 50, font: 17)
    PrimaryButton("登录", minH: 44)
}
.padding(.horizontal, 16)
```

**Ardot frame:** `93:1035`（登录）· `93:1358`（注册）

## 合规（App Store）

- Sign in with Apple **首位** · 系统 `ASAuthorizationAppleIDButton` **minH 44**
- Google / 微信 outline **minH 44**
- 「忘记密码？」**15pt** · Hit **44**
- 底部协议 **13pt #999** · 《用户协议》《隐私政策》**独立可点 Hit 44**

## V4.0 布局（取代旧「表单卡片」嵌套）

```
[V-Stack fullscreen marginH 16]
  Logo
  Title 22pt Bold
  Field email h50 r12 font 17
  Field password h50
  Primary 登录 minH 44
  Link 忘记密码 Hit 44
  Divider 或
  OAuth buttons minH 44 each
  Link 注册 15pt
  Legal 13pt
```

- **禁止** 表单外包独立 `surface-card` 再包字段（Padding on Padding）
- 字段间距 **12px**；区块间距 **24px**

## States

| 状态 | UI |
|------|-----|
| 默认 | 空表单 |
| 加载 | Primary spinner |
| 错误 | 字段下 **15pt #FF3B30** |

## API

- `POST /auth/login` · `POST /auth/register`
- Apple 登录：后端 Apple 完成接口
