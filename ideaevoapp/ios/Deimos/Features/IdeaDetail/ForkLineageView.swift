import SwiftUI
import Observation

@MainActor
@Observable
final class ForkLineageViewModel {
    var idea: Idea?
    var ancestors: [Idea] = []
    var children: [Idea] = []
    var forkRecords: [ForkRecord] = []
    var isLoading = true
    var errorMessage: String?

    func load(ideaID: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let ideaTask = APIClient.shared.getIdea(id: ideaID)
            async let childrenTask = APIClient.shared.getForkChildren(ideaID: ideaID)
            async let forksTask = APIClient.shared.getForks(ideaID: ideaID)
            idea = try await ideaTask
            children = try await childrenTask
            forkRecords = try await forksTask
            ancestors = try await loadAncestors(from: idea)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadAncestors(from idea: Idea?) async throws -> [Idea] {
        guard var parentID = idea?.forkedFromID, !parentID.isEmpty else { return [] }
        var chain: [Idea] = []
        for _ in 0..<8 {
            let parent = try await APIClient.shared.getIdea(id: parentID)
            chain.insert(parent, at: 0)
            guard let next = parent.forkedFromID, !next.isEmpty else { break }
            parentID = next
        }
        return chain
    }
}

struct ForkLineageView: View {
    let ideaID: String

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = ForkLineageViewModel()
    @State private var ideaRoute: IdeaRoute?

    var body: some View {
        VStack(spacing: 0) {
            settingsBackHeader(title: "Fork 谱系", dismiss: dismiss)

            if viewModel.isLoading {
                Spacer()
                ProgressView()
                Spacer()
            } else if let error = viewModel.errorMessage {
                AtlasDesignedEmptyStates.loadFailed(message: error) {
                    Task { await viewModel.load(ideaID: ideaID) }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(spacing: 12) {
                        if !viewModel.ancestors.isEmpty {
                            sectionCard("父链") {
                                ForEach(viewModel.ancestors) { ancestor in
                                    lineageRow(ancestor, badge: "祖先", accent: AtlasColors.inkFaint)
                                }
                            }
                        }

                        if let current = viewModel.idea {
                            sectionCard("当前想法", highlight: true) {
                                lineageRow(current, badge: "当前", accent: AtlasColors.accentActive)
                            }
                        }

                        sectionCard("直接 Fork (\(viewModel.children.count))") {
                            if viewModel.children.isEmpty {
                                Text("暂无公开 Fork 子树")
                                    .font(.system(size: 13))
                                    .foregroundStyle(AtlasColors.inkFaint)
                            } else {
                                ForEach(viewModel.children) { child in
                                    lineageRow(child, badge: "衍生", accent: AtlasColors.accentFork)
                                }
                            }
                        }

                        if !viewModel.forkRecords.isEmpty {
                            sectionCard("Fork 记录") {
                                ForEach(viewModel.forkRecords) { record in
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(record.reason)
                                            .font(.system(size: 13))
                                            .foregroundStyle(AtlasColors.ink)
                                        Text(record.createdAt.relativeShort)
                                            .font(.system(size: 11))
                                            .foregroundStyle(AtlasColors.inkFaint)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, AtlasMetrics.pageX)
                    .padding(.vertical, 16)
                }
            }
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
        .navigationDestination(item: $ideaRoute) { route in
            IdeaDetailView(ideaID: route.id)
        }
        .task { await viewModel.load(ideaID: ideaID) }
    }

    @ViewBuilder
    private func sectionCard<C: View>(_ title: String, highlight: Bool = false, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(AtlasTypography.cardTitle())
                .foregroundStyle(AtlasColors.ink)
            content()
        }
        .padding(AtlasMetrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(highlight ? AtlasColors.entityIdea.opacity(0.45) : AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .atlasElevatedCard()
    }

    private func lineageRow(_ idea: Idea, badge: String, accent: Color) -> some View {
        Button {
            ideaRoute = IdeaRoute(id: idea.id)
        } label: {
            HStack(spacing: 12) {
                EntityAvatar.idea(id: idea.id, url: idea.iconLink, name: idea.title, size: 36)
                VStack(alignment: .leading, spacing: 4) {
                    Text(idea.title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                        .lineLimit(1)
                    Text("\(idea.forkCount) Fork · \(idea.flowerCount) 花")
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkFaint)
                }
                Spacer()
                Text(badge)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(accent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(accent.opacity(0.12))
                    .clipShape(Capsule())
                DeimosIconView(icon: .chevronRight, size: 12, color: AtlasColors.inkFaint)
            }
        }
        .buttonStyle(.plain)
    }
}
