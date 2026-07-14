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
    var activeFilter: SearchFilter = .semantic

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

    var resultCountText: String {
        let count = ideaMatches.count
        if count == 0 { return "" }
        let topScore = ideaMatches.first?.similarity ?? 0
        if topScore > 0 {
            return "找到 \(count) 个相关想法 · 相似度 \(String(format: "%.2f", topScore))"
        }
        return "找到 \(count) 个相关想法"
    }

    var filteredIdeas: [SearchMatch] {
        ideaMatches
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

enum SearchFilter: CaseIterable {
    case semantic, inProgress

    var label: String {
        switch self {
        case .semantic: return "语义匹配"
        case .inProgress: return "进行中"
        }
    }
}

/// S03 Search (Ardot `179:2`).
///
/// Content Wrapper (179:20): VERTICAL itemSpacing=16, padding=[20,20,0,16].
/// Back → "搜索" 36pt ExtraBold → search input r16 → result count → filter chips r18 → result cards r20.
struct SearchView: View {
    var initialQuery: String = ""

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = SearchViewModel()
    @State private var ideaRoute: IdeaRoute?
    @State private var agentRoute: AgentRoute?
    @FocusState private var searchFocused: Bool

    var body: some View {
        ScrollView {
            // Content Wrapper (S03 179:20): VERTICAL itemSpacing=16, padding=[20,20,0,16]
            VStack(alignment: .leading, spacing: 16) {
                // Back Button (S03 179:49): 36×36 r18 bg=#F4F5F8
                AtlasNavBackButton(action: { dismiss() })

                // Search Title (S03 179:51): "搜索" 36pt ExtraBold ink
                Text("搜索")
                    .font(.system(size: 36, weight: .heavy))
                    .atlasTrackedTitle(36)
                    .foregroundStyle(AtlasColors.ink)

                // Search Input (S03 179:52): 350×48 FILL, r16, bg=#F4F5F8
                searchInput

                if viewModel.isQueryEmpty {
                    recentSection
                } else if viewModel.isSearching && viewModel.ideaMatches.isEmpty && viewModel.agentResults.isEmpty {
                    HStack { Spacer(); ProgressView(); Spacer() }
                        .padding(.top, 40)
                } else if let error = viewModel.errorMessage, viewModel.ideaMatches.isEmpty && viewModel.agentResults.isEmpty {
                    searchErrorState(message: error)
                } else if viewModel.hasSearched && viewModel.ideaMatches.isEmpty && viewModel.agentResults.isEmpty {
                    AtlasDesignedEmptyStates.searchNoResults()
                        .padding(.top, 40)
                } else {
                    resultCountLine
                    filterChipsRow
                    resultsList
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 0)
            .padding(.bottom, 16 + AtlasMetrics.bottomClear)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
        .scrollDismissesKeyboard(.immediately)
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

    // MARK: - Search input (S03 179:52: 350×48 FILL, r16, bg=#F4F5F8)

    private var searchInput: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color(hex: 0x7E8796))
            ChineseFriendlyTextField(
                placeholder: "搜索想法、Agent、标签…",
                text: $viewModel.query,
                keyboardType: .default,
                returnKeyType: .search,
                onSubmit: { Task { await viewModel.search() } }
            )
            .focused($searchFocused)
            .submitLabel(.search)
            if !viewModel.query.isEmpty {
                Button {
                    viewModel.query = ""
                    viewModel.hasSearched = false
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(AtlasColors.inkFaint)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .frame(height: 48)
        .background(Color(hex: 0xF4F5F8))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Result count (S03 179:55: 13pt Medium #7E8796)

    private var resultCountLine: some View {
        Text(viewModel.resultCountText)
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(Color(hex: 0x7E8796))
    }

    // MARK: - Filter chips (S03 179:56: HORIZONTAL itemSpacing=8, 34h, r18)

    private var filterChipsRow: some View {
        HStack(spacing: 8) {
            ForEach(SearchFilter.allCases, id: \.self) { filter in
                let isSelected = viewModel.activeFilter == filter
                Button {
                    viewModel.activeFilter = filter
                } label: {
                    Text(filter.label)
                        // Active: 13pt Bold lemonInk | Inactive: 13pt SemiBold #6D7480
                        .font(.system(size: 13, weight: isSelected ? .bold : .semibold))
                        .foregroundStyle(isSelected ? AtlasColors.lemonInk : Color(hex: 0x6D7480))
                        .padding(.horizontal, 16)
                        .frame(height: 34)
                        // Active: lemonStrong | Inactive: #F8FAFC — NO border
                        .background(isSelected ? AtlasColors.lemonStrong : Color(hex: 0xF8FAFC))
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }

    // MARK: - Results list (S03 179:61 — white card + border r20)

    private var resultsList: some View {
        LazyVStack(spacing: 12) {
            ForEach(Array(viewModel.ideaMatches.enumerated()), id: \.element.idea.id) { index, match in
                searchResultCard(
                    title: match.idea.displayTitle,
                    summary: match.idea.feedSummaryText ?? "",
                    score: match.similarity,
                    action: { ideaRoute = IdeaRoute(id: match.idea.id) }
                )
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
    }

    /// Result card (S03 179:61): white bg + stroke r20, VERTICAL itemSpacing=8, padding=[16,16,0,14].
    /// Score badge: 54×26 r14 bg=lemonSoft, score 12pt ExtraBold olive.
    /// Title: 17pt ExtraBold ink. Summary: 13pt Medium #5F6673.
    private func searchResultCard(title: String, summary: String, score: Double, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                // Score badge (S03 179:62): lemonSoft bg, raw score 12pt ExtraBold olive
                if score > 0 {
                    Text(String(format: "%.2f", score))
                        .font(.system(size: 12, weight: .heavy))
                        .foregroundStyle(AtlasColors.olive)
                        .padding(.horizontal, 10)
                        .frame(height: 26)
                        .background(AtlasColors.lemonSoft)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }

                // Title (S03 179:64): 17pt ExtraBold ink
                Text(title)
                    .font(.system(size: 17, weight: .heavy))
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(2)

                // Summary (S03 179:65): 13pt Medium #5F6673
                Text(summary)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color(hex: 0x5F6673))
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.top, 0)
            .padding(.bottom, 14)
            .background(AtlasColors.surface)
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(AtlasColors.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Recent queries section

    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if viewModel.recentQueries.isEmpty {
                AtlasDesignedEmptyStates.searchIdle()
                    .padding(.top, 40)
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
        }
        .padding(.top, 40)
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
                                .background(AtlasColors.surfaceSecondary)
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
