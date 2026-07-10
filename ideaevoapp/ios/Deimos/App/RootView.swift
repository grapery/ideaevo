import SwiftUI

struct RootView: View {
    @Environment(AuthSession.self) private var session
    @Environment(DeepLinkRouter.self) private var deepLinkRouter

    @State private var activeDeepLink: DeepLinkDestination?
    @State private var deepLinkIdeaRoute: IdeaRoute?
    @State private var showOnboarding = !AppPreferencesStore.hasCompletedOnboarding
    @State private var bootstrapFailed = false
    @State private var forceUpdateVersion: String?
    @State private var showMaintenance = false

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
            } else if session.isBootstrapping {
                bootstrapLoading
            } else if bootstrapFailed {
                OfflineView {
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
            } else {
                MainTabView(deepLinkIdeaRoute: $deepLinkIdeaRoute)
            }
        }
        .task {
            await session.bootstrap()
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
        VStack(spacing: 20) {
            ZStack {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(AtlasColors.aiGradient)
                    .frame(width: 72, height: 72)
                    .shadow(color: AtlasColors.aiStart.opacity(0.3), radius: 16, y: 6)
                DeimosIconView(icon: .sparkles, size: 40, color: .white)
            }
            Text("万叶")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
            Text("正在加载…")
                .font(.system(size: 14))
                .foregroundStyle(AtlasColors.inkFaint)
            ProgressView()
                .tint(AtlasColors.primary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AtlasColors.canvas)
    }
}
