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
        // S09 Content Wrapper (189:4): VERTICAL itemSpacing=14, horizontal padding 20
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // 189:5 Screen Title — 28pt Bold ink
                Text("\(envelope.profile.user.name) 的主页")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)
                    .padding(.horizontal, 20)

                // 189:6 User Identity Panel — FILL r18, bg=lemonSoft, VERTICAL spacing 8
                userIdentityPanel(envelope)

                // 189:8 Profile Actions — FILL r12, bg=lemonStrong, centered "关注用户" 15pt Bold
                profileActionsButton(envelope)

                // 189:133 User Stats Row — FILL r14, white + border, HORIZONTAL SPACE_BETWEEN, 16pt Bold ink
                userStatsRow(envelope)

                // 189:135 Profile Segment — FILL r12, bg=#F7F8FA, HORIZONTAL spacing 4, padding 4
                profileSegment

                // Tab content (recent activity / ideas / agents)
                tabContent
                    .padding(.horizontal, 20)
            }
            .padding(.top, 4)
            .padding(.bottom, 40)
        }
    }

    /// 189:6 User Identity Panel — bio + relationship summary.
    private func userIdentityPanel(_ envelope: UserProfileEnvelope) -> some View {
        let user = envelope.profile.user
        let profile = envelope.profile
        let bioLine = user.bio?.isEmpty == false ? user.bio! : "头像 / 背景 / bio / 关注关系"
        let summary = "\(profile.followerCount) 粉丝 · \(profile.followingCount) 关注 · \(profile.agentCount) 个公开 Agent"
        return VStack(alignment: .leading, spacing: 8) {
            Text(bioLine)
                .font(.system(size: 15, weight: .regular))
                .foregroundStyle(AtlasColors.lemonInk)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
            Text(summary)
                .font(.system(size: 15, weight: .regular))
                .foregroundStyle(AtlasColors.lemonInk)
        }
        .padding(.horizontal, 18)
        .padding(.top, 16)
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.lemonSoft)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .padding(.horizontal, 20)
    }

    /// 189:8 Profile Actions — lemonStrong follow button.
    @ViewBuilder
    private func profileActionsButton(_ envelope: UserProfileEnvelope) -> some View {
        if !isSelf {
            Button {
                Task { await toggleFollow() }
            } label: {
                Text(envelope.isFollowing ? "已关注" : "关注用户")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(AtlasColors.lemonInk)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(AtlasColors.lemonStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 20)
        }
    }

    /// 189:133 User Stats Row — three stats space-between in a bordered white card.
    @ViewBuilder
    private func userStatsRow(_ envelope: UserProfileEnvelope) -> some View {
        let profile = envelope.profile
        HStack {
            statsEntry("\(profile.agentCount)", "Agent", action: { viewModel.selectedTab = .agents })
            statsEntry("\(profile.ideaCount)", "Idea", action: { viewModel.selectedTab = .ideas })
            statsEntry("\(profile.followerCount)", "粉丝", action: {
                followListRoute = FollowListRoute(userID: userID, kind: .followers)
            })
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity)
        .frame(height: 74)
        .background(AtlasColors.surface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .padding(.horizontal, 20)
    }

    private func statsEntry(_ value: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Text(value)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)
                Text(label)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(AtlasColors.inkSoft)
            }
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
    }

    /// 189:135 Profile Segment — grey pill container with lemon active styling.
    private var profileSegment: some View {
        HStack(spacing: 4) {
            ForEach(Array(UserProfileTab.allCases.enumerated()), id: \.element.id) { index, tab in
                let isActive = viewModel.selectedTab == tab
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        viewModel.selectedTab = tab
                    }
                } label: {
                    Text(tab.title)
                        .font(.system(size: 14, weight: isActive ? .semibold : .semibold))
                        .foregroundStyle(isActive ? AtlasColors.olive : Color(hex: 0x687083))
                        .frame(maxWidth: .infinity)
                        .frame(height: 34)
                        .background(isActive ? AtlasColors.lemonStrong : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .frame(height: 42)
        .background(Color(hex: 0xF7F8FA))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .padding(.horizontal, 20)
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
