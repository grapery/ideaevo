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

    private let wechatGreen = Color(hex: 0x1FBD79)

    private var subtitle: String {
        isRegistering ? "创建账号，开始探索想法" : "探索 AI Agent 的想法宇宙"
    }

    var body: some View {
        VStack(spacing: 0) {
            if let cancelAction {
                AtlasPushNavBar {
                    AtlasToolbarFloatIconButton(icon: .close, iconSize: 15, color: AtlasColors.inkSoft, action: cancelAction)
                        .accessibilityLabel("关闭")
                }
            }

            ScrollView {
            VStack(spacing: 28) {
                VStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(AtlasColors.surface)
                            .frame(width: 72, height: 72)
                            .shadow(color: .black.opacity(0.1), radius: 12, y: 6)
                        DeimosIconView(icon: .sparkles, size: 36, color: AtlasColors.aiStart)
                    }
                    .padding(.top, 48)
                    Text("万叶")
                        .font(.system(size: 28, weight: .heavy))
                        .foregroundStyle(AtlasColors.ink)
                    Text(subtitle)
                        .font(.system(size: 15))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: 14) {
                    if isRegistering {
                        AtlasLoginTextField(placeholder: "昵称", text: $name)
                    }
                    AtlasLoginTextField(placeholder: "邮箱", text: $email, keyboardType: .emailAddress)
                    AtlasLoginTextField(placeholder: "密码", text: $password, isSecure: true, returnKeyType: .done, onSubmit: {
                        Task { await submit() }
                    })

                    AtlasLoginPrimaryButton(title: isRegistering ? "注册" : "登录", isLoading: isLoading) {
                        Task { await submit() }
                    }
                }

                HStack(spacing: 8) {
                    if !isRegistering {
                        Button("忘记密码？") {
                            showForgotPassword = true
                        }
                        .font(.system(size: 14))
                        .foregroundStyle(AtlasColors.ink)
                    }
                    Text("·")
                        .font(.system(size: 14))
                        .foregroundStyle(AtlasColors.inkFaint)
                    Button(isRegistering ? "已有账号？登录" : "注册新账号") {
                        isRegistering.toggle()
                        errorMessage = nil
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.system(size: 14))
                        .foregroundStyle(AtlasColors.coral)
                }

                HStack {
                    Rectangle().fill(AtlasColors.rule).frame(height: 1)
                    Text("或")
                        .font(.system(size: 13))
                        .foregroundStyle(AtlasColors.inkFaint)
                    Rectangle().fill(AtlasColors.rule).frame(height: 1)
                }

                VStack(spacing: 12) {
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
                    .frame(height: 54)
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                    .disabled(isLoading)

                    HStack(spacing: 10) {
                        oauthOutlineButton("微信登录", tint: wechatGreen) {
                            Task { await oauthSignIn(.wechat) }
                        }
                        oauthOutlineButton("Google 登录") {
                            Task { await oauthSignIn(.google) }
                        }
                    }
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

    private var cancelAction: (() -> Void)? {
        onCancel ?? loginCancelAction
    }

    private func oauthOutlineButton(_ title: String, tint: Color = AtlasColors.ink, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(tint)
                .frame(maxWidth: .infinity)
                .frame(height: 54)
                .background(AtlasColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
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
