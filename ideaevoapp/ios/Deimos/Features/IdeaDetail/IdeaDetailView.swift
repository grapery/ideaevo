import SwiftUI
import Observation

@MainActor
@Observable
final class IdeaDetailViewModel {
    var idea: Idea?
    var donors: [FlowerDonor] = []
    var forkChildren: [Idea] = []
    var versions: [IdeaVersionSummary] = []
    var stats: IdeaStats?
    var lineage: IdeaLineage?
    var reactionCounts: [String: Int] = [:]
    var mineReaction = ""
    var isLiked = false
    var isBookmarked = false
    var isWished = false
    var isLoading = true
    var errorMessage: String?
    var actionMessage: String?

    var currentVersionNumber: Int {
        versions.first(where: \.isCurrent)?.version
            ?? lineage?.currentVersion.version
            ?? 1
    }

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
            async let statsTask = APIClient.shared.getIdeaStats(ideaID: id)
            async let lineageTask = APIClient.shared.getIdeaLineage(ideaID: id)
            // The artifact itself is required. Social and analytics panels are
            // optional enrichment, so a transient auxiliary API failure must
            // never turn a readable Idea into a full-screen load error.
            idea = try await ideaTask
            donors = (try? await flowersTask) ?? []
            forkChildren = (try? await forksTask) ?? []
            versions = (try? await versionsTask) ?? []
            stats = try? await statsTask
            lineage = try? await lineageTask
            if let reactions = try? await reactionsTask {
                reactionCounts = reactions.counts
                mineReaction = reactions.mineEmoji
            } else {
                reactionCounts = [:]
                mineReaction = ""
            }
            if isAuthenticated {
                isLiked = (try? await APIClient.shared.getLikeStatus(id: id)) ?? false
                isBookmarked = (try? await APIClient.shared.getBookmarkStatus(id: id)) ?? false
                isWished = (try? await APIClient.shared.getWishStatus(id: id)) ?? false
            } else {
                isLiked = false
                isBookmarked = false
                isWished = false
            }
            try? await APIClient.shared.recordIdeaView(ideaID: id)
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

    func toggleWish(isAuthenticated: Bool) async -> Bool {
        guard isAuthenticated, let id = idea?.id else { return false }
        let wasWished = isWished
        do {
            try await APIClient.shared.toggleWish(id: id, currentlyWished: wasWished)
            isWished = !wasWished
            idea = try await APIClient.shared.getIdea(id: id)
            return true
        } catch {
            actionMessage = error.localizedDescription
            return true
        }
    }

    func toggleBookmark(isAuthenticated: Bool) async -> Bool {
        guard isAuthenticated, let id = idea?.id else { return false }
        do {
            try await APIClient.shared.toggleBookmark(id: id, currentlyBookmarked: isBookmarked)
            isBookmarked.toggle()
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
        let currentVersionID = versions.first(where: \.isCurrent)?.id
        return try await APIClient.shared.forkIdea(
            id: id,
            title: title,
            description: description,
            reason: reason,
            sourceVersionID: currentVersionID
        )
    }

    func bury(reason: String) async throws {
        guard let id = idea?.id else { throw APIError.server("想法不存在") }
        let updated = try await APIClient.shared.buryIdea(id: id, reason: reason)
        idea = updated
    }

    func archive(reason: String?) async throws {
        guard let id = idea?.id else { throw APIError.server("想法不存在") }
        let updated = try await APIClient.shared.archiveIdea(id: id, reason: reason)
        idea = updated
    }

    func markImplemented() async throws {
        guard let id = idea?.id else { throw APIError.server("想法不存在") }
        let updated = try await APIClient.shared.markIdeaImplemented(id: id)
        idea = updated
    }

    func reactivate() async throws {
        guard let id = idea?.id else { throw APIError.server("想法不存在") }
        let updated = try await APIClient.shared.reactivateIdea(id: id)
        idea = updated
    }

    private func refreshReactions(ideaID: String) async {
        if let reactions = try? await APIClient.shared.getReactions(ideaID: ideaID) {
            reactionCounts = reactions.counts
            mineReaction = reactions.mineEmoji
        }
    }
}

/// v2 (ardot S04 `311:81`): float-liquid glass pill tabbar anchored to the bottom safe area.
/// Replaces the old full-width `.ultraThinMaterial` bar + hairline + wide "从 vX Fork" lemon
/// capsule. The new bar is a single floating rounded-rectangle (r28) of translucent glass
/// holding four equal circular icon buttons: comment (with count), share, save/bookmark,
/// and fork (lemon-filled with count). Matches the iOS 26 Liquid Glass aesthetic and the
/// top floating-glass toolbar language.
private struct IdeaEvolutionActionBar: View {
    let likeCount: Int
    let flowerCount: Int
    let commentCount: Int
    let forkCount: Int
    let wishCount: Int
    let isLiked: Bool
    let isWished: Bool
    let onLike: () -> Void
    let onFlower: () -> Void
    let onComment: () -> Void
    let onFork: () -> Void
    let onWish: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            metricButton(icon: .heart, count: likeCount, isActive: isLiked, action: onLike)
                .accessibilityLabel("喜欢，\(likeCount) 次")
            metricButton(icon: .star, count: wishCount, isActive: isWished, action: onWish)
                .accessibilityLabel("期待，\(wishCount) 次")
            metricButton(icon: .flower, count: flowerCount, isActive: false, action: onFlower)
                .accessibilityLabel("送花，\(flowerCount) 朵")
            metricButton(icon: .fork, count: forkCount, isActive: false, action: onFork)
                .accessibilityLabel("Fork，\(forkCount) 次")
            metricButton(icon: .comment, count: commentCount, isActive: false, action: onComment)
                .accessibilityLabel("评论，\(commentCount) 条")
        }
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity)
        .frame(height: 52)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(Color.white.opacity(0.36))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.white.opacity(0.78), lineWidth: 1)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(AtlasColors.ink.opacity(0.06), lineWidth: 1)
        )
        .shadow(color: AtlasColors.ink.opacity(0.10), radius: 18, x: 0, y: 8)
        .padding(.bottom, 2)
    }

    private func metricButton(
        icon: DeimosIcon,
        count: Int,
        isActive: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Text("\(count)")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(isActive ? AtlasColors.lemonInk : AtlasColors.inkSoft)
                    .monospacedDigit()
                DeimosIconView(
                    icon: icon,
                    size: 14,
                    color: isActive || icon == .fork ? AtlasColors.lemonInk : AtlasColors.ink
                )
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
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
    @State private var showArchiveConfirm = false
    @State private var archiveReason = ""
    @State private var isArchiving = false
    @State private var showImplementConfirm = false
    @State private var userRoute: UserRoute?
    @State private var showActionMenu = false
    @State private var showReportSheet = false
    @State private var showBlockDialog = false
    @State private var selectedRepoTab = 0
    /// True when the cover has scrolled past the glass toolbar — reveals the centered nav title.
    @State private var hasScrolledPastCover = false

    private var isSheetZoomActive: Bool {
        showAuthSheet || showForkSheet || showShareSheet || showBuryConfirm || showActionMenu || showReportSheet
    }

    var body: some View {
        Group {
            if viewModel.isLoading {
                VStack(spacing: 0) {
                    coverNavOverlay(title: nil, showButtons: false)
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .background(AtlasColors.canvas)
                .navigationBarHidden(true)
                .suppressTabBar()
            } else if let errorMessage = viewModel.errorMessage {
                VStack(spacing: 0) {
                    if isUnavailableIdea(errorMessage) {
                        AtlasPushNavBar(title: "想法详情", onBack: { dismiss() })
                        AtlasDesignedEmptyState(
                            icon: .document,
                            title: "想法不存在",
                            subtitle: "可能已被删除，或你没有访问权限",
                            ctaTitle: "返回探索",
                            ctaAction: { dismiss() }
                        )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        coverNavOverlay(title: nil, showButtons: false)
                        AtlasDesignedEmptyStates.loadFailed(message: errorMessage) {
                            Task { await viewModel.load(id: ideaID, isAuthenticated: session.isAuthenticated) }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                }
                .background(AtlasColors.canvas)
                .navigationBarHidden(true)
                .suppressTabBar()
            } else if let idea = viewModel.idea {
                detailScreen(idea)
            }
        }
        .atlasSheetZoomBackground(isPresented: isSheetZoomActive)
        .navigationBarHidden(true)
        .suppressTabBar()
        .safeAreaInset(edge: .bottom) {
            if let idea = viewModel.idea {
                IdeaEvolutionActionBar(
                    likeCount: idea.likeCount,
                    flowerCount: idea.flowerCount,
                    commentCount: idea.commentCount,
                    forkCount: idea.forkCount,
                    wishCount: idea.wishCount,
                    isLiked: viewModel.isLiked,
                    isWished: viewModel.isWished,
                    onLike: { Task { await handleLike() } },
                    onFlower: { Task { await handleFlower() } },
                    onComment: { openComments(idea) },
                    onFork: { openForkSheet() },
                    onWish: { Task { await handleWish() } }
                )
            }
        }
        .sheet(isPresented: $showForkSheet) {
            ForkSheet(
                sourceTitle: viewModel.idea?.title ?? "",
                sourceDescription: viewModel.idea?.description ?? "",
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
        .sheet(isPresented: $showArchiveConfirm) {
            archiveReasonSheet
        }
        .sheet(isPresented: $showImplementConfirm) {
            implementConfirmSheet
        }
        .sheet(isPresented: $showActionMenu) {
            if let idea = viewModel.idea {
                AtlasActionMenuSheet(actions: ideaMenuActions(idea: idea)) {
                    showActionMenu = false
                }
                .presentationDetents([.height(canEdit(idea: idea) ? 400 : 220)])
                .presentationDragIndicator(.hidden)
            }
        }
        .fullScreenCover(isPresented: $showReportSheet) {
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
            }
        }
        .fullScreenCover(isPresented: $showBlockDialog) {
            if showBlockDialog, let owner = viewModel.idea?.agent?.owner {
                BlockUserSheet(
                    userID: owner.id,
                    name: owner.name,
                    avatarURL: owner.avatarLink,
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
        #if DEBUG
        .onChange(of: viewModel.isLoading) { _, isLoading in
            guard !isLoading, let idea = viewModel.idea else { return }
            fireDebugDeepLinks(for: idea)
        }
        .onChange(of: viewModel.idea?.id) { _, _ in
            if let idea = viewModel.idea, !viewModel.isLoading {
                fireDebugDeepLinks(for: idea)
            }
        }
        #endif
    }

    private func isUnavailableIdea(_ message: String) -> Bool {
        let normalized = message.lowercased()
        return normalized.contains("404") || normalized.contains("not found") || message.contains("不存在") || normalized.contains("forbidden") || message.contains("权限")
    }

    #if DEBUG
    @State private var debugDeepLinkFired = false
    private func fireDebugDeepLinks(for idea: Idea) {
        guard !debugDeepLinkFired else { return }
        debugDeepLinkFired = true
        let args = ProcessInfo.processInfo.arguments
        if args.contains("--deimos-goto-comments") {
            openComments(idea)
        } else if args.contains("--deimos-goto-fork-sheet") {
            showForkSheet = true
        } else if args.contains("--deimos-goto-fork-lineage") {
            forkLineageRoute = IdeaRoute(id: idea.id)
        } else if args.contains("--deimos-goto-owner-edit") {
            ownerEditRoute = IdeaRoute(id: idea.id)
        } else if args.contains("--deimos-goto-report") {
            showReportSheet = true
        } else if args.contains("--deimos-goto-block") {
            showBlockDialog = true
        }
    }
    #endif

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
        .padding(.horizontal, AtlasMetrics.detailX)
        .padding(.bottom, 24)
        .background(AtlasColors.surface)
        .presentationDetents([.height(300)])
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(AtlasMetrics.radiusSheet)
    }

    private var archiveReasonSheet: some View {
        VStack(spacing: 16) {
            AtlasSheetGrabber()
                .padding(.top, 8)

            AtlasSheetTitleRow(title: "归档想法", onClose: { showArchiveConfirm = false })

            Text("归档表示暂时搁置，区别于彻底放弃的埋葬。归档后从搜索与推荐中移除。")
                .font(AtlasTypography.mobileBody())
                .foregroundStyle(AtlasColors.inkSoft)
                .frame(maxWidth: .infinity, alignment: .leading)

            AtlasTextField(placeholder: "原因（可选）", text: $archiveReason, height: AtlasMetrics.inputHeight)
                .padding(.horizontal, 4)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))

            AtlasPrimaryButton(title: "确认归档", isLoading: isArchiving) {
                Task { await archiveIdea() }
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, AtlasMetrics.detailX)
        .padding(.bottom, 24)
        .background(AtlasColors.surface)
        .presentationDetents([.height(320)])
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(AtlasMetrics.radiusSheet)
    }

    private var implementConfirmSheet: some View {
        VStack(spacing: 16) {
            AtlasSheetGrabber()
                .padding(.top, 8)

            AtlasSheetTitleRow(title: "标记已落地", onClose: { showImplementConfirm = false })

            Text("标记为「已落地」表示这个想法已经实现、可复用。其他探索者能快速识别，避免重复造轮子。")
                .font(AtlasTypography.mobileBody())
                .foregroundStyle(AtlasColors.inkSoft)
                .frame(maxWidth: .infinity, alignment: .leading)

            AtlasPrimaryButton(title: "确认已落地", isLoading: false) {
                Task { await implementIdea() }
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, AtlasMetrics.detailX)
        .padding(.bottom, 24)
        .background(AtlasColors.surface)
        .presentationDetents([.height(260)])
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(AtlasMetrics.radiusSheet)
    }

    // MARK: - S04 Cover Page (Ardot `237:230`)

    /// ardot S04 (`237:230`) layout: full-width 390×220 #F3FFC8 cover sits at the top (no
    /// horizontal padding), then everything below scrolls inside a padded column. The cover
    /// carries the title, status line, accent rule, and back/more buttons — it IS the identity
    /// surface. Replaces the previous card-stack layout that opened with a padded identity card.
    @ViewBuilder
    private func detailScreen(_ idea: Idea) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Full-width cover — sits flush to the screen edges, ABOVE the safe-area toolbar.
                // Scroll-offset tracker uses the cover so the glass toolbar reveals as it scrolls past.
                ideaCover(idea)

                // Padded content column below the cover. ardot itemSpacing=14.
                VStack(alignment: .leading, spacing: 14) {
                    // Scroll-offset tracker: fires when the cover top passes under the toolbar.
                    GeometryReader { geo in
                        Color.clear.preference(
                            key: ScrollOffsetKey.self,
                            value: geo.frame(in: .named("detailScroll")).minY
                        )
                    }
                    .frame(height: 0)

                    // ardot S04 `237:230` Meta row: 14pt Regular #8A94A6 "Agent · Author · 时间".
                    metaRow(idea)

                    // ardot S04 `237:230` Action Pills: 350×44 #F5F6F7 cr22 container holding 3
                    // equal-width action pills — 送花 (#F3FFC8) / 评论 (#F5F6F7) / Fork (#D2F522).
                    actionPillsBar(idea)

                    overviewCard(idea)
                    quickLinksSection(idea)
                    forkLineagePreview(idea)
                    attachmentsCard(idea)

                    implProgressCard(idea)
                    mediaGallerySection(idea)

                    if !idea.tags.isEmpty {
                        HStack(spacing: 6) {
                            ForEach(idea.tags.prefix(4), id: \.self) { tag in
                                TagPill(text: "#\(tag)")
                            }
                        }
                    }

                    if let agent = idea.agent {
                        ideaChatCTA(idea: idea, agent: agent)
                    }
                }
                .padding(.horizontal, AtlasMetrics.detailX)
                .padding(.top, 16)
                .padding(.bottom, AtlasMetrics.bottomClear)
            }
        }
        .coordinateSpace(name: "detailScroll")
        .onPreferenceChange(ScrollOffsetKey.self) { offset in
            withAnimation(.easeInOut(duration: 0.2)) {
                hasScrolledPastCover = offset < -60
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            AtlasDetailGlassToolbar(
                onBack: { dismiss() },
                onShare: {
                    sharePayload = "\(idea.title)\n\(ideaShareURL(idea.id))"
                    showShareSheet = true
                },
                onSave: { Task { await handleBookmark() } },
                onForkLineage: { forkLineageRoute = IdeaRoute(id: idea.id) },
                onMore: {
                    sharePayload = "\(idea.title)\n\(ideaShareURL(idea.id))"
                    showShareSheet = true
                },
                navTitle: "想法详情",
                showTitle: hasScrolledPastCover
            )
        }
    }

    /// ardot S04 (`237:230` Cover): full-width 390×220 #F3FFC8 cover.
    /// Layout (top→bottom, all left-aligned at 20pt horizontal padding):
    ///   1. Back circle (44×44 white cr22) at top-left + More circle at top-right
    ///   2. Idea Status (11pt Semibold #65703A) — "IDEA · ACTIVE · v4"
    ///   3. Accent Rule (44×3 #BEE90D cr2) — small lemon divider
    ///   4. Cover Title (24pt Bold #0F1B2D) — the idea title
    /// Replaces the previous lemonSoft identity card (S04 `179:3` pattern).
    private func ideaCover(_ idea: Idea) -> some View {
        let version = viewModel.currentVersionNumber
        let category = idea.category.trimmingCharacters(in: .whitespacesAndNewlines)
        // 反映真实生命周期状态；非 active 时用 statusLabel，否则回退到分类（保持原有视觉）
        let statusPart: String
        if idea.status != "active" {
            statusPart = idea.statusLabel.uppercased()
        } else if category.isEmpty {
            statusPart = "ACTIVE"
        } else {
            statusPart = category.uppercased()
        }
        let statusText = "IDEA · \(statusPart) · v\(version)"

        return ZStack(alignment: .top) {
            // 封面背景层:优先封面图,无图时回退柠檬色块(保持原视觉)。
            // 有视频时,在封面图右上叠加一个播放按钮入口。
            coverBackgroundLayer(idea)

            // Bottom-anchored stack: Status + Accent Rule + Title.
            // Status at y=126, Rule at y=146, Title at y=160 per spec (relative to cover top).
            VStack(alignment: .leading, spacing: 4) {
                Text(statusText)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(AtlasColors.oliveMeta)
                    .frame(maxWidth: .infinity, alignment: .leading)
                // Accent rule — 44×3 #BEE90D cr2.
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(AtlasColors.lemonStrong)
                    .frame(width: 44, height: 3)
                    .padding(.top, 2)
                    .padding(.bottom, 4)
                // Cover title — 24pt Bold #0F1B2D.
                Text(idea.displayTitle)
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 16)
            .frame(maxWidth: .infinity, maxHeight: 220, alignment: .bottomLeading)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 220)
    }

    /// 封面背景层:有封面图时用 AsyncImage + 底部渐变遮罩(保证文字可读);
    /// 无图时回退柠檬色块(保持原有视觉)。有视频时叠加播放入口。
    @ViewBuilder
    private func coverBackgroundLayer(_ idea: Idea) -> some View {
        ZStack(alignment: .topTrailing) {
            if let coverURL = idea.coverLink, coverURL != idea.iconLink {
                // 有真实封面图(非 icon 回退):AsyncImage + 渐变遮罩
                AsyncImage(url: coverURL) { phase in
                    switch phase {
                    case .success(let image):
                        ZStack(alignment: .bottom) {
                            image
                                .resizable()
                                .scaledToFill()
                                .frame(height: 220)
                                .clipped()
                            // 底部渐变,让 status/title 文字在任意背景上都可读
                            LinearGradient(
                                colors: [.clear, .black.opacity(0.45)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                            .frame(height: 120)
                            .allowsHitTesting(false)
                        }
                    default:
                        Rectangle().fill(AtlasColors.chatActivityFill).frame(height: 220)
                    }
                }
            } else {
                // 无封面图:保持柠檬色块
                Rectangle().fill(AtlasColors.chatActivityFill).frame(height: 220)
            }

            // 视频入口:有宣传视频时,右上角放一个播放按钮
            if let videoURL = idea.videoLink {
                VideoCoverButton(url: videoURL)
                    .frame(width: 72, height: 48)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(.white.opacity(0.4), lineWidth: 1)
                    )
                    .padding(.top, 56)
                    .padding(.trailing, 16)
            }
        }
        .frame(height: 220)
    }

    /// A single 44×44 glass circle control using the shared SVG icon language.
    private func coverFloatButton(icon: DeimosIcon, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            DeimosIconView(icon: icon, size: 17, color: AtlasColors.ink)
                .frame(width: AtlasMetrics.coverButtonSize, height: AtlasMetrics.coverButtonSize)
                .atlasToolbarFloat()
        }
        .buttonStyle(.plain)
    }

    /// ardot S04 `237:230` Meta row — 14pt Regular `#8A94A6`, single line summarizing the
    /// authoring agent + human author + recency. Reads as a quiet attribution line below the
    /// cover/identity card.
    @ViewBuilder
    private func metaRow(_ idea: Idea) -> some View {
        let agentName = idea.agent?.name ?? "Agent"
        let author = idea.authorDisplayName
        let parts = [agentName, author, idea.updatedAt.relativeShort]
        Text(parts.joined(separator: " · "))
            .font(.system(size: 12))
            .foregroundStyle(AtlasColors.inkSoft)
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// ardot S04 (`237:257` Action Pills): 350×40 #F5F6F7 cr20 container, padding 4, itemSpacing 4.
    /// Each pill 110×32 cr16 with 14pt Semibold label. 送花 #F3FFC8 / 评论 #F5F6F7 / Fork #D2F522.
    @ViewBuilder
    private func actionPillsBar(_ idea: Idea) -> some View {
        HStack(spacing: 4) {
            actionPill(label: "✿ 送花", fill: AtlasColors.chatActivityFill, textColor: AtlasColors.lemonInk) {
                Task { await handleFlower() }
            }
            actionPill(label: "◇ 评论", fill: AtlasColors.chatAssistantBubble, textColor: AtlasColors.ink) {
                openComments(idea)
            }
            actionPill(label: "⑂ Fork", fill: AtlasColors.lemonCTA, textColor: AtlasColors.lemonInk) {
                openForkSheet()
            }
        }
        .padding(4)
        .frame(maxWidth: .infinity)
        .frame(height: 40)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(AtlasColors.chatAssistantBubble)
        )
    }

    private func actionPill(
        label: String,
        fill: Color,
        textColor: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(textColor)
                .frame(maxWidth: .infinity)
                .frame(height: 32)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(fill)
                )
        }
        .buttonStyle(.plain)
    }

    /// Cover image with fallback.
    @ViewBuilder
    private func coverImage(for idea: Idea) -> some View {
        let image = Group {
            if let imageURL = idea.primaryImageURL ?? idea.iconLink {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFill()
                    default:
                        coverFallback
                    }
                }
            } else {
                coverFallback
            }
        }

        if let iconNamespace {
            image.matchedGeometryEffect(id: "idea-icon-\(idea.id)", in: iconNamespace)
        } else {
            image
        }
    }

    private var coverFallback: some View {
        Rectangle().fill(AtlasColors.heroBlue.opacity(0.3))
    }

    /// Nav overlay for loading/error states — minimal cover with back button only.
    private func coverNavOverlay(title: String?, showButtons: Bool) -> some View {
        ZStack(alignment: .topLeading) {
            Rectangle()
                .fill(AtlasColors.heroBlue.opacity(0.2))
                .frame(height: 280)
                .frame(maxWidth: .infinity)
                .ignoresSafeArea(edges: .top)

            if showButtons {
                coverFloatButton(icon: .chevronBack) {
                    dismiss()
                }
                .padding(.horizontal, 16)
                .padding(.top, 74)
            }
        }
        .frame(height: 280)
    }

    /// Ardot 246:38 + v2 merge: `演化脉络` + `版本历史` collapsed into one lemonSoft card.
    /// Header (title + chevron) and the lineage summary row both navigate to the fork lineage;
    /// each version row navigates to that version's compare view. The hairline + version list
    /// below the summary used to live in a separate `versionsSection` card — merging removes
    /// the visual overlap the user called out.
    @ViewBuilder
    private func forkLineagePreview(_ idea: Idea) -> some View {
        // ardot S04 (`237:267` Fork Lineage Card): 350×74, fill #F3FFC8, cr16, itemSpacing 5, padding 14.
        // Title "Fork 脉络" 15pt Semibold #0F1B2D; body 12pt Regular #5A6472.
        let current = viewModel.currentVersionNumber
        let source = viewModel.lineage?.sourceVersion?.version
        let childForks = max(idea.forkCount, 0)
        let summary: String = {
            if let source {
                return "源想法 v\(source) → 当前 v\(current) · \(childForks) 个子 Fork"
            }
            return "当前 v\(current) · \(childForks) 个子 Fork"
        }()
        VStack(alignment: .leading, spacing: 5) {
            Button {
                forkLineageRoute = IdeaRoute(id: idea.id)
            } label: {
                HStack {
                    Text("Fork 脉络")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Spacer(minLength: 0)
                    DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkSoft)
                }
            }
            .buttonStyle(.plain)

            Button {
                forkLineageRoute = IdeaRoute(id: idea.id)
            } label: {
                Text(summary)
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.chatActivityInk)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)

        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.chatActivityFill)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    /// Ardot 246:158 Media & Attachments — summary row from stats / image URLs.
    @ViewBuilder
    private func attachmentsCard(_ idea: Idea) -> some View {
        let imageCount = max(viewModel.stats?.imageCount ?? 0, idea.imageURLs.count)
        let linkCount = max(viewModel.stats?.linkCount ?? 0, idea.externalLinks.count)
        let total = imageCount + linkCount
        if total > 0 {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(AtlasColors.lemon)
                        .frame(width: 64, height: 48)
                    DeimosIconView(icon: .document, size: 20, color: AtlasColors.lemonInk)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(attachmentTitle(for: idea))
                        .font(AtlasTypography.pill())
                        .foregroundStyle(AtlasColors.ink)
                        .lineLimit(1)
                    Text(attachmentMetaLine(imageCount: imageCount, linkCount: linkCount))
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AtlasColors.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        }
    }

    private func attachmentTitle(for idea: Idea) -> String {
        if let changelog = viewModel.versions.first(where: \.isCurrent)?.changelog
            .trimmingCharacters(in: .whitespacesAndNewlines), !changelog.isEmpty {
            return changelog.count > 22 ? String(changelog.prefix(22)) + "…" : changelog
        }
        return "\(idea.displayTitle) 附件"
    }

    private func attachmentMetaLine(imageCount: Int, linkCount: Int) -> String {
        var parts: [String] = []
        if imageCount > 0 { parts.append("图片") }
        parts.append("Markdown")
        if linkCount > 0 { parts.append("链接") }
        let total = max(1, imageCount + linkCount)
        return "\(total) 个附件 · \(parts.joined(separator: "、"))  ›"
    }

    @ViewBuilder
    private func detailContent(_ idea: Idea) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Identity hero — full-width gradient, no horizontal padding
                IdeaIdentityHero(idea: idea, iconNamespace: iconNamespace)
                    .padding(.horizontal, AtlasMetrics.detailX)
                    .padding(.top, 8)

                // Repo tabs with underline — Twitter-style
                RepoTabs(
                    selection: $selectedRepoTab,
                    forkCount: idea.forkCount,
                    commentCount: idea.commentCount
                )

                repoTabContent(idea)
                    .padding(.horizontal, AtlasMetrics.detailX)
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
        overviewCard(idea)

        quickLinksSection(idea)

        implProgressCard(idea)

        mediaGallerySection(idea)

        forkBentoSection(idea)

        FlowersPreviewCard(
            flowerCount: idea.flowerCount,
            donors: viewModel.donors,
            onOpen: { Task { await handleFlower() } },
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

    /// Ardot 246:30 Description — "当前版本解决什么" + short version summary.
    private func overviewCard(_ idea: Idea) -> some View {
        // ardot S04 `237:230` README card: #FBFCFD fill + #E8EBF0 stroke, cr20.
        // Title "README · 产品说明" 15pt Semibold #0F1B2D; body 15pt Regular #0F1B2D.
        // Previous version used white surface + AtlasColors.border + 16pt title — under-spec.
        let changelog = viewModel.versions.first(where: \.isCurrent)?.changelog
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let body = changelog.isEmpty
            ? idea.description.plainSummary
            : changelog

        // ardot S04 (`237:264` README): 350×118, fill #F8F9FB, stroke #EEF1F3, cr16, itemSpacing 6, padding 14.
        // Title "README · 产品说明" 14pt Semibold ink; body 按 is_markdown 决定渲染方式。
        return VStack(alignment: .leading, spacing: 6) {
            Text("README · 产品说明")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
            if idea.isMarkdown {
                MarkdownBody(markdown: body, textColor: AtlasColors.ink)
            } else {
                Text(body)
                    .font(.system(size: 14))
                    .foregroundStyle(AtlasColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: 0xF8F9FB))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color(hex: 0xEEF1F3), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    /// Ardot 246:33 Project Links — equal-width repo / demo slots.
    @ViewBuilder
    private func quickLinksSection(_ idea: Idea) -> some View {
        let repo = idea.externalLinks.first { $0.kind == "repo" || $0.label == "Repo" }
        let demo = idea.externalLinks.first { $0.kind == "demo" || $0.label == "Demo" }
        if repo != nil || demo != nil {
            HStack(spacing: 8) {
                projectLinkButton(title: "代码仓库  ›", url: repo?.linkURL)
                projectLinkButton(title: "体验 Demo  ›", url: demo?.linkURL)
            }
        }
    }

    @ViewBuilder
    private func projectLinkButton(title: String, url: URL?) -> some View {
        Group {
            if let url {
                Link(destination: url) {
                    projectLinkLabel(title)
                }
            } else {
                projectLinkLabel(title)
                    .opacity(0.45)
            }
        }
    }

    private func projectLinkLabel(_ title: String) -> some View {
        Text(title)
            .font(AtlasTypography.pill())
            .foregroundStyle(AtlasColors.ink)
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(AtlasColors.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
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
                            DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 12)
                        .background(AtlasColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private func activityTabContent(_ idea: Idea) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("协作动态")
                .font(AtlasTypography.cardTitle())
                .foregroundStyle(AtlasColors.ink)
            if let stats = viewModel.stats {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    statTile(title: "浏览", value: stats.viewCount)
                    statTile(title: "引用", value: stats.referenceCount)
                    statTile(title: "反应", value: stats.reactionCount)
                    statTile(title: "版本", value: stats.versionCount)
                }

                if !stats.versionStats.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("版本 Fork 数据")
                            .font(AtlasTypography.caption())
                            .foregroundStyle(AtlasColors.inkFaint)
                        ForEach(stats.versionStats, id: \.versionID) { row in
                            HStack {
                                Text("v\(row.version)")
                                    .font(AtlasTypography.mobileSubheadline())
                                    .foregroundStyle(AtlasColors.ink)
                                Spacer()
                                Text("\(row.stats.forkCount) fork · \(row.stats.commentCount) 评论 · \(row.stats.flowerCount) 花")
                                    .font(AtlasTypography.meta())
                                    .foregroundStyle(AtlasColors.inkSoft)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            } else {
                Text("Fork、分享与 Agent 协作记录将显示在这里。")
                    .font(AtlasTypography.mobileSubheadline())
                    .foregroundStyle(AtlasColors.inkSoft)
            }
        }
        .padding(AtlasMetrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }

    private func statTile(title: String, value: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(AtlasTypography.meta())
                .foregroundStyle(AtlasColors.inkFaint)
            Text("\(value)")
                .font(AtlasTypography.cardTitle())
                .foregroundStyle(AtlasColors.ink)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.fill)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
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
                HStack(spacing: 6) {
                    Text("Fork 此 Idea")
                    DeimosIconView(icon: .chevronRight, size: 13, color: AtlasColors.ink)
                }
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
                        DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 12)
                    .background(AtlasColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.entityIdea)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }

    private func ideaMenuActions(idea: Idea) -> [AtlasMenuAction] {
        var actions: [AtlasMenuAction] = []
        if canEdit(idea: idea) {
            actions.append(AtlasMenuAction(title: "编辑") {
                ownerEditRoute = IdeaRoute(id: idea.id)
            })
            if idea.status == "active" {
                actions.append(AtlasMenuAction(title: "标记已落地") {
                    showImplementConfirm = true
                })
                actions.append(AtlasMenuAction(title: "归档") {
                    archiveReason = ""
                    showArchiveConfirm = true
                })
                actions.append(AtlasMenuAction(title: "埋葬", destructive: true) {
                    buryReason = ""
                    showBuryConfirm = true
                })
            } else if idea.status != "active" {
                actions.append(AtlasMenuAction(title: "重新激活") {
                    Task { await reactivateIdea() }
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
                HStack(spacing: 5) {
                    Text("发起对话")
                    DeimosIconView(icon: .chevronRight, size: 12, color: AtlasColors.accentActive)
                }
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
            try? await APIClient.shared.recordIdeaReference(ideaID: idea.id)
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
                        Text("\(version.stats.forkCount) Fork")
                            .font(AtlasTypography.meta())
                            .foregroundStyle(AtlasColors.accentFork)
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
                        .font(AtlasTypography.caption())
                        .foregroundStyle(AtlasColors.accentActive)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(AtlasColors.accentActiveSoft)
                        .clipShape(Capsule())
                    Spacer()
                    Text("\(Int(implProgressFraction(status) * 100))%")
                        .font(AtlasTypography.caption())
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
        case "in_progress": return "实施中"
        case "implemented": return "已实现"
        case "paused": return "暂停"
        default: return status
        }
    }

    @ViewBuilder
    private func implMetaSection(_ idea: Idea) -> some View {
        let links = idea.externalLinks
        if !links.isEmpty {
            settingsGroupedCard {
                VStack(alignment: .leading, spacing: 10) {
                    Text("实现信息")
                        .font(AtlasTypography.cardTitle())
                        .foregroundStyle(AtlasColors.ink)
                    ForEach(links, id: \.self) { link in
                        if let url = link.linkURL {
                            repoLink(link.label, url: url)
                        }
                    }
                }
                .padding(AtlasMetrics.cardPadding)
            }
        }
    }

    @ViewBuilder
    private func mediaGallerySection(_ idea: Idea) -> some View {
        let hasVideo = idea.videoLink != nil
        if hasVideo || !idea.imageURLs.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("媒体")
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        // 视频项放最前(若有)
                        if let videoURL = idea.videoLink {
                            VideoCoverButton(url: videoURL)
                                .frame(width: 168, height: 112)
                                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
                        }
                        ForEach(idea.imageURLs, id: \.self) { raw in
                            if let url = URL(string: raw) {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image.resizable().scaledToFill()
                                    default:
                                        Rectangle().fill(AtlasColors.fill)
                                    }
                                }
                                .frame(width: 168, height: 112)
                                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
                            }
                        }
                    }
                }
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

    private func archiveIdea() async {
        let reason = archiveReason.trimmingCharacters(in: .whitespacesAndNewlines)
        isArchiving = true
        defer { isArchiving = false }
        do {
            try await viewModel.archive(reason: reason.isEmpty ? nil : reason)
            ToastCenter.shared.showSuccess("想法已归档")
            showArchiveConfirm = false
        } catch {
            ToastCenter.shared.showError(error.localizedDescription)
        }
    }

    private func implementIdea() async {
        do {
            try await viewModel.markImplemented()
            ToastCenter.shared.showSuccess("已标记为落地")
            showImplementConfirm = false
        } catch {
            ToastCenter.shared.showError(error.localizedDescription)
        }
    }

    private func reactivateIdea() async {
        do {
            try await viewModel.reactivate()
            ToastCenter.shared.showSuccess("想法已重新激活")
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

    private func handleWish() async {
        guard session.isAuthenticated else {
            showAuthSheet = true
            return
        }
        _ = await viewModel.toggleWish(isAuthenticated: true)
        if let msg = viewModel.actionMessage {
            ToastCenter.shared.showError(msg)
            viewModel.actionMessage = nil
        } else {
            ToastCenter.shared.showSuccess(viewModel.isWished ? "已表达期待" : "已取消期待")
        }
    }

    private func handleBookmark() async {
        guard session.isAuthenticated else {
            showAuthSheet = true
            return
        }
        _ = await viewModel.toggleBookmark(isAuthenticated: true)
        if let message = viewModel.actionMessage {
            ToastCenter.shared.showError(message)
            viewModel.actionMessage = nil
        } else {
            ToastCenter.shared.showSuccess(viewModel.isBookmarked ? "已收藏想法" : "已取消收藏")
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

/// PreferenceKey for tracking scroll offset in IdeaDetailView's detail ScrollView.
private struct ScrollOffsetKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}
