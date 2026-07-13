import SwiftUI

// MARK: - Designed empty & loading states (S12 Row 5)

enum AtlasDesignedEmptyStates {
    static func searchNoResults(onBrowseAgents: (() -> Void)? = nil) -> AtlasDesignedEmptyState {
        AtlasDesignedEmptyState(
            icon: .search,
            title: "没有找到相关结果",
            subtitle: "试试其他关键词或浏览 Agent",
            ctaTitle: onBrowseAgents == nil ? nil : "浏览 Agent",
            ctaAction: onBrowseAgents
        )
    }

    static func plazaEmpty(onPublish: @escaping () -> Void) -> AtlasDesignedEmptyState {
        AtlasDesignedEmptyState(
            icon: .document,
            title: "广场还没有想法",
            subtitle: "成为第一个发布创意的人",
            ctaTitle: "发布想法",
            ctaAction: onPublish
        )
    }

    static func followingEmpty(onExplore: @escaping () -> Void) -> AtlasDesignedEmptyState {
        AtlasDesignedEmptyState(
            icon: .users,
            iconTint: AtlasColors.entityUser.opacity(0.55),
            title: "还没有关注任何人",
            subtitle: "去发现有趣的创作者",
            ctaTitle: "去发现",
            ctaAction: onExplore
        )
    }

    static func notificationsEmpty() -> AtlasDesignedEmptyState {
        AtlasDesignedEmptyState(
            icon: .bell,
            title: "暂无通知",
            subtitle: "有人关注、Fork、送花或回复时会出现在这里"
        )
    }

    static func myAgentsEmpty(onCreate: @escaping () -> Void) -> AtlasDesignedEmptyState {
        AtlasDesignedEmptyState(
            icon: .sparkles,
            iconTint: AtlasColors.entityAgent.opacity(0.55),
            title: "还没有 Agent",
            subtitle: "创建你的第一个 AI 助手",
            ctaTitle: "创建 Agent",
            ctaAction: onCreate
        )
    }

    static func chatEmpty(onStart: @escaping () -> Void) -> AtlasDesignedEmptyState {
        AtlasDesignedEmptyState(
            icon: .chat,
            iconTint: AtlasColors.entityAgent.opacity(0.55),
            title: "还没有对话",
            subtitle: "与 Agent 或万叶助手开始聊天",
            ctaTitle: "开始聊天",
            ctaAction: onStart
        )
    }

    static func commentsEmpty() -> AtlasDesignedEmptyState {
        AtlasDesignedEmptyState(
            icon: .comment,
            title: "暂无评论",
            subtitle: "成为第一个发表看法的人"
        )
    }

    static func activityEmpty() -> AtlasDesignedEmptyState {
        AtlasDesignedEmptyState(
            icon: .activity,
            title: "暂无匹配动态",
            subtitle: "全站还没有新的公开动态"
        )
    }

    static func followingLogin(onLogin: @escaping () -> Void) -> AtlasDesignedEmptyState {
        AtlasDesignedEmptyState(
            icon: .users,
            iconTint: AtlasColors.entityUser.opacity(0.55),
            title: "登录后查看关注动态",
            subtitle: "关注创作者与 Agent 的最新动态",
            ctaTitle: "登录",
            ctaAction: onLogin
        )
    }

    static func agentExploreEmpty() -> AtlasDesignedEmptyState {
        AtlasDesignedEmptyState(
            icon: .sparkles,
            iconTint: AtlasColors.entityAgent.opacity(0.55),
            title: "没有匹配的 Agent",
            subtitle: "换个关键词或分类试试"
        )
    }

    static func notificationsCategoryEmpty() -> AtlasDesignedEmptyState {
        AtlasDesignedEmptyState(
            icon: .bell,
            title: "该分类暂无通知",
            subtitle: "试试切换其他分类"
        )
    }

    static func searchIdle() -> AtlasDesignedEmptyState {
        AtlasDesignedEmptyState(
            icon: .search,
            title: "搜索想法与 Agent",
            subtitle: "输入关键词，发现更多灵感"
        )
    }

    static func chatSearchEmpty(onClear: @escaping () -> Void) -> AtlasDesignedEmptyState {
        AtlasDesignedEmptyState(
            icon: .search,
            title: "无匹配会话",
            subtitle: "换个关键词试试",
            ctaTitle: "清空搜索",
            ctaAction: onClear
        )
    }

    static func listEmpty(title: String, subtitle: String, icon: DeimosIcon = .users) -> AtlasDesignedEmptyState {
        AtlasDesignedEmptyState(icon: icon, title: title, subtitle: subtitle)
    }

    static func loadFailed(message: String, onRetry: @escaping () -> Void) -> AtlasDesignedErrorState {
        AtlasDesignedErrorState(
            title: "暂时无法加载",
            message: message,
            onRetry: onRetry
        )
    }

    static func blocklistEmpty() -> AtlasDesignedEmptyState {
        AtlasDesignedEmptyState(
            icon: .shield,
            title: "暂无拉黑用户",
            subtitle: "遇到骚扰可在用户主页使用举报或拉黑"
        )
    }
}

struct AtlasDesignedErrorState: View {
    var icon: DeimosIcon = .wifiOff
    var iconTint: Color = AtlasColors.accentWarningSoft
    let title: String
    let message: String
    var retryTitle: String = "重试"
    let onRetry: () -> Void
    var secondaryTitle: String?
    var secondaryAction: (() -> Void)?

    var body: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(AtlasColors.lemonSoft)
                    .frame(width: 64, height: 64)
                DeimosIconView(icon: icon, size: 28, color: AtlasColors.olive)
            }

            VStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                Text(message)
                    .font(.system(size: 14))
                    .foregroundStyle(AtlasColors.inkSoft)
                    .multilineTextAlignment(.center)
            }

            AtlasOutlineButton(title: retryTitle, action: onRetry)
                .padding(.horizontal, 32)
                .padding(.top, 4)

            if let secondaryTitle, let secondaryAction {
                Button(action: secondaryAction) {
                    Text(secondaryTitle)
                        .font(AtlasTypography.pill())
                        .foregroundStyle(AtlasColors.ink)
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }
}

struct AtlasDesignedEmptyState: View {
    let icon: DeimosIcon
    var iconTint: Color = AtlasColors.fill
    let title: String
    let subtitle: String
    var ctaTitle: String?
    var ctaAction: (() -> Void)?

    var body: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(AtlasColors.lemonSoft)
                    .frame(width: 64, height: 64)
                DeimosIconView(icon: icon, size: 28, color: AtlasColors.olive)
            }

            VStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                Text(subtitle)
                    .font(.system(size: 14))
                    .foregroundStyle(AtlasColors.inkSoft)
                    .multilineTextAlignment(.center)
            }

            if let ctaTitle, let ctaAction {
                AtlasPrimaryButton(title: ctaTitle, action: ctaAction)
                    .padding(.horizontal, 32)
                    .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }
}

/// Loading Skeleton Card — per ardot component 195:129.
/// Card: white + border r24, padding=16, itemSpacing=10.
/// Contains: 132h r24 grey block + two text lines (r8).
struct HomeFeedLoadingSkeleton: View {
    var body: some View {
        VStack(spacing: 16) {
            ForEach(0..<2, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 10) {
                    // Skeleton block — 132h r24
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(Color(hex: 0xF0F2F5))
                        .frame(height: 132)

                    // Skeleton line 1 — 200×16 r8
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color(hex: 0xF0F2F5))
                        .frame(width: 200, height: 16)

                    // Skeleton line 2 — full width 14h r8
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color(hex: 0xF0F2F5))
                        .frame(height: 14)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AtlasColors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .stroke(AtlasColors.border, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            }
        }
    }
}

struct ChatThreadLoadingSkeleton: View {
    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Spacer(minLength: 80)
                RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                    .fill(AtlasColors.ink.opacity(0.85))
                    .frame(width: 200, height: 44)
            }
            HStack {
                RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                    .fill(AtlasColors.surface)
                    .frame(width: 240, height: 68)
                    .overlay(
                        RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                            .stroke(AtlasColors.rule, lineWidth: 1)
                    )
                Spacer(minLength: 48)
            }
            HStack {
                Spacer(minLength: 80)
                RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                    .fill(AtlasColors.ink.opacity(0.85))
                    .frame(width: 160, height: 44)
            }
        }
        .padding(.vertical, 8)
    }
}

@MainActor
enum BlocklistFiltering {
    static func idea(_ idea: Idea) -> Bool {
        !BlocklistStore.shared.isBlockedOwner(of: idea)
    }

    static func activity(_ activity: ActivityView) -> Bool {
        !BlocklistStore.shared.isBlocked(activity.actorID)
    }

    static func notification(_ item: AppNotification) -> Bool {
        if item.actorType == "user" {
            return !BlocklistStore.shared.isBlocked(item.actorID)
        }
        return true
    }

    static func chatSession(_ session: ChatSession) -> Bool {
        !BlocklistStore.shared.isBlockedSession(session)
    }

    static func agent(_ agent: Agent) -> Bool {
        guard let ownerID = agent.owner?.id ?? agent.ownerUserID else { return true }
        return !BlocklistStore.shared.isBlocked(ownerID)
    }
}

extension BlocklistStore {
    func isBlockedOwner(of idea: Idea) -> Bool {
        guard let ownerID = idea.ownerUserID else { return false }
        return isBlocked(ownerID)
    }

    func isBlockedSession(_ session: ChatSession) -> Bool {
        guard let ownerID = session.agent?.owner?.id ?? session.agent?.ownerUserID else { return false }
        return isBlocked(ownerID)
    }
}

extension Idea {
    var ownerUserID: String? {
        agent?.owner?.id ?? agent?.ownerUserID
    }
}

@MainActor
enum ModerationActions {
    static func submitReport(
        targetType: String,
        targetID: String,
        reason: String,
        detail: String
    ) async {
        do {
            try await APIClient.shared.submitReport(
                targetType: targetType,
                targetID: targetID,
                reason: reason,
                detail: detail
            )
            ToastCenter.shared.showSuccess("举报已提交")
        } catch {
            ToastCenter.shared.showError("举报失败", message: error.localizedDescription)
        }
    }

    static func blockUser(id: String, name: String) async {
        await BlocklistStore.shared.block(id: id, name: name)
        ToastCenter.shared.showSuccess("已拉黑")
    }
}