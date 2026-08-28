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
            if session.isBootstrapping {
                // Minimal cold-start state — no branded launch screen (not on the ardot board).
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(AtlasColors.canvas)
            } else if bootstrapFailed {
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
