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

            AtlasOverlayPushNavBar(title: "Agent", plainTitle: true, onBack: { dismiss() }) {
                if let agent = viewModel.agent {
                    AtlasToolbarFloatIconButton(icon: isOwner(agent) ? .edit : .more) {
                        if isOwner(agent) {
                            editorRoute = AgentEditorRoute(id: agent.id)
                        }
                    }
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
        .navigationDestination(item: $editorRoute) { route in
            AgentEditorView(agentID: route.id)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if let agent = viewModel.agent, !viewModel.isLoading {
                agentActionBar(agent)
                    .padding(.horizontal, AtlasMetrics.pageX)
                    .padding(.top, 8)
                    .padding(.bottom, 10)
                    .background(AtlasColors.canvas.opacity(0.97))
            }
        }
        .task {
            await viewModel.load(id: agentID, isAuthenticated: session.isAuthenticated)
        }
    }

    @ViewBuilder
    private func profileContent(_ agent: Agent) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                agentIdentityCard(agent)
                agentStatsBand(agent)

                HStack(spacing: 8) {
                    Text("这个 Agent 的想法")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Spacer(minLength: 0)
                    Text("最新  ›")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                .frame(height: 28)

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

                HStack(spacing: 8) {
                    Text(accessLine(agent))
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(AtlasColors.inkSoft)
                    Spacer(minLength: 0)
                    Text("查看资料 ›")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                }
                .padding(.horizontal, 12)
                .frame(height: 44)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.top, 67)
            .padding(.bottom, 28)
        }
    }

    private func accessLine(_ agent: Agent) -> String {
        [
            agent.visibility == "private" ? "私有" : "公开",
            agent.allowFollow == false ? nil : "可关注",
            agent.allowChat == false ? nil : "可聊天",
        ].compactMap { $0 }.joined(separator: " · ")
    }

    private func agentIdentityCard(_ agent: Agent) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 12) {
                EntityAvatar.agent(id: agent.id, url: agent.avatarLink, name: agent.name, size: 56)

                VStack(alignment: .leading, spacing: 3) {
                    Text(agent.name)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(AtlasColors.ink)
                        .lineLimit(1)
                    Text(agentOwnerSummary(agent))
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(1)
                }
            }

            Text(agent.description?.isEmpty == false ? agent.description! : "持续发现值得探索的想法，并把可执行方案发布为可 Fork 的想法。")
                .font(.system(size: 13))
                .foregroundStyle(AtlasColors.inkSoft)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)

            let capabilities = agent.capabilityLabels.prefix(4)
            if !capabilities.isEmpty {
                Text(capabilities.joined(separator: " · "))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(AtlasColors.lemonInk)
                    .lineLimit(1)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: 142, alignment: .top)
        .background(AtlasColors.lemonSoft)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func agentOwnerSummary(_ agent: Agent) -> String {
        let visibility = agent.visibility == "private" ? "私有" : "公开"
        if let owner = agent.owner {
            return "\(owner.name) 创建 · \(visibility)"
        }
        return "\(visibility) Agent"
    }

    /// ardot S10 (`237:399` Cover): 390×180 #1A2403 dark banner. Holds the back button
    /// (44×44 white cr22) at the top-left and the agent avatar (80×80 #BEE90D cr40) centered.
    /// The glass overlay toolbar (AtlasOverlayPushNavBar) floats above this for share/edit.
    private func agentCoverBanner(_ agent: Agent) -> some View {
        ZStack(alignment: .bottomLeading) {
            // Dark banner background.
            Rectangle()
                .fill(AtlasColors.lemonInk) // #1A2403
                .frame(height: 180)

            // Avatar — 80×80 #BEE90D lemon circle (cr40), centered horizontally on the banner.
            // Per spec the avatar IS the lemon circle (not the EntityAvatar with image). We layer
            // the agent's avatar image on top if present, falling back to the lemon circle + initial.
            EntityAvatar.agent(
                id: agent.id,
                url: agent.avatarLink,
                name: agent.name,
                size: 80
            )
            .background(Circle().fill(AtlasColors.lemonStrong))
            .clipShape(Circle())
            .padding(.leading, AtlasMetrics.pageX)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 180)
    }

    /// ardot S10 (`237:399` Content): Name 28pt Bold #0F1B2D + Owner row 14pt Regular #8A94A6
    /// + optional description + capabilities. Rendered as bare text (no card background) per spec.
    @ViewBuilder
    private func agentIdentityText(_ agent: Agent) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(agent.name)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
                .lineLimit(2)

            // Owner / visibility / follow/chat availability — single 14pt line.
            HStack(spacing: 6) {
                if agent.owner != nil {
                    Button(action: { ownerTapAction(for: agent)?() }) {
                        Text(ownerLine(agent))
                            .font(.system(size: 14))
                            .foregroundStyle(AtlasColors.inkSoft)
                    }
                    .buttonStyle(.plain)
                    .disabled(ownerTapAction(for: agent) == nil)
                } else {
                    Text(ownerLine(agent))
                        .font(.system(size: 14))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
            }

            if let description = agent.description, !description.isEmpty {
                Text(description)
                    .font(.system(size: 14))
                    .foregroundStyle(AtlasColors.inkSoft)
                    .lineLimit(2)
                    .padding(.top, 2)
            }

            let capabilities = agent.capabilityLabels.prefix(4)
            if !capabilities.isEmpty {
                Text(capabilities.joined(separator: " · "))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AtlasColors.lemonInk)
                    .lineLimit(1)
                    .padding(.top, 2)
            }
        }
        // Leave room for the avatar that overlaps from the cover above.
        .padding(.top, 50)
    }

    /// Single owner/visibility/follow/chat line, e.g. "由 Lina 创建 · 公开 · 可关注 · 可聊天".
    private func ownerLine(_ agent: Agent) -> String {
        var parts: [String] = []
        if let owner = agent.owner { parts.append("由 \(owner.name) 创建") }
        parts.append(agent.visibility == "private" ? "私有" : "公开")
        if agent.allowFollow != false { parts.append("可关注") }
        if agent.allowChat != false { parts.append("可聊天") }
        return parts.joined(separator: " · ")
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

    /// ardot S10 (`237:399` Stats 342×64): #F5F6F7 container cr20 with 3 stat tiles.
    /// First tile (想法) is #F3FFC8 lemon cr16; the other two match the container.
    private func agentStatsBand(_ agent: Agent) -> some View {
        let ideas = viewModel.stats?.ideaCount ?? viewModel.originalIdeas.count
        let forks = viewModel.stats?.totalForks ?? 0
        let followers = viewModel.stats?.followerCount ?? agent.followerCount ?? 0
        return HStack(spacing: 0) {
            agentStatTile(value: "\(ideas)", label: "想法")
            agentStatTile(value: compactCount(forks), label: "Fork")
            agentStatTile(value: compactCount(followers), label: "关注")
        }
        .frame(height: 56)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(AtlasColors.chatAssistantBubble)
        )
    }

    private func agentStatTile(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
                .monospacedDigit()
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 56)
    }

    /// ardot S10 (`237:399` Actions 342×52): #F5F6F7 container cr26 holding two 163×44 pills.
    /// Primary (关注) #BEE90D lemon + lemonInk text; Secondary (开始对话) white + #E8EBF0 stroke.
    private func agentActionBar(_ agent: Agent) -> some View {
        HStack(spacing: 8) {
            if agent.allowFollow != false {
                Button { Task { await toggleFollow() } } label: {
                    Text(viewModel.isFollowing ? "已关注" : "关注 Agent")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(AtlasColors.lemonInk)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(AtlasColors.lemon)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            if agent.allowChat != false {
                Button { Task { await openChat(agentID: agent.id, name: agent.name) } } label: {
                    Text("开始对话")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(AtlasColors.fill)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
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
