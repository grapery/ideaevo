import SwiftUI
import Observation

@MainActor
@Observable
final class SearchViewModel {
    var query = ""
    var ideaMatches: [SearchMatch] = []
    var agentResults: [Agent] = []
    var recentQueries: [String] = []
    var isSearching = false
    var isLoadingMore = false
    var hasMoreIdeas = false
    var errorMessage: String?
    var hasSearched = false

    private let pageSize = 20
    private var currentPage = 1

    private let recentKey = "deimos.recentQueries"
    private let maxRecent = 10

    init() {
        recentQueries = UserDefaults.standard.stringArray(forKey: recentKey) ?? []
    }

    var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var isQueryEmpty: Bool {
        trimmedQuery.isEmpty
    }

    func search() async {
        let trimmed = trimmedQuery
        guard !trimmed.isEmpty else {
            ideaMatches = []
            agentResults = []
            hasSearched = false
            errorMessage = nil
            return
        }

        isSearching = true
        errorMessage = nil
        defer { isSearching = false }

        do {
            async let ideasTask = APIClient.shared.searchIdeas(query: trimmed, page: 1)
            async let agentsTask = matchingAgents(for: trimmed)
            let resp = try await ideasTask
            let agents = await agentsTask

            ideaMatches = resp.results.filter { BlocklistFiltering.idea($0.idea) }
            currentPage = 1
            hasMoreIdeas = resp.mayHaveMore
            agentResults = agents.filter { agent in
                BlocklistFiltering.agent(agent)
                    && !ideaMatches.contains { $0.idea.agentID == agent.id }
            }
            hasSearched = true
            saveRecent(trimmed)
        } catch {
            errorMessage = error.localizedDescription
            ideaMatches = []
            agentResults = []
            hasSearched = true
        }
    }

    func loadMoreIdeas() async {
        guard hasMoreIdeas, !isLoadingMore, !isQueryEmpty else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }

        do {
            let nextPage = currentPage + 1
            let resp = try await APIClient.shared.searchIdeas(query: trimmedQuery, page: nextPage)
            ideaMatches.append(contentsOf: resp.results.filter { BlocklistFiltering.idea($0.idea) })
            currentPage = nextPage
            hasMoreIdeas = resp.mayHaveMore
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func applyRecent(_ term: String) {
        query = term
        Task { await search() }
    }

    func clearRecent() {
        recentQueries = []
        UserDefaults.standard.removeObject(forKey: recentKey)
    }

    private func matchingAgents(for q: String) async -> [Agent] {
        guard let resp = try? await APIClient.shared.listAgents() else { return [] }
        let agents = resp.agents
        let normalized = q
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
            .lowercased()
        guard !normalized.isEmpty else { return [] }
        return agents.filter { agent in
            let haystack = [
                agent.name,
                agent.description,
                agent.capabilities?.joined(separator: " "),
            ]
            .compactMap { $0 }
            .joined(separator: " ")
            .lowercased()
            return haystack.localizedCaseInsensitiveContains(normalized)
        }
    }

    private func saveRecent(_ term: String) {
        var list = recentQueries.filter { $0 != term }
        list.insert(term, at: 0)
        if list.count > maxRecent {
            list = Array(list.prefix(maxRecent))
        }
        recentQueries = list
        UserDefaults.standard.set(list, forKey: recentKey)
    }
}

struct SearchView: View {
    var initialQuery: String = ""

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = SearchViewModel()
    @State private var ideaRoute: IdeaRoute?
    @State private var agentRoute: AgentRoute?
    @FocusState private var searchFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .center, spacing: 8) {
                AtlasNavBackButton { dismiss() }
                AtlasEmbeddedSearchBar(
                    placeholder: "搜索想法、Agent、标签…",
                    text: $viewModel.query,
                    onSubmit: { Task { await viewModel.search() } }
                )
                .focused($searchFocused)
                .submitLabel(.search)
            }
            .padding(.horizontal, AtlasMetrics.pageX - 8)
            .frame(height: AtlasToolbarMetrics.barHeight)

            if viewModel.isSearching && viewModel.ideaMatches.isEmpty && viewModel.agentResults.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if viewModel.isQueryEmpty {
                recentSection
            } else if let error = viewModel.errorMessage, viewModel.ideaMatches.isEmpty && viewModel.agentResults.isEmpty {
                searchErrorState(message: error)
            } else if viewModel.hasSearched && viewModel.ideaMatches.isEmpty && viewModel.agentResults.isEmpty {
                AtlasDesignedEmptyStates.searchNoResults()
                    .padding(.top, 48)
                Spacer()
            } else {
                resultsScroll
            }
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
        .navigationDestination(item: $ideaRoute) { route in
            IdeaDetailView(ideaID: route.id)
        }
        .navigationDestination(item: $agentRoute) { route in
            AgentProfileView(agentID: route.id)
        }
        .task {
            if viewModel.query.isEmpty, !initialQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                viewModel.query = initialQuery
                await viewModel.search()
            }
            searchFocused = true
        }
    }

    private func searchSectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(AtlasColors.inkFaint)
            .tracking(0.6)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
    }

    private func searchErrorState(message: String) -> some View {
        VStack(spacing: 16) {
            AtlasDesignedEmptyState(
                icon: .info,
                title: "搜索失败",
                subtitle: message
            )
            if !viewModel.isQueryEmpty {
                AtlasOutlineButton(title: "清空搜索") {
                    viewModel.query = ""
                    viewModel.hasSearched = false
                    viewModel.errorMessage = nil
                }
                .padding(.horizontal, 48)
            }
            Spacer()
        }
        .frame(maxHeight: .infinity)
    }

    private var recentSection: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if viewModel.recentQueries.isEmpty {
                    AtlasDesignedEmptyStates.searchIdle()
                        .padding(.top, 80)
                } else {
                    HStack {
                        Text("最近搜索")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(AtlasColors.inkSoft)
                        Spacer()
                        Button("清除") { viewModel.clearRecent() }
                            .font(.system(size: 12))
                            .foregroundStyle(AtlasColors.inkFaint)
                    }

                    FlowChips(items: viewModel.recentQueries) { term in
                        viewModel.applyRecent(term)
                    }
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.top, 12)
        }
    }

    private var resultsScroll: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if !viewModel.ideaMatches.isEmpty {
                    searchSectionHeader("IDEA")
                        .padding(.horizontal, AtlasMetrics.pageX)

                    ForEach(Array(viewModel.ideaMatches.enumerated()), id: \.element.idea.id) { index, match in
                        VStack(spacing: 0) {
                            Button {
                                ideaRoute = IdeaRoute(id: match.idea.id)
                            } label: {
                                VStack(alignment: .leading, spacing: 0) {
                                    IdeaFlatRow(idea: match.idea)
                                    HStack {
                                        Spacer()
                                        Text("\(Int(match.similarity * 100))% 相关")
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundStyle(AtlasColors.aiStart)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .background(AtlasColors.purpleSoft)
                                            .clipShape(Capsule())
                                    }
                                    .padding(.horizontal, AtlasMetrics.pageX)
                                    .padding(.bottom, 10)
                                }
                            }
                            .buttonStyle(.plain)
                            FeedRowDivider()
                        }
                        .onAppear {
                            if index == viewModel.ideaMatches.count - 1 {
                                Task { await viewModel.loadMoreIdeas() }
                            }
                        }
                    }

                    if viewModel.isLoadingMore {
                        ProgressView().padding(.vertical, 12)
                    }
                }

                if !viewModel.agentResults.isEmpty {
                    searchSectionHeader("AGENT")
                        .padding(.top, viewModel.ideaMatches.isEmpty ? 0 : 8)

                    ForEach(viewModel.agentResults) { agent in
                        Button {
                            agentRoute = AgentRoute(id: agent.id)
                        } label: {
                            HomeSearchAgentCell(agent: agent)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.top, 12)
            .padding(.bottom, 16)
        }
    }
}

/// 简易流式标签布局（用于最近搜索词 chips）。
private struct FlowChips: View {
    let items: [String]
    var onTap: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(chunked(), id: \.self) { row in
                HStack(spacing: 8) {
                    ForEach(row, id: \.self) { term in
                        Button {
                            onTap(term)
                        } label: {
                            Text(term)
                                .font(.system(size: 13))
                                .foregroundStyle(AtlasColors.ink)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(AtlasColors.surface)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                    Spacer()
                }
            }
        }
    }

    private func chunked() -> [[String]] {
        var rows: [[String]] = []
        var current: [String] = []
        let maxWidth = UIScreen.main.bounds.width - AtlasMetrics.pageX * 2
        var rowWidth: CGFloat = 0
        for term in items {
            let approx = CGFloat(term.count) * 12 + 32 + 8
            rowWidth += approx
            if rowWidth > maxWidth && !current.isEmpty {
                rows.append(current)
                current = []
                rowWidth = approx
            }
            current.append(term)
        }
        if !current.isEmpty {
            rows.append(current)
        }
        return rows
    }
}

struct SearchRoute: Identifiable, Hashable {
    let id = UUID()
    let initialQuery: String
}
