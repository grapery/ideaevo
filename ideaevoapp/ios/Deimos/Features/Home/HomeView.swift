import SwiftUI
import Observation

@MainActor
@Observable
final class HomeViewModel {
    var ideas: [Idea] = []
    var isLoading = true
    var isLoadingMore = false
    var hasMoreIdeas = true
    var errorMessage: String?
    var currentSort: String = "popular"

    private let pageSize = 20
    private var ideasOffset = 0

    /// Map UI sort chip index → API sort parameter.
    static let sortOptions: [(label: String, value: String)] = [
        ("热门", "popular"),
        ("最新", "newest"),
        ("实现中", "most_forked"),
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
            let fresh = try await APIClient.shared.queryIdeas(sort: currentSort)
            ideas = fresh.ideas.filter(BlocklistFiltering.idea)
            ideasOffset = fresh.ideas.count
            hasMoreIdeas = Pagination.hasMore(offset: ideasOffset, loaded: fresh.ideas.count, total: fresh.total)
            FeedCache.savePlaza(fresh.ideas)
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
            let next = try await APIClient.shared.queryIdeas(offset: ideasOffset, sort: currentSort)
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
    @State private var sortIndex = 0
    @State private var startChat = false
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
            SearchView()
        }
        .navigationDestination(isPresented: $startChat) {
            ChatListView()
        }
        .sheet(isPresented: $showAuthSheet) {
            AuthRequiredSheet()
        }
        .task {
            await viewModel.loadPlaza()
        }
        .refreshable {
            await viewModel.loadPlaza()
        }
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
                            .padding(.horizontal, 24)
                            .frame(height: 40)
                            .background(isSelected ? AtlasColors.primaryAction : AtlasColors.surface)
                            .overlay(
                                Capsule()
                                    .stroke(AtlasColors.border, lineWidth: isSelected ? 0 : 1)
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

    @ViewBuilder
    private var content: some View {
        largeTitleHeader

        Button { showSearch = true } label: {
            HStack(spacing: 0) {
                Text("搜索想法、Agent…")
                    .font(AtlasTypography.subtitle())
                    .foregroundStyle(AtlasColors.inkSoft)
                Spacer()
            }
            .padding(.horizontal, 16)
            .frame(height: 48)
            .background(AtlasColors.fill)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.bottom, 20)

        // AI Hero Card — S02 instance (237:146) hides the CTA pill; the whole card is tappable.
        AIHeroCard(
            title: "还没有方向？问万叶",
            subtitle: "从问题、素材或一个想法开始"
        ) {
            startChat = true
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.bottom, 20)

        sortChips
            .padding(.bottom, 20)

        plazaContent
    }

    @ViewBuilder
    private var plazaContent: some View {
        // Section header — design always shows "热门想法" regardless of selected sort chip
        HStack {
            Text("为你挑选 · 公开可 Fork")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
            Spacer()
            Button {
                // No dedicated "all ideas" page yet — reload for more
                Task { await viewModel.loadPlaza() }
            } label: {
                Text("筛选 ›")
                    .font(.system(size: 13, weight: .medium))
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
                        coverImageURL: idea.iconLink,
                        iconNamespace: ideaIconNamespace,
                        onTap: { selectedRoute = IdeaRoute(id: idea.id) }
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
}
