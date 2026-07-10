import SwiftUI
import Observation

enum UserProfileTab: CaseIterable, Identifiable {
    case ideas, agents

    var id: String {
        switch self {
        case .ideas: return "ideas"
        case .agents: return "agents"
        }
    }

    var title: String {
        switch self {
        case .ideas: return "想法"
        case .agents: return "Agent"
        }
    }
}

@MainActor
@Observable
final class UserProfileViewModel {
    var envelope: UserProfileEnvelope?
    var ideas: [Idea] = []
    var agents: [Agent] = []
    var isLoading = true
    var isLoadingAgents = false
    var errorMessage: String?
    var selectedTab: UserProfileTab = .ideas
    private var agentsLoaded = false

    func load(userID: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let profileTask = APIClient.shared.userPublicProfile(id: userID)
            async let ideasTask = APIClient.shared.getUserIdeas(userID: userID)
            envelope = try await profileTask
            ideas = try await ideasTask
        } catch {
            errorMessage = error.localizedDescription
            envelope = nil
            ideas = []
        }
    }

    func loadAgentsIfNeeded(userID: String) async {
        guard !agentsLoaded else { return }
        isLoadingAgents = true
        defer { isLoadingAgents = false }
        do {
            agents = try await APIClient.shared.getUserAgents(userID: userID)
            agentsLoaded = true
        } catch {
            agents = []
        }
    }

    func toggleFollow(userID: String) async throws {
        guard let envelope else { return }
        if envelope.isFollowing {
            try await APIClient.shared.unfollowUser(id: userID)
        } else {
            try await APIClient.shared.followUser(id: userID)
        }
        self.envelope = try await APIClient.shared.userPublicProfile(id: userID)
    }
}

struct UserProfileView: View {
    let userID: String

    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session
    @State private var viewModel = UserProfileViewModel()
    @State private var showAuthSheet = false
    @State private var ideaRoute: IdeaRoute?
    @State private var agentRoute: AgentRoute?
    @State private var followListRoute: FollowListRoute?
    @State private var showUserActionMenu = false
    @State private var showReportSheet = false
    @State private var showBlockDialog = false
    @State private var showShareSheet = false
    @State private var sharePayload = ""

    private var isSelf: Bool {
        session.user?.id == userID
    }

    private var isSheetZoomActive: Bool {
        showAuthSheet || showUserActionMenu || showReportSheet || showShareSheet
    }

    var body: some View {
        VStack(spacing: 0) {
            AtlasPushNavBar(onBack: { dismiss() }) {
                if !isSelf, viewModel.envelope != nil {
                    AtlasToolbarFloatIconButton(icon: .more) {
                        showUserActionMenu = true
                    }
                }
            }

            Group {
            if viewModel.isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.errorMessage {
                AtlasDesignedEmptyStates.loadFailed(message: error) {
                    Task { await viewModel.load(userID: userID) }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let envelope = viewModel.envelope {
                profileContent(envelope)
            }
        }
        }
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: isSheetZoomActive)
        .navigationBarHidden(true)
        .suppressTabBar()
        .sheet(isPresented: $showAuthSheet) {
            AuthRequiredSheet().presentationDetents([.height(260)])
        }
        .sheet(isPresented: $showUserActionMenu) {
            if let user = viewModel.envelope?.profile.user {
                AtlasActionMenuSheet(actions: [
                    AtlasMenuAction(title: "分享主页") {
                        sharePayload = profileShareURL(for: user)
                        showShareSheet = true
                    },
                    AtlasMenuAction(title: "举报用户") { showReportSheet = true },
                    AtlasMenuAction(title: "拉黑用户", destructive: true) { showBlockDialog = true },
                ]) {
                    showUserActionMenu = false
                }
                .presentationDetents([.height(220)])
            }
        }
        .sheet(isPresented: $showReportSheet) {
            if let user = viewModel.envelope?.profile.user {
                ReportContentSheet(
                    targetLabel: user.name,
                    onSubmit: { reason, detail in
                        showReportSheet = false
                        Task {
                            await ModerationActions.submitReport(
                                targetType: "user",
                                targetID: user.id,
                                reason: reason,
                                detail: detail
                            )
                        }
                    },
                    onCancel: { showReportSheet = false }
                )
                .presentationDetents([.height(360)])
            }
        }
        .overlay {
            if showBlockDialog, let user = viewModel.envelope?.profile.user {
                AtlasCenterDialog(
                    title: "拉黑用户？",
                    message: "拉黑后将不再看到 \(user.name) 的内容。",
                    destructiveTitle: "拉黑",
                    cancelTitle: "取消",
                    onConfirm: {
                        Task {
                            await ModerationActions.blockUser(id: user.id, name: user.name)
                            showBlockDialog = false
                        }
                    },
                    onCancel: { showBlockDialog = false }
                )
            }
        }
        .navigationDestination(item: $ideaRoute) { route in
            IdeaDetailView(ideaID: route.id)
        }
        .navigationDestination(item: $agentRoute) { route in
            AgentProfileView(agentID: route.id)
        }
        .navigationDestination(item: $followListRoute) { route in
            FollowersFollowingView(userID: route.userID, initialKind: route.kind)
        }
        .sheet(isPresented: $showShareSheet) {
            ShareSheet(items: [sharePayload]) {
                showShareSheet = false
            }
        }
        .task(id: userID) {
            await viewModel.load(userID: userID)
        }
        .onChange(of: viewModel.selectedTab) { _, tab in
            if tab == .agents {
                Task { await viewModel.loadAgentsIfNeeded(userID: userID) }
            }
        }
    }

    @ViewBuilder
    private func profileContent(_ envelope: UserProfileEnvelope) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                UserProfileFloatHero(
                    user: envelope.profile.user,
                    stats: envelope.profile,
                    isFollowing: envelope.isFollowing,
                    isSelf: isSelf,
                    onFollow: { Task { await toggleFollow() } },
                    onIdeas: { viewModel.selectedTab = .ideas },
                    onAgents: { viewModel.selectedTab = .agents },
                    onFollowers: {
                        followListRoute = FollowListRoute(userID: userID, kind: .followers)
                    },
                    onFollowing: {
                        followListRoute = FollowListRoute(userID: userID, kind: .following)
                    }
                )

                AtlasSegmentedPill(
                    items: tabLabels,
                    selection: Binding(
                        get: { UserProfileTab.allCases.firstIndex(of: viewModel.selectedTab) ?? 0 },
                        set: { viewModel.selectedTab = UserProfileTab.allCases[$0] }
                    )
                )
                .padding(.horizontal, 16)

                tabContent
                    .padding(.horizontal, 16)
            }
            .padding(.bottom, 40)
        }
    }

    private var tabLabels: [String] {
        UserProfileTab.allCases.map { tab in
            switch tab {
            case .ideas:
                return "\(tab.title) \(viewModel.ideas.count)"
            case .agents:
                return "\(tab.title) \(viewModel.envelope?.profile.agentCount ?? viewModel.agents.count)"
            }
        }
    }

    @ViewBuilder
    private var tabContent: some View {
        switch viewModel.selectedTab {
        case .ideas:
            if viewModel.ideas.isEmpty {
                AtlasDesignedEmptyState(
                    icon: .document,
                    title: "还没有想法",
                    subtitle: "该用户尚未发布想法"
                )
            } else {
                ForEach(viewModel.ideas) { idea in
                    VStack(spacing: 0) {
                        Button {
                            ideaRoute = IdeaRoute(id: idea.id)
                        } label: {
                            IdeaFlatRow(idea: idea)
                        }
                        .buttonStyle(.plain)
                        FeedRowDivider()
                    }
                }
            }
        case .agents:
            if viewModel.isLoadingAgents {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, 24)
            } else if viewModel.agents.isEmpty {
                AtlasDesignedEmptyState(
                    icon: .users,
                    iconTint: AtlasColors.entityAgent.opacity(0.55),
                    title: "暂无 Agent",
                    subtitle: "该用户尚未创建公开 Agent"
                )
            } else {
                ForEach(viewModel.agents) { agent in
                    Button {
                        agentRoute = AgentRoute(id: agent.id)
                    } label: {
                        CompactListCard(
                            leading: {
                                EntityAvatar.agent(id: agent.id, url: agent.avatarLink, name: agent.name, size: 40)
                            },
                            title: agent.name,
                            subtitle: agent.description?.plainSummary,
                            trailing: {
                                DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                            }
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func toggleFollow() async {
        guard session.isAuthenticated else {
            showAuthSheet = true
            return
        }
        do {
            try await viewModel.toggleFollow(userID: userID)
            ToastCenter.shared.showSuccess(viewModel.envelope?.isFollowing == true ? "已关注" : "已取消关注")
        } catch {
            ToastCenter.shared.showError("操作失败", message: error.localizedDescription)
        }
    }

    private func profileShareURL(for user: User) -> String {
        AppConfig.webBaseURL.appending(path: "users/\(user.id)").absoluteString
    }
}

struct FollowListRoute: Identifiable, Hashable {
    let userID: String
    let kind: FollowListKind

    var id: String { "\(userID)-\(kind.rawValue)" }
}
