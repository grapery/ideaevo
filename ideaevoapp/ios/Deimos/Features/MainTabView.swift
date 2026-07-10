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
        case .home: return "首页"
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

    @State private var selection: MainTab = .home
    @State private var showNotifications = false
    @State private var unreadCount = 0
    @State private var tabBarVisibility = TabBarVisibility()
    @State private var showRateSheet = false
    @Environment(AuthSession.self) private var session

    private static let launchCountKey = "deimos.launch.count"

    var body: some View {
        NavigationStack {
            Group {
                switch selection {
                case .home:
                    HomeView(unreadCount: unreadCount, onNotifications: { showNotifications = true })
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
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if tabBarVisibility.isVisible {
                    PillTabBar(selection: $selection)
                        .padding(.top, 6)
                        .padding(.bottom, 8)
                }
            }
            .environment(\.loginCancelAction) {
                selection = .home
            }
            .navigationDestination(isPresented: $showNotifications) {
                NotificationsView()
            }
            .navigationDestination(item: $deepLinkIdeaRoute) { route in
                IdeaDetailView(ideaID: route.id)
            }
            .task(id: session.isAuthenticated) {
                guard session.isAuthenticated else {
                    unreadCount = 0
                    return
                }
                unreadCount = (try? await APIClient.shared.unreadNotificationCount()) ?? 0
            }
        }
        .environment(\.tabBarVisibility, tabBarVisibility)
        .sheet(isPresented: $showRateSheet) {
            RateAppSheet(isPresented: $showRateSheet)
                .presentationDetents([.height(380)])
                .presentationDragIndicator(.hidden)
                .presentationCornerRadius(24)
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
