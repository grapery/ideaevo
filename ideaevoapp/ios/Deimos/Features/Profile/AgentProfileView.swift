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
    @State private var editorRoute: AgentEditorRoute?

    var body: some View {
        ZStack(alignment: .top) {
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

            AtlasOverlayPushNavBar(onBack: { dismiss() }) {
                if let agent = viewModel.agent, isOwner(agent) {
                    AtlasToolbarFloatIconButton(icon: .edit) {
                        editorRoute = AgentEditorRoute(id: agent.id)
                    }
                }
                ShareLink(item: viewModel.agent?.name ?? "Agent") {
                    DeimosIconView(icon: .share, size: 17, color: AtlasColors.ink)
                        .frame(width: AtlasMetrics.toolbarVisualSize, height: AtlasMetrics.toolbarVisualSize)
                        .atlasToolbarFloat()
                        .frame(width: AtlasMetrics.touchTarget, height: AtlasMetrics.touchTarget)
                }
                .buttonStyle(.plain)
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
        .navigationDestination(item: $editorRoute) { route in
            AgentEditorView(agentID: route.id)
        }
        .task {
            await viewModel.load(id: agentID, isAuthenticated: session.isAuthenticated)
        }
    }

    @ViewBuilder
    private func profileContent(_ agent: Agent) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 20) {
                    AgentIdentityCard(
                        agent: agent,
                        stats: viewModel.stats,
                        onOwnerTap: ownerTapAction(for: agent)
                    )
                    agentStatsBand(agent)
                    agentActionBar(agent)
                    agentTabBar
                    tabContent
                }
                .padding(.horizontal, AtlasMetrics.pageX)
                .padding(.top, 72)
                .padding(.bottom, 40)
            }
        }
    }

    private var agentHero: some View {
        ZStack(alignment: .bottomLeading) {
            Rectangle()
                .fill(AtlasColors.ink)
                .frame(height: 180)
            Circle()
                .fill(AtlasColors.lemon)
                .frame(width: 80, height: 80)
                .offset(x: AtlasMetrics.pageX)
        }
        .frame(maxWidth: .infinity)
    }

    private func tabCount(for item: AgentProfileTab) -> Int {
        switch item {
        case .ideas: return viewModel.originalIdeas.count
        case .forks: return viewModel.forkIdeas.count
        case .activity: return viewModel.activityCount
        }
    }

    /// Ardot 246:98 / S10 — H-scroll tabs: 想法 / Fork / 动态.
    private var agentTabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(AgentProfileTab.allCases) { item in
                    let selected = tab == item
                    Button {
                        tab = item
                    } label: {
                        Text(item.label(count: tabCount(for: item)))
                            .font(.system(size: 14, weight: selected ? .semibold : .medium))
                            .foregroundStyle(selected ? AtlasColors.lemonInk : AtlasColors.inkSoft)
                            .padding(.horizontal, 14)
                            .frame(height: 36)
                            .background(selected ? AtlasColors.lemon : AtlasColors.surface)
                            .overlay(
                                Capsule()
                                    .stroke(AtlasColors.border, lineWidth: selected ? 0 : 1)
                            )
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func ownerTapAction(for agent: Agent) -> (() -> Void)? {
        let ownerID = agent.owner?.id ?? agent.ownerUserID
        guard let ownerID, !ownerID.isEmpty else { return nil }
        return { userRoute = UserRoute(id: ownerID) }
    }

    private func isOwner(_ agent: Agent) -> Bool {
        guard let currentUserID = session.user?.id else { return false }
        return agent.ownerUserID == currentUserID || agent.owner?.id == currentUserID
    }

    @ViewBuilder
    private var tabContent: some View {
        switch tab {
        case .ideas:
            if viewModel.originalIdeas.isEmpty {
                emptyTab("暂无原创想法")
            } else {
                ForEach(viewModel.originalIdeas) { idea in
                    IdeaCoverCard(
                        idea: idea,
                        coverImageURL: idea.iconLink,
                        onTap: { ideaRoute = IdeaRoute(id: idea.id) }
                    )
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
            .font(AtlasTypography.meta())
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

    private func agentStatsBand(_ agent: Agent) -> some View {
        let ideas = viewModel.stats?.ideaCount ?? viewModel.originalIdeas.count
        let forks = viewModel.stats?.totalForks ?? 0
        let followers = viewModel.stats?.followerCount ?? agent.followerCount ?? 0
        return HStack(spacing: 0) {
            agentStat(value: "\(ideas)", label: "想法")
            agentStat(value: compactCount(forks), label: "Fork")
            agentStat(value: compactCount(followers), label: "关注者")
        }
        .padding(.vertical, 14)
        .background(AtlasColors.fill)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }

    private func agentStat(value: String, label: String) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
                .monospacedDigit()
            Text(label)
                .font(AtlasTypography.meta())
                .foregroundStyle(AtlasColors.inkSoft)
        }
        .frame(maxWidth: .infinity)
    }

    private func agentActionBar(_ agent: Agent) -> some View {
        HStack(spacing: 10) {
            if agent.allowFollow != false {
                Button { Task { await toggleFollow() } } label: {
                    Text(viewModel.isFollowing ? "已关注" : "关注 Agent")
                        .font(AtlasTypography.mobileBody())
                        .foregroundStyle(AtlasColors.lemonInk)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(AtlasColors.primaryAction)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            if agent.allowChat != false {
                Button { Task { await openChat(agentID: agent.id, name: agent.name) } } label: {
                    Text("开始对话")
                        .font(AtlasTypography.mobileBody())
                        .foregroundStyle(AtlasColors.ink)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(AtlasColors.fill)
                        .overlay(Capsule().stroke(AtlasColors.border, lineWidth: 1))
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 2)
    }

    private func compactCount(_ value: Int) -> String {
        value >= 1_000 ? String(format: "%.1fk", Double(value) / 1_000) : "\(value)"
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

private struct AgentIdentityCard: View {
    let agent: Agent
    let stats: AgentStats?
    var onOwnerTap: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 12) {
                EntityAvatar.agent(id: agent.id, url: agent.avatarLink, name: agent.name, size: 56)

                VStack(alignment: .leading, spacing: 4) {
                    Text(agent.name)
                        .font(AtlasTypography.heroTitle())
                        .foregroundStyle(AtlasColors.ink)
                        .lineLimit(2)

                    if let owner = agent.owner {
                        Button("由 \(owner.name) 创建 · \(agent.visibility == "private" ? "私有" : "公开")", action: { onOwnerTap?() })
                            .font(AtlasTypography.meta())
                            .foregroundStyle(AtlasColors.inkSoft)
                            .buttonStyle(.plain)
                            .disabled(onOwnerTap == nil)
                    } else {
                        Text(agent.visibility == "private" ? "私有草稿" : "公开 Agent")
                            .font(AtlasTypography.meta())
                            .foregroundStyle(AtlasColors.inkSoft)
                    }
                }
            }

            if let description = agent.description, !description.isEmpty {
                Text(description)
                    .font(AtlasTypography.mobileSubheadline())
                    .foregroundStyle(AtlasColors.inkSoft)
                    .lineLimit(2)
            }

            let capabilities = agent.capabilityLabels.prefix(4)
            if !capabilities.isEmpty {
                Text(capabilities.joined(separator: " · "))
                    .font(AtlasTypography.meta().weight(.semibold))
                    .foregroundStyle(AtlasColors.lemonInk)
                    .lineLimit(1)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.lemonSoft)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }
}
