import SwiftUI

/// 版本历史 · 演进动态 —— 二合一屏（顶部分段切换）。
///
/// 设计语言：
/// - 版本 tab：卡片列表（List + swipeActions），左滑「与当前对比」、右滑「查看快照」；
///   版本徽章列（当前 = 墨黑实心，历史 = 灰底）承担时间线锚点。
/// - 动态 tab：点线时间轴，事件按类型语义着色（version 蓝 / status 橙 / job 绿红）。
/// - 字阶刻意收细：eyebrow 10 Semibold / 标题 15 Semibold / 正文 13 / meta 11 tabular。
struct VersionHistoryView: View {
    let ideaID: String
    /// 当前版本 id（用于默认对比基准）；详情页传入。
    var currentVersionID: String?

    @Environment(\.dismiss) private var dismiss
    @State private var tab: Tab = .versions
    @State private var versions: [IdeaVersionSummary] = []
    @State private var changelog: [ChangelogEntry] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var compareRoute: VersionCompareRoute?

    enum Tab { case versions, changelog }

    var body: some View {
        VStack(spacing: 0) {
            navBar
            segmented
            content
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .navigationDestination(item: $compareRoute) { route in
            VersionCompareView(
                ideaID: route.ideaID,
                versionID: route.versionID,
                compareVersionID: route.compareVersionID
            )
        }
        .task { await load() }
    }

    // MARK: - 顶部

    private var navBar: some View {
        HStack(spacing: 12) {
            Button { dismiss() } label: {
                DeimosIconView(icon: .chevronBack, size: 18, color: AtlasColors.ink)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(AtlasColors.surfaceSecondary))
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("返回")

            VStack(alignment: .leading, spacing: 1) {
                Text("版本历史")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                Text("共 \(versions.count) 个版本 · \(changelog.count) 条演进动态")
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkFaint)
                    .monospacedDigit()
            }
            Spacer()
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.top, 8)
        .padding(.bottom, 10)
    }

    private var segmented: some View {
        HStack(spacing: 6) {
            segmentButton("版本", tab == .versions) { tab = .versions }
            segmentButton("演进动态", tab == .changelog) { tab = .changelog }
        }
        .padding(4)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(AtlasColors.settingsGroupFill))
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.bottom, 12)
    }

    private func segmentButton(_ title: String, _ isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: isSelected ? .semibold : .medium))
                .foregroundStyle(isSelected ? AtlasColors.lemonInk : AtlasColors.inkTertiary)
                .frame(maxWidth: .infinity)
                .frame(height: 32)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(isSelected ? AtlasColors.lemon : .clear)
                )
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var content: some View {
        if isLoading {
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let errorMessage {
            AtlasDesignedEmptyStates.loadFailed(message: errorMessage) {
                Task { await load() }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            switch tab {
            case .versions: versionsList
            case .changelog: changelogTimeline
            }
        }
    }

    // MARK: - 版本卡片列表（左滑对比 / 右滑快照）

    @ViewBuilder
    private var versionsList: some View {
        if versions.isEmpty {
            AtlasDesignedEmptyState(
                icon: .document,
                title: "还没有版本",
                subtitle: "发布第一个版本后，这里会记录每次演进"
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
        List {
            ForEach(versions) { version in
                VersionCard(version: version)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button {
                            compareRoute = VersionCompareRoute(
                                ideaID: ideaID,
                                versionID: version.id,
                                compareVersionID: baselineID(for: version)
                            )
                        } label: {
                            Label("对比", systemImage: "arrow.left.arrow.right")
                        }
                        .tint(AtlasColors.linkBlue)
                    }
                    .swipeActions(edge: .leading, allowsFullSwipe: false) {
                        Button {
                            compareRoute = VersionCompareRoute(
                                ideaID: ideaID,
                                versionID: version.id,
                                compareVersionID: nil
                            )
                        } label: {
                            Label("快照", systemImage: "doc.text")
                        }
                        .tint(AtlasColors.inkTertiary)
                    }
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 5, leading: AtlasMetrics.pageX, bottom: 5, trailing: AtlasMetrics.pageX))
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        }
    }

    /// 对比基准：优先当前版本；对比当前版本自身时用它的上一版。
    private func baselineID(for version: IdeaVersionSummary) -> String? {
        if version.isCurrent {
            guard let idx = versions.firstIndex(where: { $0.id == version.id }), idx + 1 < versions.count else {
                return nil
            }
            return versions[idx + 1].id
        }
        return currentVersionID ?? versions.first(where: \.isCurrent)?.id
    }

    // MARK: - 演进动态时间线

    private var changelogTimeline: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if changelog.isEmpty {
                    AtlasDesignedEmptyState(
                        icon: .activity,
                        title: "暂无演进动态",
                        subtitle: "版本发布、状态变更、建议采纳都会记录在这里"
                    )
                    .padding(.top, 60)
                } else {
                    ForEach(Array(changelog.enumerated()), id: \.element.id) { index, entry in
                        changelogRow(entry, isLast: index == changelog.count - 1)
                    }
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.top, 6)
            .padding(.bottom, 32)
        }
    }

    private func changelogRow(_ entry: ChangelogEntry, isLast: Bool) -> some View {
        HStack(alignment: .top, spacing: 12) {
            // 时间轴列：语义色圆点 + 连接线
            VStack(spacing: 0) {
                Circle()
                    .fill(changelogColor(entry.type))
                    .frame(width: 9, height: 9)
                    .overlay(Circle().stroke(AtlasColors.canvas, lineWidth: 2))
                if !isLast {
                    Rectangle()
                        .fill(AtlasColors.rule)
                        .frame(width: 1.5)
                        .frame(maxHeight: .infinity)
                }
            }
            .frame(width: 12)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(entry.title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text(typeLabel(entry.type))
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(changelogColor(entry.type))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1.5)
                        .background(Capsule().fill(changelogColor(entry.type).opacity(0.12)))
                }
                if let detail = entry.detail, !detail.isEmpty {
                    Text(detail)
                        .font(.system(size: 12.5))
                        .foregroundStyle(AtlasColors.inkTertiary)
                        .lineSpacing(3)
                }
                Text(relativeTime(entry.createdAt))
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkFaint)
                    .monospacedDigit()
            }
            .padding(.vertical, 2)
            .padding(.bottom, isLast ? 0 : 16)

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - 数据

    private func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let versionsTask = APIClient.shared.getIdeaVersions(ideaID: ideaID)
            async let changelogTask = APIClient.shared.getIdeaChangelog(ideaID: ideaID)
            versions = try await versionsTask
            changelog = (try? await changelogTask) ?? []
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - 语义映射

    private func changelogColor(_ type: String) -> Color {
        switch type {
        case "version": return AtlasColors.linkBlue
        case "status": return AtlasColors.brandOrange
        case "suggestion_selected", "fork": return AtlasColors.linkBlue
        case "job_done": return AtlasColors.success
        case "job_failed": return AtlasColors.destructive
        default: return AtlasColors.inkTertiary
        }
    }

    private func typeLabel(_ type: String) -> String {
        switch type {
        case "version": return "版本"
        case "status": return "状态"
        case "suggestion_selected": return "采纳"
        case "job_done": return "实现"
        case "job_failed": return "未成"
        case "comment": return "评论"
        case "fork": return "Fork"
        default: return "动态"
        }
    }

    private func relativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - 版本卡片（时间线锚点徽章 + 内容 + 统计行）

private struct VersionCard: View {
    let version: IdeaVersionSummary

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            versionBadge

            VStack(alignment: .leading, spacing: 5) {
                Text(version.changelog.isEmpty ? "第 \(version.version) 个版本" : version.changelog)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(2)
                    .lineSpacing(3)

                Text(relativeTime(version.createdAt))
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkFaint)
                    .monospacedDigit()

                HStack(spacing: 12) {
                    miniStat(icon: .fork, count: version.stats.forkCount)
                    miniStat(icon: .comment, count: version.stats.commentCount)
                    miniStat(icon: .flower, count: version.stats.flowerCount)
                }
                .padding(.top, 2)
            }

            Spacer(minLength: 0)

            DeimosIconView(icon: .chevronRight, size: 12, color: AtlasColors.inkFaint)
                .padding(.top, 4)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(version.isCurrent ? AtlasColors.ink.opacity(0.75) : AtlasColors.cardStroke, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    /// 版本徽章：当前版 = 墨黑实心白字；历史版 = 灰底墨字。承担时间线锚点。
    private var versionBadge: some View {
        VStack(spacing: 3) {
            Text("v\(version.version)")
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundStyle(version.isCurrent ? AtlasColors.lemonInk : AtlasColors.ink)
                .frame(width: 40, height: 40)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(version.isCurrent ? AtlasColors.action : AtlasColors.surfaceSecondary)
                )
            if version.isCurrent {
                Text("当前")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(AtlasColors.success)
            }
        }
    }

    private func miniStat(icon: DeimosIcon, count: Int) -> some View {
        HStack(spacing: 3) {
            DeimosIconView(icon: icon, size: 10, color: AtlasColors.inkFaint)
            Text("\(count)")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(AtlasColors.inkFaint)
                .monospacedDigit()
        }
    }

    private func relativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
