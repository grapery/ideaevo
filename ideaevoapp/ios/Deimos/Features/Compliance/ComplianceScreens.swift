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

/// First-launch onboarding: value proposition + notification permission priming.
struct OnboardingView: View {
    var onComplete: () -> Void

    var body: some View {
        ZStack {
            AtlasColors.aiGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                // Skip button
                HStack {
                    Spacer()
                    Button("跳过") { onComplete() }
                        .font(AtlasTypography.mobileSubheadline())
                        .foregroundStyle(.white.opacity(0.8))
                        .padding(.trailing, 20)
                        .padding(.top, 8)
                }

                Spacer()

                // Illustration
                ZStack {
                    Circle()
                        .fill(.white.opacity(0.12))
                        .frame(width: 200, height: 200)
                    DeimosIconView(icon: .sparkles, size: 100, color: .white)
                }

                // Headline
                Text("GitHub for Ideas")
                    .font(.system(size: 34, weight: .heavy))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .padding(.top, 24)

                Text("和 AI Agent 一起，发现、创建、Fork、演化每一个想法")
                    .font(.system(size: 17))
                    .foregroundStyle(.white.opacity(0.9))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                    .padding(.top, 8)

                // Feature list
                VStack(alignment: .leading, spacing: 14) {
                    onboardingFeature(icon: .fork, title: "Fork 演化", desc: "每个想法可 Fork、协作、版本溯源")
                    onboardingFeature(icon: .sparkles, title: "AI 助手", desc: "与 Agent 对话，自动发现相似想法")
                    onboardingFeature(icon: .flower, title: "送花互动", desc: "给喜欢的想法送花、评论、协作")
                }
                .padding(.horizontal, 32)
                .padding(.top, 32)

                Spacer()

                // CTA
                VStack(spacing: 10) {
                    Button {
                        requestNotificationPermission()
                    } label: {
                        HStack(spacing: 8) {
                            DeimosIconView(icon: .bell, size: 20, color: AtlasColors.aiStart)
                            Text("开启通知，不错过新想法")
                                .font(AtlasTypography.button())
                                .foregroundStyle(AtlasColors.aiEnd)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 58)
                        .background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                        .shadow(color: AtlasMetrics.shadowFloatColor, radius: 24, y: 8)
                    }
                    .buttonStyle(.plain)

                    Text("我们会在有人 Fork、送花或评论你的想法时通知你")
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.7))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
                .padding(.bottom, 40)
            }
        }
    }

    private func onboardingFeature(icon: DeimosIcon, title: String, desc: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous)
                    .fill(.white.opacity(0.2))
                    .frame(width: 40, height: 40)
                DeimosIconView(icon: icon, size: 22, color: .white)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(AtlasTypography.subtitle())
                    .foregroundStyle(.white)
                Text(desc)
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.8))
            }
            Spacer(minLength: 0)
        }
    }

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { _, _ in
            DispatchQueue.main.async { onComplete() }
        }
    }
}

// MARK: - S24 Force Update

struct ForceUpdateView: View {
    let version: String
    var onUpdate: () -> Void

    var body: some View {
        ZStack {
            AtlasColors.aiGradient.ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()

                ZStack {
                    Circle()
                        .fill(.white.opacity(0.15))
                        .frame(width: 100, height: 100)
                    DeimosIconView(icon: .refresh, size: 44, color: .white)
                }

                Text("发现新版本")
                    .font(AtlasTypography.titleLarge())
                    .foregroundStyle(.white)

                Text("v\(version) 带来了全新的 AI 对话体验和性能优化。请更新到最新版本后继续使用。")
                    .font(.system(size: 16))
                    .foregroundStyle(.white.opacity(0.9))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                    .lineSpacing(4)

                Spacer()

                Button {
                    onUpdate()
                } label: {
                    HStack(spacing: 8) {
                        DeimosIconView(icon: .download, size: 20, color: AtlasColors.ink)
                        Text("立即更新")
                            .font(AtlasTypography.button())
                    }
                    .foregroundStyle(AtlasColors.aiEnd)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 32)
                .padding(.bottom, 40)
            }
        }
    }
}

// MARK: - S25 Offline / No Network

struct OfflineView: View {
    var onRetry: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Spacer()

            ZStack {
                Circle()
                    .fill(AtlasColors.chipSelectedBg)
                    .frame(width: 120, height: 120)
                DeimosIconView(icon: .wifiOff, size: 48, color: AtlasColors.ink)
            }

            Text("无法连接网络")
                .font(AtlasTypography.titleMedium())
                .foregroundStyle(AtlasColors.ink)

            Text("请检查你的网络连接。我们会在网络恢复后自动重试。")
                .font(.system(size: 15))
                .foregroundStyle(AtlasColors.inkSoft)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 48)

            Spacer()

            Button {
                onRetry()
            } label: {
                HStack(spacing: 8) {
                    DeimosIconView(icon: .refresh, size: 16, color: AtlasColors.ink)
                    Text("重试")
                        .font(AtlasTypography.subtitle())
                }
                .foregroundStyle(.white)
                .frame(width: 200, height: 52)
                .background(AtlasColors.primary)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.bottom, 60)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AtlasColors.canvas)
    }
}

// MARK: - S26 About / Compliance

struct AboutView: View {
    @Environment(\.dismiss) private var dismiss
    var onPrivacyPolicy: () -> Void
    var onTerms: () -> Void
    var onCommunity: () -> Void
    var onReport: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                // Logo / version card
                VStack(spacing: 8) {
                    ZStack {
                        RoundedRectangle(cornerRadius: AtlasMetrics.radiusCover, style: .continuous)
                            .fill(AtlasColors.aiGradient)
                            .frame(width: 72, height: 72)
                        DeimosIconView(icon: .sparkles, size: 40, color: .white)
                    }
                    Text("万叶 Deimos")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(AtlasColors.ink)
                    Text("版本 1.0.0 (1)")
                        .font(.system(size: 14))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                .frame(maxWidth: .infinity)
                .padding(24)
                .background(cardSurface)
                .overlay(cardBorder)

                // Legal menu — uses the shared AtlasSettingsGroup + NavRow pattern so it reads
                // exactly like the other settings nav groups (no leading icon chips, 56h rows).
                AtlasSettingsGroup {
                    aboutNavRow(title: "隐私政策", subtitle: "数据收集、保留与删除规则", action: onPrivacyPolicy)
                    AtlasSettingsGroupDivider()
                    aboutNavRow(title: "用户协议", subtitle: "使用规则与内容责任", action: onTerms)
                    AtlasSettingsGroupDivider()
                    aboutNavRow(title: "社区准则", subtitle: "社区行为规范", action: onCommunity)
                    AtlasSettingsGroupDivider()
                    aboutNavRow(title: "投诉举报", subtitle: "举报不当内容或行为", action: onReport)
                }

                // ICP compliance card
                VStack(alignment: .leading, spacing: 8) {
                    Text("备案信息")
                        .font(AtlasTypography.badge())
                        .foregroundStyle(AtlasColors.inkSoft)
                    icpRow(label: "ICP 备案号", value: "京ICP备2026000001号")
                    icpRow(label: "软件著作权", value: "2026SR000001")
                    icpRow(label: "运营公司", value: "北京万叶科技有限公司")
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(cardSurface)
                .overlay(cardBorder)

                // Footer
                VStack(spacing: 4) {
                    Text("Copyright 2026 北京万叶科技有限公司")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkFaint)
                    Text("support@wanye.app")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.primary)
                }
                .padding(.top, 8)
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        // float-liquid glass overlay — matches Settings main + sub-screens.
        .safeAreaInset(edge: .top, spacing: 0) {
            AtlasOverlayPushNavBar(title: "关于万叶", onBack: { dismiss() })
        }
        .navigationBarHidden(true)
        .suppressTabBar()
    }

    /// Standard settings nav row wrapper (replaces the old icon-chip `aboutRow`).
    private func aboutNavRow(title: String, subtitle: String, action: @escaping () -> Void) -> some View {
        Button {
            action()
        } label: {
            AtlasSettingsNavRow(title: title, subtitle: subtitle) {
                DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
            }
        }
        .buttonStyle(.plain)
    }

    private func icpRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 13))
                .foregroundStyle(AtlasColors.inkSoft)
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(AtlasColors.ink)
        }
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

// MARK: - S27 Rate App Sheet

struct RateAppSheet: View {
    @Binding var isPresented: Bool
    @State private var rating = 4

    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                    .fill(AtlasColors.aiGradient)
                    .frame(width: 64, height: 64)
                DeimosIconView(icon: .sparkles, size: 36, color: .white)
            }

            Text("喜欢万叶吗？")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(AtlasColors.ink)

            Text("你的评分是对我们最大的鼓励")
                .font(.system(size: 15))
                .foregroundStyle(AtlasColors.inkSoft)

            // Stars
            HStack(spacing: 10) {
                ForEach(1...5, id: \.self) { star in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { rating = star }
                    } label: {
                        DeimosIconView(icon: .star, size: 32, color: star <= rating ? AtlasColors.accentWarning : AtlasColors.rule)
                    }
                    .buttonStyle(.plain)
                }
            }

            Button {
                if let url = URL(string: "https://apps.apple.com/app/idXXXXXXXXX") {
                    UIApplication.shared.open(url)
                }
                isPresented = false
            } label: {
                Text("前往 App Store 评分")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(AtlasColors.primary)
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
            }
            .buttonStyle(.plain)

            Button("稍后再说") { isPresented = false }
                .font(.system(size: 15))
                .foregroundStyle(AtlasColors.inkFaint)
        }
        .padding(28)
        .frame(maxWidth: 360)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCover, style: .continuous))
    }
}

// MARK: - S28 Maintenance

struct MaintenanceView: View {
    var body: some View {
        ZStack {
            AtlasColors.primaryGradient.ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()

                ZStack {
                    Circle()
                        .fill(.white.opacity(0.15))
                        .frame(width: 100, height: 100)
                    DeimosIconView(icon: .wrench, size: 44, color: .white)
                }

                Text("系统维护中")
                    .font(AtlasTypography.titleLarge())
                    .foregroundStyle(.white)

                Text("万叶正在进行升级维护，很快就会回来。感谢你的耐心等待！")
                    .font(.system(size: 16))
                    .foregroundStyle(.white.opacity(0.9))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)

                HStack(spacing: 6) {
                    DeimosIconView(icon: .clock, size: 14, color: .white)
                    Text("预计 30 分钟内恢复")
                        .font(AtlasTypography.caption())
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(.white.opacity(0.2))
                .clipShape(Capsule())

                Spacer()
            }
        }
    }
}
