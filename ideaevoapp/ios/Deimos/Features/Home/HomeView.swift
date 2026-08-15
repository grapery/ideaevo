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
    /// nil = 全部状态;非空时按 status 过滤广场流。
    var currentStatus: String? = nil

    private let pageSize = 20
    private var ideasOffset = 0

    /// Map UI sort chip index → API sort parameter.
    static let sortOptions: [(label: String, value: String)] = [
        ("热门", "popular"),
        ("最新", "newest"),
        ("实现中", "most_forked"),
    ]

    /// 状态筛选选项:label 展示用,value 为 nil 时表示「全部」。
    static let statusOptions: [(label: String, value: String?)] = [
        ("全部", nil),
        ("活跃", "active"),
        ("已落地", "implemented"),
        ("已归档", "archived"),
        ("已埋没", "buried"),
    ]

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
            async let freshTask = APIClient.shared.queryIdeas(sort: currentSort, status: currentStatus)
            async let trendingTask = APIClient.shared.rankingTrending(window: "week", metric: "weighted", limit: 10)
            let fresh = try await freshTask
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
            let next = try await APIClient.shared.queryIdeas(offset: ideasOffset, sort: currentSort, status: currentStatus)
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

    // MARK: - v6 Large Title Header

    private var largeTitleHeader: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Text("DEIMOS")
                    .font(AtlasTypography.overline())
                    .foregroundStyle(AtlasColors.inkSoft)
                Text("探索")
                    .font(AtlasTypography.largeTitle())
                    .foregroundStyle(AtlasColors.ink)
                    .atlasTrackedTitle(30)
            }

            Spacer()
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.top, 8)
        .padding(.bottom, 20)
    }

    // MARK: - Sort Chips

    /// ardot S02 (`237:137` Sort Chips): each chip 88×36. Active = #BEE90D lemon fill, no
    /// border; Inactive = white fill + #E8EBF0 hairline border. Label 15pt Semibold.
    private var sortChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(HomeViewModel.sortOptions.indices, id: \.self) { index in
                    let isSelected = sortIndex == index
                    Button {
                        selectSort(index)
                    } label: {
                        Text(HomeViewModel.sortOptions[index].label)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(isSelected ? AtlasColors.lemonInk : AtlasColors.inkSoft)
                            .frame(width: 88, height: 36)
                            .background(isSelected ? AtlasColors.lemonStrong : AtlasColors.surface)
                            .overlay(
                                Capsule()
                                    .stroke(AtlasColors.settingsRowStroke, lineWidth: isSelected ? 0 : 1)
                            )
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
        }
    }

    private func selectSort(_ index: Int) {
        let needsReload = sortIndex != index
        sortIndex = index
        viewModel.currentSort = HomeViewModel.sortOptions[index].value
        if needsReload {
            viewModel.ideas = []
            Task { await viewModel.loadPlaza() }
        }
    }

    /// 状态筛选 chips(与 sortChips 同形,略小)。让用户按生命周期状态分桶浏览。
    private var statusChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(HomeViewModel.statusOptions.indices, id: \.self) { index in
                    let isSelected = statusIndex == index
                    Button {
                        selectStatus(index)
                    } label: {
                        Text(HomeViewModel.statusOptions[index].label)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(isSelected ? AtlasColors.ink : AtlasColors.inkFaint)
                            .padding(.horizontal, 14)
                            .frame(height: 30)
                            .background(isSelected ? AtlasColors.ink.opacity(0.06) : AtlasColors.surface)
                            .overlay(
                                Capsule()
                                    .stroke(AtlasColors.settingsRowStroke, lineWidth: isSelected ? 0 : 1)
                            )
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
        }
    }

    private func selectStatus(_ index: Int) {
        let needsReload = statusIndex != index
        statusIndex = index
        viewModel.currentStatus = HomeViewModel.statusOptions[index].value
        if needsReload {
            viewModel.ideas = []
            Task { await viewModel.loadPlaza() }
        }
    }

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

        // ardot S02 (`237:137` Search Trigger): 342×44 #F5F6F7 fill, cr16, 15pt Regular
        // #8A94A6 placeholder "搜索想法、Agent…". Previous AtlasColors.fill (#F2F3F7) was
        // a touch too grey; spec wants the slightly bluer #F5F6F7 chatAssistantBubble token.
        Button { showSearch = true } label: {
            HStack(spacing: 0) {
                Text("搜索想法、Agent…")
                    .font(.system(size: 15))
                    .foregroundStyle(AtlasColors.inkSoft)
                Spacer()
            }
            .padding(.horizontal, 16)
            .frame(height: 44)
            .background(AtlasColors.chatAssistantBubble)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.bottom, 16)

        // AI Hero Card — S02 (`237:146` instance overrides): Title "还没有方向？问万叶" 18pt Bold,
        // Subtitle "从问题、素材或一个想法开始" 13pt Regular, CTA "开始对话" 14pt Semibold.
        // Card 342×132 cr22, lemonInk fill, padding 20, itemSpacing 12.
        AIHeroCard(
            title: "还没有方向？问万叶",
            subtitle: "从问题、素材或一个想法开始",
            sizeVariant: .small
        ) {
            startChat = true
        }
        .frame(height: 132)
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.bottom, 16)

        sortChips
            .padding(.bottom, 12)

        statusChips
            .padding(.bottom, 16)

        if !viewModel.trendingIdeas.isEmpty {
            trendingBanner
                .padding(.bottom, 20)
        }

        plazaContent
    }

    @ViewBuilder
    private var plazaContent: some View {
        // Section header — design always shows "热门想法" regardless of selected sort chip
        HStack {
            Text("为你挑选 · 公开可 Fork")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
            Spacer()
            Button {
                // No dedicated "all ideas" page yet — reload for more
                Task { await viewModel.loadPlaza() }
            } label: {
                Text("筛选 ›")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(AtlasColors.oliveMeta)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.bottom, 20)

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
                        coverImageURL: idea.coverLink,
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
