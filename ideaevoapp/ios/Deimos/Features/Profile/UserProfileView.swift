import SwiftUI
import Observation

enum UserProfileTab: CaseIterable, Identifiable {
    case ideas, agents, activity

    var id: String {
        switch self {
        case .ideas: return "ideas"
        case .agents: return "agents"
        case .activity: return "activity"
        }
    }

    var title: String {
        switch self {
        case .ideas: return "想法"
        case .agents: return "Agent"
        case .activity: return "动态"
        }
    }
}

@MainActor
@Observable
final class UserProfileViewModel {
    var envelope: UserProfileEnvelope?
    var ideas: [Idea] = []
    var agents: [Agent] = []
    var activities: [ActivityView] = []
    var isLoading = true
    var isLoadingAgents = false
    var isLoadingActivity = false
    var errorMessage: String?
    var selectedTab: UserProfileTab = .activity
    private var agentsLoaded = false
    private var activityLoaded = false

    func load(userID: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let profileTask = APIClient.shared.userPublicProfile(id: userID)
            async let ideasTask = APIClient.shared.getUserIdeas(userID: userID)
            envelope = try await profileTask
            ideas = try await ideasTask
            activities = (try? await APIClient.shared.getUserActivity(userID: userID).activities) ?? []
            activityLoaded = true
        } catch {
            errorMessage = error.localizedDescription
            envelope = nil
            ideas = []
            activities = []
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

    func loadActivityIfNeeded(userID: String) async {
        guard !activityLoaded else { return }
        isLoadingActivity = true
        defer { isLoadingActivity = false }
        do {
            activities = try await APIClient.shared.getUserActivity(userID: userID).activities
            activityLoaded = true
        } catch {
            activities = []
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
        ZStack(alignment: .top) {
            Group {
                if viewModel.isLoading {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = viewModel.errorMessage {
                    if isUnavailableProfile(error) {
                        AtlasDesignedEmptyState(
                            icon: .profile,
                            title: "无法查看此主页",
                            subtitle: "该用户设置了隐私限制，或你已被拉黑",
                            ctaTitle: "返回",
                            ctaAction: { dismiss() }
                        )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        AtlasDesignedEmptyStates.loadFailed(message: error) {
                            Task { await viewModel.load(userID: userID) }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                } else if let envelope = viewModel.envelope {
                    profileContent(envelope)
                        .contextMenu {
                            if !isSelf {
                                Button("分享主页") {
                                    sharePayload = profileShareURL(for: envelope.profile.user)
                                    showShareSheet = true
                                }
                                Button("举报用户") { showReportSheet = true }
                                Button("拉黑用户", role: .destructive) { showBlockDialog = true }
                            }
                        }
                }
            }

            AtlasOverlayPushNavBar(title: "用户主页", barBackground: .clear, onBack: { dismiss() })
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
        .fullScreenCover(isPresented: $showReportSheet) {
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
            }
        }
        .fullScreenCover(isPresented: $showBlockDialog) {
            if showBlockDialog, let user = viewModel.envelope?.profile.user {
                BlockUserSheet(
                    userID: user.id,
                    name: user.name,
                    avatarURL: user.avatarLink,
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
        .sheet(isPresented: $showShareSheet) {
            ShareSheet(items: [sharePayload]) {
                showShareSheet = false
            }
        }
        .task(id: userID) {
            await viewModel.load(userID: userID)
            #if DEBUG
            let args = ProcessInfo.processInfo.arguments
            if args.contains("--deimos-show-user-report") {
                showReportSheet = true
            } else if args.contains("--deimos-show-user-block") {
                showBlockDialog = true
            }
            #endif
        }
        .onChange(of: viewModel.selectedTab) { _, tab in
            if tab == .agents {
                Task { await viewModel.loadAgentsIfNeeded(userID: userID) }
            }
            if tab == .activity {
                Task { await viewModel.loadActivityIfNeeded(userID: userID) }
            }
        }
    }

    private func isUnavailableProfile(_ message: String) -> Bool {
        let normalized = message.lowercased()
        return normalized.contains("403") || normalized.contains("404") || normalized.contains("forbidden") || normalized.contains("not found") || message.contains("权限") || message.contains("不存在") || message.contains("拉黑")
    }

    @ViewBuilder
    private func profileContent(_ envelope: UserProfileEnvelope) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                publicHero

                VStack(alignment: .leading, spacing: 20) {
                    PublicUserIdentityContent(user: envelope.profile.user)

                    PublicUserStatsBand(
                        stats: envelope.profile,
                        user: envelope.profile.user
                    )

                    if !isSelf {
                        PublicUserFollowButton(isFollowing: envelope.isFollowing) {
                            Task { await toggleFollow() }
                        }
                    }

                    AtlasSegmentedPill(
                        items: ["动态", "Agent", "想法"],
                        selection: Binding(
                            get: {
                                switch viewModel.selectedTab {
                                case .activity: return 0
                                case .agents: return 1
                                case .ideas: return 2
                                }
                            },
                            set: {
                                viewModel.selectedTab = switch $0 {
                                case 0: .activity
                                case 1: .agents
                                default: .ideas
                                }
                            }
                        )
                    )

                    tabContent
                }
                .padding(.horizontal, AtlasMetrics.pageX)
                .padding(.top, 48)
            }
            .padding(.bottom, 40)
        }
    }

    private var publicHero: some View {
        ZStack(alignment: .bottomLeading) {
            Rectangle()
                .fill(AtlasColors.lemonSoft)
                .frame(height: 140)
            Circle()
                .fill(AtlasColors.lemon)
                .frame(width: 80, height: 80)
                .offset(x: AtlasMetrics.pageX)
        }
        .frame(maxWidth: .infinity)
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
        case .activity:
            if viewModel.isLoadingActivity {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, 24)
            } else if viewModel.activities.isEmpty {
                AtlasDesignedEmptyState(
                    icon: .sparkles,
                    title: "暂无动态",
                    subtitle: "该用户和其 Agent 还没有公开活动"
                )
            } else {
                ForEach(Array(viewModel.activities.enumerated()), id: \.element.id) { index, activity in
                    Group {
                        if let ideaID = activity.ideaID {
                            Button {
                                ideaRoute = IdeaRoute(id: ideaID)
                            } label: {
                                userActivityRow(activity)
                            }
                            .buttonStyle(.plain)
                        } else {
                            userActivityRow(activity)
                        }
                    }
                    if index < viewModel.activities.count - 1 {
                        FeedRowDivider()
                    }
                }
            }
        }
    }

    private func userActivityRow(_ activity: ActivityView) -> some View {
        CompactListCard(
            leading: {
                activityIcon(for: activity.action)
            },
            title: activity.feedSummary,
            subtitle: activity.targetDesc?.plainSummary,
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
        ZStack {
            Circle()
                .fill(AtlasColors.fill)
                .frame(width: 36, height: 36)
            DeimosIconView(icon: icon, size: 16, color: AtlasColors.inkSoft)
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

private struct PublicUserIdentityContent: View {
    let user: User

    var body: some View {
        // ardot S09B (`237:378`): Name 28pt Bold #0F1B2D; Bio 15pt Regular #8A94A6.
        VStack(alignment: .leading, spacing: 8) {
            Text(user.name)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
            Text(user.bio?.isEmpty == false ? (user.bio ?? "") : "AI 想法探索者")
                .font(.system(size: 15))
                .foregroundStyle(AtlasColors.inkSoft)
                .lineLimit(2)
        }
    }
}

private struct PublicUserStatsBand: View {
    let stats: UserProfileData
    let user: User

    var body: some View {
        // ardot S09B (`237:378` Stats 342×64): #F5F6F7 container cr20 holding 3 stat tiles.
        // First tile (想法) #F3FFC8 lemon cr16; other two match the container.
        HStack(spacing: 8) {
            statTile(value: "\(stats.ideaCount)", label: "想法", highlight: true)
            statTile(value: compactCount(user.followerCount), label: "粉丝", highlight: false)
            statTile(value: compactCount(user.followingCount), label: "关注", highlight: false)
        }
        .padding(4)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(AtlasColors.chatAssistantBubble)
        )
    }

    private func statTile(value: String, label: String, highlight: Bool) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
                .monospacedDigit()
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(AtlasColors.inkSoft)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 56)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(highlight ? AtlasColors.chatActivityFill : AtlasColors.chatAssistantBubble)
        )
    }

    private func compactCount(_ value: Int) -> String {
        value >= 1_000 ? String(format: "%.1fk", Double(value) / 1_000) : "\(value)"
    }
}

private struct PublicUserFollowButton: View {
    let isFollowing: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(isFollowing ? "已关注" : "关注用户")
                .font(AtlasTypography.mobileBody())
                .foregroundStyle(AtlasColors.lemonInk)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(AtlasColors.primaryAction)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}
