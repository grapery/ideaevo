import SwiftUI
import Observation

enum FollowListKind: String, CaseIterable, Identifiable {
    case followers
    case following

    var id: String { rawValue }

    var title: String {
        switch self {
        case .followers: return "粉丝"
        case .following: return "关注"
        }
    }
}

@MainActor
@Observable
final class FollowersFollowingViewModel {
    var users: [User] = []
    var query = ""
    var isLoading = false
    var isLoadingMore = false
    var hasMore = true
    var errorMessage: String?
    var followedIDs: Set<String> = []
    var followingInProgress: Set<String> = []

    private let pageSize = 50
    private var offset = 0
    private var kind: FollowListKind = .followers
    private var userID: String = ""

    var filteredUsers: [User] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return users }
        return users.filter { $0.name.localizedCaseInsensitiveContains(trimmed) }
    }

    func load(userID: String, kind: FollowListKind, viewerID: String?) async {
        self.userID = userID
        self.kind = kind
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let resp = try await fetchPage(offset: 0)
            users = resp.users
            offset = resp.users.count
            hasMore = Pagination.hasMore(offset: offset, loaded: resp.users.count, total: resp.total)
            followedIDs = Set(resp.followingIDs)
            if kind == .following, userID == viewerID {
                followedIDs.formUnion(resp.users.map(\.id))
            }
        } catch {
            errorMessage = error.localizedDescription
            users = []
        }
    }

    func loadMore(viewerID: String?) async {
        guard hasMore, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let resp = try await fetchPage(offset: offset)
            users.append(contentsOf: resp.users)
            offset = users.count
            hasMore = Pagination.hasMore(offset: offset, loaded: resp.users.count, total: resp.total)
            followedIDs.formUnion(resp.followingIDs)
            if kind == .following, userID == viewerID {
                followedIDs.formUnion(resp.users.map(\.id))
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func follow(userID: String) async {
        guard !followingInProgress.contains(userID) else { return }
        followingInProgress.insert(userID)
        defer { followingInProgress.remove(userID) }
        do {
            try await APIClient.shared.followUser(id: userID)
            followedIDs.insert(userID)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func unfollow(userID: String) async {
        guard !followingInProgress.contains(userID) else { return }
        followingInProgress.insert(userID)
        defer { followingInProgress.remove(userID) }
        do {
            try await APIClient.shared.unfollowUser(id: userID)
            followedIDs.remove(userID)
            if kind == .following {
                users.removeAll { $0.id == userID }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func fetchPage(offset: Int) async throws -> UsersListResponse {
        switch kind {
        case .followers:
            return try await APIClient.shared.getFollowers(userID: userID, limit: pageSize, offset: offset)
        case .following:
            return try await APIClient.shared.getFollowing(userID: userID, limit: pageSize, offset: offset)
        }
    }
}

struct FollowersFollowingView: View {
    let userID: String
    let initialKind: FollowListKind

    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session
    @State private var viewModel = FollowersFollowingViewModel()
    @State private var kind: FollowListKind
    @State private var userRoute: UserRoute?
    @State private var showAgentExplore = false

    init(userID: String, initialKind: FollowListKind) {
        self.userID = userID
        self.initialKind = initialKind
        _kind = State(initialValue: initialKind)
    }

    var body: some View {
        VStack(spacing: 0) {
            settingsBackHeader(title: kind.title, dismiss: dismiss)

            AtlasSegmentedPill(
                items: FollowListKind.allCases.map(\.title),
                selection: Binding(
                    get: { FollowListKind.allCases.firstIndex(of: kind) ?? 0 },
                    set: { kind = FollowListKind.allCases[$0] }
                )
            )
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.bottom, 12)

            AtlasEmbeddedSearchBar(
                placeholder: "搜索用户",
                text: $viewModel.query,
                onSubmit: {}
            )
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.bottom, 12)

            if viewModel.isLoading && viewModel.users.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if let error = viewModel.errorMessage, viewModel.users.isEmpty {
                AtlasDesignedEmptyStates.loadFailed(message: error) {
                    Task { await viewModel.load(userID: userID, kind: kind, viewerID: session.user?.id) }
                }
            } else if viewModel.filteredUsers.isEmpty {
                if kind == .following, userID == session.user?.id, viewModel.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    AtlasDesignedEmptyStates.followingEmpty {
                        showAgentExplore = true
                    }
                } else {
                    AtlasDesignedEmptyStates.listEmpty(
                        title: "暂无\(kind.title)",
                        subtitle: viewModel.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            ? "列表还是空的"
                            : "没有匹配的用户"
                    )
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(Array(viewModel.filteredUsers.enumerated()), id: \.element.id) { index, user in
                            userRow(user)
                                .onAppear {
                                    if index == viewModel.filteredUsers.count - 1 {
                                        Task { await viewModel.loadMore(viewerID: session.user?.id) }
                                    }
                                }
                        }
                        if viewModel.isLoadingMore {
                            ProgressView().padding(.vertical, 12)
                        }
                    }
                    .padding(.horizontal, AtlasMetrics.pageX)
                    .padding(.bottom, 24)
                }
            }
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
        .navigationDestination(item: $userRoute) { route in
            UserProfileView(userID: route.id)
        }
        .navigationDestination(isPresented: $showAgentExplore) {
            AgentExploreView()
        }
        .task(id: kind) {
            await viewModel.load(userID: userID, kind: kind, viewerID: session.user?.id)
        }
    }

    @ViewBuilder
    private func userRow(_ user: User) -> some View {
        let isSelf = session.user?.id == user.id
        let isFollowed = viewModel.followedIDs.contains(user.id)
        let isOwnFollowingList = kind == .following && userID == session.user?.id
        let showFollow = !isSelf && session.isAuthenticated && !isFollowed
        let showUnfollow = !isSelf && session.isAuthenticated && isFollowed && isOwnFollowingList

        HStack(spacing: 10) {
            Button {
                userRoute = UserRoute(id: user.id)
            } label: {
                CompactListCard(
                    leading: {
                        EntityAvatar.user(id: user.id, url: user.avatarLink, name: user.name, size: 40)
                    },
                    title: user.name,
                    subtitle: user.bio?.plainSummary,
                    trailing: {
                        if showFollow || showUnfollow {
                            EmptyView()
                        } else if !isSelf, isFollowed {
                            Text("已关注")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(AtlasColors.accentActive)
                        } else {
                            DeimosIconView(icon: .chevronRight, size: 13, color: AtlasColors.inkFaint)
                        }
                    }
                )
            }
            .buttonStyle(.plain)

            if showFollow {
                followButton(user: user, title: "关注") {
                    Task { await viewModel.follow(userID: user.id) }
                }
            } else if showUnfollow {
                followButton(user: user, title: "取关", outline: true) {
                    Task { await viewModel.unfollow(userID: user.id) }
                }
            }
        }
    }

    private func followButton(user: User, title: String, outline: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(viewModel.followingInProgress.contains(user.id) ? "…" : title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(outline ? AtlasColors.ink : .white)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(outline ? AtlasColors.surface : AtlasColors.primary)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(viewModel.followingInProgress.contains(user.id))
    }
}
