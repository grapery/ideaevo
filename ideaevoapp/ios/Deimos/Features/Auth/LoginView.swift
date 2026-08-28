import SwiftUI

private struct LoginCancelActionKey: EnvironmentKey {
    static let defaultValue: (() -> Void)? = nil
}

extension EnvironmentValues {
    var loginCancelAction: (() -> Void)? {
        get { self[LoginCancelActionKey.self] }
        set { self[LoginCancelActionKey.self] = newValue }
    }
}

/// S10 登录 / S11 注册 (ardot board 715405210175453, nodes `2:639` / `2:640`).
///
/// Login: close circle → brand block (64 r20 lemon logo, 火卫二 Bold-26, slogan
/// 13 inkSoft) → 邮箱/密码 r12 bgInput fields → 忘记密码 link → 登录 CTA →
/// divider → Apple/Google/WeChat 52pt circles → 立即注册 footer.
/// Register: inline back nav 创建账号 → 昵称/邮箱/密码 → terms checkbox → CTA.
struct LoginView: View {
    var initialRegister = false
    var onCancel: (() -> Void)?

    @Environment(AuthSession.self) private var session
    @Environment(\.loginCancelAction) private var loginCancelAction
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var isRegistering = false
    @State private var agreedToTerms = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showWeChatBind = false
    @State private var showForgotPassword = false
    @State private var showPassword = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                if isRegistering {
                    registerScreen
                } else {
                    loginScreen
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 6)
            .padding(.bottom, 40)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollBounceBehavior(.basedOnSize, axes: .vertical)
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: showForgotPassword)
        .atlasScrollDismissesKeyboard()
        .fullScreenCover(isPresented: $showWeChatBind) {
            WeChatPhoneBindView()
        }
        .sheet(isPresented: $showForgotPassword) {
            ForgotPasswordView()
        }
        .onAppear {
            isRegistering = initialRegister
            #if DEBUG
            // Review-only hook: `--deimos-review=forgot` opens the S12 sheet directly.
            if ProcessInfo.processInfo.arguments.contains("--deimos-review=forgot") {
                showForgotPassword = true
            }
            #endif
        }
        .navigationBarHidden(true)
    }

    // MARK: - S10 登录

    private var loginScreen: some View {
        VStack(alignment: .leading, spacing: 22) {
            // S10 Close Row — 40pt surfaceSecondary circle when guest browsing is allowed.
            HStack {
                if let cancelAction {
                    Button {
                        cancelAction()
                    } label: {
                        DeimosIconView(icon: .close, size: 16, color: AtlasColors.ink)
                            .frame(width: 40, height: 40)
                            .background(Circle().fill(AtlasColors.surfaceSecondary))
                            .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("先逛逛")
                }
                Spacer()
            }

            // S10 Brand Block — 64 r20 lemon logo + 火卫二 Bold-26 + slogan.
            VStack(alignment: .leading, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(AtlasColors.lemon)
                        .frame(width: 64, height: 64)
                    DeimosIconView(icon: .sparkles, size: 30, color: AtlasColors.lemonInk)
                }
                .padding(.top, 16)

                Text("火卫二")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)

                Text("AI Agent 的想法市场 · 让好想法不再重复")
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.inkSoft)
            }

            VStack(spacing: 12) {
                formField("邮箱", text: $email, keyboardType: .emailAddress)
                secureField("密码", text: $password, onSubmit: { Task { await submit() } })

                HStack {
                    Spacer()
                    Button("忘记密码？") {
                        showForgotPassword = true
                    }
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(AtlasColors.inkSoft)
                }
            }

            AtlasFormCTA(title: "登录", isLoading: isLoading) {
                Task { await submit() }
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.destructive)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            // S10 Divider — 或使用以下方式继续.
            HStack(spacing: 12) {
                Rectangle().fill(AtlasColors.border).frame(height: 0.5)
                Text("或使用以下方式继续")
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.inkFaint)
                Rectangle().fill(AtlasColors.border).frame(height: 0.5)
            }

            thirdPartyRow

            // S10 Footer — 立即注册.
            HStack(spacing: 4) {
                Text("还没有账号？")
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.inkSoft)
                Button("立即注册") {
                    withAnimation(.easeOut(duration: 0.15)) {
                        isRegistering = true
                        errorMessage = nil
                    }
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AtlasColors.olive)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 10)
        }
    }

    /// S10 Third Party Row — 52pt white circles with hairline borders.
    private var thirdPartyRow: some View {
        HStack(spacing: 20) {
            // ASAuthorizationAppleIDButton 只有带文案的 .signIn/.continue 形态,
            // 52pt 圆形里必然截断。原生按钮隐藏在底层承接点击, 顶层只画  logo。
            ZStack {
                SignInWithAppleButtonView { result in
                    Task {
                        isLoading = true
                        errorMessage = nil
                        defer { isLoading = false }
                        do {
                            try await AppleSignInHelper.handle(result, session: session)
                        } catch {
                            errorMessage = error.localizedDescription
                        }
                    }
                }
                .frame(width: 52, height: 52)
                .opacity(0)
                Image(systemName: "apple.logo")
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(AtlasColors.ink)
                    .frame(width: 52, height: 52)
                    .background(Circle().fill(AtlasColors.surface))
                    .overlay(Circle().stroke(AtlasColors.border, lineWidth: 1))
                    .allowsHitTesting(false)
            }
            .disabled(isLoading)
            .accessibilityLabel("通过 Apple 登录")

            oauthCircle(icon: .globe, tint: AtlasColors.ink, label: "通过 Google 登录") {
                Task { await oauthSignIn(.google) }
            }
            oauthCircle(icon: .chat, tint: Color(hex: 0x07C160), label: "通过微信登录") {
                Task { await oauthSignIn(.wechat) }
            }

            Spacer()
        }
    }

    private func oauthCircle(icon: DeimosIcon, tint: Color, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            DeimosIconView(icon: icon, size: 20, color: tint)
                .frame(width: 52, height: 52)
                .background(Circle().fill(AtlasColors.surface))
                .overlay(Circle().stroke(AtlasColors.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
        .accessibilityLabel(label)
    }

    // MARK: - S11 注册

    private var registerScreen: some View {
        VStack(alignment: .leading, spacing: 22) {
            AtlasSubPageNavBar(title: "创建账号", onBack: {
                withAnimation(.easeOut(duration: 0.15)) {
                    isRegistering = false
                    errorMessage = nil
                }
            })

            VStack(spacing: 12) {
                formField("昵称", text: $name)
                formField("邮箱", text: $email, keyboardType: .emailAddress)
                secureField("设置密码（8 位以上）", text: $password, onSubmit: { Task { await submit() } })
            }
            .padding(.top, 16)

            termsRow

            AtlasFormCTA(title: "注册并进入火卫二", isLoading: isLoading) {
                Task { await submit() }
            }
            .opacity(agreedToTerms ? 1 : 0.5)

            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.destructive)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack(spacing: 4) {
                Text("已有账号？")
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.inkSoft)
                Button("去登录") {
                    withAnimation(.easeOut(duration: 0.15)) {
                        isRegistering = false
                        errorMessage = nil
                    }
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AtlasColors.olive)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 6)
        }
    }

    /// S11 Terms Row — 18pt r5 checkbox (lemonStrong when agreed) + 12 inkSoft copy.
    private var termsRow: some View {
        Button {
            withAnimation(.easeOut(duration: 0.12)) { agreedToTerms.toggle() }
        } label: {
            HStack(alignment: .top, spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                        .fill(agreedToTerms ? AtlasColors.lemonStrong : AtlasColors.bgInput)
                        .frame(width: 18, height: 18)
                    if agreedToTerms {
                        DeimosIconView(icon: .check, size: 10, color: AtlasColors.lemonInk)
                    }
                }
                Text("我已阅读并同意《用户协议》和《隐私政策》")
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.inkSoft)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Fields (S10/S11: r12 bgInput, 48pt, 14pt text)

    private func formField(
        _ placeholder: String,
        text: Binding<String>,
        keyboardType: UIKeyboardType = .default
    ) -> some View {
        ChineseFriendlyTextField(
            placeholder: placeholder,
            text: text,
            keyboardType: keyboardType,
            fontSize: 14
        )
        .padding(.horizontal, 14)
        .frame(height: 48)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(AtlasColors.bgInput)
        )
    }

    private func secureField(
        _ placeholder: String,
        text: Binding<String>,
        onSubmit: @escaping () -> Void
    ) -> some View {
        HStack(spacing: 14) {
            ChineseFriendlyTextField(
                placeholder: placeholder,
                text: text,
                isSecure: !showPassword,
                keyboardType: .default,
                returnKeyType: .done,
                fontSize: 14,
                onSubmit: onSubmit
            )
            Button {
                showPassword.toggle()
            } label: {
                DeimosIconView(icon: showPassword ? .eyeOff : .eye, size: 18, color: AtlasColors.inkFaint)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(showPassword ? "隐藏密码" : "显示密码")
        }
        .padding(.leading, 14)
        .padding(.trailing, 14)
        .frame(height: 48)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(AtlasColors.bgInput)
        )
    }

    // MARK: - Actions

    private var cancelAction: (() -> Void)? {
        onCancel ?? loginCancelAction
    }

    private func oauthSignIn(_ provider: OAuthProvider) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let result = try await OAuthService.shared.signIn(provider: provider)
            if let user = try await APIClient.shared.completeOAuth(result) {
                session.user = user
            } else if APIClient.shared.phoneBindToken != nil {
                showWeChatBind = true
            }
        } catch let error as OAuthError {
            if case .cancelled = error { return }
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func submit() async {
        if isRegistering && !agreedToTerms {
            errorMessage = "请先阅读并同意协议"
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            if isRegistering {
                try await session.register(name: name, email: email, password: password)
            } else {
                try await session.login(email: email, password: password)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
