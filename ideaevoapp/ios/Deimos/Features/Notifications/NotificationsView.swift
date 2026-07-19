import SwiftUI
import Observation

enum NotificationCategory: String, CaseIterable, Identifiable {
    case all, flower, fork

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: return "全部"
        case .flower: return "送花"
        case .fork: return "Fork"
        }
    }

    func matches(_ item: AppNotification) -> Bool {
        switch self {
        case .all: return true
        case .flower: return item.action == "flower" || item.action == "flowers"
        case .fork: return item.action == "fork"
        }
    }
}

@MainActor
@Observable
final class NotificationsViewModel {
    var items: [AppNotification] = []
    var isLoading = false
    var isLoadingMore = false
    var hasMore = true
    var errorMessage: String?

    private let pageSize = 30
    private var offset = 0

    func load() async {
        isLoading = items.isEmpty
        errorMessage = nil
        defer { isLoading = false }
        do {
            let response = try await APIClient.shared.notifications(limit: pageSize, offset: 0)
            items = response.items
            offset = response.items.count
            hasMore = Pagination.hasMore(offset: offset, loaded: response.items.count, total: response.total)
        } catch {
            errorMessage = error.localizedDescription
            items = []
        }
    }

    func loadMore() async {
        guard hasMore, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let response = try await APIClient.shared.notifications(limit: pageSize, offset: offset)
            items.append(contentsOf: response.items)
            offset = items.count
            hasMore = Pagination.hasMore(offset: offset, loaded: response.items.count, total: response.total)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func markAllRead() async {
        try? await APIClient.shared.markAllNotificationsRead()
        await load()
    }

    func markRead(id: String) async {
        try? await APIClient.shared.markNotificationRead(id: id)
        await load()
    }
}

struct NotificationsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = NotificationsViewModel()
    @State private var category: NotificationCategory = .all
    @State private var ideaRoute: IdeaRoute?
    @State private var userRoute: UserRoute?
    @State private var agentRoute: AgentRoute?

    private var filteredItems: [AppNotification] {
        viewModel.items.filter { item in
            guard category.matches(item) else { return false }
            guard AppPreferencesStore.shouldShowNotification(action: item.action) else { return false }
            return BlocklistFiltering.notification(item)
        }
    }

    private var unreadCount: Int {
        filteredItems.filter { !$0.isRead }.count
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(NotificationCategory.allCases) { item in
                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                category = item
                            }
                        } label: {
                            Text(item.title)
                                .font(.system(size: 14, weight: category == item ? .semibold : .regular))
                                .foregroundStyle(category == item ? .white : AtlasColors.inkSoft)
                                .padding(.horizontal, 14)
                                .frame(height: 32)
                                .background(category == item ? AtlasColors.primary : AtlasColors.surfaceSecondary)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, AtlasMetrics.detailX)
            }
            .padding(.top, 8)
            .padding(.bottom, 12)

            if viewModel.isLoading && viewModel.items.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if let error = viewModel.errorMessage, viewModel.items.isEmpty {
                AtlasDesignedEmptyStates.loadFailed(message: error) {
                    Task { await viewModel.load() }
                }
                .frame(maxHeight: .infinity)
            } else if viewModel.items.isEmpty {
                AtlasDesignedEmptyStates.notificationsEmpty { dismiss() }
                    .frame(maxHeight: .infinity)
            } else if filteredItems.isEmpty {
                AtlasDesignedEmptyStates.notificationsCategoryEmpty()
                    .frame(maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        if unreadCount > 0 {
                            Button {
                                Task { await viewModel.markAllRead() }
                            } label: {
                                HStack(spacing: 8) {
                                    Text("\(unreadCount) 条未读 · 评论、关注和 Agent 更新")
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundStyle(AtlasColors.lemonInk)
                                        .lineLimit(1)
                                    Spacer(minLength: 4)
                                    Text("全部已读")
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundStyle(AtlasColors.ink)
                                }
                                .padding(.horizontal, 14)
                                .frame(height: 48)
                                .background(AtlasColors.lemonSoft)
                                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                        ForEach(Array(filteredItems.enumerated()), id: \.element.id) { index, item in
                            notificationCell(item)
                            .onAppear {
                                if index == filteredItems.count - 1 {
                                    Task { await viewModel.loadMore() }
                                }
                            }
                        }
                        if viewModel.isLoadingMore {
                            ProgressView().padding(.vertical, 12)
                        }
                    }
                    .padding(.top, 4)
                    .padding(.bottom, 16)
                    .padding(.horizontal, AtlasMetrics.detailX)
                }
            }
        }
        .background(AtlasColors.canvas)
        .safeAreaInset(edge: .top, spacing: 0) {
            AtlasOverlayPushNavBar(title: "通知", onBack: { dismiss() })
        }
        .navigationBarHidden(true)
        .suppressTabBar()
        .navigationDestination(item: $ideaRoute) { route in
            IdeaDetailView(ideaID: route.id)
        }
        .navigationDestination(item: $userRoute) { route in
            UserProfileView(userID: route.id)
        }
        .navigationDestination(item: $agentRoute) { route in
            AgentProfileView(agentID: route.id)
        }
        .task { await viewModel.load() }
    }

    private func notificationCell(_ item: AppNotification) -> some View {
        let iconStyle = notificationIconStyle(for: item.action)

        return Button {
            Task {
                await viewModel.markRead(id: item.id)
                openDestination(for: item)
            }
        } label: {
            CompactListCard(
                leading: {
                    ZStack(alignment: .topTrailing) {
                        if let url = item.actorAvatarLink {
                            if item.actorType == "agent" {
                                EntityAvatar.agent(id: item.actorID, url: url, name: item.actorName, size: 36)
                            } else {
                                EntityAvatar.user(id: item.actorID, url: url, name: item.actorName, size: 36)
                            }
                        } else {
                            ZStack {
                                Circle()
                                    .fill(iconStyle.color)
                                    .frame(width: 36, height: 36)
                                DeimosIconView(icon: iconStyle.icon, size: 16, color: .white)
                            }
                        }
                        if !item.isRead {
                            Circle()
                                .fill(AtlasColors.primary)
                                .frame(width: 8, height: 8)
                                .offset(x: 2, y: -2)
                        }
                    }
                },
                title: item.title,
                subtitle: item.listSubtitle,
                timestamp: item.createdAt.relativeShort,
                cardBackground: item.isRead ? AtlasColors.surface : AtlasColors.notificationUnread,
                layoutStyle: .card
            )
        }
        .buttonStyle(.plain)
    }

    private func notificationIconStyle(for action: String) -> (icon: DeimosIcon, color: Color) {
        switch action {
        case "flower", "flowers":
            return (.flower, AtlasColors.coral)
        case "comment":
            return (.comment, AtlasColors.accentActive)
        case "follow":
            return (.users, AtlasColors.entityUser.opacity(0.85))
        case "fork":
            return (.fork, AtlasColors.accentFork)
        default:
            return (.bell, AtlasColors.inkFaint)
        }
    }

    private func openDestination(for item: AppNotification) {
        switch item.targetType {
        case "idea":
            ideaRoute = IdeaRoute(id: item.targetID)
        case "user":
            if item.action == "follow" {
                userRoute = UserRoute(id: item.actorID)
            } else {
                userRoute = UserRoute(id: item.targetID)
            }
        case "agent":
            agentRoute = AgentRoute(id: item.targetID)
        default:
            if item.actorType == "user" {
                userRoute = UserRoute(id: item.actorID)
            } else if item.actorType == "agent" {
                agentRoute = AgentRoute(id: item.actorID)
            }
        }
    }
}
