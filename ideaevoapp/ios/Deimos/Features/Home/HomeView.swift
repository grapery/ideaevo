import SwiftUI
import Observation

@MainActor
@Observable
final class HomeViewModel {
    var ideas: [Idea] = []
    var isLoading = false
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
        ("最多复用", "most_forked"),
        ("最多送花", "most_flowered"),
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

/// v7 Home — per S02 node tree (Ardot 179:1).
/// Content Wrapper: VERTICAL itemSpacing=18, padding=[20,20,0,18], bg=white.
/// Elements: eyebrow → title → AI hero → sort chips → section title → idea cover cards.
struct HomeView: View {
    let unreadCount: Int
    let onNotifications: () -> Void

    @Environment(AuthSession.self) private var session
    @State private var viewModel = HomeViewModel()
    @State private var selectedRoute: IdeaRoute?
    @State private var showPublishIdea = false
    @State private var showAuthSheet = false
    @State private var sortIndex = 0
    @State private var startChat = false
    @Namespace private var ideaIconNamespace

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if let offlineMessage = viewModel.errorMessage,
                   !viewModel.visibleIdeas.isEmpty {
                    AtlasOfflineBanner(message: offlineMessage) {
                        Task { await viewModel.loadPlaza() }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
                }

                content
            }
            .padding(.bottom, AtlasMetrics.bottomClear)
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

    // MARK: - Content (S02 Content Wrapper: VERTICAL itemSpacing=18, padding=[20,20,0,18])

    @ViewBuilder
    private var content: some View {
        // Per S02 node tree: VStack itemSpacing=18, no bell, no "查看全部"
        VStack(alignment: .leading, spacing: 18) {
            // Title (S02: 179:26)
            Text("探索")
                .font(.system(size: 36, weight: .heavy))
                .foregroundStyle(AtlasColors.ink)

            // AI Hero Card (S02: 179:27)
            AIHeroCard(
                title: "和万叶一起延展下一个想法",
                subtitle: "搜索、注册、复用，都在对话里完成",
                ctaTitle: "找万叶聊"
            ) {
                startChat = true
            }

            // Sort Chips (S02: 179:32)
            sortChips

            // Section title (S02: 179:39)
            Text("热门想法")
                .font(.system(size: 24, weight: .heavy))
                .foregroundStyle(AtlasColors.ink)

            // Idea feed
            feedContent
        }
        .padding(.horizontal, 20)
        .padding(.top, 0)
        .padding(.bottom, 18)
    }

    // MARK: - Sort Chips (S02: 179:32 — HORIZONTAL itemSpacing=8, 36h, r20, NO border on inactive)

    private var sortChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(HomeViewModel.sortOptions.indices, id: \.self) { index in
                    let isSelected = sortIndex == index
                    Button {
                        selectSort(index)
                    } label: {
                        Text(HomeViewModel.sortOptions[index].label)
                            // Active: 14pt Bold lemonInk | Inactive: 14pt SemiBold #737A87
                            .font(.system(size: 14, weight: isSelected ? .bold : .semibold))
                            .foregroundStyle(isSelected ? AtlasColors.lemonInk : Color(hex: 0x737A87))
                            .padding(.horizontal, 16)
                            .frame(height: 36)
                            // Active: lemonStrong #CBEA16 | Inactive: #F7F8FA — NO border
                            .background(isSelected ? AtlasColors.lemonStrong : Color(hex: 0xF7F8FA))
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
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

    // MARK: - Feed content

    @ViewBuilder
    private var feedContent: some View {
        if viewModel.isLoading && viewModel.visibleIdeas.isEmpty {
            HomeFeedLoadingSkeleton()
        } else if let errorMessage = viewModel.errorMessage, viewModel.visibleIdeas.isEmpty {
            AtlasDesignedEmptyStates.loadFailed(message: errorMessage) {
                Task { await viewModel.loadPlaza() }
            }
            .frame(minHeight: 200)
        } else if viewModel.visibleIdeas.isEmpty {
            AtlasDesignedEmptyStates.plazaEmpty {
                if session.isAuthenticated {
                    showPublishIdea = true
                } else {
                    showAuthSheet = true
                }
            }
        } else {
            LazyVStack(spacing: 18) {
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
        }
    }
}
