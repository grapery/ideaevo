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
    var previewComments: [FlatComment] = []
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
            previewComments = Array(CommentFlattener.flatten((try? await APIClient.shared.getComments(ideaID: id)) ?? []).prefix(2))
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
/// S02 Action Bar (ardot 715405210175453 `2:4`): white bar + 0.5 rule; h44 r22 pills —
/// 期待 (bookmark + count, surfaceSecondary; wished = lemonSoft/olive) · 送花 (surfaceSecondary)
/// · 评论 (compact surfaceSecondary) · Fork CTA (lemonStrong, grows). 点赞 lives on the stats tile.
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
        HStack(spacing: 8) {
            pillButton(
                icon: .bookmark,
                label: "期待 \(wishCount)",
                fill: isWished ? AtlasColors.lemonSoft : AtlasColors.surfaceSecondary,
                textColor: isWished ? AtlasColors.olive : AtlasColors.ink,
                action: onWish
            )
            .accessibilityLabel("期待，\(wishCount) 次")

            pillButton(
                icon: .flower,
                label: "送花",
                fill: AtlasColors.surfaceSecondary,
                textColor: AtlasColors.ink,
                action: onFlower
            )
            .accessibilityLabel("送花，\(flowerCount) 朵")

            compactPillButton(icon: .comment, count: commentCount, action: onComment)
                .accessibilityLabel("评论，\(commentCount) 条")

            Button(action: onFork) {
                HStack(spacing: 6) {
                    DeimosIconView(icon: .fork, size: 15, color: AtlasColors.lemonInk)
                    Text("Fork")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(AtlasColors.lemonInk)
                        .lineLimit(1)
                        .fixedSize()
                }
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(
                    Capsule(style: .continuous)
                        .fill(AtlasColors.lemonStrong)
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Fork 这个想法，\(forkCount) 次")
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 16)
        .background(AtlasColors.surface)
        .overlay(alignment: .top) {
            Rectangle().fill(AtlasColors.rule).frame(height: 0.5)
        }
    }

    private func pillButton(
        icon: DeimosIcon,
        label: String,
        fill: Color,
        textColor: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                DeimosIconView(icon: icon, size: 15, color: textColor)
                Text(label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(textColor)
                    .lineLimit(1)
                    .fixedSize()
            }
            .padding(.horizontal, 16)
            .frame(height: 44)
            .background(Capsule(style: .continuous).fill(fill))
        }
        .buttonStyle(.plain)
    }

    private func compactPillButton(icon: DeimosIcon, count: Int, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                DeimosIconView(icon: icon, size: 15, color: AtlasColors.ink)
                Text("\(count)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                    .monospacedDigit()
            }
            .padding(.horizontal, 14)
            .frame(height: 44)
            .background(Capsule(style: .continuous).fill(AtlasColors.surfaceSecondary))
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
    @State private var isFollowAuthor = false
    @State private var isFollowWorking = false

    private var isSheetZoomActive: Bool {
        showAuthSheet || showForkSheet || showShareSheet || showBuryConfirm || showActionMenu || showReportSheet
    }

    var body: some View {
        Group {
            if viewModel.isLoading {
                VStack(spacing: 0) {
                    detailNavBar(onShare: {}, onMore: {})
                        .padding(.horizontal, 20)
                        .padding(.top, 6)
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .background(AtlasColors.canvas)
                .navigationBarHidden(true)
                .suppressTabBar()
            } else if let errorMessage = viewModel.errorMessage {
                VStack(spacing: 0) {
                    detailNavBar(onShare: {}, onMore: {})
                        .padding(.horizontal, 20)
                        .padding(.top, 6)
                    if isUnavailableIdea(errorMessage) {
                        AtlasDesignedEmptyState(
                            icon: .document,
                            title: "想法不存在",
                            subtitle: "可能已被删除，或你没有访问权限",
                            ctaTitle: "返回探索",
                            ctaAction: { dismiss() }
                        )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
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
    /// S02 想法详情 (ardot 715405210175453 `2:4`): inline nav (back · title · share · more)
    /// → padded r16 hero cover with status badge → Bold-20 title → creator row with follow →
    /// 4-tile stats row → README body → fork lineage card → tags → comments preview →
    /// the existing rich sections (links / attachments / progress / media / chat CTA).
    @ViewBuilder
    private func detailScreen(_ idea: Idea) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                detailNavBar(
                    onShare: {
                        sharePayload = "\(idea.title)\n\(ideaShareURL(idea.id))"
                        showShareSheet = true
                    },
                    onMore: { showActionMenu = true }
                )

                heroCover(idea)

                Text(idea.displayTitle)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)
                    .lineSpacing(8)
                    .fixedSize(horizontal: false, vertical: true)

                creatorRow(idea)
                statsRow(idea)

                overviewCard(idea)
                forkLineagePreview(idea)

                if !idea.tags.isEmpty {
                    HStack(spacing: 8) {
                        ForEach(idea.tags.prefix(4), id: \.self) { tag in
                            TagPill(text: "#\(tag)")
                        }
                    }
                }

                commentsPreview(idea)
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)
            .padding(.bottom, AtlasMetrics.bottomClear)
        }
    }

    /// S02 Nav Bar — back circle + 想法详情 + share/more circles (surfaceSecondary).
    private func detailNavBar(onShare: @escaping () -> Void, onMore: @escaping () -> Void) -> some View {
        HStack(spacing: 0) {
            Button { dismiss() } label: {
                DeimosIconView(icon: .chevronBack, size: 18, color: AtlasColors.ink)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(AtlasColors.surfaceSecondary))
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("返回")

            Text("想法详情")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
                .padding(.leading, 12)

            Spacer()

            Button(action: onShare) {
                DeimosIconView(icon: .share, size: 18, color: AtlasColors.ink)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(AtlasColors.surfaceSecondary))
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("分享")

            Button(action: onMore) {
                DeimosIconView(icon: .more, size: 18, color: AtlasColors.ink)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(AtlasColors.surfaceSecondary))
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("更多")
        }
    }

    /// S02 Hero Cover — padded 176pt r16 image (or lemonSoft fallback) with the lifecycle
    /// status badge overlaid top-left.
    private func heroCover(_ idea: Idea) -> some View {
        // 无真实内容图(primaryImageURL 为空)时不渲染灰色封面占位,
        // 状态徽章并入标题区上方由调用方处理 (对齐 web 详情页)。
        if idea.primaryImageURL == nil {
            return AnyView(EmptyView().frame(height: 0))
        }
        return AnyView(ZStack(alignment: .topLeading) {
            coverBackgroundLayer(idea)

            Text(idea.statusLabel)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(statusBadgeColors(idea).foreground)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(statusBadgeColors(idea).fill)
                )
                .padding(8)
        }
        .frame(height: 176)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous)))
    }

    private func statusBadgeColors(_ idea: Idea) -> (fill: Color, foreground: Color) {
        switch idea.status {
        case "implemented": return (AtlasColors.linkBlueSoft, AtlasColors.linkBlue)
        case "active": return (AtlasColors.successSoft, AtlasColors.success)
        case "buried": return (AtlasColors.dangerSoft, AtlasColors.destructive)
        default: return (AtlasColors.surfaceSecondary, AtlasColors.inkSoft)
        }
    }

    /// S02 Creator Row — 32pt avatar, 14 SemiBold author + 11 meta, r17 follow pill.
    private func creatorRow(_ idea: Idea) -> some View {
        HStack(spacing: 10) {
            Button {
                openAuthorProfile(idea)
            } label: {
                HStack(spacing: 10) {
                    EntityAvatar.agent(
                        id: idea.agent?.id ?? idea.id,
                        url: idea.authorAvatarLink,
                        name: idea.authorDisplayName,
                        size: 32
                    )
                    VStack(alignment: .leading, spacing: 2) {
                        Text(idea.authorDisplayName)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(AtlasColors.ink)
                            .lineLimit(1)
                        Text("创建 · \(idea.agent?.name ?? "Agent") · \(idea.createdAt.relativeShort)")
                            .font(.system(size: 11))
                            .foregroundStyle(AtlasColors.inkSoft)
                            .lineLimit(1)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Spacer(minLength: 0)

            followAuthorButton(idea)
        }
    }

    @ViewBuilder
    private func followAuthorButton(_ idea: Idea) -> some View {
        let ownerID = idea.agent?.owner?.id ?? idea.agent?.ownerUserID
        if ownerID != nil || idea.agent?.id != nil {
            Button {
                Task { await toggleFollowAuthor(idea) }
            } label: {
                Group {
                    if isFollowWorking {
                        ProgressView().controlSize(.small)
                    } else {
                        Text(isFollowAuthor ? "已关注" : "+ 关注")
                            .font(.system(size: 12, weight: .semibold))
                    }
                }
                .foregroundStyle(isFollowAuthor ? AtlasColors.olive : AtlasColors.lemonInk)
                .frame(width: 56, height: 33)
                .background(
                    Capsule(style: .continuous)
                        .fill(isFollowAuthor ? AtlasColors.lemonSoft : AtlasColors.lemon)
                )
            }
            .buttonStyle(.plain)
            .disabled(isFollowWorking)
        }
    }

    private func openAuthorProfile(_ idea: Idea) {
        let ownerID = idea.agent?.owner?.id ?? idea.agent?.ownerUserID
        if let ownerID, !ownerID.isEmpty {
            userRoute = UserRoute(id: ownerID)
        } else if let agentID = idea.agent?.id {
            agentRoute = AgentRoute(id: agentID)
        }
    }

    private func toggleFollowAuthor(_ idea: Idea) async {
        if !session.isAuthenticated {
            showAuthSheet = true
            return
        }
        let ownerID = idea.agent?.owner?.id ?? idea.agent?.ownerUserID
        isFollowWorking = true
        defer { isFollowWorking = false }
        do {
            if let ownerID, !ownerID.isEmpty {
                if isFollowAuthor {
                    try await APIClient.shared.unfollowUser(id: ownerID)
                } else {
                    try await APIClient.shared.followUser(id: ownerID)
                }
            } else if let agentID = idea.agent?.id {
                if isFollowAuthor {
                    try await APIClient.shared.unfollowAgent(id: agentID)
                } else {
                    try await APIClient.shared.followAgent(id: agentID)
                }
            } else {
                return
            }
            isFollowAuthor.toggle()
            ToastCenter.shared.showSuccess(isFollowAuthor ? "已关注" : "已取消关注")
        } catch {
            ToastCenter.shared.showError("操作失败", message: error.localizedDescription)
        }
    }

    /// S02 Stats Row — four h61 r14 tiles (送花 lemonSoft · Fork · 期待 · 点赞).
    /// 点赞 is the interactive tile (tap toggles like; active state lemonSoft + olive).
    private func statsRow(_ idea: Idea) -> some View {
        HStack(spacing: 8) {
            detailStatTile(number: "\(idea.flowerCount)", label: "送花", fill: AtlasColors.lemonSoft, labelColor: AtlasColors.olive)

            detailStatTile(number: "\(idea.forkCount)", label: "Fork", fill: AtlasColors.surfaceSecondary, labelColor: AtlasColors.inkSoft)

            detailStatTile(number: "\(idea.wishCount)", label: "期待", fill: AtlasColors.surfaceSecondary, labelColor: AtlasColors.inkSoft)

            Button {
                Task { await handleLike() }
            } label: {
                detailStatTileContent(
                    number: "\(idea.likeCount)",
                    label: viewModel.isLiked ? "已点赞" : "点赞",
                    fill: viewModel.isLiked ? AtlasColors.lemonSoft : AtlasColors.surfaceSecondary,
                    labelColor: viewModel.isLiked ? AtlasColors.olive : AtlasColors.inkSoft
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("点赞，\(idea.likeCount) 次")
        }
    }

    private func detailStatTile(number: String, label: String, fill: Color, labelColor: Color) -> some View {
        detailStatTileContent(number: number, label: label, fill: fill, labelColor: labelColor)
    }

    private func detailStatTileContent(number: String, label: String, fill: Color, labelColor: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(number)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
                .monospacedDigit()
                .lineLimit(1)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(labelColor)
                .lineLimit(1)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(fill)
        )
    }

    /// S02 Comments Preview — 评论 N SemiBold-15 header + 查看全部 link + two preview rows.
    @ViewBuilder
    private func commentsPreview(_ idea: Idea) -> some View {
        let count = max(idea.commentCount, viewModel.previewComments.count)
        if count > 0 || !viewModel.previewComments.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("评论 \(count)")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Spacer()
                    Button {
                        openComments(idea)
                    } label: {
                        Text("查看全部")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(AtlasColors.inkSoft)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.bottom, 8)

                ForEach(viewModel.previewComments) { item in
                    HStack(alignment: .top, spacing: 10) {
                        if item.comment.authorType == "agent" {
                            EntityAvatar.agent(id: item.comment.userID, url: item.comment.avatarLink, name: item.comment.displayName, size: 26)
                        } else {
                            EntityAvatar.user(id: item.comment.userID, url: item.comment.avatarLink, name: item.comment.displayName, size: 26)
                        }
                        VStack(alignment: .leading, spacing: 3) {
                            Text("\(item.comment.displayName) · \(item.comment.createdAt.relativeShort)")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(AtlasColors.ink)
                                .lineLimit(1)
                            Text(item.comment.content)
                                .font(.system(size: 13))
                                .foregroundStyle(AtlasColors.inkTertiary)
                                .lineSpacing(7)
                                .lineLimit(2)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 6)
                }

                if viewModel.previewComments.isEmpty {
                    Button {
                        openComments(idea)
                    } label: {
                        Text("抢先写下第一条评论")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(AtlasColors.inkSoft)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
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
                // 无封面图:不渲染占位色块
                EmptyView()
            }
        }
        .frame(height: 220)
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

    /// Ardot 246:38 + v2 merge: `演化脉络` + `版本历史` collapsed into one lemonSoft card.
    /// Header (title + chevron) and the lineage summary row both navigate to the fork lineage;
    /// each version row navigates to that version's compare view. The hairline + version list
    /// below the summary used to live in a separate `versionsSection` card — merging removes
    /// the visual overlap the user called out.
    /// S02 Fork Lineage Card — surfaceSecondary r14 with 30pt lemon fork icon circle,
    /// 演化脉络 eyebrow + summary, chevron; whole card opens the lineage view.
    @ViewBuilder
    private func forkLineagePreview(_ idea: Idea) -> some View {
        let current = viewModel.currentVersionNumber
        let source = viewModel.lineage?.sourceVersion?.version
        let childForks = max(idea.forkCount, 0)
        let summary: String = {
            if let source {
                return "源想法 v\(source) → 当前 v\(current) · \(childForks) 个子 Fork"
            }
            return "当前 v\(current) · \(childForks) 个子 Fork"
        }()
        Button {
            forkLineageRoute = IdeaRoute(id: idea.id)
        } label: {
            HStack(spacing: 10) {
                DeimosIconView(icon: .fork, size: 14, color: AtlasColors.lemonInk)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(AtlasColors.lemon))

                VStack(alignment: .leading, spacing: 2) {
                    Text("演化脉络")
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkSoft)
                    Text(summary)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(AtlasColors.settingsGroupFill)
            )
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
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
        actions.append(AtlasMenuAction(
            title: viewModel.isBookmarked ? "取消收藏" : "收藏想法"
        ) {
            Task { await handleBookmark() }
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


