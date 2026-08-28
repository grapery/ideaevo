import SwiftUI
import Observation

enum ActivityActionFilter: String, CaseIterable, Identifiable {
    case all, create, fork, share

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: return "全部"
        case .create: return "发布"
        case .fork: return "Fork"
        case .share: return "分享"
        }
    }

    func matches(_ activity: ActivityView) -> Bool {
        switch self {
        case .all: return true
        case .create: return activity.action == "register" || activity.action == "create"
        case .fork: return activity.action == "fork"
        case .share: return activity.action == "share"
        }
    }
}

enum ActivityRankingTab: Int, CaseIterable, Identifiable {
    case popular, flowers, forks

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .popular: return "热门"
        case .flowers: return "鲜花"
        case .forks: return "Fork"
        }
    }
}

@MainActor
@Observable
final class ActivityScreenViewModel {
    var searchQuery = ""
    var actionFilter: ActivityActionFilter = .all
    var rankingTab: ActivityRankingTab = .popular
    var stats = ActivityStats(todayNewIdeas: 0, todayForks: 0, activeAgents: 0, totalActions: 0)
    var rankings: ActivityRankings = ActivityRankings(popular: [], flowers: [], forks: [])
    var activities: [ActivityView] = []
    var isLoading = false
    var isLoadingMore = false
    var hasMore = false
    var errorMessage: String?
    var isOffline = false

    var isSearchActive: Bool {
        !searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var filteredActivities: [ActivityView] {
        activities
            .filter { BlocklistFiltering.activity($0) }
            .filter { actionFilter.matches($0) }
            .filter { matchesSearch($0) }
    }

    var currentRanking: [RankingIdea] {
        let base: [RankingIdea]
        switch rankingTab {
        case .popular: base = rankings.popular
        case .flowers: base = rankings.flowers
        case .forks: base = rankings.forks
        }
        guard isSearchActive else { return base }
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        return base.filter { $0.title.localizedCaseInsensitiveContains(query) }
    }

    private func matchesSearch(_ activity: ActivityView) -> Bool {
        guard isSearchActive else { return true }
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        return activity.searchHaystack.localizedCaseInsensitiveContains(query)
    }

    func rankingMetric(for idea: RankingIdea) -> (Int, String) {
        switch rankingTab {
        case .popular:
            let count = max(idea.likeCount, idea.flowerCount)
            return (count, idea.flowerCount > idea.likeCount ? "花" : "赞")
        case .flowers:
            return (idea.flowerCount, "花")
        case .forks:
            return (idea.forkCount, "Fork")
        }
    }

    func load() async {
        isLoading = activities.isEmpty
        errorMessage = nil
        isOffline = false
        defer { isLoading = false }

        do {
            let feed = try await APIClient.shared.activityFeed(limit: 20)
            stats = feed.stats
            rankings = feed.rankings
            activities = feed.activities
            hasMore = feed.activities.count < feed.total && feed.activities.count < 50
        } catch {
            errorMessage = error.localizedDescription
            isOffline = true
        }
    }

    func loadMore() async {
        guard hasMore, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }

        do {
            // `/activity/feed` currently returns the newest prefix rather than accepting an
            // offset. Increase the requested prefix and retain stable identity ordering.
            let requested = min(activities.count + 20, 50)
            let feed = try await APIClient.shared.activityFeed(limit: requested)
            activities = feed.activities
            hasMore = activities.count < feed.total && activities.count < 50
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct ActivityScreen: View {
    @Environment(AuthSession.self) private var session
    @State private var viewModel = ActivityScreenViewModel()
    @State private var selectedRoute: IdeaRoute?
    @State private var showAuthSheet = false

    var body: some View {
        content
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: showAuthSheet)
        .navigationBarHidden(true)
        .navigationDestination(item: $selectedRoute) { route in
            IdeaDetailView(ideaID: route.id)
        }
        .sheet(isPresented: $showAuthSheet) {
            AuthRequiredSheet()
        }
        .task {
            await viewModel.load()
        }
        .refreshable {
            await viewModel.load()
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.activities.isEmpty {
            VStack(spacing: 0) {
                activityHeader
                loadingSkeleton
            }
        } else if viewModel.isOffline && viewModel.activities.isEmpty {
            VStack(spacing: 0) {
                activityHeader
                errorState
            }
        } else {
            // Single scroll container — header, stats and ranking scroll with the feed.
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    activityHeader
                    statsSection
                        .padding(.horizontal, AtlasMetrics.pageX)
                    rankingSection
                        .padding(.horizontal, AtlasMetrics.pageX)
                    feedRows
                }
                .padding(.bottom, AtlasMetrics.bottomClear)
            }
        }
    }

    /// S04 Header (ardot 715405210175453 `2:6`): 动态 Bold-22 + lemonSoft 筛选
    /// chip (r15, olive Medium-12). Scope/type/ranking filters live in its menu.
    private var activityHeader: some View {
        HStack {
            Text("动态")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
            Spacer()
            filterChip
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.top, 8)
    }

    /// S04 Filter Chip — lemonSoft r15 capsule; menu holds scope (全局/关注),
    /// action type and ranking metric.
    private var filterChip: some View {
        Menu {
            Picker("动态类型", selection: $viewModel.actionFilter) {
                ForEach(ActivityActionFilter.allCases) { filter in
                    Text(filter.title).tag(filter)
                }
            }
            Picker("榜单指标", selection: $viewModel.rankingTab) {
                ForEach(ActivityRankingTab.allCases) { tab in
                    Text(tab.title).tag(tab)
                }
            }
        } label: {
            HStack(spacing: 5) {
                DeimosIconView(icon: .sliders, size: 13, color: AtlasColors.olive)
                Text("筛选")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(AtlasColors.olive)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                Capsule(style: .continuous)
                    .fill(AtlasColors.lemonSoft)
            )
        }
    }

    private var loadingSkeleton: some View {
        ScrollView {
            HomeFeedLoadingSkeleton()
                .padding(.horizontal, AtlasMetrics.pageX)
                .padding(.top, 16)
        }
    }

    /// Feed rows without their own scroller — lives inside the main ScrollView.
    /// Wraps the existing feedSection (header + rows + load-more).
    private var feedRows: some View {
        VStack(spacing: 12) {
            if viewModel.isOffline, let message = viewModel.errorMessage {
                AtlasOfflineBanner(message: message) {
                    Task {
                        await viewModel.load()
                    }
                }
            }

            feedSection
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.top, 4)
    }

    /// S04 Stats Row (ardot 715405210175453 `2:6`): three 72pt r14 tiles —
    /// 今日新想法 (lemonSoft/olive) · 今日 Fork · 活跃 Agent. Value Bold-20, label Regular-11.
    private var statsSection: some View {
        HStack(spacing: 8) {
            activityStatTile(value: viewModel.stats.todayNewIdeas, label: "今日新想法", fill: AtlasColors.lemonSoft, labelColor: AtlasColors.olive)
            activityStatTile(value: viewModel.stats.todayForks, label: "今日 Fork", fill: Color(hex: 0xF2F5F7), labelColor: Color(hex: 0x657080))
            activityStatTile(value: viewModel.stats.activeAgents, label: "活跃 Agent", fill: Color(hex: 0xF2F5F7), labelColor: Color(hex: 0x657080))
        }
    }

    private func activityStatTile(value: Int, label: String, fill: Color, labelColor: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("\(value)")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
                .monospacedDigit()
                .lineLimit(1)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(labelColor)
                .lineLimit(1)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(fill)
        )
    }

    /// S04 本周热榜 — header + compact rank rows (22pt circle badge, 42pt r10 thumb,
    /// 13pt SemiBold title + 11pt category, olive SemiBold-12 score).
    @ViewBuilder
    private var rankingSection: some View {
        if !viewModel.currentRanking.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("本周热榜")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Spacer()
                    Text(rankingMetricLabel)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                .padding(.bottom, 8)

                ForEach(Array(viewModel.currentRanking.prefix(3).enumerated()), id: \.element.id) { index, idea in
                    Button {
                        selectedRoute = IdeaRoute(id: idea.id)
                    } label: {
                        rankRow(idea, rank: index + 1)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var rankingMetricLabel: String {
        switch viewModel.rankingTab {
        case .popular: return "按热度排序"
        case .flowers: return "按鲜花排序"
        case .forks: return "按 Fork 排序"
        }
    }

    private func rankRow(_ idea: RankingIdea, rank: Int) -> some View {
        let metric = viewModel.rankingMetric(for: idea)
        return HStack(spacing: 10) {
            Text("\(rank)")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(rank == 1 ? AtlasColors.lemonInk : AtlasColors.inkSoft)
                .frame(width: 22, height: 22)
                .background(
                    Circle().fill(rank == 1 ? AtlasColors.lemon : AtlasColors.surfaceSecondary)
                )

            RankingThumb(idea: idea)

            VStack(alignment: .leading, spacing: 2) {
                Text(idea.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)
                if !idea.category.isEmpty {
                    Text(idea.category)
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
            }
            Spacer(minLength: 0)
            Text("\(metric.1) \(metric.0)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(AtlasColors.olive)
        }
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var feedSection: some View {
        if viewModel.filteredActivities.isEmpty {
            followingEmptyState
                .padding(.top, 12)
        } else {
            // S04 Feed Header — 最新动态 SemiBold-15.
            Text("最新动态")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
                .padding(.bottom, 4)

            VStack(spacing: 8) {
                ForEach(Array(viewModel.filteredActivities.enumerated()), id: \.element.id) { index, activity in
                    Group {
                        if let ideaID = activity.ideaID {
                            Button {
                                selectedRoute = IdeaRoute(id: ideaID)
                            } label: {
                                activityCard(activity)
                            }
                            .buttonStyle(.plain)
                        } else {
                            activityCard(activity)
                        }
                    }
                    .onAppear {
                        if index == viewModel.filteredActivities.count - 1 {
                            Task {
                                await viewModel.loadMore()
                            }
                        }
                    }
                }
            }

            if viewModel.isLoadingMore {
                HStack(spacing: 8) {
                    ProgressView()
                        .tint(AtlasColors.lemonStrong)
                    Text("加载更多动态…")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 102)
                .background(AtlasColors.settingsGroupFill)
            }
        }
    }

    /// 动态行卡片容器: 白底描边圆角, 替代 Divider 分隔的裸行。
    private func activityCard(_ activity: ActivityView) -> some View {
        ActivityCell(activity: activity)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AtlasColors.surface)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(AtlasColors.cardStroke, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    @ViewBuilder
    private var followingEmptyState: some View {
        if !viewModel.isSearchActive && viewModel.actionFilter == .all {
            AtlasDesignedEmptyStates.activityEmpty()
        } else {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(emptyStateTitle)
                        .font(AtlasTypography.cardTitle())
                        .foregroundStyle(AtlasColors.ink)
                    Text(emptyDescription)
                        .font(AtlasTypography.meta())
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                .padding(AtlasMetrics.cardPadding)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AtlasColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                .atlasElevatedCard()

                if viewModel.isSearchActive {
                    AtlasOutlineButton(title: "清空搜索") {
                        viewModel.searchQuery = ""
                    }
                } else if viewModel.actionFilter != .all {
                    AtlasOutlineButton(title: "查看全部动态") {
                        viewModel.actionFilter = .all
                    }
                }
            }
        }
    }

    private var emptyStateTitle: String {
        if viewModel.isSearchActive { return "没有匹配结果" }
        return "暂无匹配动态"
    }

    private var emptyDescription: String {
        if viewModel.isSearchActive {
            return "没有匹配「\(viewModel.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines))」的内容，试试其他关键词或清空搜索。"
        }
        if viewModel.actionFilter != .all {
            return "当前筛选下没有动态，试试切换其他类型。"
        }
        return "全站还没有新的公开动态。"
    }


    private var errorState: some View {
        VStack(spacing: 16) {
            AtlasDesignedErrorState(
                title: "暂时无法加载",
                message: viewModel.errorMessage ?? "网络异常",
                onRetry: {
                    Task {
                        await viewModel.load()
                    }
                },
                secondaryTitle: nil,
                secondaryAction: nil
            )
        }
        .frame(maxHeight: .infinity)
    }
}

// MARK: - ardot 311:1 · Activity toolbar stats chip

/// Compact two-stat pill that sits in the top-right of the Activity title row, replacing the
/// old large overview cards. Layout matches ardot `311:1`: lemonSoft capsule with a hairline
/// border, two icon-tile + value + label stacks separated by a vertical divider.
struct ActivityToolbarStatsChip: View {
    let stats: ActivityStats

    var body: some View {
        HStack(spacing: 8) {
            statTile(
                value: "\(stats.todayNewIdeas)",
                label: "今日新想法",
                icon: .sparkles,
                tileFill: AtlasColors.lemonStrong,
                iconColor: AtlasColors.lemonInk,
                valueColor: AtlasColors.lemonInk,
                labelColor: AtlasColors.oliveMeta
            )

            Capsule()
                .fill(AtlasColors.borderProfile)
                .frame(width: 1, height: 26)

            statTile(
                value: "\(stats.todayForks)",
                label: "今日 Fork",
                icon: .fork,
                tileFill: AtlasColors.surface,
                iconColor: AtlasColors.ink,
                valueColor: AtlasColors.ink,
                labelColor: AtlasColors.oliveMeta
            )
        }
        .padding(6)
        .background(
            Capsule(style: .continuous)
                .fill(AtlasColors.lemonSoft)
        )
        .overlay(
            Capsule(style: .continuous)
                .stroke(AtlasColors.borderProfile, lineWidth: 1)
        )
    }

    private func statTile(
        value: String,
        label: String,
        icon: DeimosIcon,
        tileFill: Color,
        iconColor: Color,
        valueColor: Color,
        labelColor: Color
    ) -> some View {
        HStack(spacing: 6) {
            // Icon tile (26×26, r13) matching ardot 311:2/311:9.
            DeimosIconView(icon: icon, size: 14, color: iconColor)
                .frame(width: 26, height: 26)
                .background(tileFill, in: RoundedRectangle(cornerRadius: 13, style: .continuous))

            VStack(alignment: .leading, spacing: 1) {
                Text(value)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(valueColor)
                    .lineLimit(1)
                Text(label)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(labelColor)
                    .lineLimit(1)
            }
        }
    }
}
