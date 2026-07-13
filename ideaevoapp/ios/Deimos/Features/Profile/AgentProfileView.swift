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
        // S10 Content Wrapper (179:22): VERTICAL itemSpacing=16, horizontal padding 20
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // 179:95 Agent Cover — lemon bg r24 with avatar circle
                agentCover(agent)

                // 179:97 Agent Title — 30pt Black ink
                Text(agent.name)
                    .font(.system(size: 30, weight: .black))
                    .foregroundStyle(AtlasColors.ink)
                    .padding(.horizontal, 20)

                // 179:98 Agent Handle — 14pt SemiBold #667085
                Text(agentHandleLine(agent))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color(hex: 0x667085))
                    .padding(.horizontal, 20)

                // 179:99 Agent Stats — 3 stat tiles, HORIZONTAL spacing 8
                agentStatsRow

                // 179:106 Agent Actions — Follow + Chat buttons
                agentActions(agent)

                // 179:111 About Agent Card — white r20
                aboutAgentCard(agent)

                // 179:114 Recent Idea Card — grey r20
                recentIdeaCard

                // S26 Metrics Grid card — bg #F7F8FA r16 itemSpacing 8 (Ardot 189:62)
                agentMetricsGrid

                // S26 Recent Activity card — bg #F2FFC5 r16 itemSpacing 8 (Ardot 189:64)
                agentRecentActivity

                // S26 Stats Breakdown card — white + 1px border r16 (Ardot 189:153)
                agentStatsBreakdown

                // Tabbed content (ideas / forks / activity)
                tabContent
                    .padding(.horizontal, 20)
            }
            .padding(.top, 4)
            .padding(.bottom, 40)
        }
    }

    /// 179:95 Agent Cover — lemon background with avatar circle.
    private func agentCover(_ agent: Agent) -> some View {
        ZStack(alignment: .bottomLeading) {
            AtlasColors.lemon
            EntityAvatar.agent(
                id: agent.id,
                url: agent.avatarLink,
                name: agent.name,
                size: 72
            )
            .overlay(Circle().stroke(AtlasColors.surface, lineWidth: 4))
            .padding(.leading, 18)
            .padding(.bottom, 10)
        }
        .frame(height: 176)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .padding(.horizontal, 20)
    }

    private func agentHandleLine(_ agent: Agent) -> String {
        let slug = agent.id.lowercased()
        let follow = agent.allowFollow != false ? "可关注" : "不可关注"
        let chat = agent.allowChat != false ? "可对话" : "不可对话"
        return "@\(slug) · \(follow) · \(chat)"
    }

    /// 179:99 Agent Stats — three tiles in a horizontal strip.
    private var agentStatsRow: some View {
        let stats = viewModel.stats
        return HStack(spacing: 8) {
            statTile(
                value: "\(stats?.ideaCount ?? viewModel.originalIdeas.count)",
                label: "想法",
                bg: Color(hex: 0xF7F8FA),
                textColor: AtlasColors.ink
            )
            statTile(
                value: "\(stats?.totalFlowers ?? viewModel.topFlowerIdeas.first?.flowerCount ?? 0)",
                label: "鲜花",
                bg: Color(hex: 0xFFF7D6),
                textColor: Color(hex: 0xA66A00)
            )
            statTile(
                value: "\(stats?.totalForks ?? viewModel.forkIdeas.count)",
                label: "Fork",
                bg: Color(hex: 0xF2FFC5),
                textColor: Color(hex: 0x5F7400)
            )
        }
        .frame(height: 52)
        .padding(.horizontal, 20)
    }

    private func statTile(value: String, label: String, bg: Color, textColor: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 14, weight: .heavy))
                .foregroundStyle(textColor)
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(textColor)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 52)
        .background(bg)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    /// 179:106 Agent Actions — follow (lemonStrong) + chat (lemonSoft) buttons.
    private func agentActions(_ agent: Agent) -> some View {
        HStack(spacing: 10) {
            Button {
                Task { await toggleFollow() }
            } label: {
                Text(viewModel.isFollowing ? "已关注 Agent" : "关注 Agent")
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(AtlasColors.lemonInk)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(AtlasColors.lemonStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            }
            .buttonStyle(.plain)

            Button {
                Task { await openChat(agentID: agent.id, name: agent.name) }
            } label: {
                Text("发起聊天")
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(AtlasColors.olive)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(AtlasColors.lemonSoft)
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .frame(height: 44)
        .padding(.horizontal, 20)
    }

    /// 179:111 About Agent Card — capabilities / description.
    private func aboutAgentCard(_ agent: Agent) -> some View {
        let body = agent.description?.isEmpty == false
            ? agent.description!
            : agent.capabilityLabels.joined(separator: "、")
        return VStack(alignment: .leading, spacing: 8) {
            Text("Agent 能做什么")
                .font(.system(size: 18, weight: .heavy))
                .foregroundStyle(AtlasColors.ink)
            Text(body)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color(hex: 0x5F6673))
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .padding(.horizontal, 20)
    }

    /// 179:114 Recent Idea Card — spotlight idea in a grey tile.
    @ViewBuilder
    private var recentIdeaCard: some View {
        if let idea = viewModel.topFlowerIdeas.first {
            Button {
                ideaRoute = IdeaRoute(id: idea.id)
            } label: {
                VStack(alignment: .leading, spacing: 8) {
                    Text(idea.title)
                        .font(.system(size: 17, weight: .heavy))
                        .foregroundStyle(AtlasColors.ink)
                        .lineLimit(1)
                    if let summary = idea.feedSummaryText, !summary.isEmpty {
                        Text(summary)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color(hex: 0x667085))
                            .lineLimit(2)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(hex: 0xF7F8FA))
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 20)
        }
    }

    /// S26 Metrics Grid — bg #F7F8FA r16, aggregate metric values (Ardot 189:62).
    private var agentMetricsGrid: some View {
        let stats = viewModel.stats
        return VStack(alignment: .leading, spacing: 8) {
            metricLine("\(stats?.ideaCount ?? viewModel.originalIdeas.count) 想法 · \(stats?.totalForks ?? viewModel.forkIdeas.count) 被Fork")
            metricLine("\(stats?.totalFlowers ?? 0) 送花 · \(stats?.totalForks ?? viewModel.forkIdeas.count) Fork")
            metricLine("\(viewModel.agent?.followerCount ?? 0) 关注者")
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: 0xF7F8FA))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(.horizontal, 20)
    }

    private func metricLine(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 17))
            .foregroundStyle(AtlasColors.ink)
    }

    /// S26 Recent Activity — bg #F2FFC5 r16, lemonInk rows (Ardot 189:64).
    @ViewBuilder
    private var agentRecentActivity: some View {
        let activities = viewModel.stats?.recentActivity ?? []
        if !activities.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(activities.prefix(3).enumerated()), id: \.offset) { _, activity in
                    Text("\(activity.createdAt.relativeShort)  \(agentActivityTitle(activity))")
                        .font(.system(size: 15))
                        .foregroundStyle(AtlasColors.lemonInk)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(hex: 0xF2FFC5))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .padding(.horizontal, 20)
        }
    }

    /// S26 Stats Breakdown — white + 1px border r16 (Ardot 189:153).
    private var agentStatsBreakdown: some View {
        let stats = viewModel.stats
        return VStack(alignment: .leading, spacing: 8) {
            Text("被关注 \(viewModel.agent?.followerCount ?? 0) · 全部关注者")
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: 0x3E4652))
            Text("被 Fork \(stats?.totalForks ?? viewModel.forkIdeas.count) · 主要来自社区")
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: 0x3E4652))
            Text("送花 \(stats?.totalFlowers ?? 0) · 来自互动用户")
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: 0x3E4652))
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color(hex: 0xE7EAF0), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(.horizontal, 20)
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
