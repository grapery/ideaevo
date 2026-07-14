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
        // S09 Content Wrapper (189:4): VERTICAL itemSpacing=16, padding=[20,20,0,20]
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Back button
                AtlasNavBackButton(action: { dismiss() })

                // User Identity Card — lemon cover banner + avatar + info
                userIdentityCard(envelope)

                // Profile Actions — follow button
                if !isSelf {
                    profileActionsButton(envelope)
                }

                // Stats Grid — 3 tiles
                statsGrid(envelope)

                // Profile Segment
                profileSegment

                // Tab content
                tabContent
            }
            .padding(.horizontal, 20)
            .padding(.top, 0)
            .padding(.bottom, 20 + AtlasMetrics.bottomClear)
        }
    }

    /// User identity card — lemon cover banner (80h r24) + avatar (72×72 overlapping) + name/bio/relationship.
    private func userIdentityCard(_ envelope: UserProfileEnvelope) -> some View {
        let user = envelope.profile.user
        let profile = envelope.profile

        return VStack(alignment: .leading, spacing: 0) {
            // Cover banner — lemon bg r24 top, 80h
            Rectangle()
                .fill(AtlasColors.lemon)
                .frame(height: 80)
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))

            // Avatar overlapping cover
            HStack(alignment: .bottom, spacing: 12) {
                EntityAvatar.user(
                    id: user.id,
                    url: user.avatarLink,
                    name: user.name,
                    size: 72
                )
                .overlay(Circle().stroke(.white, lineWidth: 3))
                .offset(y: -36)
                .padding(.leading, 18)

                Spacer()
            }

            // User info
            VStack(alignment: .leading, spacing: 4) {
                Text(user.name)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)

                Text(user.bio?.isEmpty == false ? user.bio! : "AI 想法探索者")
                    .font(.system(size: 14))
                    .foregroundStyle(AtlasColors.inkSoft)

                // Meta row — icon labels with structured layout
                HStack(spacing: 16) {
                    metaLabel(icon: "square.grid.2x2", text: "\(profile.ideaCount) 想法", iconBg: AtlasColors.lemonSoft)
                    metaLabel(icon: "person.2", text: "\(profile.followerCount) 粉丝", iconBg: Color(hex: 0xF0F2F5))
                    metaLabel(icon: "person.crop.circle.badge.plus", text: "\(profile.followingCount) 关注", iconBg: Color(hex: 0xF0F2F5))
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 4)
            .padding(.bottom, 18)
        }
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: Color(hex: 0x0F1B2D, opacity: 0.06), radius: 16, y: 4)
    }

    /// Profile Actions — lemonStrong follow button, 44h r12.
    @ViewBuilder
    private func profileActionsButton(_ envelope: UserProfileEnvelope) -> some View {
        Button {
            Task { await toggleFollow() }
        } label: {
            Text(envelope.isFollowing ? "已关注" : "关注用户")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(AtlasColors.lemonInk)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(AtlasColors.lemonStrong)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(AtlasPressableStyle())
    }

    /// Stats Grid — 3 tiles (想法/Agent/粉丝), first tile lemonSoft, others grey.
    /// Meta label — small icon chip + value text (for identity card).
    private func metaLabel(icon: String, text: String, iconBg: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 10))
                .foregroundStyle(AtlasColors.ink)
                .frame(width: 16, height: 16)
                .background(iconBg)
                .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
            Text(text)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
        }
    }

    private func statsGrid(_ envelope: UserProfileEnvelope) -> some View {
        let profile = envelope.profile
        return HStack(spacing: 12) {
            statTile(value: "\(profile.ideaCount)", unit: " 想法", bg: AtlasColors.lemonSoft, fg: AtlasColors.lemonInk, icon: "square.grid.2x2") {
                viewModel.selectedTab = .ideas
            }
            statTile(value: "\(profile.agentCount)", unit: " Agent", bg: Color(hex: 0xF7F8FA), fg: AtlasColors.ink, icon: "cpu") {
                viewModel.selectedTab = .agents
            }
            statTile(value: "\(profile.followerCount)", unit: " 粉丝", bg: Color(hex: 0xF7F8FA), fg: AtlasColors.ink, icon: "person.2") {
                followListRoute = FollowListRoute(userID: userID, kind: .followers)
            }
        }
    }

    /// Stat tile — icon chip + number + label, 72h r16.
    private func statTile(value: String, unit: String, bg: Color, fg: Color, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                // Icon chip — 24×24 r6 lemonStrong
                Image(systemName: icon)
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.lemonInk)
                    .frame(width: 24, height: 24)
                    .background(AtlasColors.lemonStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))

                // Number + unit label
                HStack(spacing: 2) {
                    Text(value)
                        .font(.system(size: 18, weight: .heavy))
                    Text(unit)
                        .font(.system(size: 12, weight: .medium))
                }
                .foregroundStyle(fg)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 72)
            .background(bg)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    /// Profile Segment — grey container r16, lemonStrong active.
    private var profileSegment: some View {
        HStack(spacing: 4) {
            ForEach(UserProfileTab.allCases) { tab in
                let isActive = viewModel.selectedTab == tab
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        viewModel.selectedTab = tab
                    }
                } label: {
                    Text(tab.title)
                        .font(.system(size: 14, weight: isActive ? .semibold : .semibold))
                        .foregroundStyle(isActive ? AtlasColors.lemonInk : Color(hex: 0x687083))
                        .frame(maxWidth: .infinity)
                        .frame(height: 32)
                        .background(isActive ? AtlasColors.lemonStrong : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Color(hex: 0xF4F5F8))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
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
                // Horizontal scroll agent cards
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(viewModel.agents) { agent in
                            Button {
                                agentRoute = AgentRoute(id: agent.id)
                            } label: {
                                VStack(alignment: .leading, spacing: 8) {
                                    EntityAvatar.agent(id: agent.id, url: agent.avatarLink, name: agent.name, size: 36)
                                    Text(agent.name)
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundStyle(AtlasColors.ink)
                                        .lineLimit(1)
                                    Text(agent.capabilities?.first ?? "Agent")
                                        .font(.system(size: 11, weight: .medium))
                                        .foregroundStyle(AtlasColors.inkSoft)
                                        .lineLimit(1)
                                }
                                .padding(14)
                                .frame(width: 140, alignment: .leading)
                                .background(AtlasColors.surface)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                                        .stroke(AtlasColors.border, lineWidth: 1)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
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
