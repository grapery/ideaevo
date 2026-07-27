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

    func load(segment: Int, isAuthenticated: Bool) async {
        isLoading = activities.isEmpty && segment == 0
        errorMessage = nil
        isOffline = false
        defer { isLoading = false }

        do {
            if segment == 0 {
                let feed = try await APIClient.shared.activityFeed(limit: 20)
                stats = feed.stats
                rankings = feed.rankings
                activities = feed.activities
                hasMore = feed.activities.count < feed.total && feed.activities.count < 50
            } else if isAuthenticated {
                stats = ActivityStats(todayNewIdeas: 0, todayForks: 0, activeAgents: 0, totalActions: 0)
                rankings = ActivityRankings(popular: [], flowers: [], forks: [])
                activities = try await APIClient.shared.followingFeed(limit: 20)
                hasMore = activities.count == 20
            } else {
                stats = ActivityStats(todayNewIdeas: 0, todayForks: 0, activeAgents: 0, totalActions: 0)
                rankings = ActivityRankings(popular: [], flowers: [], forks: [])
                activities = []
                hasMore = false
            }
        } catch {
            errorMessage = error.localizedDescription
            isOffline = true
            if segment != 0 {
                activities = []
            }
        }
    }

    func loadMore(segment: Int, isAuthenticated: Bool) async {
        guard hasMore, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }

        do {
            if segment == 0 {
                // `/activity/feed` currently returns the newest prefix rather than accepting an
                // offset. Increase the requested prefix and retain stable identity ordering.
                let requested = min(activities.count + 20, 50)
                let feed = try await APIClient.shared.activityFeed(limit: requested)
                activities = feed.activities
                hasMore = activities.count < feed.total && activities.count < 50
            } else if isAuthenticated {
                let more = try await APIClient.shared.followingFeed(limit: 20, offset: activities.count)
                let existing = Set(activities.map(\.id))
                activities.append(contentsOf: more.filter { !existing.contains($0.id) })
                hasMore = more.count == 20
            }
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
    @State private var showStats = false
    @State private var showRankings = false

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                Text("DEIMOS")
                    .font(AtlasTypography.overline())
                    .foregroundStyle(AtlasColors.inkSoft)
                Text("动态")
                    .font(AtlasTypography.largeTitle())
                    .foregroundStyle(AtlasColors.ink)
                    .atlasTrackedTitle(30)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.top, 8)
            .padding(.bottom, 20)

            AtlasSegmentedPill(items: ["全局", "关注"], selection: $viewModel.segment)
                .padding(.horizontal, AtlasMetrics.pageX)
                .padding(.bottom, 12)

            // ardot S08 (`237:168`): compact 342×80 stats row below the segments.
            // Left tile #F3FFC8 lemon cr20 (今日新增想法) + Right tile #F2F5F8 stroke #E8EBF0 cr20
            // (今日 Fork). Each tile: Label 13pt + Value 26pt Bold + Trend 11pt Medium.
            statsSection
                .padding(.horizontal, AtlasMetrics.pageX)
                .padding(.bottom, 16)

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
            LazyVStack(spacing: 12) {
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
            .padding(.top, 4)
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

    /// ardot S08 (`237:168`): two side-by-side 165×80 stat tiles.
    /// Left tile #F3FFC8 lemon cr20 ("今日新增想法") + Right tile #F2F5F8 stroke #E8EBF0 cr20
    /// ("今日 Fork"). Each tile holds Label 13pt + Value 26pt Bold + Trend 11pt Medium.
    /// Replaces the old compact ActivityToolbarStatsChip for the section below the segments.
    private var statsSection: some View {
        HStack(spacing: 12) {
            activityStatTile(
                label: "今日新增想法",
                value: "\(viewModel.stats.todayNewIdeas)",
                trend: nil,
                fill: AtlasColors.chatActivityFill,
                stroke: nil,
                labelColor: AtlasColors.oliveMeta,
                trendColor: AtlasColors.oliveMeta
            )
            activityStatTile(
                label: "今日 Fork",
                value: "\(viewModel.stats.todayForks)",
                trend: nil,
                fill: AtlasColors.statTileSecondary,
                stroke: AtlasColors.settingsRowStroke,
                labelColor: AtlasColors.statLabelSecondary,
                trendColor: AtlasColors.inkSoft
            )
        }
    }

    private func activityStatTile(
        label: String,
        value: String,
        trend: String?,
        fill: Color,
        stroke: Color?,
        labelColor: Color,
        trendColor: Color
    ) -> some View {
        // ardot S08 (`237:177` Stats): each tile 166×80 cr16, padding 16, itemSpacing 2.
        // Label 11pt Semibold, Value 22pt Bold, Trend 10pt Medium.
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(labelColor)
                .lineLimit(1)
            Text(value)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
                .monospacedDigit()
                .lineLimit(1)
            if let trend {
                Text(trend)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(trendColor)
                    .lineLimit(1)
            } else {
                Text(" ")
                    .font(.system(size: 10))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 80, maxHeight: 80, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(fill)
        )
        .overlay(
            stroke.map {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke($0, lineWidth: 1)
            }
        )
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
            VStack(spacing: 0) {
                ForEach(Array(viewModel.filteredActivities.enumerated()), id: \.element.id) { index, activity in
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
                    .onAppear {
                        if index == viewModel.filteredActivities.count - 1 {
                            Task {
                                await viewModel.loadMore(
                                    segment: viewModel.segment,
                                    isAuthenticated: session.isAuthenticated
                                )
                            }
                        }
                    }

                    if index < viewModel.filteredActivities.count - 1 {
                        Divider()
                            .padding(.leading, 64)
                    }
                }
            }
            .background(AtlasColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(AtlasColors.border, lineWidth: 1)
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
