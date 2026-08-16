import SwiftUI
import Observation


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
    @State private var ideaRoute: IdeaRoute?
    @State private var userRoute: UserRoute?
    @State private var agentRoute: AgentRoute?

    private var filteredItems: [AppNotification] {
        viewModel.items.filter { item in
            guard AppPreferencesStore.shouldShowNotification(action: item.action) else { return false }
            return BlocklistFiltering.notification(item)
        }
    }

    private var unreadCount: Int {
        filteredItems.filter { !$0.isRead }.count
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // S09 Header (ardot 715405210175453 `2:498`) — 通知 Bold-22 + lemonSoft
                // 全部已读 chip (r15, olive Medium-12).
                HStack {
                    Text("通知")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(AtlasColors.ink)
                    Spacer()
                    if unreadCount > 0 {
                        Button {
                            Task { await viewModel.markAllRead() }
                        } label: {
                            Text("全部已读")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(AtlasColors.olive)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(
                                    Capsule(style: .continuous)
                                        .fill(AtlasColors.lemonSoft)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.top, 6)

                if viewModel.isLoading && viewModel.items.isEmpty {
                    Color.clear.frame(height: 1)
                } else if let error = viewModel.errorMessage, viewModel.items.isEmpty {
                    AtlasDesignedEmptyStates.loadFailed(message: error) {
                        Task { await viewModel.load() }
                    }
                    .padding(.top, 40)
                } else if viewModel.items.isEmpty {
                    AtlasDesignedEmptyStates.notificationsEmpty {
                        dismiss()
                    }
                        .padding(.top, 40)
                } else if filteredItems.isEmpty {
                    AtlasDesignedEmptyStates.notificationsCategoryEmpty()
                        .padding(.top, 40)
                } else {
                    // S09 grouping — 今天 / 更早 sections with 12pt SemiBold inkSoft labels.
                    let todayItems = filteredItems.filter { Calendar.current.isDateInToday($0.createdAt) }
                    let earlierItems = filteredItems.filter { !Calendar.current.isDateInToday($0.createdAt) }

                    LazyVStack(alignment: .leading, spacing: 0) {
                        if !todayItems.isEmpty {
                            Text("今天")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(AtlasColors.inkSoft)
                                .padding(.bottom, 6)
                        }
                        ForEach(Array(todayItems.enumerated()), id: \.element.id) { index, item in
                            notificationCell(item)
                                .onAppear {
                                    if index == todayItems.count - 1, earlierItems.isEmpty {
                                        Task { await viewModel.loadMore() }
                                    }
                                }
                        }

                        if !earlierItems.isEmpty {
                            Text("更早")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(AtlasColors.inkSoft)
                                .padding(.top, 14)
                                .padding(.bottom, 6)
                        }
                        ForEach(Array(earlierItems.enumerated()), id: \.element.id) { index, item in
                            notificationCell(item)
                                .onAppear {
                                    if index == earlierItems.count - 1 {
                                        Task { await viewModel.loadMore() }
                                    }
                                }
                        }

                        if viewModel.isLoadingMore {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 16)
        }
        .background(AtlasColors.canvas)
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

    /// S09 notification row (ardot 715405210175453 `2:498`): 34pt avatar (or tinted icon
    /// circle), 13pt Regular text (ink when unread, inkTertiary when read), 11pt timestamp,
    /// trailing 8pt lemonStrong unread dot.
    private func notificationCell(_ item: AppNotification) -> some View {
        let iconStyle = notificationIconStyle(for: item.action)

        return Button {
            Task {
                await viewModel.markRead(id: item.id)
                openDestination(for: item)
            }
        } label: {
            HStack(alignment: .top, spacing: 10) {
                if let url = item.actorAvatarLink {
                    if item.actorType == "agent" {
                        EntityAvatar.agent(id: item.actorID, url: url, name: item.actorName, size: 34)
                    } else {
                        EntityAvatar.user(id: item.actorID, url: url, name: item.actorName, size: 34)
                    }
                } else {
                    ZStack {
                        Circle()
                            .fill(iconStyle.background)
                            .frame(width: 34, height: 34)
                        DeimosIconView(icon: iconStyle.icon, size: 15, color: iconStyle.color)
                    }
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.system(size: 13))
                        .foregroundStyle(item.isRead ? AtlasColors.inkTertiary : AtlasColors.ink)
                        .lineSpacing(6)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Text(item.createdAt.relativeShort)
                        .font(.system(size: 11))
                        .foregroundStyle(item.isRead ? AtlasColors.inkFaint : AtlasColors.inkSoft)
                }
                Spacer(minLength: 0)
                if !item.isRead {
                    Circle()
                        .fill(AtlasColors.lemonStrong)
                        .frame(width: 8, height: 8)
                        .padding(.top, 5)
                }
            }
            .padding(.vertical, 4)
            .frame(minHeight: 37)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// S09 icon circles — soft fills (lemonSoft/surfaceSecondary) with colored glyphs.
    private func notificationIconStyle(for action: String) -> (icon: DeimosIcon, color: Color, background: Color) {
        switch action {
        case "flower", "flowers":
            return (.flower, AtlasColors.olive, AtlasColors.lemonSoft)
        case "comment":
            return (.comment, AtlasColors.olive, AtlasColors.lemonSoft)
        case "follow":
            return (.users, AtlasColors.success, AtlasColors.successSoft)
        case "fork":
            return (.fork, AtlasColors.olive, AtlasColors.lemonSoft)
        default:
            return (.bell, AtlasColors.success, AtlasColors.surfaceSecondary)
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
