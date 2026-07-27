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

/// v6 Login (Ardot 138:165) — gradient logo block, icon inputs, pill buttons, filled OAuth.
struct LoginView: View {
    var initialRegister = false
    var onCancel: (() -> Void)?

    @Environment(AuthSession.self) private var session
    @Environment(\.loginCancelAction) private var loginCancelAction
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var isRegistering = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showWeChatBind = false
    @State private var showForgotPassword = false
    @State private var showPassword = false
    @State private var showCredentials = false

    var body: some View {
        Group {
            if showCredentials {
                credentialsForm
            } else {
                loginEntry
            }
        }
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: showWeChatBind || showForgotPassword)
        .atlasScrollDismissesKeyboard()
        .sheet(isPresented: $showWeChatBind) {
            WeChatPhoneBindView()
        }
        .sheet(isPresented: $showForgotPassword) {
            ForgotPasswordView()
        }
        .onAppear {
            isRegistering = initialRegister
        }
        .navigationBarHidden(true)
    }

    private var loginEntry: some View {
        // Ardot S00 (179:524) Content Wrapper: VStack, itemSpacing 18, horizontal padding 24,
        // top-anchored under the status bar. Top→bottom: brand mark → title → subtitle →
        // launch motion → Apple → email → legal. A flexible spacer keeps the buttons clear of the
        // bottom safe area on tall devices; the whole stack scrolls on small devices.
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // ardot S00 (`237:362` Brand Mark): 56×56 circle cr28, lemon fill.
                Circle()
                    .fill(AtlasColors.lemonStrong)
                    .frame(width: 56, height: 56)

                // Ardot S00 (`237:363`): product wordmark “Deimos”, 40pt Bold.
                Text("Deimos")
                    .font(.system(size: 40, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)

                // Subtitle — 16pt Regular, inkSoft (ardot 179:530).
                Text("发现、登记、Fork 你的下一个 Agent 想法")
                    .font(.system(size: 16, weight: .regular))
                    .foregroundStyle(AtlasColors.inkSoft)

                // Sign in with Apple — 54h, ink fill, white label (ardot 179:531).
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
                .frame(height: 52)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(AtlasColors.border, lineWidth: 1))
                .disabled(isLoading)

                // ardot S00 (`237:359` C/Primary Button 342×52): #BEE90D fill, cr26, 17pt Semibold
                // #1A2403 label "邮箱或手机号登录". Previous 15pt Semibold was under spec.
                Button {
                    showCredentials = true
                } label: {
                    Text("邮箱或手机号登录")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(AtlasColors.lemonInk)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(AtlasColors.lemonStrong)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)

                if let errorMessage {
                    Text(errorMessage)
                        .font(AtlasTypography.caption())
                        .foregroundStyle(AtlasColors.destructive)
                }

                // Legal copy — 12pt Regular, inkSoft (ardot 179:535).
                Text("继续即表示同意《服务条款》和《隐私政策》")
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.inkSoft)
                    .frame(maxWidth: .infinity, alignment: .center)

                // ardot S00 (`237:359` Privacy Promise 342×76): #F5F6F7 fill, cr20.
                // Title "安全登录" 14pt #0F1B2D + body "凭证仅用于身份验证，不用于训练 Agent"
                // 12pt #8A94A6. Reassures the user about credential handling.
                VStack(alignment: .leading, spacing: 6) {
                    Text("安全登录")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text("凭证仅用于身份验证，不用于训练 Agent")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(AtlasColors.chatAssistantBubble)
                )
                .padding(.top, 8)

                // "先逛逛" — guest browse affordance (RootView sets allowGuestBrowse via onCancel).
                if let cancelAction {
                    Button("先逛逛") {
                        cancelAction()
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AtlasColors.inkSoft)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, 4)
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.top, 24)
            .padding(.bottom, 40)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollBounceBehavior(.basedOnSize, axes: .vertical)
        .ignoresSafeArea(.keyboard)
    }

    private var credentialsForm: some View {
        VStack(spacing: 0) {
            AtlasPushNavBar(onBack: { showCredentials = false }, trailing: {
                if let cancelAction {
                    AtlasToolbarFloatIconButton(icon: .close, iconSize: 15, color: AtlasColors.inkSoft, action: {
                        cancelAction()
                    })
                    .accessibilityLabel("关闭")
                }
            })

            ScrollView {
                VStack(spacing: 28) {
                    // Logo block — 80×80 r20 lemon square with sparkles, centered under the nav bar.
                    VStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 20, style: .continuous)
                                .fill(AtlasColors.lemon)
                                .frame(width: 80, height: 80)
                            DeimosIconView(icon: .sparkles, size: 40, color: AtlasColors.lemonInk)
                        }
                        .padding(.top, 8)

                        Text("万叶")
                            .font(.system(size: 28, weight: .heavy))
                            .foregroundStyle(AtlasColors.ink)

                        Text(isRegistering ? "创建账号，开始探索想法" : "Agent 想法市场")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(AtlasColors.inkSoft)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)

                    // Form
                    VStack(spacing: 16) {
                        if isRegistering {
                            v6InputField(icon: .user, placeholder: "昵称", text: $name)
                        }
                        v6InputField(icon: .mail, placeholder: "邮箱地址", text: $email, keyboardType: .emailAddress)
                        v6SecureField(icon: .lock, placeholder: "密码", text: $password, showPassword: $showPassword)

                        // Forgot password — right-aligned blue link
                        if !isRegistering {
                            HStack {
                                Spacer()
                                Button("忘记密码？") {
                                    showForgotPassword = true
                                }
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(AtlasColors.primary)
                            }
                        }

                        // Primary button — pill
                        AtlasLoginPrimaryButton(title: isRegistering ? "注册" : "登录", isLoading: isLoading) {
                            Task { await submit() }
                        }
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(AtlasTypography.bodyMedium())
                            .foregroundStyle(AtlasColors.destructive)
                    }

                    // Divider "或"
                    HStack(spacing: 12) {
                        Rectangle().fill(AtlasColors.border).frame(height: 1)
                        Text("或")
                            .font(AtlasTypography.bodyMedium())
                            .foregroundStyle(AtlasColors.inkSoft)
                        Rectangle().fill(AtlasColors.border).frame(height: 1)
                    }

                    // OAuth — Google + WeChat side-by-side, then Apple full-width (Ardot v11 layout)
                    VStack(spacing: 12) {
                        HStack(spacing: 12) {
                            oauthFilledButton("Google", icon: .globe, bgColor: AtlasColors.surface, textColor: AtlasColors.ink, borderColor: AtlasColors.border) {
                                Task { await oauthSignIn(.google) }
                            }
                            oauthFilledButton("微信", icon: .chat, bgColor: Color(hex: 0x43BD60), textColor: .white, borderColor: nil) {
                                Task { await oauthSignIn(.wechat) }
                            }
                        }

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
                        .frame(height: 56)
                        .clipShape(Capsule())
                        .disabled(isLoading)
                    }

                    // Hint text
                    Text("登录方式：邮箱密码 / Apple / Google / 微信扫码")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkTertiary)

                    // Signup row — centered
                    HStack(spacing: 4) {
                        Text(isRegistering ? "已有账号？" : "还没有账号？")
                            .font(.system(size: 15))
                            .foregroundStyle(AtlasColors.ink)
                        Button(isRegistering ? "立即登录" : "立即注册") {
                            isRegistering.toggle()
                            errorMessage = nil
                        }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.primary)
                    }

                    Text("登录即表示同意《用户协议》和《隐私政策》")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkFaint)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, AtlasMetrics.pageX)
                .padding(.bottom, 40)
            }
        }
    }

    private var cancelAction: (() -> Void)? {
        onCancel ?? loginCancelAction
    }

    // MARK: - v6 Input Field (icon + text, r16, bg #F1F3F7, border #E7EAF0)

    private func v6InputField(
        icon: DeimosIcon,
        placeholder: String,
        text: Binding<String>,
        keyboardType: UIKeyboardType = .default
    ) -> some View {
        HStack(spacing: 12) {
            DeimosIconView(icon: icon, size: 18, color: AtlasColors.inkSoft)
            ChineseFriendlyTextField(
                placeholder: placeholder,
                text: text,
                keyboardType: keyboardType
            )
            .frame(height: 21)
        }
        .padding(.horizontal, 16)
        .frame(height: 56)
        .background(AtlasColors.surfaceSecondary)
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
    }

    private func v6SecureField(
        icon: DeimosIcon,
        placeholder: String,
        text: Binding<String>,
        showPassword: Binding<Bool>
    ) -> some View {
        HStack(spacing: 12) {
            DeimosIconView(icon: icon, size: 18, color: AtlasColors.inkSoft)
            ChineseFriendlyTextField(
                placeholder: placeholder,
                text: text,
                isSecure: !showPassword.wrappedValue,
                keyboardType: .default,
                returnKeyType: .done,
                onSubmit: { Task { await submit() } }
            )
            .frame(height: 21)
            Spacer(minLength: 0)
            Button {
                showPassword.wrappedValue.toggle()
            } label: {
                DeimosIconView(icon: showPassword.wrappedValue ? .eyeOff : .eye, size: 18, color: AtlasColors.inkSoft)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .frame(height: 56)
        .background(AtlasColors.surfaceSecondary)
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
    }

    // MARK: - v6 OAuth Button (filled pill with icon)

    private func oauthFilledButton(
        _ title: String,
        icon: DeimosIcon,
        bgColor: Color,
        textColor: Color,
        borderColor: Color?,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                DeimosIconView(icon: icon, size: 18, color: textColor)
                Text(title)
                    .font(AtlasTypography.mobileSubheadline())
            }
            .foregroundStyle(textColor)
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(bgColor)
            .overlay {
                if let borderColor {
                    Capsule().stroke(borderColor, lineWidth: 1)
                }
            }
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
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
