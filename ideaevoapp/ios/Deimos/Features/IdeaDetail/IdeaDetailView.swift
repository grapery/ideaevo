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
            } else {
                isLiked = false
                isBookmarked = false
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
    let commentCount: Int
    let forkCount: Int
    let isBookmarked: Bool
    let onComment: () -> Void
    let onShare: () -> Void
    let onBookmark: () -> Void
    let onFork: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            circleButton(icon: .comment, count: commentCount, isActive: false, action: onComment)
                .accessibilityLabel("评论，\(commentCount) 条")
            circleButton(icon: .share, count: nil, isActive: false, action: onShare)
                .accessibilityLabel("分享")
            circleButton(icon: .bookmark, count: nil, isActive: isBookmarked, action: onBookmark)
                .accessibilityLabel(isBookmarked ? "取消收藏" : "收藏")
            circleButton(icon: .fork, count: forkCount, isActive: false, isLemon: true, action: onFork)
                .accessibilityLabel("Fork，\(forkCount) 次")
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity)
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
        .padding(.horizontal, AtlasMetrics.detailX)
        .padding(.bottom, 8)
    }

    /// One circular action. Default state: white/36% glass circle with an ink icon; an
    /// optional count badge sits below the icon. `isActive` recolours the icon (e.g. saved
    /// bookmark). `isLemon` swaps the glass fill for the lemonStrong primary-action fill.
    @ViewBuilder
    private func circleButton(
        icon: DeimosIcon,
        count: Int?,
        isActive: Bool,
        isLemon: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 2) {
                ZStack {
                    Circle()
                        .fill(isLemon
                              ? AtlasColors.lemonStrong
                              : Color.white.opacity(0.36))
                        .frame(width: 40, height: 40)
                    DeimosIconView(
                        icon: icon,
                        size: 17,
                        color: isLemon
                            ? AtlasColors.lemonInk
                            : (isActive ? AtlasColors.lemonInk : AtlasColors.ink)
                    )
                }
                .overlay(
                    Circle().stroke(Color.white.opacity(0.78), lineWidth: 1)
                )
                .overlay(
                    Circle().stroke(AtlasColors.ink.opacity(0.06), lineWidth: 1)
                )

                if let count {
                    Text("\(count)")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(isLemon ? AtlasColors.lemonInk : AtlasColors.inkSoft)
                        .monospacedDigit()
                        .lineLimit(1)
                } else {
                    Color.clear.frame(height: 12)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 56)
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
                    commentCount: idea.commentCount,
                    forkCount: idea.forkCount,
                    isBookmarked: viewModel.isBookmarked,
                    onComment: { openComments(idea) },
                    onShare: { Task { await shareIdea() } },
                    onBookmark: { Task { await handleBookmark() } },
                    onFork: { openForkSheet() }
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
        .sheet(isPresented: $showActionMenu) {
            if let idea = viewModel.idea {
                AtlasActionMenuSheet(actions: ideaMenuActions(idea: idea)) {
                    showActionMenu = false
                }
                .presentationDetents([.height(canEdit(idea: idea) ? 280 : 220)])
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
    }

    private func isUnavailableIdea(_ message: String) -> Bool {
        let normalized = message.lowercased()
        return normalized.contains("404") || normalized.contains("not found") || message.contains("不存在") || normalized.contains("forbidden") || message.contains("权限")
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
        .padding(.horizontal, AtlasMetrics.detailX)
        .padding(.bottom, 24)
        .background(AtlasColors.surface)
        .presentationDetents([.height(300)])
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(AtlasMetrics.radiusSheet)
    }

    // MARK: - v6 Cover Page with Transparent Float Navigation (Ardot 138:334)

    /// Product Reality (Ardot 246:2 + v2 redesign): glass toolbar + card stack.
    /// v2 reorder: identity (now holds author info) → flowers row → description →
    /// links → evolution+version timeline (merged) → attachments → impl/media → chat.
    @ViewBuilder
    private func detailScreen(_ idea: Idea) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Scroll-offset tracker: fires when the idea identity card passes under the toolbar.
                GeometryReader { geo in
                    Color.clear.preference(
                        key: ScrollOffsetKey.self,
                        value: geo.frame(in: .named("detailScroll")).minY
                    )
                }
                .frame(height: 0)

                ideaIdentityCard(idea)

                // v2: flowers row sits directly under the identity card so it's discoverable.
                FlowersPreviewCard(
                    flowerCount: idea.flowerCount,
                    donors: viewModel.donors,
                    onOpen: { Task { await handleFlower() } },
                    onSendFlower: { Task { await handleFlower() } }
                )

                overviewCard(idea)
                quickLinksSection(idea)
                forkLineagePreview(idea)
                attachmentsCard(idea)

                // Secondary artifact material remains below the Product Reality first fold.
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
            .padding(.top, 8)
            .padding(.bottom, AtlasMetrics.bottomClear)
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

    /// Ardot 246:18 + v2 update (S04 `179:3` redesign) — lemonSoft card with the idea identity
    /// on the LEFT and the author info (avatar + name + agent meta) stacked on the RIGHT.
    /// This collapses the old `agentOwnershipCard` into the identity card so the author is
    /// visible alongside the title instead of in a separate muted row below.
    private func ideaIdentityCard(_ idea: Idea) -> some View {
        let version = viewModel.currentVersionNumber
        let category = idea.category.trimmingCharacters(in: .whitespacesAndNewlines)
        let kicker = category.isEmpty
            ? "IDEA · v\(version)"
            : "IDEA · \(category.uppercased()) · v\(version)"
        let primaryName = idea.authorDisplayName
        let agentName = idea.agent?.name ?? "Agent"
        let showAgentName = idea.isAuthoredByDistinctAgent

        return HStack(alignment: .top, spacing: 12) {
            // Left — kicker + title + status row.
            VStack(alignment: .leading, spacing: 8) {
                Text(kicker)
                    .font(AtlasTypography.overline())
                    .foregroundStyle(AtlasColors.lemonInk)

                Text(idea.displayTitle)
                    .font(AtlasTypography.titleLarge())
                    .foregroundStyle(AtlasColors.ink)
                    .atlasTrackedTitle(25)
                    .lineLimit(3)

                HStack(spacing: 8) {
                    Text(implStatusLabel(idea.implStatus ?? "concept"))
                        .font(AtlasTypography.overline())
                        .foregroundStyle(AtlasColors.lemonInk)
                        .padding(.horizontal, 10)
                        .frame(height: 24)
                        .background(AtlasColors.lemon)
                        .clipShape(Capsule())
                    Text(idea.isBuried ? "已埋没" : "公开 · 可 Fork")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AtlasColors.inkTertiary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Right — author avatar + name + badges + agent meta, vertically stacked.
            Button {
                agentRoute = AgentRoute(id: idea.agentID)
            } label: {
                VStack(alignment: .trailing, spacing: 4) {
                    EntityAvatar.user(
                        id: idea.agent?.owner?.id ?? idea.agent?.ownerUserID ?? "",
                        url: idea.authorAvatarLink,
                        name: primaryName,
                        size: 40
                    )
                    HStack(spacing: 4) {
                        Text(primaryName)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(AtlasColors.ink)
                            .lineLimit(1)
                        if idea.showsAIAgentBadge {
                            Text("AI")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(AtlasColors.lemonInk)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Capsule(style: .continuous).fill(AtlasColors.lemon))
                        }
                        if idea.isFork {
                            Text("Fork")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(AtlasColors.inkSoft)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Capsule(style: .continuous).fill(AtlasColors.fill))
                        }
                    }
                    Text(showAgentName
                         ? "\(agentName) · \(idea.updatedAt.relativeShort)更新"
                         : "\(idea.updatedAt.relativeShort)更新")
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(1)
                }
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.lemonSoft)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
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
        let current = viewModel.currentVersionNumber
        let source = viewModel.lineage?.sourceVersion?.version
        let branches = viewModel.lineage?.stats.activeBranches ?? idea.forkCount
        let contributors = viewModel.lineage?.stats.contributors ?? 0
        let summary: String = {
            if let source {
                return "源自 v\(source) · 当前 v\(current) · \(branches) 个分支 · \(contributors) 位贡献者"
            }
            return "当前 v\(current) · \(branches) 个分支 · \(contributors) 位贡献者 · \(idea.forkCount) 个 Fork"
        }()
        let versions = viewModel.versions.prefix(4)

        VStack(alignment: .leading, spacing: 10) {
            // Header — title + chevron; tapping the header navigates to the fork lineage.
            Button {
                forkLineageRoute = IdeaRoute(id: idea.id)
            } label: {
                HStack {
                    Text("演化脉络")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Spacer(minLength: 0)
                    DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                }
            }
            .buttonStyle(.plain)

            // Lineage summary — also navigates to the fork lineage.
            Button {
                forkLineageRoute = IdeaRoute(id: idea.id)
            } label: {
                Text(summary)
                    .font(AtlasTypography.meta())
                    .foregroundStyle(AtlasColors.inkTertiary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)

            if !versions.isEmpty {
                Rectangle()
                    .fill(AtlasColors.rule)
                    .frame(height: 1)

                // Compact version timeline (max 4 rows). Each row navigates to the version compare.
                ForEach(Array(versions), id: \.id) { version in
                    Button {
                        let currentVersion = viewModel.versions.first(where: \.isCurrent)
                        if let currentVersion, currentVersion.id != version.id {
                            versionRoute = VersionCompareRoute(
                                ideaID: ideaID,
                                versionID: version.id,
                                compareVersionID: currentVersion.id
                            )
                        } else {
                            versionRoute = VersionCompareRoute(
                                ideaID: ideaID,
                                versionID: version.id,
                                compareVersionID: nil
                            )
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Text("v\(version.version)")
                                .font(.system(size: 13, weight: version.isCurrent ? .bold : .semibold))
                                .foregroundStyle(version.isCurrent ? AtlasColors.lemonInk : AtlasColors.ink)
                                .frame(width: 28, alignment: .leading)
                            if version.isCurrent {
                                Text("当前")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(AtlasColors.lemonInk)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Capsule(style: .continuous).fill(AtlasColors.lemon))
                            }
                            Text(version.changelog.isEmpty ? "—" : version.changelog)
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(AtlasColors.inkTertiary)
                                .lineLimit(1)
                            Spacer(minLength: 0)
                            Text(version.createdAt.relativeShort)
                                .font(AtlasTypography.meta())
                                .foregroundStyle(AtlasColors.inkFaint)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.lemonSoft)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
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
        let changelog = viewModel.versions.first(where: \.isCurrent)?.changelog
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let body = changelog.isEmpty
            ? idea.description.plainSummary
            : changelog

        return VStack(alignment: .leading, spacing: 6) {
            Text("当前版本解决什么")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
            Text(body)
                .font(AtlasTypography.bodyMedium())
                .foregroundStyle(AtlasColors.inkTertiary)
                .lineLimit(4)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
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
        if !idea.imageURLs.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("图片")
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
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
