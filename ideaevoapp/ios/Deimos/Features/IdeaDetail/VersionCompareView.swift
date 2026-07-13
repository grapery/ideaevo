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
                    VStack(alignment: .leading, spacing: 14) {
                        // Compare picker — lemon-soft card r16 (Ardot 189:102)
                        if let compare = viewModel.compare {
                            comparePickerCard(compare, primary)

                            // Description diff — grey card r16 (Ardot 189:104)
                            descriptionDiffCard(from: compare.description, to: primary.description)

                            // Stats delta — white card + border r16 (Ardot 189:163)
                            statsDeltaCard(compare, primary)
                        } else {
                            versionCard(primary)
                        }
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
        .task {
            await viewModel.load(ideaID: ideaID, versionID: versionID, compareVersionID: compareVersionID)
        }
    }

    // MARK: - S31 Compare picker card (lemon-soft, r16, itemSpacing=6)

    /// Version toggle: v{old} → v{new} with tap to switch (Ardot 189:102).
    private func comparePickerCard(_ compare: IdeaVersionDetail, _ primary: IdeaVersionDetail) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("选择对比版本")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AtlasColors.olive)
            HStack(spacing: 8) {
                versionToggleChip("v\(compare.version)", isSelected: !viewModel.showingPrimary) {
                    viewModel.showingPrimary = false
                }
                Text("→")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(AtlasColors.olive)
                versionToggleChip("v\(primary.version) 当前", isSelected: viewModel.showingPrimary) {
                    viewModel.showingPrimary = true
                }
            }
            Text(viewModel.diffSummary)
                .font(.system(size: 13))
                .foregroundStyle(AtlasColors.olive)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(AtlasColors.lemonSoft)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func versionToggleChip(_ title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: isSelected ? .bold : .medium))
                .foregroundStyle(isSelected ? AtlasColors.lemonInk : AtlasColors.olive)
                .padding(.horizontal, 12)
                .frame(height: 32)
                .background(isSelected ? Color.white : Color.clear)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: - S31 Description diff card (#F8FAFC, r16, itemSpacing=8)

    /// Line-by-line diff in a grey card (Ardot 189:104).
    private func descriptionDiffCard(from old: String, to new: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("描述 Diff")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AtlasColors.inkTertiary)

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
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color(hex: 0xF8FAFC))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - S31 Stats delta card (white + border, r16)

    /// Description length delta between versions (Ardot 189:163).
    private func statsDeltaCard(_ compare: IdeaVersionDetail, _ primary: IdeaVersionDetail) -> some View {
        let oldLen = compare.description.count
        let newLen = primary.description.count
        let charDelta = newLen - oldLen
        let changelogDelta = primary.changelog.isEmpty ? "无" : primary.changelog
        return VStack(alignment: .leading, spacing: 10) {
            Text("版本变化摘要")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AtlasColors.inkTertiary)

            HStack(spacing: 16) {
                statDeltaItem("字数", charDelta)
                statDeltaItem("版本", primary.version - compare.version)
            }

            Text("变更说明：\(changelogDelta)")
                .font(.system(size: 13))
                .foregroundStyle(AtlasColors.inkSoft)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(AtlasColors.surface)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func statDeltaItem(_ label: String, _ delta: Int) -> some View {
        let sign = delta >= 0 ? "+" : ""
        return VStack(spacing: 2) {
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(AtlasColors.inkFaint)
            Text("\(sign)\(delta)")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(delta >= 0 ? AtlasColors.lemonStrong : AtlasColors.destructive)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - S30 Version snapshot card (#F8FAFC r16, itemSpacing=8) (Ardot 189:94)

    /// Single version detail: title / changelog / description snapshot in a grey card.
    private func versionCard(_ version: IdeaVersionDetail) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("标题：\(version.title)")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
            Text("Changelog：\(version.changelog.isEmpty ? "无" : version.changelog)")
                .font(.system(size: 15))
                .foregroundStyle(AtlasColors.inkSoft)
            MarkdownBody(markdown: version.description)
                .font(.system(size: 15))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color(hex: 0xF8FAFC))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
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
