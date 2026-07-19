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
    var segment = 0
    var searchQuery = ""
    var actionFilter: ActivityActionFilter = .all
    var rankingTab: ActivityRankingTab = .popular
    var stats = ActivityStats(todayNewIdeas: 0, todayForks: 0, activeAgents: 0, totalActions: 0)
    var rankings: ActivityRankings = ActivityRankings(popular: [], flowers: [], forks: [])
    var activities: [ActivityView] = []
    var isLoading = false
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

    func load(segment: Int, isAuthenticated: Bool) async {
        isLoading = activities.isEmpty && segment == 0
        errorMessage = nil
        isOffline = false
        defer { isLoading = false }

        do {
            if segment == 0 {
                let feed = try await APIClient.shared.activityFeed()
                stats = feed.stats
                rankings = feed.rankings
                activities = feed.activities
            } else if isAuthenticated {
                stats = ActivityStats(todayNewIdeas: 0, todayForks: 0, activeAgents: 0, totalActions: 0)
                rankings = ActivityRankings(popular: [], flowers: [], forks: [])
                activities = try await APIClient.shared.followingFeed()
            } else {
                stats = ActivityStats(todayNewIdeas: 0, todayForks: 0, activeAgents: 0, totalActions: 0)
                rankings = ActivityRankings(popular: [], flowers: [], forks: [])
                activities = []
            }
        } catch {
            errorMessage = error.localizedDescription
            isOffline = true
            if segment != 0 {
                activities = []
            }
        }
    }
}

struct ActivityScreen: View {
    @Environment(AuthSession.self) private var session
    @State private var viewModel = ActivityScreenViewModel()
    @State private var selectedRoute: IdeaRoute?
    @State private var showAuthSheet = false
    @State private var showStats = false
    @State private var showRankings = false

    var body: some View {
        VStack(spacing: 0) {
            // v6 large title header — stats live in a compact toolbar chip on the right (ardot 311:1).
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("DEIMOS")
                        .font(AtlasTypography.overline())
                        .foregroundStyle(AtlasColors.inkSoft)
                    Text("动态")
                        .font(AtlasTypography.largeTitle())
                        .foregroundStyle(AtlasColors.ink)
                        .atlasTrackedTitle(30)
                }

                Spacer()

                ActivityToolbarStatsChip(stats: viewModel.stats)
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.top, 8)
            .padding(.bottom, 20)

            AtlasSegmentedPill(items: ["全局", "关注"], selection: $viewModel.segment)
                .padding(.horizontal, AtlasMetrics.pageX)
                .padding(.bottom, 12)

            content
        }
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
        .task(id: viewModel.segment) {
            await viewModel.load(segment: viewModel.segment, isAuthenticated: session.isAuthenticated)
        }
        .refreshable {
            await viewModel.load(segment: viewModel.segment, isAuthenticated: session.isAuthenticated)
        }
        .onChange(of: viewModel.segment) { _, newValue in
            if newValue == 1 && !session.isAuthenticated {
                viewModel.segment = 0
                showAuthSheet = true
            }
            if newValue != 0 {
                showStats = false
                showRankings = false
            }
        }
        .onChange(of: session.isAuthenticated) { _, _ in
            Task {
                await viewModel.load(segment: viewModel.segment, isAuthenticated: session.isAuthenticated)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.segment == 1 && !session.isAuthenticated {
            followingLoginPrompt
        } else if viewModel.isLoading && viewModel.activities.isEmpty && viewModel.segment == 0 {
            loadingSkeleton
        } else if viewModel.isOffline && viewModel.activities.isEmpty {
            errorState
        } else {
            feedScroll
        }
    }

    private var loadingSkeleton: some View {
        ScrollView {
            HomeFeedLoadingSkeleton()
                .padding(.horizontal, AtlasMetrics.pageX)
                .padding(.top, 16)
        }
    }

    private var feedScroll: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                if viewModel.isOffline, let message = viewModel.errorMessage {
                    AtlasOfflineBanner(message: message) {
                        Task {
                            await viewModel.load(segment: viewModel.segment, isAuthenticated: session.isAuthenticated)
                        }
                    }
                }

                feedSection
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.top, 16)
            .padding(.bottom, AtlasMetrics.bottomClear)
        }
    }

    private var actionFilterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(ActivityActionFilter.allCases) { filter in
                    AtlasFilterChip(
                        title: filter.title,
                        isSelected: viewModel.actionFilter == filter
                    ) {
                        viewModel.actionFilter = filter
                    }
                }
            }
        }
    }

    /// ardot 311:1 — replaced the large `activityOverview` cards with this compact stats chip in
    /// the title row's top-right. Two metrics side by side: 今日新想法 (lemon tile) | 今日 Fork
    /// (white tile), separated by a hairline divider inside a lemonSoft pill.
    @ViewBuilder
    private var scopeToolbarControl: some View {
        if viewModel.segment == 0 {
            Menu {
                Toggle("统计", isOn: animatedBinding($showStats))
                Toggle("热门排行", isOn: animatedBinding($showRankings))
            } label: {
                AtlasToolbarFloatTextLabel(title: "全局")
            }
        } else {
            AtlasToolbarFloatTextLabel(title: "与我", color: AtlasColors.inkFaint)
        }
    }

    private func animatedBinding(_ value: Binding<Bool>) -> Binding<Bool> {
        Binding(
            get: { value.wrappedValue },
            set: { newValue in
                withAnimation(.easeInOut(duration: 0.2)) {
                    value.wrappedValue = newValue
                }
            }
        )
    }

    private var statsRow: some View {
        HStack(spacing: 12) {
            WireframeStatCircle(value: "\(viewModel.stats.todayNewIdeas)", label: "今日新想法")
            WireframeStatCircle(value: "\(viewModel.stats.activeAgents)", label: "活跃 Agent")
            WireframeStatCircle(value: "\(viewModel.stats.totalActions)", label: "全站动作")
        }
    }

    private var rankingsCard: some View {
        settingsGroupedCard {
            VStack(alignment: .leading, spacing: 9) {
                Text("热门排行")
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)
                    .padding(.horizontal, AtlasMetrics.cardPadding)
                    .padding(.top, AtlasMetrics.cardPadding)

                HStack(spacing: 6) {
                    ForEach(ActivityRankingTab.allCases) { tab in
                        AtlasFilterChip(
                            title: tab.title,
                            isSelected: viewModel.rankingTab == tab
                        ) {
                            viewModel.rankingTab = tab
                        }
                    }
                }
                .padding(.horizontal, AtlasMetrics.cardPadding)

                if viewModel.currentRanking.isEmpty {
                    Text(viewModel.isSearchActive ? "没有匹配的排行" : "暂无数据")
                        .font(AtlasTypography.meta())
                        .foregroundStyle(AtlasColors.inkFaint)
                        .padding(.horizontal, AtlasMetrics.cardPadding)
                        .padding(.bottom, AtlasMetrics.cardPadding)
                } else {
                    ForEach(Array(viewModel.currentRanking.prefix(5).enumerated()), id: \.element.id) { index, idea in
                        Button {
                            selectedRoute = IdeaRoute(id: idea.id)
                        } label: {
                            HStack {
                                Text(String(format: "%02d", index + 1))
                                    .font(AtlasTypography.meta())
                                    .foregroundStyle(AtlasColors.inkFaint)
                                    .frame(width: 24, alignment: .leading)
                                Text(idea.title)
                                    .font(AtlasTypography.meta())
                                    .foregroundStyle(AtlasColors.ink)
                                    .lineLimit(1)
                                Spacer(minLength: 8)
                                let metric = viewModel.rankingMetric(for: idea)
                                Text("\(metric.0) \(metric.1)")
                                    .font(.system(size: 12))
                                    .foregroundStyle(AtlasColors.accentFork)
                            }
                            .padding(.horizontal, AtlasMetrics.cardPadding)
                            .padding(.vertical, 10)
                        }
                        .buttonStyle(.plain)

                        if index < min(4, viewModel.currentRanking.count - 1) {
                            Divider().padding(.leading, AtlasMetrics.cardPadding)
                        }
                    }
                    .padding(.bottom, 8)
                }
            }
        }
    }

    @ViewBuilder
    private var feedSection: some View {
        if viewModel.filteredActivities.isEmpty {
            followingEmptyState
                .padding(.top, 12)
        } else {
            ForEach(viewModel.filteredActivities, id: \.id) { activity in
                Group {
                    if let ideaID = activity.ideaID {
                        Button {
                            selectedRoute = IdeaRoute(id: ideaID)
                        } label: {
                            ActivityCell(activity: activity)
                        }
                        .buttonStyle(.plain)
                    } else {
                        ActivityCell(activity: activity)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var followingEmptyState: some View {
        if viewModel.segment == 0 && !viewModel.isSearchActive && viewModel.actionFilter == .all {
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

                if viewModel.segment == 1 {
                    AtlasPrimaryButton(title: "浏览广场热门") {
                        viewModel.segment = 0
                    }
                } else if viewModel.isSearchActive {
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
        return viewModel.segment == 0 ? "暂无匹配动态" : "关注流还是空的"
    }

    private var emptyDescription: String {
        if viewModel.isSearchActive {
            return "没有匹配「\(viewModel.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines))」的内容，试试其他关键词或清空搜索。"
        }
        if viewModel.segment == 1 {
            return "关注 Agent 或用户后，他们的发布、Fork 和分享会出现在这里。"
        }
        if viewModel.actionFilter != .all {
            return "当前筛选下没有动态，试试切换其他类型。"
        }
        return "全站还没有新的公开动态。"
    }

    private var followingLoginPrompt: some View {
        VStack(spacing: 16) {
            AtlasDesignedEmptyStates.followingLogin {
                showAuthSheet = true
            }
            Spacer()
        }
        .frame(maxHeight: .infinity)
    }

    private var errorState: some View {
        VStack(spacing: 16) {
            AtlasDesignedErrorState(
                title: "暂时无法加载",
                message: viewModel.errorMessage ?? "网络异常",
                onRetry: {
                    Task {
                        await viewModel.load(segment: viewModel.segment, isAuthenticated: session.isAuthenticated)
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
