# S11 Phone Bind Sheet v5 · 绑定手机

**Ardot frame:** `93:1631`  
**iOS:** `PhoneBindView` · `WeChatPhoneBindView`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S11 Phone Bind | 🎯 唯一核心任务：验证手机号并完成绑定

#### 1. ASCII Wireframe（Sheet D）

```
[Root scale 0.95 dim 0.4]
┌─ Sheet ~380h R20 top ────────────────┐
│ [Handle 40×4 r2 center]              │
│ Spacer(8)                            │
│ [TitleRow] X Hit44 | 绑定手机号 17pt Bold | (spacer) │
│ Spacer(12)                           │
│ Text 说明 17pt Regular #222          │
│ Field 手机号 h50 r12 17pt            │
│ HStack Field 验证码 + Link 获取 44   │
│ Spacer(16)                           │
│ [Primary 完成绑定 minH 44]           │
└──────────────────────────────────────┘
```

#### 2. Tokens

* 遮罩 **opacity 0.4**（非仅 44% 色值混用 — 与 dim 0.4 等效）
* 输入 **17pt** / 链接 **15pt** / 主按钮 **17pt Semibold**
* 关闭 **X Hit 44** · 获取验证码 **Hit 44**

#### 3. 变体

| 场景 | 文案差异 |
|------|----------|
| 账户安全 | 「验证手机号用于账户安全…」 |
| 微信 OAuth `S11WX` | 「微信登录需验证手机号…」取消清 token |

#### 4. 动效

* 打开/关闭：**zoom 95% ↔ 100%** + dim 0.4 ↔ 0

#### 5. 上下文状态机切换逻辑

* `[Idle · 表单]` → Sheet D + Handle + TitleRow + Fields
* `[Editing · 输入]` → 键盘升起；获取验证码倒计时 **Hit 44** 保持可点
* `[Submit 成功]` → dismiss Sheet · 恢复根 **scale 1.0**
* `[微信 OAuth S11WX · 取消]` → dismiss + 清除 token

#### 6. 双重空状态表现细节

* 不适用 — 绑定表单无列表空态
* 验证码错误：Field 描边红 + **13pt** 提示

#### 7. 声明式 UI 架构伪代码

```swift
.sheet {
    VStack(spacing: 0) {
        HandleBar(40, 4, radius: 2)
        Spacer(8)
        TitleRow(close: 44, title: 17.bold)
        Spacer(12)
        Text(hint).font(.body17)
        TextField("手机号", height: 50)
        HStack { TextField("验证码"); Link("获取", target: 44) }
        PrimaryButton("完成绑定", minH: 44)
    }
}
// Root: scaleEffect(0.95) + dim 0.4
```

## API

`POST /auth/phone/send` · `POST /auth/user/phone/verify`
