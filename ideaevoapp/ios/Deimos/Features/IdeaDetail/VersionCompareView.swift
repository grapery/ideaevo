import SwiftUI
import Observation

@MainActor
@Observable
final class VersionCompareViewModel {
    var primary: IdeaVersionDetail?
    var compare: IdeaVersionDetail?
    var isLoading = true
    var errorMessage: String?
    var showingPrimary = true

    func load(ideaID: String, versionID: String, compareVersionID: String?) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            primary = try await APIClient.shared.getIdeaVersion(ideaID: ideaID, versionID: versionID)
            if let compareVersionID {
                compare = try await APIClient.shared.getIdeaVersion(ideaID: ideaID, versionID: compareVersionID)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    var diffSummary: String {
        guard let primary, let compare else { return "单版本预览" }
        let oldLen = compare.description.count
        let newLen = primary.description.count
        let delta = newLen - oldLen
        let sign = delta >= 0 ? "+" : ""
        return "描述长度 \(sign)\(delta) 字符 · v\(compare.version) → v\(primary.version)"
    }

    var activeVersion: IdeaVersionDetail? {
        guard compare != nil else { return primary }
        return showingPrimary ? primary : compare
    }
}

private enum DiffLineKind {
    case unchanged, added, removed
}

private struct DiffLine: Identifiable {
    let id = UUID()
    let text: String
    let kind: DiffLineKind
}

struct VersionCompareView: View {
    let ideaID: String
    let versionID: String
    let compareVersionID: String?

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = VersionCompareViewModel()

    var body: some View {
        VStack(spacing: 0) {
            settingsBackHeader(title: "版本对比", dismiss: dismiss)

            if viewModel.isLoading {
                Spacer()
                ProgressView()
                Spacer()
            } else if let error = viewModel.errorMessage {
                AtlasDesignedEmptyStates.loadFailed(message: error) {
                    Task { await viewModel.load(ideaID: ideaID, versionID: versionID, compareVersionID: compareVersionID) }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let primary = viewModel.primary {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if let compare = viewModel.compare {
                            AtlasSegmentedPill(
                                items: ["v\(compare.version)", "v\(primary.version) 当前"],
                                selection: Binding(
                                    get: { viewModel.showingPrimary ? 1 : 0 },
                                    set: { viewModel.showingPrimary = $0 == 1 }
                                )
                            )

                            Text(viewModel.diffSummary)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(AtlasColors.accentActive)

                            diffSection(from: compare.description, to: primary.description)
                        } else {
                            versionCard(primary)
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
        .task {
            await viewModel.load(ideaID: ideaID, versionID: versionID, compareVersionID: compareVersionID)
        }
    }

    private func versionCard(_ version: IdeaVersionDetail) -> some View {
        settingsGroupedCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("v\(version.version) · \(version.changelog)")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)
                    .padding(.horizontal, AtlasMetrics.cardPadding)
                    .padding(.top, AtlasMetrics.cardPadding)
                Text(version.createdAt.relativeShort)
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkFaint)
                    .padding(.horizontal, AtlasMetrics.cardPadding)
                MarkdownBody(markdown: version.description)
                    .padding(.horizontal, AtlasMetrics.cardPadding)
                    .padding(.bottom, AtlasMetrics.cardPadding)
            }
        }
    }

    private func diffSection(from old: String, to new: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Diff")
                .font(AtlasTypography.cardTitle())
                .foregroundStyle(AtlasColors.ink)

            VStack(alignment: .leading, spacing: 0) {
                ForEach(computeLineDiff(from: old, to: new)) { line in
                    Text(line.text.isEmpty ? " " : line.text)
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundStyle(diffForeground(line.kind))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(diffBackground(line.kind))
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))

            if let active = viewModel.activeVersion {
                settingsGroupedCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("v\(active.version) 正文")
                            .font(AtlasTypography.cardTitle())
                            .foregroundStyle(AtlasColors.ink)
                            .padding(.horizontal, AtlasMetrics.cardPadding)
                            .padding(.top, AtlasMetrics.cardPadding)
                        MarkdownBody(markdown: active.description)
                            .padding(.horizontal, AtlasMetrics.cardPadding)
                            .padding(.bottom, AtlasMetrics.cardPadding)
                    }
                }
            }
        }
    }

    private func diffForeground(_ kind: DiffLineKind) -> Color {
        switch kind {
        case .unchanged: return AtlasColors.inkSoft
        case .added: return AtlasColors.accentActive
        case .removed: return AtlasColors.coral
        }
    }

    private func diffBackground(_ kind: DiffLineKind) -> Color {
        switch kind {
        case .unchanged: return AtlasColors.surface
        case .added: return AtlasColors.accentActiveSoft
        case .removed: return AtlasColors.coralSoft
        }
    }

    private func computeLineDiff(from old: String, to new: String) -> [DiffLine] {
        let oldLines = old.components(separatedBy: "\n")
        let newLines = new.components(separatedBy: "\n")
        var result: [DiffLine] = []
        var i = 0
        var j = 0

        while i < oldLines.count || j < newLines.count {
            if i < oldLines.count, j < newLines.count, oldLines[i] == newLines[j] {
                result.append(DiffLine(text: oldLines[i], kind: .unchanged))
                i += 1
                j += 1
            } else if j < newLines.count, i >= oldLines.count || !oldLines[i...].contains(newLines[j]) {
                result.append(DiffLine(text: newLines[j], kind: .added))
                j += 1
            } else if i < oldLines.count {
                result.append(DiffLine(text: oldLines[i], kind: .removed))
                i += 1
            }
        }
        return result
    }
}
