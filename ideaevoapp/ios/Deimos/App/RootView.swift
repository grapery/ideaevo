import SwiftUI

struct RootView: View {
    @Environment(AuthSession.self) private var session
    @Environment(DeepLinkRouter.self) private var deepLinkRouter

    @State private var activeDeepLink: DeepLinkDestination?
    @State private var deepLinkIdeaRoute: IdeaRoute?
    @State private var showOnboarding = !AppPreferencesStore.hasCompletedOnboarding
    @State private var showLaunch = true
    @State private var bootstrapFailed = false
    @State private var forceUpdateVersion: String?
    @State private var showMaintenance = false
    /// Set true when the user taps "先逛逛" on the login gate. Lets a logged-out user browse the
    /// public feed without authenticating. Cleared on next cold start.
    @State private var allowGuestBrowse = false

    private let minimumLaunchDisplayNanoseconds: UInt64 = 1_600_000_000

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    var body: some View {
        Group {
            if let version = forceUpdateVersion {
                ForceUpdateView(version: version) {
                    if let url = URL(string: "https://apps.apple.com/app/idXXXXXXXXX") {
                        UIApplication.shared.open(url)
                    }
                }
            } else if showMaintenance {
                MaintenanceView()
            } else if showLaunch || session.isBootstrapping {
                bootstrapLoading
            } else if bootstrapFailed {
                // Unified bootstrap view in error state — reuses the same launch layout.
                BootstrapView(state: .failed) {
                    bootstrapFailed = false
                    session.bootstrapError = nil
                    Task {
                        await session.bootstrap()
                        bootstrapFailed = session.bootstrapError != nil
                    }
                }
            } else if showOnboarding {
                OnboardingView {
                    AppPreferencesStore.hasCompletedOnboarding = true
                    withAnimation { showOnboarding = false }
                }
            } else if session.user == nil && !allowGuestBrowse {
                // Auth gate: login is a full-screen flow with no tab bar. The user may bypass into
                // guest browsing via "先逛逛" (sets allowGuestBrowse) and still authenticate later.
                LoginView(onCancel: {
                    withAnimation { allowGuestBrowse = true }
                })
                .transition(.opacity)
            } else {
                MainTabView(deepLinkIdeaRoute: $deepLinkIdeaRoute)
            }
        }
        .task {
            let minimumLaunchDisplay = Task {
                try? await Task.sleep(nanoseconds: minimumLaunchDisplayNanoseconds)
            }

            await session.bootstrap()
            await minimumLaunchDisplay.value

            if let error = session.bootstrapError {
                // Check for maintenance mode (503) vs network failure
                if error.contains("维护") || error.contains("503") {
                    showMaintenance = true
                } else {
                    bootstrapFailed = true
                }
            }
            // Check minimum version (simple local check; server can return minVersion in future)
            checkForceUpdate()

            withAnimation(.easeOut(duration: 0.24)) {
                showLaunch = false
            }
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

    /// Check if app version is below minimum required (placeholder for server-side version gate).
    private func checkForceUpdate() {
        // TODO: Fetch minimum version from server config endpoint
        // For now, this is a no-op. Server can return 426 status or a minVersion field
        // in the /health response to trigger force update.
        // Example: if appVersion < minVersion { forceUpdateVersion = minVersion }
    }

    private var bootstrapLoading: some View {
        BootstrapView(state: .loading)
    }
}

/// Unified bootstrap screen — handles both the initial loading animation and the error/retry state.
/// Replaces the former separate `DeimosLaunchView` + `OfflineView` with a single view that
/// transitions between states while keeping the same brand identity and layout.
struct BootstrapView: View {
    enum State {
        case loading
        case failed
    }

    let state: State
    var onRetry: (() -> Void)? = nil

    @State private var appeared = false
    @State private var animating = false

    var body: some View {
        GeometryReader { proxy in
            let compactHeight = proxy.size.height < 720

            VStack(spacing: compactHeight ? 28 : 36) {
                Spacer(minLength: compactHeight ? 72 : 110)

                brandIcon
                    .scaleEffect(appeared ? 1 : 0.92)
                    .opacity(appeared ? 1 : 0)

                VStack(spacing: 10) {
                    Text("DEIMOS")
                        .font(.system(size: 34, weight: .semibold, design: .serif))
                        .foregroundStyle(AtlasColors.ink)
                        .minimumScaleFactor(0.82)

                    Text(state == .loading ? "让想法与 Agent 一起生长" : "无法连接网络")
                        .font(AtlasTypography.subtitle())
                        .foregroundStyle(AtlasColors.inkTertiary)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .padding(.horizontal, AtlasMetrics.pageX)
                }
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 8)

                if state == .loading {
                    LaunchMotion(animating: animating)
                        .padding(.horizontal, AtlasMetrics.pageX)
                        .opacity(appeared ? 1 : 0)
                } else {
                    Text("请检查你的网络连接后重试。")
                        .font(.system(size: 15))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 48)
                        .opacity(appeared ? 1 : 0)

                    if let onRetry {
                        Button {
                            onRetry()
                        } label: {
                            HStack(spacing: 8) {
                                DeimosIconView(icon: .refresh, size: 16, color: .white)
                                Text("重试")
                                    .font(.system(size: 17, weight: .semibold))
                            }
                            .foregroundStyle(.white)
                            .frame(width: 200, height: 52)
                            .background(AtlasColors.ink)
                            .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .opacity(appeared ? 1 : 0)
                    }
                }

                Spacer(minLength: compactHeight ? 60 : 92)

                Text(state == .loading ? "正在连接你的想法网络" : "")
                    .font(AtlasTypography.meta())
                    .foregroundStyle(AtlasColors.inkFaint)
                    .padding(.bottom, 28)
                    .opacity(appeared ? 1 : 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(AtlasColors.canvas.ignoresSafeArea())
        }
        .onAppear {
            withAnimation(.spring(response: 0.7, dampingFraction: 0.86)) {
                appeared = true
            }
            if state == .loading {
                withAnimation(.linear(duration: 1.9).repeatForever(autoreverses: false)) {
                    animating = true
                }
            }
        }
    }

    // MARK: - Brand icon (shared across both states)

    private var brandIcon: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .fill(AtlasColors.ink)
                .frame(width: 104, height: 104)
                .shadow(color: AtlasColors.ink.opacity(0.14), radius: 18, y: 8)

            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(.white.opacity(0.48), lineWidth: 1)
                .frame(width: 88, height: 88)

            if state == .loading {
                DeimosIconView(icon: .fork, size: 38, color: AtlasColors.lemon)
                    .rotationEffect(.degrees(animating ? 360 : 0))
                    .animation(.linear(duration: 7.2).repeatForever(autoreverses: false), value: animating)
            } else {
                DeimosIconView(icon: .wifiOff, size: 38, color: AtlasColors.lemon)
            }

            DeimosIconView(icon: .sparkles, size: 18, color: .white)
                .offset(x: 28, y: -30)
                .scaleEffect(animating ? 1.16 : 0.82)
                .opacity(animating ? 1 : 0.62)
                .animation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true), value: animating)
        }
        .accessibilityLabel("Deimos")
    }
}

// MARK: - Launch motion graphic (User → Agent → Idea flow)

private struct LaunchMotion: View {
    let animating: Bool

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 8) {
                launchNode("User", color: AtlasColors.entityUser)
                connection
                launchNode("Agent", color: AtlasColors.entityAgent)
                connection
                launchNode("Idea", color: AtlasColors.entityIdea)
            }
            .frame(height: 44)

            ZStack(alignment: .leading) {
                Capsule()
                    .fill(AtlasColors.rule)
                    .frame(height: 4)

                Capsule()
                    .fill(AtlasColors.primaryGradient)
                    .frame(width: 74, height: 4)
                    .offset(x: animating ? 196 : -12)
                    .animation(.easeInOut(duration: 1.9).repeatForever(autoreverses: false), value: animating)
            }
            .frame(width: 258, height: 4)
            .clipShape(Capsule())
        }
        .frame(maxWidth: .infinity)
    }

    private var connection: some View {
        Rectangle()
            .fill(AtlasColors.rule)
            .frame(width: 20, height: 1)
    }

    private func launchNode(_ title: String, color: Color) -> some View {
        Text(title)
            .font(AtlasTypography.badge())
            .foregroundStyle(AtlasColors.ink)
            .lineLimit(1)
            .minimumScaleFactor(0.82)
            .frame(width: 64, height: 36)
            .background(color)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}
