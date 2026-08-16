import SwiftUI

// MARK: - Shared card primitives (mirror SettingsSubviews.swift so compliance screens
// use the same card language as the settings stack: solid white surface + rule border).

private var cardSurface: some View {
    RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
        .fill(AtlasColors.surface)
}
private var cardBorder: some View {
    RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
        .stroke(AtlasColors.rule, lineWidth: 1)
}

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
        ("harassment", "冒犯、骚扰或仇恨内容"),
        ("spam", "垃圾内容或误导信息"),
        ("infringement", "侵犯版权或冒用身份"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // ardot S16 (`237:466` Context 350×73): #F5F6F7 fill, cr20.
                VStack(alignment: .leading, spacing: 4) {
                    Text(targetLabel)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text("这项内容涉嫌误导或冒用他人内容。")
                        .font(.system(size: 14))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(AtlasColors.chatAssistantBubble)
                )

                // ardot S16 (`237:466` Reasons 350×141): #F6FFD0 fill, cr20.
                VStack(alignment: .leading, spacing: 8) {
                    Text("选择原因")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    ForEach(reasons, id: \.id) { reason in
                        Button { selectedReason = reason.id } label: {
                            HStack(spacing: 10) {
                                ZStack {
                                    Circle()
                                        .stroke(
                                            selectedReason == reason.id ? AtlasColors.ink : AtlasColors.inkSoft.opacity(0.55),
                                            lineWidth: 1.25
                                        )
                                    if selectedReason == reason.id {
                                        Circle()
                                            .fill(AtlasColors.ink)
                                            .padding(4)
                                    }
                                }
                                .frame(width: 18, height: 18)

                                Text(reason.title)
                                    .font(.system(size: 15))
                                    .foregroundStyle(AtlasColors.ink)
                                Spacer()
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 4)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(AtlasColors.noticeSoft)
                )

                AtlasPrimaryButton(title: "提交举报") {
                    onSubmit(selectedReason, detail)
                }
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 16)
            .padding(.bottom, 40)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            // ardot S16 (`237:466` C/Push Nav Bar): floating glass overlay toolbar.
            AtlasOverlayPushNavBar(title: "举报内容", onBack: onCancel)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
    }
}

struct BlockUserSheet: View {
    let userID: String
    let name: String
    var avatarURL: URL? = nil
    var onConfirm: () -> Void
    var onCancel: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // ardot S17 (`237:479` User Card 350×88): #FBFCFD fill, stroke #E8EBF0, cr20.
                HStack(spacing: 12) {
                    EntityAvatar.user(id: userID, url: avatarURL, name: name, size: 48)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(name)
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(AtlasColors.ink)
                        Text("屏蔽后不会再看到对方评论、私信或关注动态。")
                            .font(.system(size: 13))
                            .foregroundStyle(AtlasColors.inkSoft)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(hex: 0xFBFCFD))
                .overlay(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .stroke(AtlasColors.settingsRowStroke, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))

                // ardot S17 (`237:479` Info 350×74): #FFF7E8 fill, cr20.
                VStack(alignment: .leading, spacing: 8) {
                    Text("隐藏此用户的内容")
                    Text("同时提交至审核队列")
                }
                .font(.system(size: 14))
                .foregroundStyle(AtlasColors.ink)
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(AtlasColors.infoWarm)
                )

                // ardot S17 (`237:479` C/Primary Button 342×52): #E5484D destructive fill,
                // white text. Matches the destructive action color across all moderation flows.
                Button(action: onConfirm) {
                    Text("确认拉黑")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(AtlasColors.destructiveFill)
                        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 16)
            .padding(.bottom, 40)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            // ardot S17 (`237:479` C/Push Nav Bar): floating glass overlay toolbar.
            AtlasOverlayPushNavBar(title: "拉黑用户", onBack: onCancel)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
    }
}

// MARK: - In-app legal (S11PP · S11CG · S11CS)

struct LegalDocumentView: View {
    let title: String
    let sections: [(heading: String, body: String)]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
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
                    .background(cardSurface)
                    .overlay(cardBorder)
                }
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: title, dismiss: dismiss)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
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
            VStack(alignment: .leading, spacing: 14) {
                AtlasSubPageNavBar(title: "黑名单管理", onBack: { dismiss() })

                // S29 Summary Card — surfaceSecondary r20, 15 SemiBold title + 13 inkTertiary.
                VStack(alignment: .leading, spacing: 6) {
                    Text("黑名单管理")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text("被拉黑的用户无法评论你的想法、私信或关注你。")
                        .font(.system(size: 13))
                        .foregroundStyle(AtlasColors.inkTertiary)
                        .lineSpacing(6)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(AtlasColors.settingsGroupFill)
                )

                if blocked.isEmpty {
                    AtlasDesignedEmptyStates.blocklistEmpty()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 48)
                } else {
                    // S29 Blocked Row — 44pt avatar, 14 SemiBold name, 11 inkSoft meta,
                    // lemonSoft r16 解除 pill (olive SemiBold-12).
                    ForEach(blocked) { user in
                        HStack(spacing: 10) {
                            EntityAvatar.user(id: user.id, url: nil, name: user.name, size: 44)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(user.name)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(AtlasColors.ink)
                                    .lineLimit(1)
                                Text("已屏蔽其内容与互动")
                                    .font(.system(size: 11))
                                    .foregroundStyle(AtlasColors.inkSoft)
                            }
                            Spacer(minLength: 0)
                            Button {
                                Task {
                                    await BlocklistStore.shared.unblock(user.id)
                                    blocked = BlocklistStore.shared.entries
                                }
                            } label: {
                                Text("解除")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(AtlasColors.olive)
                                    .frame(width: 72, height: 32)
                                    .background(
                                        Capsule(style: .continuous)
                                            .fill(AtlasColors.lemonSoft)
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                        .frame(minHeight: 44)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
        .task {
            await BlocklistStore.shared.sync()
            blocked = BlocklistStore.shared.entries
        }
    }
}
