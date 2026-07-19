import SwiftUI
import Observation

@MainActor
@Observable
final class ForkLineageViewModel {
    var lineage: IdeaLineage?
    var isLoading = true
    var errorMessage: String?

    func load(ideaID: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            lineage = try await APIClient.shared.getIdeaLineage(ideaID: ideaID)
        } catch {
            errorMessage = error.localizedDescription
        }
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
            AtlasPushNavBar(title: "Fork 谱系", onBack: { dismiss() })

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
                        if let source = viewModel.lineage?.sourceIdea {
                            sourceNode(source, version: viewModel.lineage?.sourceVersion)
                        }

                        if let lineage = viewModel.lineage {
                            currentNode(lineage.idea, version: lineage.currentVersion)
                        }
                        childForksNode
                        statsBand

                        Text("选择一个节点，查看版本变化与 Fork 数")
                            .font(AtlasTypography.mobileSubheadline())
                            .foregroundStyle(AtlasColors.inkSoft)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 14)
                            .frame(height: 48)
                            .background(AtlasColors.lemonSoft)
                            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
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
    private func sourceNode(_ idea: Idea, version: IdeaVersionDetail?) -> some View {
        Button {
            ideaRoute = IdeaRoute(id: idea.id)
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                Text(sourceTitle(for: version))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AtlasColors.inkTertiary)
                Text(nonEmpty(version?.title) ?? idea.displayTitle)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color(hex: 0x3E4652))
                    .lineLimit(2)
                Text("\(idea.forkCount) Fork · \(version?.createdAt.absoluteShort ?? idea.createdAt.absoluteShort)")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(AtlasColors.inkSoft)
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
    private func currentNode(_ idea: Idea, version: IdeaVersionDetail?) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("当前 v\(version?.version ?? 1)")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AtlasColors.olive)
            Text(nonEmpty(version?.title) ?? idea.displayTitle)
                .font(.system(size: 15))
                .foregroundStyle(AtlasColors.lemonInk)
                .lineLimit(2)
            Text("\(idea.forkCount) Fork · 你正在查看")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(AtlasColors.olive)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(AtlasColors.lemonSoft)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Child forks

    private var childForksNode: some View {
        VStack(alignment: .leading, spacing: 12) {
            if children.isEmpty {
                EmptyView()
            } else {
                ForEach(children.prefix(3)) { child in
                    Button { ideaRoute = IdeaRoute(id: child.id) } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("子 Fork · \(child.displayTitle)")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(AtlasColors.ink)
                                .lineLimit(1)
                            Text("子分支 · \(child.agent?.name ?? "Agent") · \(child.createdAt.relativeShort)")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(AtlasColors.inkSoft)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 16)
                        .frame(height: 72)
                        .background(AtlasColors.surface)
                        .overlay(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous).stroke(AtlasColors.border, lineWidth: 1))
                        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var statsBand: some View {
        let stats = viewModel.lineage?.stats
        return HStack(spacing: 0) {
            lineageMetric("\(stats?.totalForks ?? 0)", "总 Fork")
            lineageMetric("\(stats?.activeBranches ?? children.count)", "活跃分支")
            lineageMetric("\(stats?.contributors ?? 0)", "贡献者")
        }
        .padding(.vertical, 12)
        .background(AtlasColors.fill)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }

    private var children: [Idea] {
        viewModel.lineage?.children ?? []
    }

    private func sourceTitle(for version: IdeaVersionDetail?) -> String {
        guard let version else { return "源想法" }
        if viewModel.lineage?.origin?.sourceVersionID == version.id {
            return "Fork 来源 · v\(version.version)"
        }
        return "源想法 · v\(version.version)"
    }

    private func nonEmpty(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func lineageMetric(_ value: String, _ label: String) -> some View {
        VStack(spacing: 3) {
            Text(value).font(.system(size: 16, weight: .bold)).foregroundStyle(AtlasColors.ink)
            Text(label).font(AtlasTypography.meta()).foregroundStyle(AtlasColors.inkSoft)
        }
        .frame(maxWidth: .infinity)
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
