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
    @State private var resultScope = "全部想法"
    @State private var isFilterExpanded = false
    @FocusState private var searchFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            AtlasPushNavBar(title: "搜索", onBack: { dismiss() })

            AtlasEmbeddedSearchBar(
                placeholder: "搜索想法、Agent、标签…",
                text: $viewModel.query,
                onSubmit: { Task { await viewModel.search() } }
            )
            .focused($searchFocused)
            .submitLabel(.search)
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 12)
            .padding(.bottom, 4)

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
            .font(.system(size: 14))
            .foregroundStyle(AtlasColors.inkSoft)
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
                            .font(AtlasTypography.badge())
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
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 12)
        }
    }

    private var resultsScroll: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                if !viewModel.ideaMatches.isEmpty {
                    searchSectionHeader("语义搜索结果 · \(viewModel.ideaMatches.count) 条匹配")

                    Button {
                        withAnimation(.easeInOut(duration: 0.18)) {
                            isFilterExpanded.toggle()
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Text("筛选条件")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(AtlasColors.ink)
                            Spacer()
                            Text(resultScope == "全部想法" ? "想法 · 公开 · 匹配度" : resultScope)
                                .font(.system(size: 11))
                                .foregroundStyle(AtlasColors.inkSoft)
                            DeimosIconView(icon: .chevronRight, size: 10, color: AtlasColors.inkSoft)
                                .rotationEffect(.degrees(isFilterExpanded ? -90 : 90))
                        }
                        .padding(.horizontal, 14)
                        .frame(height: 40)
                        .background(AtlasColors.bgInput)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)

                    if isFilterExpanded {
                        VStack(spacing: 2) {
                            filterOption("全部想法", detail: "想法 · 公开 · 匹配度")
                            filterOption("公开内容", detail: "只看可浏览与 Fork 的内容")
                            filterOption("按匹配度", detail: "相似度从高到低")
                        }
                        .padding(4)
                        .background(AtlasColors.surface)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(AtlasColors.settingsRowStroke, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .shadow(color: AtlasColors.ink.opacity(0.08), radius: 18, y: 8)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }

                    VStack(spacing: 0) {
                        ForEach(Array(viewModel.ideaMatches.enumerated()), id: \.element.idea.id) { index, match in
                            Button { ideaRoute = IdeaRoute(id: match.idea.id) } label: {
                                searchIdeaRow(match, isTopMatch: index == 0)
                            }
                            .buttonStyle(.plain)
                            .onAppear {
                                if index == viewModel.ideaMatches.count - 1 {
                                    Task { await viewModel.loadMoreIdeas() }
                                }
                            }

                            if index < viewModel.ideaMatches.count - 1 {
                                Divider().padding(.leading, 14)
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
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 12)
            .padding(.bottom, 16)
        }
    }

    private func filterOption(_ title: String, detail: String) -> some View {
        Button {
            resultScope = title
            withAnimation(.easeInOut(duration: 0.18)) {
                isFilterExpanded = false
            }
        } label: {
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .stroke(
                            resultScope == title ? AtlasColors.lemonInk : AtlasColors.settingsRowStroke,
                            lineWidth: 1.25
                        )
                    if resultScope == title {
                        Circle()
                            .fill(AtlasColors.lemonStrong)
                            .padding(4)
                    }
                }
                .frame(width: 18, height: 18)

                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text(detail)
                        .font(.system(size: 10))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 10)
            .frame(height: 34)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func searchIdeaRow(_ match: SearchMatch, isTopMatch: Bool) -> some View {
        let idea = match.idea
        return VStack(alignment: .leading, spacing: 3) {
            Text(idea.displayTitle)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
                .lineLimit(1)
            Text("\(Int(match.similarity * 100))% 匹配 · \(idea.agent?.name ?? "Agent") · 公开")
                .font(.system(size: 11))
                .foregroundStyle(AtlasColors.inkSoft)
                .lineLimit(1)
        }
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: 68)
        .background(isTopMatch ? AtlasColors.lemonSoft : AtlasColors.surface)
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
                                .font(AtlasTypography.meta())
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
