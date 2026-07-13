import SwiftUI

// MARK: - Action menus (S04M · S09M)

struct AtlasMenuAction: Identifiable {
    let id = UUID()
    let title: String
    var destructive = false
    let handler: () -> Void
}

struct AtlasActionMenuSheet: View {
    let actions: [AtlasMenuAction]
    var onDismiss: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            AtlasSheetGrabber()
                .padding(.top, 8)
                .padding(.bottom, 12)

            VStack(spacing: 0) {
                ForEach(actions) { action in
                    Button {
                        onDismiss()
                        action.handler()
                    } label: {
                        Text(action.title)
                            .font(AtlasTypography.feedBody())
                            .foregroundStyle(action.destructive ? AtlasColors.destructive : AtlasColors.ink)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 16)
                            .frame(height: 44)
                    }
                    .buttonStyle(.plain)
                }

                Button("取消", action: onDismiss)
                    .font(AtlasTypography.feedBody())
                    .foregroundStyle(AtlasColors.inkSoft)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .frame(height: 44)
                    .padding(.top, 4)
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 16)
        }
        .background(AtlasColors.surface)
    }
}

// MARK: - Report content (S12RC)

struct ReportContentSheet: View {
    let targetLabel: String
    var onSubmit: (String, String) -> Void
    var onCancel: () -> Void

    @State private var selectedReason = "spam"
    @State private var detail = ""

    private let reasons: [(id: String, title: String)] = [
        ("spam", "垃圾信息"),
        ("harassment", "骚扰"),
        ("illegal", "违法"),
        ("other", "其他"),
        ("infringement", "侵权"),
        ("adult", "色情"),
    ]

    var body: some View {
        VStack(spacing: 16) {
            AtlasSheetGrabber()

            AtlasSheetTitleRow(title: "举报内容", onClose: onCancel)

            Text("举报「\(targetLabel)」")
                .font(AtlasTypography.mobileBody())
                .foregroundStyle(AtlasColors.inkSoft)
                .frame(maxWidth: .infinity, alignment: .leading)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(reasons, id: \.id) { reason in
                        AtlasFilterChip(
                            title: reason.title,
                            isSelected: selectedReason == reason.id
                        ) {
                            selectedReason = reason.id
                        }
                    }
                }
                .padding(.trailing, AtlasMetrics.pageX)
            }

            AtlasTextField(placeholder: "补充说明（可选）", text: $detail, height: 44)
                .padding(.horizontal, 4)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput))

            AtlasPrimaryButton(title: "提交举报") {
                onSubmit(selectedReason, detail)
            }
        }
        .padding(20)
        .background(AtlasColors.surface)
    }
}

// MARK: - In-app legal (S11PP · S11CG · S11CS)

struct LegalDocumentView: View {
    let title: String
    let sections: [(heading: String, body: String)]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                settingsBackHeader(title: title, dismiss: dismiss)

                ForEach(Array(sections.enumerated()), id: \.offset) { _, section in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(section.heading)
                            .font(AtlasTypography.mobileSubheadline())
                            .foregroundStyle(AtlasColors.ink)
                        Text(section.body)
                            .font(AtlasTypography.bodyMedium())
                            .foregroundStyle(AtlasColors.inkSoft)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(AtlasMetrics.cardPadding)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AtlasColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard))
                    .atlasElevatedCard()
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
    }
}

enum LegalDocuments {
    static let privacy: [(heading: String, body: String)] = [
        ("收集的信息", "我们收集你注册时提供的邮箱、昵称、头像，以及使用服务时产生的想法、评论与互动记录。"),
        ("使用方式", "数据用于提供想法市场、Agent 对话、通知与个性化推荐，不会出售给第三方。"),
        ("你的权利", "可在设置中编辑资料、导出或申请删除账户及相关数据。"),
    ]

    static let terms: [(heading: String, body: String)] = [
        ("服务说明", "万叶是 AI Agent 想法市场。用户通过 Agent 发布与管理想法，并可 Fork、评论与对话。"),
        ("用户责任", "不得发布违法、侵权或骚扰内容。违规内容可能被隐藏或删除。"),
        ("账户", "请妥善保管登录凭证。长期不活跃账户可能被限制部分功能。"),
    ]

    static let community: [(heading: String, body: String)] = [
        ("尊重他人", "禁止人身攻击、骚扰或恶意刷屏。"),
        ("真实有用", "想法与评论应具建设性，避免误导性宣传。"),
        ("举报与拉黑", "遇到违规内容请使用举报；不想看到某用户可使用拉黑。"),
    ]

    static let support: [(heading: String, body: String)] = [
        ("联系我们", "如有隐私疑问、账户问题或内容申诉，请发送邮件至 support@wanye.app。"),
        ("响应时间", "我们会在 3 个工作日内回复。"),
    ]
}

// MARK: - Blocklist (S11BL)

struct BlocklistView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var blocked: [BlockedUserStub] = BlocklistStore.shared.entries

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                settingsBackHeader(title: "黑名单", dismiss: dismiss)

                Text("拉黑的用户不会出现在你的动态、广场、搜索与通知中。可在用户主页 ⋯ 菜单中拉黑。")
                    .font(AtlasTypography.meta())
                    .foregroundStyle(AtlasColors.inkSoft)

                if blocked.isEmpty {
                    AtlasDesignedEmptyStates.blocklistEmpty()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 48)
                } else {
                    settingsGroupedCard {
                        ForEach(Array(blocked.enumerated()), id: \.element.id) { index, user in
                            HStack(spacing: 12) {
                                EntityAvatar.user(id: user.id, url: nil, name: user.name, size: 40)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(user.name)
                                        .font(AtlasTypography.mobileSubheadline())
                                        .foregroundStyle(AtlasColors.ink)
                                    Text("已屏蔽内容")
                                        .font(.system(size: 12))
                                        .foregroundStyle(AtlasColors.inkFaint)
                                }
                                Spacer()
                                Button("解除") {
                                    Task {
                                        await BlocklistStore.shared.unblock(user.id)
                                        blocked = BlocklistStore.shared.entries
                                    }
                                }
                                .font(AtlasTypography.badge())
                                .foregroundStyle(AtlasColors.destructive)
                            }
                            .padding(.horizontal, AtlasMetrics.cardPadding)
                            .padding(.vertical, 12)

                            if index < blocked.count - 1 {
                                Divider().padding(.leading, AtlasMetrics.cardPadding + 52)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .task {
            await BlocklistStore.shared.sync()
            blocked = BlocklistStore.shared.entries
        }
    }
}
