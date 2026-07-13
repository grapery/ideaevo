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

/// v7 Login entry (Ardot S00 `179:524`) — lemon logo block, large brand title,
/// Sign in with Apple (black) + Email/Phone login (lemon) two-button entry.
///
/// Tapping "邮箱或手机号登录" navigates to `EmailLoginFormView`, which holds the
/// existing email/password/register-toggle/OAuth form logic.
struct LoginView: View {
    var initialRegister = false
    var onCancel: (() -> Void)?

    @Environment(AuthSession.self) private var session
    @Environment(\.loginCancelAction) private var loginCancelAction
    @State private var showEmailForm = false
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        topBar

                        VStack(alignment: .leading, spacing: AtlasMetrics.sectionGap) {
                            brandHero
                            authActions
                        }
                        .padding(.horizontal, AtlasMetrics.pageX)
                        .padding(.top, 34)
                        .padding(.bottom, 28)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(minHeight: proxy.size.height, alignment: .top)
                }
                .scrollBounceBehavior(.basedOnSize)
            }
            .background(AtlasColors.canvas)
            .navigationBarHidden(true)
            .navigationDestination(isPresented: $showEmailForm) {
                EmailLoginFormView(initialRegister: initialRegister)
            }
        }
    }

    @ViewBuilder
    private var topBar: some View {
        HStack {
            if let cancelAction {
                AtlasToolbarFloatIconButton(icon: .close, iconSize: 15, color: AtlasColors.inkSoft, action: cancelAction)
                    .accessibilityLabel("关闭")
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, AtlasMetrics.detailX)
        .frame(height: AtlasToolbarMetrics.barHeight)
    }

    private var brandHero: some View {
        VStack(alignment: .leading, spacing: 22) {
            WanyeLoginMark()

            VStack(alignment: .leading, spacing: 10) {
                Text("万叶")
                    .font(.system(size: 44, weight: .heavy))
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)

                Text("发现、登记、Fork 你的下一个 Agent 想法")
                    .font(AtlasTypography.subtitle())
                    .foregroundStyle(AtlasColors.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }

            LoginRelationshipStrip()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var authActions: some View {
        VStack(alignment: .leading, spacing: 14) {
            SignInWithAppleButtonView(onCompletion: { result in
                Task {
                    isLoading = true
                    defer { isLoading = false }
                    do {
                        try await AppleSignInHelper.handle(result, session: session)
                    } catch {
                        // Silently ignore — Apple cancellation errors are non-blocking
                    }
                }
            })
            .frame(height: AtlasMetrics.primaryButtonHeight)
            .clipShape(Capsule())
            .overlay(
                Capsule().stroke(AtlasColors.border, lineWidth: 1)
            )

            Button {
                showEmailForm = true
            } label: {
                Text("邮箱或手机号登录")
                    .font(AtlasTypography.button())
                    .foregroundStyle(AtlasColors.lemonInk)
                    .frame(maxWidth: .infinity)
                    .frame(height: AtlasMetrics.primaryButtonHeight)
                    .background(AtlasColors.primaryAction)
                    .overlay(
                        Capsule().stroke(AtlasColors.border, lineWidth: 1)
                    )
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)

            Text("继续即表示同意《服务条款》和《隐私政策》")
                .font(AtlasTypography.meta())
                .foregroundStyle(AtlasColors.inkSoft)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 2)
        }
    }

    private var cancelAction: (() -> Void)? {
        onCancel ?? loginCancelAction
    }
}

private struct WanyeLoginMark: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusHero, style: .continuous)
                .fill(AtlasColors.primaryGradient)
                .frame(width: 96, height: 96)

            RoundedRectangle(cornerRadius: 23, style: .continuous)
                .stroke(Color.white.opacity(0.72), lineWidth: 1.4)
                .frame(width: 72, height: 72)

            VStack(spacing: 4) {
                HStack(spacing: 6) {
                    Circle().fill(Color.white.opacity(0.86)).frame(width: 12, height: 12)
                    Circle().fill(Color.white.opacity(0.55)).frame(width: 6, height: 6)
                    Circle().fill(Color.white.opacity(0.86)).frame(width: 12, height: 12)
                }
                HStack(spacing: 4) {
                    Circle().fill(Color.white.opacity(0.42)).frame(width: 5, height: 5)
                    Circle().fill(Color.white.opacity(0.86)).frame(width: 12, height: 12)
                }
            }
            .offset(y: 2)
        }
        .shadow(color: AtlasColors.lemonStrong.opacity(0.28), radius: 18, y: 10)
    }
}

private struct LoginRelationshipStrip: View {
    var body: some View {
        HStack(spacing: 8) {
            chip("User", color: AtlasColors.entityUser)
            connector
            chip("Agent", color: AtlasColors.entityAgent)
            connector
            chip("Idea", color: AtlasColors.entityIdea)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surfaceSecondary.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
    }

    private var connector: some View {
        Rectangle()
            .fill(AtlasColors.border)
            .frame(maxWidth: .infinity)
            .frame(height: 1)
    }

    private func chip(_ title: String, color: Color) -> some View {
        Text(title)
            .font(AtlasTypography.pill())
            .foregroundStyle(AtlasColors.inkTertiary)
            .frame(minWidth: 74)
            .frame(height: 36)
            .background(color)
            .clipShape(Capsule())
    }
}

// MARK: - Email Login Form (existing multi-field logic, moved here from old LoginView)

/// Email/password login + register toggle + Google/WeChat OAuth.
/// Presented when the user taps "邮箱或手机号登录" on the v7 login entry page.
struct EmailLoginFormView: View {
    var initialRegister = false

    @Environment(AuthSession.self) private var session
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var isRegistering = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showWeChatBind = false
    @State private var showForgotPassword = false
    @State private var showPassword = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                // Form
                VStack(spacing: 16) {
                    if isRegistering {
                        v7InputField(icon: "person", placeholder: "昵称", text: $name)
                    }
                    v7InputField(icon: "envelope", placeholder: "邮箱地址", text: $email, keyboardType: .emailAddress)
                    v7SecureField(icon: "lock", placeholder: "密码", text: $password, showPassword: $showPassword)

                    // Forgot password — right-aligned
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

                    // Primary button — pill (lemon via token)
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

                // OAuth — Google + WeChat side-by-side
                HStack(spacing: 12) {
                    oauthFilledButton("Google", systemIcon: "globe", bgColor: AtlasColors.surface, textColor: AtlasColors.ink, borderColor: AtlasColors.border) {
                        Task { await oauthSignIn(.google) }
                    }
                    oauthFilledButton("微信", systemIcon: "message.fill", bgColor: Color(hex: 0x43BD60), textColor: .white, borderColor: nil) {
                        Task { await oauthSignIn(.wechat) }
                    }
                }

                // Hint text
                Text("登录方式：邮箱密码 / Google / 微信扫码")
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
            .padding(.horizontal, 24)
            .frame(maxWidth: .infinity)
            .frame(minHeight: UIScreen.main.bounds.height - 120)
        }
        .background(AtlasColors.canvas)
        .scrollDismissesKeyboard(.immediately)
        .sheet(isPresented: $showWeChatBind) {
            WeChatPhoneBindView()
        }
        .sheet(isPresented: $showForgotPassword) {
            ForgotPasswordView()
        }
        .onAppear {
            isRegistering = initialRegister
        }
        .navigationTitle(isRegistering ? "注册" : "登录")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                AtlasNavBackButton(action: { dismiss() })
            }
        }
    }

    // MARK: - v7 Input Field (icon + text, r16, bg surfaceSecondary, border)

    private func v7InputField(
        icon: String,
        placeholder: String,
        text: Binding<String>,
        keyboardType: UIKeyboardType = .default
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundStyle(AtlasColors.inkSoft)
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

    private func v7SecureField(
        icon: String,
        placeholder: String,
        text: Binding<String>,
        showPassword: Binding<Bool>
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundStyle(AtlasColors.inkSoft)
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
                Image(systemName: showPassword.wrappedValue ? "eye.slash" : "eye")
                    .font(.system(size: 18))
                    .foregroundStyle(AtlasColors.inkSoft)
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

    // MARK: - OAuth Button (filled pill with icon)

    private func oauthFilledButton(
        _ title: String,
        systemIcon: String,
        bgColor: Color,
        textColor: Color,
        borderColor: Color?,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: systemIcon)
                    .font(.system(size: 18, weight: .medium))
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
                dismiss()
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
            // Pop back to LoginView entry — AuthRequiredSheet/ProfileView will
            // observe session.isAuthenticated change and auto-dismiss/swap.
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
