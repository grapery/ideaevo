# S01C Forgot Password v5 · 忘记密码

**Ardot frame:** `93:1185`  
**Marvel V4.0：** [`../marvel-art-review-v4.md`](../marvel-art-review-v4.md)

### 📱 界面：S01C Forgot Password | 🎯 唯一核心任务：提交邮箱以接收重置链接

#### 1. ASCII Wireframe

```
┌──────────────────────────────────────┐ marginH 16
│ [AtlasPushNavBar H44] ‹ 忘记密码      │ 或 Sheet D
├──────────────────────────────────────┤
│ Text 说明 17pt Regular               │
│ Field 邮箱 h50 r12 17pt              │
│ [Primary 发送重置链接 minH 44]        │
│ Link 返回登录 15pt Hit 44            │
└──────────────────────────────────────┘
```

#### 2. Tokens · 动效

* 标题 Nav **17pt Semibold** / 正文 **17pt** / 按钮 **17pt minH 44**
* Sheet 模式：**Handle 40×4** + **zoom 95% dim 0.4**

#### 3. 上下文状态机切换逻辑

* `[Idle · 表单]` → Nav 或 Sheet + 邮箱 Field + Primary
* `[Editing · 输入]` → 键盘升起；Primary 保持 **minH 44**
* `[Submit 成功]` → Toast + dismiss → 邮件 Deep Link 流程
* `[Sheet 模式]` → 根视图 **scale 0.95 dim 0.4**

#### 4. 物理微动效与手势声明

* Sheet 打开/关闭：**zoom 95% ↔ 100%** + dim **0.4 ↔ 0**
* Push 返回：**parallax 35%**

#### 5. 双重空状态表现细节

* 不适用 — 表单屏无列表空态
* 邮箱格式错误：Field 描边 `#FF3B30` + Caption **13pt** 错误文案

#### 6. 声明式 UI 架构伪代码

```swift
VStack(spacing: 16) {
    Text(instructions).font(.body17)
    TextField("邮箱", font: .body17).frame(height: 50).cornerRadius(12)
    PrimaryButton("发送重置链接", minH: 44)
    LinkButton("返回登录", font: 15, target: 44)
}
.padding(.horizontal, 16)
```

#### 7. 关联

* 邮件 Deep Link 打开 → [`10-gap-completion.md`](./10-gap-completion.md) S01RL Reset Sheet

## API

`POST /auth/forgot-password`
