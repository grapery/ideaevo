import SwiftUI
import Observation

@MainActor
@Observable
final class IdeaDetailViewModel {
    var idea: Idea?
    var donors: [FlowerDonor] = []
    var forkChildren: [Idea] = []
    var versions: [IdeaVersionSummary] = []
    var reactionCounts: [String: Int] = [:]
    var mineReaction = ""
    var isLiked = false
    var isLoading = true
    var errorMessage: String?
    var actionMessage: String?

    func load(id: String, isAuthenticated: Bool) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let ideaTask = APIClient.shared.getIdea(id: id)
            async let flowersTask = APIClient.shared.getFlowers(ideaID: id)
            async let forksTask = APIClient.shared.getForkChildren(ideaID: id)
            async let reactionsTask = APIClient.shared.getReactions(ideaID: id)
            async let versionsTask = APIClient.shared.getIdeaVersions(ideaID: id)
            idea = try await ideaTask
            donors = try await flowersTask
            forkChildren = try await forksTask
            versions = try await versionsTask
            let reactions = try await reactionsTask
            reactionCounts = reactions.counts
            mineReaction = reactions.mineEmoji
            if isAuthenticated {
                isLiked = (try? await APIClient.shared.getLikeStatus(id: id)) ?? false
            } else {
                isLiked = false
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func sendFlower(isAuthenticated: Bool) async -> Bool {
        guard isAuthenticated else { return false }
        guard let id = idea?.id else { return false }
        do {
            try await APIClient.shared.sendFlower(ideaID: id)
            donors = try await APIClient.shared.getFlowers(ideaID: id)
            if let updated = try? await APIClient.shared.getIdea(id: id) {
                idea = updated
            }
            actionMessage = "已送出鲜花"
            return true
        } catch {
            actionMessage = error.localizedDescription
            return true
        }
    }

    func toggleLike(isAuthenticated: Bool) async -> Bool {
        guard isAuthenticated, let id = idea?.id else { return false }
        let wasLiked = isLiked
        do {
            try await APIClient.shared.toggleLike(id: id, currentlyLiked: wasLiked)
            isLiked = !wasLiked
            idea = try await APIClient.shared.getIdea(id: id)
            return true
        } catch {
            actionMessage = error.localizedDescription
            return true
        }
    }

    func setReaction(emoji: String, isAuthenticated: Bool) async {
        guard isAuthenticated, let id = idea?.id else { return }
        do {
            try await APIClient.shared.react(ideaID: id, emoji: emoji)
            await refreshReactions(ideaID: id)
        } catch {
            actionMessage = error.localizedDescription
        }
    }

    func removeReaction(isAuthenticated: Bool) async {
        guard isAuthenticated, let id = idea?.id else { return }
        do {
            try await APIClient.shared.unreact(ideaID: id)
            await refreshReactions(ideaID: id)
        } catch {
            actionMessage = error.localizedDescription
        }
    }

    func fork(title: String, description: String, reason: String) async throws -> Idea {
        guard let id = idea?.id else { throw APIError.server("想法不存在") }
        return try await APIClient.shared.forkIdea(id: id, title: title, description: description, reason: reason)
    }

    func bury(reason: String) async throws {
        guard let id = idea?.id else { throw APIError.server("想法不存在") }
        let updated = try await APIClient.shared.buryIdea(id: id, reason: reason)
        idea = updated
    }

    private func refreshReactions(ideaID: String) async {
        if let reactions = try? await APIClient.shared.getReactions(ideaID: ideaID) {
            reactionCounts = reactions.counts
            mineReaction = reactions.mineEmoji
        }
    }
}

struct IdeaDetailView: View {
    let ideaID: String
    var iconNamespace: Namespace.ID? = nil

    @State private var viewModel = IdeaDetailViewModel()
    @Environment(AuthSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var showAuthSheet = false
    @State private var agentRoute: AgentRoute?
    @State private var commentsRoute: CommentsRoute?
    @State private var forkRoute: IdeaRoute?
    @State private var chatRoute: ChatSessionRoute?
    @State private var showForkSheet = false
    @State private var showShareSheet = false
    @State private var sharePayload = ""
    @State private var ownerEditRoute: IdeaRoute?
    @State private var forkLineageRoute: IdeaRoute?
    @State private var versionRoute: VersionCompareRoute?
    @State private var isForking = false
    @State private var isCreatingChat = false
    @State private var forkError: String?
    @State private var showBuryConfirm = false
    @State private var buryReason = ""
    @State private var isBurying = false
    @State private var userRoute: UserRoute?
    @State private var showActionMenu = false
    @State private var showReportSheet = false
    @State private var showBlockDialog = false
    @State private var selectedRepoTab = 0
    @State private var flowersRoute: FlowersRoute?

    private var isSheetZoomActive: Bool {
        showAuthSheet || showForkSheet || showShareSheet || showBuryConfirm || showActionMenu || showReportSheet
    }

    var body: some View {
        VStack(spacing: 0) {
            AtlasPushNavBar(onBack: { dismiss() }) {
                if let idea = viewModel.idea {
                    AtlasToolbarFloatTextButton(title: "分享") {
                        sharePayload = "\(idea.title)\n\(ideaShareURL(idea.id))"
                        showShareSheet = true
                    }
                }
                AtlasToolbarFloatIconButton(icon: .more) {
                    showActionMenu = true
                }
            }

            Group {
            if viewModel.isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage = viewModel.errorMessage {
                AtlasDesignedEmptyStates.loadFailed(message: errorMessage) {
                    Task { await viewModel.load(id: ideaID, isAuthenticated: session.isAuthenticated) }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let idea = viewModel.idea {
                detailContent(idea)
            }
        }
        }
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: isSheetZoomActive)
        .navigationBarHidden(true)
        .suppressTabBar()
        .safeAreaInset(edge: .bottom) {
            if let idea = viewModel.idea {
                EngagementBar(
                    likeCount: idea.likeCount,
                    flowerCount: idea.flowerCount,
                    forkCount: idea.forkCount,
                    commentCount: idea.commentCount,
                    isLiked: viewModel.isLiked,
                    onLike: { Task { await handleLike() } },
                    onFlower: { openFlowersGrid(idea) },
                    onFork: { openForkSheet() },
                    onComment: { openComments(idea) }
                )
            }
        }
        .sheet(isPresented: $showForkSheet) {
            ForkSheet(
                sourceTitle: viewModel.idea?.title ?? "",
                sourceIdeaID: viewModel.idea?.id,
                sourceIconURL: viewModel.idea?.iconLink,
                isSubmitting: isForking,
                errorMessage: forkError,
                onSubmit: { title, description, reason in
                    Task { await submitFork(title: title, description: description, reason: reason) }
                }
            )
        }
        .sheet(isPresented: $showAuthSheet) {
            AuthRequiredSheet()
                .presentationDetents([.height(260)])
        }
        .navigationDestination(item: $agentRoute) { route in
            AgentProfileView(agentID: route.id)
        }
        .navigationDestination(item: $flowersRoute) { route in
            FlowersGridView(ideaID: route.id, initialFlowerCount: route.flowerCount)
        }
        .navigationDestination(item: $commentsRoute) { route in
            CommentsView(
                ideaID: route.id,
                ideaTitle: route.title,
                commentCount: route.commentCount,
                iconURL: route.iconURL,
                agentName: route.agentName
            )
        }
        .navigationDestination(item: $forkRoute) { route in
            IdeaDetailView(ideaID: route.id)
        }
        .navigationDestination(item: $ownerEditRoute) { route in
            IdeaOwnerEditView(ideaID: route.id)
        }
        .navigationDestination(item: $forkLineageRoute) { route in
            ForkLineageView(ideaID: route.id)
        }
        .navigationDestination(item: $versionRoute) { route in
            VersionCompareView(ideaID: route.ideaID, versionID: route.versionID, compareVersionID: route.compareVersionID)
        }
        .sheet(isPresented: $showShareSheet) {
            ShareSheet(items: [sharePayload]) {
                Task { await trackShare() }
            }
        }
        .navigationDestination(item: $chatRoute) { route in
            ChatThreadView(sessionID: route.id, title: route.title)
        }
        .navigationDestination(item: $userRoute) { route in
            UserProfileView(userID: route.id)
        }
        .sheet(isPresented: $showBuryConfirm) {
            buryReasonSheet
        }
        .sheet(isPresented: $showActionMenu) {
            if let idea = viewModel.idea {
                AtlasActionMenuSheet(actions: ideaMenuActions(idea: idea)) {
                    showActionMenu = false
                }
                .presentationDetents([.height(canEdit(idea: idea) ? 280 : 220)])
                .presentationDragIndicator(.hidden)
            }
        }
        .sheet(isPresented: $showReportSheet) {
            if let idea = viewModel.idea {
                ReportContentSheet(
                    targetLabel: idea.title,
                    onSubmit: { reason, detail in
                        showReportSheet = false
                        Task {
                            await ModerationActions.submitReport(
                                targetType: "idea",
                                targetID: idea.id,
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
            if showBlockDialog, let owner = viewModel.idea?.agent?.owner {
                AtlasCenterDialog(
                    title: "拉黑用户？",
                    message: "拉黑后将不再看到 \(owner.name) 发布的内容。",
                    destructiveTitle: "拉黑",
                    cancelTitle: "取消",
                    onConfirm: {
                        Task {
                            await ModerationActions.blockUser(id: owner.id, name: owner.name)
                            showBlockDialog = false
                        }
                    },
                    onCancel: { showBlockDialog = false }
                )
            }
        }
        .task(id: ideaID) {
            await viewModel.load(id: ideaID, isAuthenticated: session.isAuthenticated)
        }
        .onChange(of: session.isAuthenticated) { _, loggedIn in
            Task { await viewModel.load(id: ideaID, isAuthenticated: loggedIn) }
        }
    }

    private var buryReasonSheet: some View {
        VStack(spacing: 16) {
            AtlasSheetGrabber()
                .padding(.top, 8)

            AtlasSheetTitleRow(title: "埋葬想法", onClose: { showBuryConfirm = false })

            Text("埋葬后想法将从搜索与推荐中移除。")
                .font(AtlasTypography.mobileBody())
                .foregroundStyle(AtlasColors.inkSoft)
                .frame(maxWidth: .infinity, alignment: .leading)

            AtlasTextField(placeholder: "原因", text: $buryReason, height: AtlasMetrics.inputHeight)
                .padding(.horizontal, 4)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))

            AtlasPrimaryButton(title: "确认埋葬", isLoading: isBurying) {
                Task { await buryIdea() }
            }
            .disabled(buryReason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.bottom, 24)
        .background(AtlasColors.surface)
        .presentationDetents([.height(300)])
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(AtlasMetrics.radiusSheet)
    }

    @ViewBuilder
    private func detailContent(_ idea: Idea) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Identity hero — full-width gradient, no horizontal padding
                IdeaIdentityHero(idea: idea, iconNamespace: iconNamespace)
                    .padding(.horizontal, AtlasMetrics.pageX)
                    .padding(.top, 8)

                // Repo tabs with underline — Twitter-style
                RepoTabs(
                    selection: $selectedRepoTab,
                    forkCount: idea.forkCount,
                    commentCount: idea.commentCount
                )

                repoTabContent(idea)
                    .padding(.horizontal, AtlasMetrics.pageX)
                    .padding(.top, 16)
                    .padding(.bottom, 16)
            }
        }
    }

    @ViewBuilder
    private func repoTabContent(_ idea: Idea) -> some View {
        switch RepoTab(rawValue: selectedRepoTab) ?? .readme {
        case .readme:
            readmeTabContent(idea)
        case .forks:
            forksTabContent(idea)
        case .activity:
            activityTabContent(idea)
        case .discussion:
            discussionTabContent(idea)
        }
    }

    @ViewBuilder
    private func readmeTabContent(_ idea: Idea) -> some View {
        RelationshipTriangle(
            userName: idea.agent?.owner?.name ?? "用户",
            userID: idea.agent?.owner?.id ?? idea.agent?.ownerUserID ?? "user",
            userAvatarURL: idea.agent?.owner?.avatarLink,
            agentName: idea.agent?.name ?? "Agent",
            agentID: idea.agentID,
            agentAvatarURL: idea.agent?.avatarLink,
            ideaTitle: idea.title,
            ideaID: idea.id,
            ideaIconURL: idea.iconLink,
            onUserTap: {
                if let ownerID = idea.agent?.owner?.id ?? idea.agent?.ownerUserID {
                    userRoute = UserRoute(id: ownerID)
                }
            },
            onAgentTap: {
                agentRoute = AgentRoute(id: idea.agentID)
            }
        )

        AtlasStatusPill(text: idea.statusLabel)

        Text(idea.title)
            .font(AtlasTypography.screenTitle())
            .foregroundStyle(AtlasColors.ink)

        implProgressCard(idea)

        MarkdownBody(markdown: idea.description)

        forkBentoSection(idea)

        FlowersPreviewCard(
            flowerCount: idea.flowerCount,
            donors: viewModel.donors,
            onOpen: { openFlowersGrid(idea) },
            onSendFlower: { Task { await handleFlower() } }
        )

        if !idea.tags.isEmpty {
            HStack(spacing: 6) {
                ForEach(idea.tags.prefix(4), id: \.self) { tag in
                    TagPill(text: "#\(tag)")
                }
            }
        }

        implMetaSection(idea)

        if let agent = idea.agent {
            ideaChatCTA(idea: idea, agent: agent)
        }

        if viewModel.versions.count > 1 {
            versionsSection
        }
    }

    @ViewBuilder
    private func forksTabContent(_ idea: Idea) -> some View {
        forkBentoSection(idea, showAllChildren: true)

        if viewModel.forkChildren.count > 2 {
            VStack(alignment: .leading, spacing: 10) {
                Text("全部 Fork")
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)

                ForEach(viewModel.forkChildren) { child in
                    Button { forkRoute = IdeaRoute(id: child.id) } label: {
                        HStack(spacing: 8) {
                            EntityAvatar.idea(id: child.id, url: child.iconLink, name: child.title, size: 32)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(child.title)
                                    .font(AtlasTypography.mobileBody())
                                    .foregroundStyle(AtlasColors.ink)
                                    .lineLimit(1)
                                Text(child.createdAt.feedTimestamp)
                                    .font(AtlasTypography.meta())
                                    .foregroundStyle(AtlasColors.inkFaint)
                            }
                            Spacer()
                            Text("→")
                                .font(AtlasTypography.mobileSubheadline())
                                .foregroundStyle(AtlasColors.inkFaint)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 12)
                        .background(AtlasColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private func activityTabContent(_ idea: Idea) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("协作动态")
                .font(AtlasTypography.cardTitle())
                .foregroundStyle(AtlasColors.ink)
            Text("Fork、分享与 Agent 协作记录将显示在这里。")
                .font(AtlasTypography.mobileSubheadline())
                .foregroundStyle(AtlasColors.inkSoft)
        }
        .padding(AtlasMetrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }

    @ViewBuilder
    private func discussionTabContent(_ idea: Idea) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("讨论")
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)
                Spacer()
                Text("\(idea.commentCount) 条")
                    .font(AtlasTypography.meta())
                    .foregroundStyle(AtlasColors.accentActive)
            }

            Text(idea.commentCount > 0 ? "查看全部评论，参与 Idea 讨论。" : "还没有评论，写下第一条想法。")
                .font(AtlasTypography.mobileSubheadline())
                .foregroundStyle(AtlasColors.inkSoft)

            AtlasPrimaryButton(title: idea.commentCount > 0 ? "查看评论" : "写评论") {
                openComments(idea)
            }
        }
        .padding(AtlasMetrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }

    @ViewBuilder
    private func implProgressCard(_ idea: Idea) -> some View {
        if idea.implStatus != nil && !(idea.implStatus ?? "").isEmpty {
            implProgressSection(idea)
                .padding(AtlasMetrics.cardPadding)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AtlasColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        }
    }

    private func forkBentoSection(_ idea: Idea, showAllChildren: Bool = false) -> some View {
        let forkCount = idea.forkCount
        let childLimit = showAllChildren ? viewModel.forkChildren.count : 2
        return VStack(alignment: .leading, spacing: 12) {
            Text("fork 此想法，继续实现")
                .font(AtlasTypography.cardTitle())
                .foregroundStyle(AtlasColors.ink)

            Text(
                forkCount > 0
                    ? "已有 \(forkCount) 个衍生 Fork · 在社区协作中演化"
                    : "成为第一个 Fork，在社区协作中演化"
            )
            .font(AtlasTypography.mobileSubheadline())
            .foregroundStyle(AtlasColors.inkSoft)

            Button { openForkSheet() } label: {
                Text("Fork 此 Idea →")
                    .font(AtlasTypography.pill())
                    .foregroundStyle(AtlasColors.ink)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 9)
                    .overlay(Capsule().stroke(AtlasColors.ink, lineWidth: 1))
            }
            .buttonStyle(.plain)

            if forkCount > 0 {
                Button { forkLineageRoute = IdeaRoute(id: idea.id) } label: {
                    Text("查看 Fork 谱系")
                        .font(AtlasTypography.mobileSubheadline())
                        .foregroundStyle(AtlasColors.accentFork)
                }
                .buttonStyle(.plain)
            }

            ForEach(viewModel.forkChildren.prefix(childLimit)) { child in
                Button { forkRoute = IdeaRoute(id: child.id) } label: {
                    HStack(spacing: 8) {
                        Text(child.title)
                            .font(AtlasTypography.mobileSubheadline())
                            .foregroundStyle(AtlasColors.ink)
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text("→")
                            .font(AtlasTypography.mobileSubheadline())
                            .foregroundStyle(AtlasColors.inkFaint)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 12)
                    .background(AtlasColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.entityIdea)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func ideaMenuActions(idea: Idea) -> [AtlasMenuAction] {
        var actions: [AtlasMenuAction] = []
        if canEdit(idea: idea) {
            actions.append(AtlasMenuAction(title: "编辑") {
                ownerEditRoute = IdeaRoute(id: idea.id)
            })
            if idea.status == "active" {
                actions.append(AtlasMenuAction(title: "埋葬", destructive: true) {
                    buryReason = ""
                    showBuryConfirm = true
                })
            }
        }
        actions.append(AtlasMenuAction(title: "分享") {
            sharePayload = "\(idea.title)\n\(ideaShareURL(idea.id))"
            showShareSheet = true
        })
        actions.append(AtlasMenuAction(title: "举报内容") {
            showReportSheet = true
        })
        if let owner = idea.agent?.owner, owner.id != session.user?.id {
            actions.append(AtlasMenuAction(title: "拉黑发布者", destructive: true) {
                showBlockDialog = true
            })
        }
        return actions
    }

    private func ideaChatCTA(idea: Idea, agent: Agent) -> some View {
        Button {
            Task { await openIdeaChat(idea: idea, agent: agent) }
        } label: {
            HStack(spacing: 12) {
                EntityAvatar.agent(id: agent.id, url: agent.avatarLink, name: agent.name, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text("带着想法问 Agent")
                        .font(AtlasTypography.cardTitle())
                        .foregroundStyle(AtlasColors.ink)
                    Text("基于当前想法开启对话")
                        .font(AtlasTypography.mobileSubheadline())
                        .foregroundStyle(AtlasColors.inkFaint)
                }
                Spacer(minLength: 0)
                Text("发起对话 →")
                    .font(AtlasTypography.pill())
                    .foregroundStyle(AtlasColors.accentActive)
            }
            .padding(AtlasMetrics.cardPadding)
            .background(AtlasColors.entityAgent.opacity(0.45))
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isCreatingChat)
        .overlay {
            if isCreatingChat {
                ProgressView()
            }
        }
    }

    private func openIdeaChat(idea: Idea, agent: Agent) async {
        if !session.isAuthenticated {
            showAuthSheet = true
            return
        }
        isCreatingChat = true
        defer { isCreatingChat = false }
        do {
            let chatSession = try await APIClient.shared.createSession(
                agentID: agent.id,
                title: idea.title,
                ideaID: idea.id
            )
            chatRoute = ChatSessionRoute(id: chatSession.id, title: chatSession.displayTitle)
        } catch {
            ToastCenter.shared.showError("无法创建对话", message: error.localizedDescription)
        }
    }

    private var versionsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("版本历史")
                .font(AtlasTypography.cardTitle())
                .foregroundStyle(AtlasColors.ink)
            ForEach(viewModel.versions) { version in
                Button {
                    let current = viewModel.versions.first(where: \.isCurrent)
                    if let current, current.id != version.id {
                        versionRoute = VersionCompareRoute(ideaID: ideaID, versionID: version.id, compareVersionID: current.id)
                    } else {
                        versionRoute = VersionCompareRoute(ideaID: ideaID, versionID: version.id, compareVersionID: nil)
                    }
                } label: {
                    HStack {
                        Text("v\(version.version)")
                            .font(AtlasTypography.mobileSubheadline())
                            .foregroundStyle(version.isCurrent ? AtlasColors.accentActive : AtlasColors.ink)
                        Text(version.changelog)
                            .font(AtlasTypography.mobileSubheadline())
                            .foregroundStyle(AtlasColors.inkSoft)
                            .lineLimit(1)
                        Spacer()
                        Text(version.createdAt.relativeShort)
                            .font(AtlasTypography.meta())
                            .foregroundStyle(AtlasColors.inkFaint)
                    }
                    .padding(.vertical, 6)
                    .overlay(alignment: .bottom) { Rectangle().fill(AtlasColors.rule).frame(height: 1) }
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private func implProgressSection(_ idea: Idea) -> some View {
        if let status = idea.implStatus, !status.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(implStatusLabel(status))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AtlasColors.accentActive)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(AtlasColors.accentActiveSoft)
                        .clipShape(Capsule())
                    Spacer()
                    Text("\(Int(implProgressFraction(status) * 100))%")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AtlasColors.inkFaint)
                }
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(AtlasColors.fill)
                        Capsule()
                            .fill(AtlasColors.accentActive)
                            .frame(width: max(6, proxy.size.width * implProgressFraction(status)))
                    }
                }
                .frame(height: 6)
            }
        }
    }

    private func implProgressFraction(_ status: String) -> Double {
        switch status {
        case "concept": return 0.25
        case "in_progress": return 0.55
        case "implemented": return 1.0
        case "paused": return 0.35
        default: return 0.15
        }
    }

    private func implStatusLabel(_ status: String) -> String {
        switch status {
        case "concept": return "概念"
        case "in_progress": return "进行中"
        case "implemented": return "已实现"
        case "paused": return "暂停"
        default: return status
        }
    }

    @ViewBuilder
    private func implMetaSection(_ idea: Idea) -> some View {
        let hasRepo = !(idea.repoURL ?? "").isEmpty
        let hasDemo = !(idea.demoURL ?? "").isEmpty
        if hasRepo || hasDemo {
            settingsGroupedCard {
                VStack(alignment: .leading, spacing: 10) {
                    Text("实现信息")
                        .font(AtlasTypography.cardTitle())
                        .foregroundStyle(AtlasColors.ink)
                    if hasRepo, let repo = idea.repoURL, let url = URL(string: repo) {
                        repoLink(repo, url: url)
                    }
                    if hasDemo, let demo = idea.demoURL, let url = URL(string: demo) {
                        repoLink(demo, url: url)
                    }
                }
                .padding(AtlasMetrics.cardPadding)
            }
        }
    }

    private func repoLink(_ label: String, url: URL) -> some View {
        Link(destination: url) {
            HStack {
                Text(label.replacingOccurrences(of: "^https?://", with: "", options: .regularExpression))
                    .font(AtlasTypography.mobileSubheadline())
                    .foregroundStyle(AtlasColors.accentActive)
                    .lineLimit(1)
                Spacer()
                DeimosIconView(icon: .externalLink, size: 12, color: AtlasColors.inkFaint)
            }
        }
    }

    private func buryIdea() async {
        let reason = buryReason.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !reason.isEmpty else {
            ToastCenter.shared.showError("请填写埋葬原因")
            return
        }
        isBurying = true
        defer { isBurying = false }
        do {
            try await viewModel.bury(reason: reason)
            ToastCenter.shared.showSuccess("想法已埋葬")
            showBuryConfirm = false
        } catch {
            ToastCenter.shared.showError(error.localizedDescription)
        }
    }

    private func handleFlower() async {
        if !session.isAuthenticated {
            showAuthSheet = true
            return
        }
        _ = await viewModel.sendFlower(isAuthenticated: true)
        if let msg = viewModel.actionMessage {
            if msg.contains("已送出") {
                ToastCenter.shared.showSuccess(msg)
            } else {
                ToastCenter.shared.showError(msg)
            }
            viewModel.actionMessage = nil
        }
    }

    private func handleLike() async {
        if !session.isAuthenticated {
            showAuthSheet = true
            return
        }
        _ = await viewModel.toggleLike(isAuthenticated: true)
        if let msg = viewModel.actionMessage {
            ToastCenter.shared.showError(msg)
            viewModel.actionMessage = nil
        }
    }

    private func canEdit(idea: Idea?) -> Bool {
        guard session.isAuthenticated, let idea, let ownerID = idea.agent?.ownerUserID, let userID = session.user?.id else {
            return false
        }
        return ownerID == userID
    }

    private func ideaShareURL(_ id: String) -> String {
        "deimos://ideas/\(id)"
    }

    private func trackShare() async {
        guard session.isAuthenticated else { return }
        try? await APIClient.shared.shareIdea(id: ideaID)
    }

    private func shareIdea() async {
        guard let idea = viewModel.idea else { return }
        sharePayload = "\(idea.title)\n\(ideaShareURL(idea.id))"
        showShareSheet = true
    }

    private func openFlowersGrid(_ idea: Idea) {
        flowersRoute = FlowersRoute(idea: idea)
    }

    private func openComments(_ idea: Idea) {
        commentsRoute = CommentsRoute(
            id: idea.id,
            title: idea.title,
            commentCount: idea.commentCount,
            iconURL: idea.iconURL,
            agentName: idea.agent?.name
        )
    }

    private func openForkSheet() {
        if !session.isAuthenticated {
            showAuthSheet = true
            return
        }
        forkError = nil
        showForkSheet = true
    }

    private func submitFork(title: String, description: String, reason: String) async {
        isForking = true
        forkError = nil
        defer { isForking = false }
        do {
            let forked = try await viewModel.fork(title: title, description: description, reason: reason)
            showForkSheet = false
            ToastCenter.shared.showSuccess("Fork 已创建")
            forkRoute = IdeaRoute(id: forked.id)
        } catch {
            forkError = error.localizedDescription
        }
    }
}
