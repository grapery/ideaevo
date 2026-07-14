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

/// S34 Fork Lineage (Ardot `189:123`) — 源/当前/子分支脉络.
///
/// Layout: title "Fork 脉络" 28pt → source node (grey card) → current node (lemon card) →
/// child forks list → "查看源版本详情" button (lemonInk bg) → legend card.
struct ForkLineageView: View {
    let ideaID: String

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = ForkLineageViewModel()
    @State private var ideaRoute: IdeaRoute?

    var body: some View {
        VStack(spacing: 0) {
            // S34 Back button row — 36×36 r18 bg=#F4F5F8
            HStack(spacing: 8) {
                AtlasNavBackButton { dismiss() }
                Spacer()
            }
            .padding(.horizontal, 8)
            .frame(height: AtlasToolbarMetrics.barHeight)

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
                    VStack(alignment: .leading, spacing: 14) {
                        // S34 Screen Title — 28pt Bold ink (Ardot 189:126)
                        Text("Fork 脉络")
                            .font(.system(size: 28, weight: .bold))
                            .atlasTrackedTitle(28)
                            .foregroundStyle(AtlasColors.ink)

                        // S34 Source idea node — #F8FAFC r16 itemSpacing=6 (Ardot 189:127)
                        if let source = viewModel.ancestors.last {
                            sourceNode(source)
                        }

                        // S34 Current fork node — lemon-soft r16 (Ardot 189:129)
                        if let current = viewModel.idea {
                            currentNode(current)
                        }

                        // S34 Child forks list (Ardot 189:131)
                        childForksNode

                        // S34 "查看源版本详情" button — lemonInk r12 (Ardot 189:169)
                        if let source = viewModel.ancestors.last {
                            viewSourceButton(source)
                        }

                        // S34 Legend card — #F8FAFC r16 (Ardot 189:171)
                        legendCard
                    }
                    .padding(.horizontal, AtlasMetrics.detailX)
                    .padding(.vertical, 16)
                    .padding(.bottom, AtlasMetrics.bottomClear)
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

    // MARK: - Source node (#F8FAFC card)

    /// 源想法 · vX / title · N Fork (Ardot 189:127 — grey bg #F7F8FA r16 itemSpacing=6).
    private func sourceNode(_ idea: Idea) -> some View {
        Button {
            ideaRoute = IdeaRoute(id: idea.id)
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                Text("源想法")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AtlasColors.inkTertiary)
                Text(idea.displayTitle)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color(hex: 0x3E4652))
                    .lineLimit(2)
                HStack(spacing: 8) {
                    Text("\(idea.forkCount) Fork")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color(hex: 0xF7F8FA))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Current node (lemon card)

    /// 当前分支 / title · agent (Ardot 189:129 — lemon-soft bg r16).
    private func currentNode(_ idea: Idea) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("当前分支")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AtlasColors.olive)
            Text("\(idea.displayTitle) · \(idea.agent?.name ?? "Agent")")
                .font(.system(size: 15))
                .foregroundStyle(AtlasColors.lemonInk)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(AtlasColors.lemonSoft)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Child forks — horizontal scroll cards (Ardot S34 189:131)

    private var childForksNode: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("子分支")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(AtlasColors.ink)

            if viewModel.children.isEmpty {
                Text("暂无公开 Fork 子树")
                    .font(.system(size: 14))
                    .foregroundStyle(AtlasColors.inkFaint)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(viewModel.children) { child in
                            Button {
                                ideaRoute = IdeaRoute(id: child.id)
                            } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(child.displayTitle)
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundStyle(AtlasColors.ink)
                                        .lineLimit(2)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    HStack(spacing: 4) {
                                        Circle()
                                            .fill(AtlasColors.lemonStrong)
                                            .frame(width: 6, height: 6)
                                        Text("\(child.forkCount) Fork")
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundStyle(AtlasColors.inkSoft)
                                    }
                                }
                                .padding(14)
                                .frame(width: 160, alignment: .leading)
                                .background(AtlasColors.surface)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                                        .stroke(AtlasColors.border, lineWidth: 1)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    // MARK: - View source button (Ardot 189:169)

    /// lemonInk bg r12, 48h, white text 15pt Bold.
    private func viewSourceButton(_ source: Idea) -> some View {
        Button {
            ideaRoute = IdeaRoute(id: source.id)
        } label: {
            Text("查看源版本详情")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(AtlasColors.lemonInk)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Legend card (Ardot 189:171 — #F8FAFC r16)

    /// #F8FAFC r16 with explanation text 14pt.
    private var legendCard: some View {
        Text("灰色是源节点，柠檬色是当前分支。子分支按 Fork 时间排序。")
            .font(.system(size: 14))
            .foregroundStyle(AtlasColors.inkTertiary)
            .lineSpacing(6)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color(hex: 0xF8FAFC))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
