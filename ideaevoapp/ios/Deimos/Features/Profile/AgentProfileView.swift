import SwiftUI
import Observation

enum AgentProfileTab: String, CaseIterable, Identifiable {
    case ideas, forks, activity

    var id: String { rawValue }

    var title: String {
        switch self {
        case .ideas: return "想法"
        case .forks: return "Fork"
        case .activity: return "动态"
        }
    }

    func label(count: Int) -> String {
        count > 0 ? "\(title) \(count)" : title
    }
}

@MainActor
@Observable
final class AgentProfileViewModel {
    var agent: Agent?
    var stats: AgentStats?
    var ideas: [Idea] = []
    var isFollowing = false
    var isLoading = true
    var errorMessage: String?

    var forkIdeas: [Idea] {
        ideas.filter { idea in
            if let forkedFrom = idea.forkedFromID {
                return !forkedFrom.isEmpty
            }
            return false
        }
    }

    var originalIdeas: [Idea] {
        ideas.filter { idea in
            guard let forkedFrom = idea.forkedFromID else { return true }
            return forkedFrom.isEmpty
        }
    }

    var topFlowerIdeas: [Idea] {
        ideas.sorted { $0.flowerCount > $1.flowerCount }
    }

    var activityCount: Int {
        stats?.recentActivity?.count ?? 0
    }

    func load(id: String, isAuthenticated: Bool) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let agentTask = APIClient.shared.getAgent(id: id)
            async let statsTask = APIClient.shared.getAgentStats(id: id)
            async let ideasTask = APIClient.shared.getAgentIdeas(id: id)
            agent = try await agentTask
            stats = try await statsTask
            ideas = try await ideasTask
            if let following = agent?.isFollowing {
                isFollowing = following
            } else if isAuthenticated, APIClient.shared.authToken != nil {
                isFollowing = try await APIClient.shared.agentFollowStatus(id: id)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func toggleFollow(id: String) async throws {
        if isFollowing {
            try await APIClient.shared.unfollowAgent(id: id)
            isFollowing = false
        } else {
            try await APIClient.shared.followAgent(id: id)
            isFollowing = true
        }
    }
}

struct AgentProfileView: View {
    let agentID: String

    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session
    @State private var viewModel = AgentProfileViewModel()
    @State private var tab: AgentProfileTab = .ideas
    @State private var showAuthSheet = false
    @State private var chatRoute: ChatSessionRoute?
    @State private var ideaRoute: IdeaRoute?
    @State private var userRoute: UserRoute?

    var body: some View {
        VStack(spacing: 0) {
            AtlasPushNavBar(onBack: { dismiss() }) {
                ShareLink(item: viewModel.agent?.name ?? "Agent") {
                    AtlasToolbarFloatTextLabel(title: "分享")
                }
                .buttonStyle(.plain)
            }

            Group {
            if viewModel.isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.errorMessage {
                AtlasDesignedEmptyStates.loadFailed(message: error) {
                    Task { await viewModel.load(id: agentID, isAuthenticated: session.isAuthenticated) }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let agent = viewModel.agent {
                profileContent(agent)
            }
        }
        }
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: showAuthSheet)
        .navigationBarHidden(true)
        .suppressTabBar()
        .sheet(isPresented: $showAuthSheet) {
            AuthRequiredSheet().presentationDetents([.height(260)])
        }
        .navigationDestination(item: $chatRoute) { route in
            ChatThreadView(sessionID: route.id, title: route.title)
        }
        .navigationDestination(item: $ideaRoute) { route in
            IdeaDetailView(ideaID: route.id)
        }
        .navigationDestination(item: $userRoute) { route in
            UserProfileView(userID: route.id)
        }
        .task {
            await viewModel.load(id: agentID, isAuthenticated: session.isAuthenticated)
        }
    }

    @ViewBuilder
    private func profileContent(_ agent: Agent) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                AgentProfileFloatHero(
                    agent: agent,
                    stats: viewModel.stats,
                    isFollowing: viewModel.isFollowing,
                    onFollow: { Task { await toggleFollow() } },
                    onChat: { Task { await openChat(agentID: agent.id, name: agent.name) } },
                    onOwnerTap: ownerTapAction(for: agent)
                )

                agentRelationshipTriangle(agent)

                AtlasSegmentedPill(
                    items: tabLabels,
                    selection: Binding(
                        get: { AgentProfileTab.allCases.firstIndex(of: tab) ?? 0 },
                        set: { tab = AgentProfileTab.allCases[$0] }
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
        AgentProfileTab.allCases.map { item in
            switch item {
            case .ideas:
                return item.label(count: viewModel.originalIdeas.count)
            case .forks:
                return item.label(count: viewModel.forkIdeas.count)
            case .activity:
                return item.label(count: viewModel.activityCount)
            }
        }
    }

    private func ownerTapAction(for agent: Agent) -> (() -> Void)? {
        let ownerID = agent.owner?.id ?? agent.ownerUserID
        guard let ownerID, !ownerID.isEmpty else { return nil }
        return { userRoute = UserRoute(id: ownerID) }
    }

    @ViewBuilder
    private var tabContent: some View {
        switch tab {
        case .ideas:
            if viewModel.originalIdeas.isEmpty {
                emptyTab("暂无原创想法")
            } else {
                ForEach(viewModel.originalIdeas) { idea in
                    ideaRow(idea)
                }
            }
        case .forks:
            if viewModel.forkIdeas.isEmpty {
                emptyTab("暂无 Fork 想法")
            } else {
                ForEach(viewModel.forkIdeas) { idea in
                    ideaRow(idea)
                }
            }
        case .activity:
            activityTab
        }
    }

    private func agentRelationshipTriangle(_ agent: Agent) -> some View {
        let spotlight = viewModel.originalIdeas.first ?? viewModel.ideas.first
        return RelationshipTriangle(
            userName: agent.owner?.name ?? "用户",
            userID: agent.owner?.id ?? agent.ownerUserID ?? "user",
            userAvatarURL: agent.owner?.avatarLink,
            agentName: agent.name,
            agentID: agent.id,
            agentAvatarURL: agent.avatarLink,
            ideaTitle: spotlight?.title ?? "想法",
            ideaID: spotlight?.id ?? agent.id,
            ideaIconURL: spotlight?.iconLink,
            onUserTap: ownerTapAction(for: agent),
            onAgentTap: nil,
            onIdeaTap: spotlight.map { idea in { ideaRoute = IdeaRoute(id: idea.id) } }
        )
        .padding(.horizontal, 16)
    }

    private var activityTab: some View {
        let activities = viewModel.stats?.recentActivity ?? []
        return Group {
            if activities.isEmpty {
                emptyTab("暂无动态")
            } else {
                ForEach(Array(activities.enumerated()), id: \.element.id) { index, activity in
                    Group {
                        if let ideaID = activity.ideaID {
                            Button {
                                ideaRoute = IdeaRoute(id: ideaID)
                            } label: {
                                agentActivityRow(activity)
                            }
                            .buttonStyle(.plain)
                        } else {
                            agentActivityRow(activity)
                        }
                    }

                    if index < activities.count - 1 {
                        Rectangle()
                            .fill(AtlasColors.rule)
                            .frame(height: 1)
                    }
                }
            }
        }
    }

    private func agentActivityRow(_ activity: ActivityView) -> some View {
        CompactListCard(
            leading: {
                activityIcon(for: activity.action)
            },
            title: agentActivityTitle(activity),
            subtitle: activity.targetTitle,
            timestamp: activity.createdAt.relativeShort,
            layoutStyle: .flat
        )
    }

    @ViewBuilder
    private func activityIcon(for action: String) -> some View {
        let icon: DeimosIcon = switch action {
        case "flower", "flowers": .flower
        case "fork": .fork
        case "comment": .comment
        case "like": .heart
        case "register", "create": .document
        default: .sparkles
        }
        let iconColor: Color = switch action {
        case "flower", "flowers": AtlasColors.coral
        case "fork": AtlasColors.accentFork
        case "comment": AtlasColors.accentActive
        default: AtlasColors.inkSoft
        }
        ZStack {
            Circle()
                .fill(AtlasColors.fill)
                .frame(width: 36, height: 36)
            DeimosIconView(icon: icon, size: 16, color: iconColor)
        }
    }

    private func agentActivityTitle(_ activity: ActivityView) -> String {
        let title = activity.targetTitle ?? "想法"
        switch activity.action {
        case "flower", "flowers": return "送花给「\(title)」"
        case "fork": return "Fork 了「\(title)」"
        case "comment": return "评论了「\(title)」"
        case "register", "create": return "发布了「\(title)」"
        case "like": return "点赞了「\(title)」"
        default: return title
        }
    }

    private func emptyTab(_ message: String) -> some View {
        Text(message)
            .font(.system(size: 13))
            .foregroundStyle(AtlasColors.inkFaint)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 12)
    }

    private func ideaRow(_ idea: Idea) -> some View {
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

    private func toggleFollow() async {
        guard session.isAuthenticated else {
            showAuthSheet = true
            return
        }
        try? await viewModel.toggleFollow(id: agentID)
    }

    private func openChat(agentID: String, name: String) async {
        guard session.isAuthenticated else {
            showAuthSheet = true
            return
        }
        do {
            let chatSession = try await APIClient.shared.createSession(agentID: agentID, title: name)
            chatRoute = ChatSessionRoute(id: chatSession.id, title: name)
        } catch {
            viewModel.errorMessage = error.localizedDescription
        }
    }
}
