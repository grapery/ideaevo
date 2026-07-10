import SwiftUI
import Observation

@MainActor
@Observable
final class HomeViewModel {
    var segment = 0
    var ideas: [Idea] = []
    var followingActivities: [ActivityView] = []
    var isLoading = false
    var isLoadingFollowing = false
    var isLoadingMore = false
    var hasMoreIdeas = true
    var errorMessage: String?
    var followingError: String?

    private let suggestions = ["#AI工具", "本地模型", "语义搜索"]
    private let pageSize = 20
    private var ideasOffset = 0

    var suggestionChips: [String] { suggestions }

    var visibleIdeas: [Idea] {
        ideas.filter(BlocklistFiltering.idea)
    }

    var visibleFollowingActivities: [ActivityView] {
        followingActivities.filter(BlocklistFiltering.activity)
    }

    func loadPlaza() async {
        if ideas.isEmpty, let cached = FeedCache.loadPlaza() {
            ideas = cached.filter(BlocklistFiltering.idea)
        }

        isLoading = ideas.isEmpty
        errorMessage = nil
        defer { isLoading = false }

        do {
            let fresh = try await APIClient.shared.queryIdeas()
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
            let next = try await APIClient.shared.queryIdeas(offset: ideasOffset)
            let filtered = next.ideas.filter(BlocklistFiltering.idea)
            ideas.append(contentsOf: filtered)
            ideasOffset = ideas.count
            hasMoreIdeas = Pagination.hasMore(offset: ideasOffset, loaded: next.ideas.count, total: next.total)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadFollowing() async {
        isLoadingFollowing = followingActivities.isEmpty
        followingError = nil
        defer { isLoadingFollowing = false }

        do {
            followingActivities = try await APIClient.shared.followingFeed()
                .filter(BlocklistFiltering.activity)
        } catch {
            followingError = error.localizedDescription
            followingActivities = []
        }
    }
}

struct HomeView: View {
    let unreadCount: Int
    let onNotifications: () -> Void

    @Environment(AuthSession.self) private var session
    @State private var viewModel = HomeViewModel()
    @State private var selectedRoute: IdeaRoute?
    @State private var showAgentExplore = false
    @State private var showPublishIdea = false
    @State private var agentExploreQuery = ""
    @State private var showAuthSheet = false
    @State private var searchRoute: SearchRoute?
    @Namespace private var ideaIconNamespace

    var body: some View {
        VStack(spacing: 0) {
            homeHeader
            homeStickyChrome

            ScrollView {
                LazyVStack(spacing: 0) {
                    if let offlineMessage = viewModel.errorMessage,
                       viewModel.segment == 0,
                       !viewModel.visibleIdeas.isEmpty {
                        AtlasOfflineBanner(message: offlineMessage) {
                            Task { await viewModel.loadPlaza() }
                        }
                        .padding(.horizontal, AtlasMetrics.pageX)
                        .padding(.bottom, 8)
                    }

                    content
                }
                .padding(.top, 4)
                .padding(.bottom, 16)
            }
        }
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: showAuthSheet)
        .navigationBarHidden(true)
        .navigationDestination(item: $selectedRoute) { route in
            IdeaDetailView(ideaID: route.id, iconNamespace: ideaIconNamespace)
        }
        .navigationDestination(isPresented: $showAgentExplore) {
            AgentExploreView(initialQuery: agentExploreQuery)
        }
        .navigationDestination(isPresented: $showPublishIdea) {
            PublishIdeaView()
        }
        .navigationDestination(item: $searchRoute) { route in
            SearchView(initialQuery: route.initialQuery)
        }
        .sheet(isPresented: $showAuthSheet) {
            AuthRequiredSheet()
        }
        .task {
            await viewModel.loadPlaza()
        }
        .refreshable {
            if viewModel.segment == 0 {
                await viewModel.loadPlaza()
            } else if session.isAuthenticated {
                await viewModel.loadFollowing()
            }
        }
        .onChange(of: viewModel.segment) { _, newValue in
            if newValue == 1 && !session.isAuthenticated {
                viewModel.segment = 0
                showAuthSheet = true
                return
            }
            if newValue == 1 {
                Task { await viewModel.loadFollowing() }
            }
        }
        .onChange(of: session.isAuthenticated) { _, isAuthenticated in
            if isAuthenticated, viewModel.segment == 1 {
                Task { await viewModel.loadFollowing() }
            }
        }
    }

    private var homeHeader: some View {
        AtlasTabScreenHeader(title: "探索") {
            AtlasToolbarCenterActionButton(icon: .plus, iconSize: 16) {
                if session.isAuthenticated {
                    showPublishIdea = true
                } else {
                    showAuthSheet = true
                }
            }
            AtlasToolbarBellButton(unreadCount: unreadCount, action: onNotifications)
        }
    }

    private var homeStickyChrome: some View {
        VStack(spacing: 16) {
            Button {
                searchRoute = SearchRoute(initialQuery: "")
            } label: {
                AtlasSearchBarTrigger(placeholder: "搜索 Idea 仓库、Agent、标签")
            }
            .buttonStyle(.plain)

            suggestionChips
            plazaFollowingSegment
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.top, 16)
        .padding(.bottom, 12)
    }

    private var suggestionChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(viewModel.suggestionChips, id: \.self) { chip in
                    Button {
                        searchRoute = SearchRoute(initialQuery: chip.replacingOccurrences(of: "#", with: ""))
                    } label: {
                        Text(chip)
                            .font(.system(size: 14))
                            .foregroundStyle(AtlasColors.inkSoft)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(AtlasColors.fill)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var plazaFollowingSegment: some View {
        AtlasSegmentedPill(items: ["趋势", "关注"], selection: $viewModel.segment)
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.segment == 0 {
            plazaContent
        } else {
            followingContent
        }
    }

    @ViewBuilder
    private var plazaContent: some View {
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
            ForEach(Array(viewModel.visibleIdeas.enumerated()), id: \.element.id) { index, idea in
                VStack(spacing: 0) {
                    ideaButton(idea)
                    FeedRowDivider()
                }
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

    @ViewBuilder
    private var followingContent: some View {
        if viewModel.isLoadingFollowing && viewModel.visibleFollowingActivities.isEmpty {
            HomeFeedLoadingSkeleton()
        } else if let error = viewModel.followingError, viewModel.visibleFollowingActivities.isEmpty {
            AtlasDesignedEmptyStates.loadFailed(message: error) {
                Task { await viewModel.loadFollowing() }
            }
            .frame(minHeight: 200)
        } else if viewModel.visibleFollowingActivities.isEmpty {
            AtlasDesignedEmptyStates.followingEmpty {
                openAgentExplore()
            }
        } else {
            ForEach(viewModel.visibleFollowingActivities) { activity in
                if let ideaID = activity.ideaID {
                    Button {
                        selectedRoute = IdeaRoute(id: ideaID)
                    } label: {
                        FollowingIdeaCell(activity: activity)
                    }
                    .buttonStyle(.plain)
                } else {
                    FollowingIdeaCell(activity: activity)
                }
            }
        }
    }

    private func ideaButton(_ idea: Idea) -> some View {
        Button {
            selectedRoute = IdeaRoute(id: idea.id)
        } label: {
            IdeaFlatRow(idea: idea, iconNamespace: ideaIconNamespace)
        }
        .buttonStyle(.plain)
    }

    private func openAgentExplore(query: String = "") {
        agentExploreQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        showAgentExplore = true
    }
}
