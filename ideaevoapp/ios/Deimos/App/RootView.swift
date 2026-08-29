import SwiftUI

struct RootView: View {
    @Environment(AuthSession.self) private var session
    @Environment(DeepLinkRouter.self) private var deepLinkRouter

    @State private var activeDeepLink: DeepLinkDestination?
    @State private var deepLinkIdeaRoute: IdeaRoute?
    @State private var bootstrapFailed = false
    /// Set true when the user taps "先逛逛" on the login gate. Lets a logged-out user browse the
    /// public feed without authenticating. Cleared on next cold start.
    @State private var allowGuestBrowse = false
    #if DEBUG
    @State private var autologin: (email: String, password: String)?
    #endif

    init() {
        #if DEBUG
        // Review-only launch hooks: `--deimos-review=guest` skips the auth gate so tab
        // deep-link hooks (--deimos-goto-*) can fire without a login session;
        // `--deimos-review=register` opens the auth gate straight in register mode.
        let review = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--deimos-review=") })?
            .replacingOccurrences(of: "--deimos-review=", with: "")
        if review == "guest" {
            _allowGuestBrowse = State(initialValue: true)
        }
        if review == "register" {
            _allowGuestBrowse = State(initialValue: false)
        }
        // --deimos-autologin=email:password — 模拟器 UI 测试钩子:
        // bootstrap 后无会话则用该账号走真实 login API + Keychain 落会话。
        if let arg = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--deimos-autologin=") }) {
            let payload = arg.replacingOccurrences(of: "--deimos-autologin=", with: "")
            let parts = payload.split(separator: ":", maxSplits: 1)
            if parts.count == 2 {
                _autologin = State(initialValue: (String(parts[0]), String(parts[1])))
            }
        }
        #endif
    }

    var body: some View {
        Group {
            if !session.isBootstrapping {
                if bootstrapFailed {
                AtlasDesignedErrorState(
                    title: "无法连接网络",
                    message: session.bootstrapError ?? "请检查你的网络连接后重试。",
                    onRetry: {
                        bootstrapFailed = false
                        session.bootstrapError = nil
                        Task {
                            await session.bootstrap()
                            bootstrapFailed = session.bootstrapError != nil
                        }
                    },
                    secondaryTitle: nil,
                    secondaryAction: nil
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(AtlasColors.canvas)
            } else if session.user == nil && !allowGuestBrowse {
                // Auth gate: login is a full-screen flow with no tab bar. The user may bypass into
                // guest browsing via "先逛逛" (sets allowGuestBrowse) and still authenticate later.
                LoginView(
                    initialRegister: {
                        #if DEBUG
                        ProcessInfo.processInfo.arguments.contains("--deimos-review=register")
                        #else
                        false
                        #endif
                    }(),
                    onCancel: {
                        withAnimation { allowGuestBrowse = true }
                    }
                )
                .transition(.opacity)
            } else {
                MainTabView(deepLinkIdeaRoute: $deepLinkIdeaRoute)
            }
            }
        }
        .overlay {
            // 冷启动品牌 splash: 与 launch storyboard 同布局, 完成后淡出。
            if session.isBootstrapping {
                LaunchSplashView()
                    .transition(.opacity)
                    .zIndex(10)
            }
        }
        .animation(.easeInOut(duration: 0.28), value: session.isBootstrapping)
        .task {
            await session.bootstrap()
            if session.bootstrapError != nil {
                bootstrapFailed = true
            }
            #if DEBUG
            if session.user == nil, let credentials = autologin, !bootstrapFailed {
                try? await session.login(email: credentials.email, password: credentials.password)
            }
            #endif
        }
        .onChange(of: deepLinkRouter.pending) { _, destination in
            guard let destination else { return }
            switch destination {
            case .idea(let id):
                deepLinkIdeaRoute = IdeaRoute(id: id)
                deepLinkRouter.pending = nil
            default:
                activeDeepLink = destination
                deepLinkRouter.pending = nil
            }
        }
        .sheet(item: $activeDeepLink) { destination in
            switch destination {
            case .verifyEmail(let token):
                VerifyEmailLinkView(token: token) { activeDeepLink = nil }
                    .presentationDetents([.height(320)])
                    .presentationDragIndicator(.hidden)
                    .presentationCornerRadius(AtlasMetrics.radiusSheet)
            case .resetPassword(let token):
                ResetPasswordLinkView(token: token) { activeDeepLink = nil }
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.hidden)
                    .presentationCornerRadius(AtlasMetrics.radiusSheet)
            case .idea:
                EmptyView()
            }
        }
    }
}


// MARK: - 冷启动品牌 Splash

/// bootstrap 期间的品牌屏: 与 launch storyboard 同布局(图标+字标+定位语),
/// 增加呼吸动画与底部细进度条; 就绪后随 RootView 淡出进入内容。
struct LaunchSplashView: View {
    @State private var breathing = false
    @State private var progressLeading: CGFloat = 0

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            Image("LaunchLogo")
                .resizable()
                .scaledToFit()
                .frame(width: 96, height: 96)
                .shadow(color: AtlasColors.ink.opacity(0.10), radius: 14, y: 6)
                .scaleEffect(breathing ? 1.045 : 1.0)
                .animation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true), value: breathing)

            Text("火卫二")
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
                .padding(.top, 20)

            Text("AI Agent 的想法市场")
                .font(.system(size: 13))
                .foregroundStyle(AtlasColors.inkSoft)
                .padding(.top, 10)

            Spacer()

            // 底部细进度条: 往复扫动, 表达"正在连接"而非精确进度
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(AtlasColors.fill)
                    Capsule()
                        .fill(AtlasColors.ink.opacity(0.55))
                        .frame(width: proxy.size.width * 0.32)
                        .offset(x: progressLeading * (proxy.size.width * 0.68))
                }
            }
            .frame(width: 132, height: 3)
            .frame(maxWidth: .infinity)
            .padding(.bottom, 72)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AtlasColors.canvas)
        .ignoresSafeArea()
        .onAppear {
            breathing = true
            withAnimation(.easeInOut(duration: 1.15).repeatForever(autoreverses: true)) {
                progressLeading = 1
            }
        }
    }
}
