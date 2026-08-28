import SwiftUI
import Observation

@MainActor
@Observable
final class HomeViewModel {
    var ideas: [Idea] = []
    var trendingIdeas: [TrendingIdea] = []
    var isLoading = true
    var isLoadingMore = false
    var hasMoreIdeas = true
    var errorMessage: String?
    var currentSort: String = "popular"
    /// nil = 全部分类;非空时按 category 过滤广场流(S01 分类 chips)。
    var currentCategory: String? = nil
    /// Categories aggregated from the UNFILTERED feed — the chip row must stay stable
    /// while a category filter is active, otherwise the other chips vanish.
    var knownCategories: [String] = []

    private let pageSize = 20
    private var ideasOffset = 0

    var visibleIdeas: [Idea] {
        ideas.filter(BlocklistFiltering.idea)
    }

    func loadPlaza() async {
        if ideas.isEmpty, let cached = FeedCache.loadPlaza() {
            ideas = cached.filter(BlocklistFiltering.idea)
        }

        isLoading = ideas.isEmpty
        errorMessage = nil
        defer { isLoading = false }

        do {
            async let freshTask = APIClient.shared.queryIdeas(sort: currentSort, category: currentCategory)
            async let trendingTask = APIClient.shared.rankingTrending(window: "week", metric: "weighted", limit: 10)
            let fresh = try await freshTask
            if currentCategory == nil {
                var counts: [String: Int] = [:]
                for idea in fresh.ideas where !idea.category.isEmpty {
                    counts[idea.category, default: 0] += 1
                }
                knownCategories = counts.sorted { lhs, rhs in
                    lhs.value == rhs.value ? lhs.key < rhs.key : lhs.value > rhs.value
                }.prefix(6).map(\.key)
            }
            ideas = fresh.ideas.filter(BlocklistFiltering.idea)
            ideasOffset = fresh.ideas.count
            hasMoreIdeas = Pagination.hasMore(offset: ideasOffset, loaded: fresh.ideas.count, total: fresh.total)
            FeedCache.savePlaza(fresh.ideas)
            // 热榜失败不影响主 feed
            if let trending = try? await trendingTask {
                trendingIdeas = trending.ranking
            }
        } catch {
            if ideas.isEmpty, let cached = FeedCache.loadPlazaStale() {
                ideas = cached.filter(BlocklistFiltering.idea)
                errorMessage = "网络不可用，显示缓存内容"
            } else {
                errorMessage = error.localizedDescription
                ideas = []
            }
        }
    }

    func loadMorePlaza() async {
        guard hasMoreIdeas, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }

        do {
            let next = try await APIClient.shared.queryIdeas(offset: ideasOffset, sort: currentSort, category: currentCategory)
            let filtered = next.ideas.filter(BlocklistFiltering.idea)
            ideas.append(contentsOf: filtered)
            ideasOffset = ideas.count
            hasMoreIdeas = Pagination.hasMore(offset: ideasOffset, loaded: next.ideas.count, total: next.total)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// v6 Home — large title + AI Hero card + sort chips + IdeaCoverCard feed.
/// Per Ardot `138:228`.
struct HomeView: View {
    @State private var viewModel = HomeViewModel()
    @State private var selectedRoute: IdeaRoute?
    @State private var showPublishIdea = false
    @State private var showAuthSheet = false
    @State private var showSearch = false
    @State private var debugSearchQuery = ""
    @State private var sortIndex = 0
    @State private var statusIndex = 0
    @State private var showNotifications = false
    @State private var unreadCount = 0
    @State private var showTrending = true
    @State private var startChat = false
    @State private var quickActionIdea: Idea?
    @State private var forkActionIdea: Idea?
    @State private var shareActionIdea: Idea?
    @State private var reportActionIdea: Idea?
    @State private var isForking = false
    @State private var forkError: String?
    @State private var suppressNextIdeaTap = false
    @Namespace private var ideaIconNamespace

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.visibleIdeas.isEmpty {
                loadingHome
            } else if viewModel.errorMessage == nil && viewModel.visibleIdeas.isEmpty {
                emptyHome
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        if let offlineMessage = viewModel.errorMessage,
                           !viewModel.visibleIdeas.isEmpty {
                            AtlasOfflineBanner(message: offlineMessage) {
                                Task { await viewModel.loadPlaza() }
                            }
                            .padding(.horizontal, AtlasMetrics.pageX)
                            .padding(.bottom, 8)
                        }

                        content
                    }
                    .padding(.bottom, AtlasMetrics.bottomClear)
                }
            }
        }
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: showAuthSheet)
        .navigationBarHidden(true)
        .navigationDestination(item: $selectedRoute) { route in
            IdeaDetailView(ideaID: route.id, iconNamespace: ideaIconNamespace)
        }
        .navigationDestination(isPresented: $showPublishIdea) {
            PublishIdeaView()
        }
        .navigationDestination(isPresented: $showSearch) {
            SearchView(initialQuery: debugSearchQuery)
        }
        .navigationDestination(isPresented: $startChat) {
            ChatListView()
        }
        .navigationDestination(isPresented: $showNotifications) {
            NotificationsView()
        }
        .sheet(isPresented: $showAuthSheet) {
            AuthRequiredSheet()
        }
        .sheet(item: $forkActionIdea) { idea in
            ForkSheet(
                sourceTitle: idea.title,
                sourceDescription: idea.description,
                sourceIdeaID: idea.id,
                sourceIconURL: idea.iconLink,
                isSubmitting: isForking,
                errorMessage: forkError,
                onSubmit: { title, description, reason in
                    Task { await submitQuickFork(idea: idea, title: title, description: description, reason: reason) }
                }
            )
        }
        .sheet(item: $shareActionIdea) { idea in
            ShareSheet(items: [ideaShareURL(idea)])
        }
        .fullScreenCover(item: $reportActionIdea) { idea in
            ReportContentSheet(
                targetLabel: idea.title,
                onSubmit: { reason, detail in
                    reportActionIdea = nil
                    Task {
                        await ModerationActions.submitReport(
                            targetType: "idea",
                            targetID: idea.id,
                            reason: reason,
                            detail: detail
                        )
                    }
                },
                onCancel: { reportActionIdea = nil }
            )
        }
        .overlay {
            if let idea = quickActionIdea {
                IdeaQuickActionOverlay(
                    onFork: {
                        quickActionIdea = nil
                        if APIClient.shared.authToken == nil {
                            showAuthSheet = true
                        } else {
                            forkError = nil
                            forkActionIdea = idea
                        }
                    },
                    onShare: {
                        quickActionIdea = nil
                        shareActionIdea = idea
                    },
                    onReport: {
                        quickActionIdea = nil
                        reportActionIdea = idea
                    },
                    onDismiss: { quickActionIdea = nil }
                )
            }
        }
        .task {
            await viewModel.loadPlaza()
            unreadCount = (try? await APIClient.shared.filteredUnreadNotificationCount()) ?? 0
        }
        .refreshable {
            await viewModel.loadPlaza()
        }
        #if DEBUG
        .onAppear {
            if ProcessInfo.processInfo.arguments.contains("--deimos-goto-search") {
                showSearch = true
            }
            if let arg = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--deimos-search-query=") }) {
                debugSearchQuery = arg.replacingOccurrences(of: "--deimos-search-query=", with: "")
                showSearch = true
            }
            if ProcessInfo.processInfo.arguments.contains("--deimos-show-auth-sheet") {
                showAuthSheet = true
            }
        }
        #endif
    }

    private var emptyHome: some View {
        VStack(spacing: 0) {
            largeTitleHeader
            Spacer(minLength: 54)
            AtlasDesignedEmptyStates.plazaEmpty { startChat = true }
            Spacer()
        }
        .padding(.bottom, AtlasMetrics.bottomClear)
    }

    private var loadingHome: some View {
        ScrollView {
            VStack(spacing: 0) {
                largeTitleHeader
                HomeFeedLoadingSkeleton()
                    .padding(.horizontal, AtlasMetrics.pageX)
            }
            .padding(.bottom, AtlasMetrics.bottomClear)
        }
    }

    // MARK: - S01 Header (ardot 715405210175453 `2:3`)

    /// 火卫二 Bold-22 + slogan, trailing 40pt surfaceSecondary circles:
    /// publish · search · bell (violet unread dot).
    private var largeTitleHeader: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 3) {
                Text("火卫二")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)
                Text("AI Agent 的想法市场")
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.inkSoft)
            }

            Spacer()

            Button {
                showPublishIdea = true
            } label: {
                DeimosIconView(icon: .plus, size: 18, color: AtlasColors.ink)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(AtlasColors.surfaceSecondary))
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("发布想法")

            Button {
                showSearch = true
            } label: {
                DeimosIconView(icon: .search, size: 18, color: AtlasColors.ink)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(AtlasColors.surfaceSecondary))
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("搜索")

            Button {
                showNotifications = true
            } label: {
                ZStack(alignment: .topTrailing) {
                    DeimosIconView(icon: .bell, size: 18, color: AtlasColors.ink)
                        .frame(width: 40, height: 40)
                        .background(Circle().fill(AtlasColors.surfaceSecondary))
                        .contentShape(Circle())
                    if unreadCount > 0 {
                        Circle()
                            .fill(AtlasColors.lemonStrong)
                            .overlay(Circle().stroke(AtlasColors.canvas, lineWidth: 1.5))
                            .frame(width: 9, height: 9)
                            .offset(x: -4, y: 4)
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(unreadCount > 0 ? "通知, \(unreadCount) 条未读" : "通知")
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.top, 8)
        .padding(.bottom, 6)
    }

    // MARK: - Category Chips (S01)

    /// S01 Category Chips (ardot 715405210175453 `2:3`): h32 r16 — selected lemon fill
    /// with lemonInk SemiBold-13 label, unselected surfaceSecondary with inkTertiary
    /// Medium-13. Categories are aggregated from the loaded feed (web-parity behavior).
    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(categoryOptions, id: \.value) { option in
                    let isSelected = viewModel.currentCategory == option.value
                    Button {
                        viewModel.ideas = []
                        viewModel.currentCategory = option.value
                        Task { await viewModel.loadPlaza() }
                    } label: {
                        Text(option.label)
                            .font(.system(size: 13, weight: isSelected ? .semibold : .medium))
                            .foregroundStyle(isSelected ? AtlasColors.lemonInk : AtlasColors.inkTertiary)
                            .padding(.horizontal, 14)
                            .frame(height: 32)
                            .background(
                                Capsule(style: .continuous)
                                    .fill(isSelected ? AtlasColors.lemon : AtlasColors.surfaceSecondary)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
        }
    }

    private var categoryOptions: [(label: String, value: String?)] {
        [("全部", nil)] + viewModel.knownCategories.map { ($0, $0) }
    }

    // MARK: - Sort Chips


    /// 本周热榜 banner:横向滚动的 top idea 列表(按 wish 增量排序)。
    /// 让近期值得关注的 idea 集中曝光,对标 Product Hunt 的榜单机制。
    private var trendingBanner: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                DeimosIconView(icon: .star, size: 14, color: AtlasColors.lemonInk)
                Text("本周热榜 · 值得关注")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
            }
            .padding(.horizontal, AtlasMetrics.pageX)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(Array(viewModel.trendingIdeas.prefix(10).enumerated()), id: \.element.id) { index, item in
                        Button {
                            selectedRoute = IdeaRoute(id: item.id)
                        } label: {
                            trendingCard(item, rank: index + 1)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, AtlasMetrics.pageX)
            }
        }
    }

    private func trendingCard(_ item: TrendingIdea, rank: Int) -> some View {
        HStack(spacing: 10) {
            // 排名
            Text("\(rank)")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(rank <= 3 ? AtlasColors.lemonInk : AtlasColors.inkFaint)
                .frame(width: 24)

            // 缩略图
            if let thumb = item.thumbLink {
                AsyncImage(url: thumb) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        Rectangle().fill(AtlasColors.lemonSoft)
                    }
                }
                .frame(width: 40, height: 40)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            } else {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(AtlasColors.lemonSoft)
                    .frame(width: 40, height: 40)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    DeimosIconView(icon: .star, size: 10, color: AtlasColors.inkFaint)
                    Text("\(Int(item.score)) 关注度")
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkFaint)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(width: 240, alignment: .leading)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(AtlasColors.settingsRowStroke, lineWidth: 1)
        )
    }

    @ViewBuilder
    private var content: some View {
        largeTitleHeader

        categoryChips
            .padding(.bottom, 14)

        plazaContent
    }

    @ViewBuilder
    private var plazaContent: some View {
        // S01 Section Row — 为你推荐 + 查看热榜 (inkSoft Medium-12 link).
        HStack {
            Text("为你推荐")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
            Spacer()
            if !viewModel.trendingIdeas.isEmpty {
                Button {
                    withAnimation(.easeOut(duration: 0.2)) { showTrending.toggle() }
                } label: {
                    Text(showTrending ? "收起热榜" : "查看热榜")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.bottom, 12)

        if showTrending && !viewModel.trendingIdeas.isEmpty {
            trendingBanner
                .padding(.bottom, 16)
        }

        if let errorMessage = viewModel.errorMessage, viewModel.visibleIdeas.isEmpty {
            AtlasDesignedEmptyStates.loadFailed(message: errorMessage) {
                Task { await viewModel.loadPlaza() }
            }
            .frame(minHeight: 200)
        } else {
            LazyVStack(spacing: AtlasMetrics.cardGap) {
                ForEach(Array(viewModel.visibleIdeas.enumerated()), id: \.element.id) { index, idea in
                    IdeaCoverCard(
                        idea: idea,
                        // 只传真实内容图; coverLink 会兜底 icon 头像链,
                        // 让每张卡都渲染 150pt 大图位。无图的卡走内联徽章布局。
                        coverImageURL: idea.primaryImageURL,
                        iconNamespace: ideaIconNamespace,
                        onTap: {
                            if suppressNextIdeaTap {
                                suppressNextIdeaTap = false
                            } else {
                                selectedRoute = IdeaRoute(id: idea.id)
                            }
                        }
                    )
                    .simultaneousGesture(
                        LongPressGesture(minimumDuration: 0.45)
                            .onEnded { _ in
                                suppressNextIdeaTap = true
                                Haptics.medium()
                                quickActionIdea = idea
                            }
                    )
                    .onAppear {
                        if index == viewModel.visibleIdeas.count - 1 {
                            Task { await viewModel.loadMorePlaza() }
                        }
                    }
                }
                if viewModel.isLoadingMore {
                    ProgressView().padding(.vertical, 12)
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
        }
    }

    private func ideaShareURL(_ idea: Idea) -> String {
        AppConfig.webBaseURL
            .appendingPathComponent("ideas")
            .appendingPathComponent(idea.id)
            .absoluteString
    }

    private func submitQuickFork(
        idea: Idea,
        title: String,
        description: String,
        reason: String
    ) async {
        isForking = true
        forkError = nil
        defer { isForking = false }
        do {
            let forked = try await APIClient.shared.forkIdea(
                id: idea.id,
                title: title,
                description: description,
                reason: reason
            )
            forkActionIdea = nil
            selectedRoute = IdeaRoute(id: forked.id)
            ToastCenter.shared.showSuccess("已创建 Fork")
        } catch {
            forkError = error.localizedDescription
        }
    }
}

/// Ardot interaction frame `353:42`: a centered 280×216 quick-action menu opened by
/// long-pressing an Idea card.
private struct IdeaQuickActionOverlay: View {
    let onFork: () -> Void
    let onShare: () -> Void
    let onReport: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        ZStack {
            AtlasColors.ink.opacity(0.40)
                .ignoresSafeArea()
                .onTapGesture(perform: onDismiss)

            VStack(spacing: 0) {
                actionRow(
                    title: "Fork 这个想法",
                    icon: .fork,
                    iconFill: AtlasColors.lemonStrong,
                    iconColor: AtlasColors.lemonInk,
                    action: onFork
                )
                Divider()
                actionRow(
                    title: "分享链接",
                    icon: .share,
                    iconFill: AtlasColors.surfaceSecondary,
                    iconColor: AtlasColors.ink,
                    action: onShare
                )
                Divider()
                actionRow(
                    title: "举报内容",
                    icon: .info,
                    iconFill: AtlasColors.destructiveFill,
                    iconColor: .white,
                    titleColor: AtlasColors.destructiveFill,
                    action: onReport
                )
            }
            .frame(width: 280, height: 216)
            .background(AtlasColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .shadow(color: AtlasColors.ink.opacity(0.15), radius: 32, y: 12)
        }
        .transition(.opacity)
    }

    private func actionRow(
        title: String,
        icon: DeimosIcon,
        iconFill: Color,
        iconColor: Color,
        titleColor: Color = AtlasColors.ink,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                DeimosIconView(icon: icon, size: 13, color: iconColor)
                    .frame(width: 22, height: 22)
                    .background(iconFill, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                Text(title)
                    .font(.system(size: 16))
                    .foregroundStyle(titleColor)
                Spacer()
            }
            .padding(.horizontal, 20)
            .frame(height: 72)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
