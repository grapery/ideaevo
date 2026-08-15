import SwiftUI
import Observation

@MainActor
@Observable
final class TabBarVisibility {
    private(set) var suppressionDepth = 0

    var isVisible: Bool { suppressionDepth == 0 }

    func pushSuppression() {
        suppressionDepth += 1
    }

    func popSuppression() {
        suppressionDepth = max(0, suppressionDepth - 1)
    }
}

private enum TabBarVisibilityKey: EnvironmentKey {
    static let defaultValue: TabBarVisibility? = nil
}

extension EnvironmentValues {
    var tabBarVisibility: TabBarVisibility? {
        get { self[TabBarVisibilityKey.self] }
        set { self[TabBarVisibilityKey.self] = newValue }
    }
}

private struct SuppressTabBarModifier: ViewModifier {
    @Environment(\.tabBarVisibility) private var tabBarVisibility

    func body(content: Content) -> some View {
        content
            .onAppear { tabBarVisibility?.pushSuppression() }
            .onDisappear { tabBarVisibility?.popSuppression() }
    }
}

extension View {
    func suppressTabBar() -> some View {
        modifier(SuppressTabBarModifier())
    }
}

enum MainTab: CaseIterable {
    case home, chat, activity, profile

    var title: String {
        switch self {
        case .home: return "探索"
        case .chat: return "对话"
        case .activity: return "动态"
        case .profile: return "我的"
        }
    }

    var icon: DeimosIcon {
        switch self {
        case .home: return .home
        case .chat: return .chat
        case .activity: return .activity
        case .profile: return .profile
        }
    }

}

struct MainTabView: View {
    @Binding var deepLinkIdeaRoute: IdeaRoute?

    @Environment(AuthSession.self) private var session
    @State private var selection: MainTab = .home
    @State private var tabBarVisibility = TabBarVisibility()
    @State private var showRateSheet = false
    @State private var debugAgentRoute: AgentRoute?
    @State private var debugUserRoute: UserRoute?
    @State private var showGuestLogin = false

    private static let launchCountKey = "deimos.launch.count"

    private var isGuestBrowse: Bool {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--deimos-preview-guest") {
            return true
        }
        #endif
        return !session.isAuthenticated
    }

    /// Device bottom safe-area inset (home indicator zone). Used to position the floating tab
    /// bar pill at the true screen edge — `overlay(alignment: .bottom)` otherwise anchors to the
    /// safe-area inner edge and leaves a gap below the pill.
    private var safeBottomInset: CGFloat {
        (UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }?
            .safeAreaInsets.bottom) ?? 34
    }

    var body: some View {
        // ardot 237:80: floating glass pill ~9pt above the true screen bottom edge. The tab
        // bar lives OUTSIDE the NavigationStack (in this ZStack) so it is not constrained by
        // the NavigationStack's safe-area management — `.ignoresSafeArea(edges: .bottom)` on
        // the pill then reliably moves its bottom anchor to the real screen edge, and
        // `.padding(.bottom, 9)` lifts it just above the home indicator zone. Inside the
        // NavigationStack, ignoresSafeArea was being overridden and the pill sat ~64pt above
        // the edge (safe-area inner edge + padding), leaving the large gap users reported.
        ZStack(alignment: .bottom) {
            NavigationStack {
                Group {
                    switch selection {
                    case .home:
                        HomeView()
                    case .chat:
                        ChatListView()
                    case .activity:
                        ActivityScreen()
                    case .profile:
                        ProfileView()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(AtlasColors.canvas)
                .environment(\.loginCancelAction) {
                    selection = .home
                }
                .navigationDestination(item: $deepLinkIdeaRoute) { route in
                    IdeaDetailView(ideaID: route.id)
                }
                .navigationDestination(item: $debugAgentRoute) { route in
                    AgentProfileView(agentID: route.id)
                }
                .navigationDestination(item: $debugUserRoute) { route in
                    UserProfileView(userID: route.id)
                }
            }

            if tabBarVisibility.isVisible {
                NativeTabBar(selection: $selection)
            }

            if tabBarVisibility.isVisible, isGuestBrowse, selection == .home {
                GuestBrowseCTABar {
                    showGuestLogin = true
                }
                // The tab component's 83pt frame contains ~26pt of transparent safe-area
                // material. Position against its visible pill so the CTA occupies S12G y689–761.
                .padding(.bottom, 57)
            }
        }
        .environment(\.tabBarVisibility, tabBarVisibility)
        #if DEBUG
        // Verify-only launch hook: pass `--deimos-tab-activity` to deep-link straight to the
        // Activity tab for visual review against the ardot S08 design spec.
        // `--deimos-tab-profile` switches to the Profile tab so its own deep-link hooks
        // (--deimos-goto-settings / --deimos-goto-notifications) can fire.
        // `--deimos-goto-idea=<id>` deep-links straight to an idea detail screen.
        .onAppear {
            if ProcessInfo.processInfo.arguments.contains("--deimos-tab-activity") {
                selection = .activity
            } else if ProcessInfo.processInfo.arguments.contains("--deimos-tab-profile") {
                selection = .profile
            } else if ProcessInfo.processInfo.arguments.contains("--deimos-tab-chat") {
                selection = .chat
            }
            if let ideaArg = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--deimos-goto-idea=") }) {
                let id = ideaArg.replacingOccurrences(of: "--deimos-goto-idea=", with: "")
                if !id.isEmpty { deepLinkIdeaRoute = IdeaRoute(id: id) }
            }
            if let agentArg = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--deimos-goto-agent=") }) {
                let id = agentArg.replacingOccurrences(of: "--deimos-goto-agent=", with: "")
                if !id.isEmpty { debugAgentRoute = AgentRoute(id: id) }
            }
            if let userArg = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--deimos-goto-user=") }) {
                let id = userArg.replacingOccurrences(of: "--deimos-goto-user=", with: "")
                if !id.isEmpty { debugUserRoute = UserRoute(id: id) }
            }
        }
        #endif
        .sheet(isPresented: $showRateSheet) {
            RateAppSheet(isPresented: $showRateSheet)
                .presentationDetents([.height(380)])
                .presentationDragIndicator(.hidden)
                .presentationCornerRadius(24)
        }
        .sheet(isPresented: $showGuestLogin) {
            NavigationStack {
                LoginView(initialRegister: false, onCancel: { showGuestLogin = false })
            }
        }
        .onAppear {
            incrementLaunchCount()
        }
    }

    private func incrementLaunchCount() {
        let count = UserDefaults.standard.integer(forKey: Self.launchCountKey) + 1
        UserDefaults.standard.set(count, forKey: Self.launchCountKey)
        // Show rate prompt on 5th, 20th, and 50th launch (if not already rated)
        if count == 5 || count == 20 || count == 50 {
            let lastRated = UserDefaults.standard.bool(forKey: "deimos.rated")
            if !lastRated {
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                    showRateSheet = true
                }
            }
        }
    }
}

/// Ardot S12G (`237:617`): persistent guest affordance immediately above the floating tab bar.
private struct GuestBrowseCTABar: View {
    let onLogin: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Text("登录后可送花、评论和 Fork")
                .font(.system(size: 14))
                .foregroundStyle(AtlasColors.inkSoft)
                .lineLimit(1)

            Spacer(minLength: 4)

            Button("登录", action: onLogin)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AtlasColors.lemonInk)
                .frame(width: 104, height: 40)
                .background(AtlasColors.lemonStrong)
                .clipShape(Capsule())
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .frame(height: 72)
        .background(AtlasColors.surface.opacity(0.98))
        .overlay(alignment: .top) {
            Rectangle().fill(AtlasColors.rule).frame(height: 0.5)
        }
    }
}
