import SwiftUI
import UserNotifications

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

// MARK: - S21 Onboarding


// MARK: - S24 Force Update


// MARK: - S25 Offline / No Network


// MARK: - S26 About / Compliance

/// 关于火卫二 (entry row on S06 我的): version info + legal rows in the board's
/// group language.
struct AboutView: View {
    @Environment(\.dismiss) private var dismiss
    var onPrivacyPolicy: () -> Void
    var onTerms: () -> Void
    var onCommunity: () -> Void
    var onReport: () -> Void

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "v\(version) (\(build))"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                AtlasSubPageNavBar(title: "关于火卫二", onBack: { dismiss() })

                VStack(spacing: 8) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .fill(AtlasColors.lemon)
                            .frame(width: 64, height: 64)
                        DeimosIconView(icon: .sparkles, size: 30, color: AtlasColors.lemonInk)
                    }
                    Text("火卫二 Deimos")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(AtlasColors.ink)
                    Text(appVersion)
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 12)

                AtlasFormGroupLabel(text: "法律与社区")
                AtlasFormGroupCard {
                    legalRow("隐私政策", action: onPrivacyPolicy)
                    legalRow("用户协议", action: onTerms)
                    legalRow("社区准则", action: onCommunity)
                    legalRow("投诉举报", action: onReport)
                }

                AtlasFormGroupLabel(text: "备案信息")
                AtlasFormGroupCard {
                    AtlasFormGroupRow(label: "ICP 备案号") {
                        AtlasFormGroupValue(text: "京ICP备2026000001号")
                    }
                    AtlasFormGroupRow(label: "运营公司") {
                        AtlasFormGroupValue(text: "北京万叶科技有限公司")
                    }
                }

                Text("Copyright 2026 北京万叶科技有限公司")
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkFaint)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
    }

    private func legalRow(_ title: String, action: @escaping () -> Void) -> some View {
        Button {
            action()
        } label: {
            AtlasFormGroupRow(label: title) {
                AtlasRowChevron()
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - S22 Privacy Policy (full in-app)

struct PrivacyPolicyView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // Header summary card
                AtlasSettingsSubSummaryCard(
                    title: "万叶隐私政策",
                    message: "最后更新：2026 年 6 月 28 日"
                )

                privacySection(title: "一、我们收集哪些信息",
                    body: "当您注册账号时，我们会收集您的邮箱地址和昵称。如果您使用 Apple/Google/微信登录，我们会接收 OAuth 提供商返回的唯一标识符。您发布的想法、评论和聊天消息内容将被存储用于服务运行。")

                privacySection(title: "二、我们如何使用信息",
                    body: "提供想法市场核心功能、语义搜索（使用向量化嵌入）、AI 对话及通知推送。我们不会出售您的个人信息给第三方。")

                privacySection(title: "三、您的权利",
                    body: "根据《个人信息保护法》及 GDPR/CCPA，您有权访问、更正、导出和删除您的个人数据。您可以在「设置 > 账号与安全」中操作，或联系 privacy@wanye.app。")

                privacySection(title: "四、数据安全",
                    body: "我们使用行业标准的安全措施保护您的数据，包括传输层加密（TLS）和安全存储。API Key 使用哈希存储，不以明文形式保存。")

                privacySection(title: "五、未成年人保护",
                    body: "本服务面向 16 岁及以上用户。我们不会有意收集未成年人的个人信息。")

                privacySection(title: "六、联系我们",
                    body: "如有任何隐私相关问题，请联系：privacy@wanye.app")
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        // float-liquid glass overlay — matches Settings main + sub-screens.
        .safeAreaInset(edge: .top, spacing: 0) {
            AtlasOverlayPushNavBar(title: "隐私政策", onBack: { dismiss() })
        }
        .navigationBarHidden(true)
        .suppressTabBar()
    }

    private func privacySection(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(AtlasTypography.mobileSubheadline().weight(.bold))
                .foregroundStyle(AtlasColors.ink)
            Text(body)
                .font(AtlasTypography.bodyMedium())
                .foregroundStyle(AtlasColors.inkSoft)
                .lineSpacing(5)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(cardSurface)
        .overlay(cardBorder)
    }
}


// MARK: - S28 Maintenance

