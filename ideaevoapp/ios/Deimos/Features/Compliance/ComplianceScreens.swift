import SwiftUI
import UserNotifications

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
                        .foregroundStyle(AtlasColors.olive)
                        .padding(.trailing, 20)
                        .padding(.top, 8)
                }

                Spacer()

                // Illustration
                ZStack {
                    Circle()
                        .fill(.white.opacity(0.25))
                        .frame(width: 200, height: 200)
                    DeimosIconView(icon: .sparkles, size: 100, color: AtlasColors.lemonInk)
                }

                // Headline
                Text("GitHub for Ideas")
                    .font(.system(size: 34, weight: .heavy))
                    .foregroundStyle(AtlasColors.lemonInk)
                    .multilineTextAlignment(.center)
                    .padding(.top, 24)

                Text("和 AI Agent 一起，发现、创建、Fork、演化每一个想法")
                    .font(.system(size: 17))
                    .foregroundStyle(AtlasColors.olive)
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
                            DeimosIconView(icon: .bell, size: 20, color: AtlasColors.lemonStrong)
                            Text("开启通知，不错过新想法")
                                .font(AtlasTypography.button())
                                .foregroundStyle(AtlasColors.lemonInk)
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
                        .foregroundStyle(AtlasColors.olive)
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
                    .fill(.white.opacity(0.35))
                    .frame(width: 40, height: 40)
                DeimosIconView(icon: icon, size: 22, color: AtlasColors.lemonInk)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(AtlasTypography.subtitle())
                    .foregroundStyle(AtlasColors.lemonInk)
                Text(desc)
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.olive)
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
                        .fill(.white.opacity(0.25))
                        .frame(width: 100, height: 100)
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.system(size: 44, weight: .medium))
                        .foregroundStyle(AtlasColors.lemonInk)
                }

                Text("发现新版本")
                    .font(AtlasTypography.titleLarge())
                    .foregroundStyle(AtlasColors.lemonInk)

                Text("v\(version) 带来了全新的 AI 对话体验和性能优化。请更新到最新版本后继续使用。")
                    .font(.system(size: 16))
                    .foregroundStyle(AtlasColors.olive)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                    .lineSpacing(4)

                Spacer()

                Button {
                    onUpdate()
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "arrow.down.circle.fill")
                            .font(.system(size: 20))
                        Text("立即更新")
                            .font(AtlasTypography.button())
                    }
                    .foregroundStyle(AtlasColors.lemonInk)
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
                Image(systemName: "wifi.slash")
                    .font(.system(size: 48))
                    .foregroundStyle(AtlasColors.primary)
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
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 16))
                    Text("重试")
                        .font(AtlasTypography.subtitle())
                }
                .foregroundStyle(AtlasColors.lemonInk)
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
    var onPrivacyPolicy: () -> Void
    var onTerms: () -> Void
    var onCommunity: () -> Void
    var onReport: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Logo card
                VStack(spacing: 8) {
                    ZStack {
                        RoundedRectangle(cornerRadius: AtlasMetrics.radiusCover, style: .continuous)
                            .fill(AtlasColors.aiGradient)
                            .frame(width: 72, height: 72)
                        DeimosIconView(icon: .sparkles, size: 40, color: AtlasColors.lemonInk)
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
                .background(AtlasColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                .atlasElevatedCard()

                // Legal menu
                VStack(spacing: 0) {
                    aboutRow(icon: .lock, iconColor: AtlasColors.primary, iconBg: AtlasColors.chipSelectedBg, label: "隐私政策", action: onPrivacyPolicy)
                    aboutDivider
                    aboutRow(icon: .document, iconColor: AtlasColors.aiStart, iconBg: AtlasColors.purpleSoft, label: "用户协议", action: onTerms)
                    aboutDivider
                    aboutRow(icon: .users, iconColor: AtlasColors.accentWarning, iconBg: AtlasColors.accentWarningSoft, label: "社区准则", action: onCommunity)
                    aboutDivider
                    aboutRow(icon: .info, iconColor: AtlasColors.destructive, iconBg: AtlasColors.destructive.opacity(0.08), label: "投诉举报", action: onReport)
                }
                .background(AtlasColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                .atlasElevatedCard()

                // ICP compliance
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
                .background(AtlasColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                .atlasElevatedCard()

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
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationTitle("关于万叶")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func aboutRow(icon: DeimosIcon, iconColor: Color, iconBg: Color, label: String, action: @escaping () -> Void) -> some View {
        Button {
            action()
        } label: {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(iconBg)
                        .frame(width: 30, height: 30)
                    DeimosIconView(icon: icon, size: 16, color: iconColor)
                }
                Text(label)
                    .font(.system(size: 15))
                    .foregroundStyle(AtlasColors.ink)
                Spacer()
                DeimosIconView(icon: .chevronRight, size: 16, color: AtlasColors.inkFaint)
            }
            .padding(.horizontal, 12)
            .frame(height: 50)
        }
        .buttonStyle(.plain)
    }

    private var aboutDivider: some View {
        Divider().overlay(AtlasColors.rule).padding(.leading, 52)
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
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("万叶隐私政策")
                        .font(AtlasTypography.titleMedium())
                        .foregroundStyle(AtlasColors.ink)
                    Text("最后更新：2026 年 6 月 28 日")
                        .font(.system(size: 13))
                        .foregroundStyle(AtlasColors.inkFaint)
                }

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
            .padding(.horizontal, 24)
            .padding(.vertical, 20)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.surface)
        .navigationTitle("隐私政策")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func privacySection(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
            Text(body)
                .font(.system(size: 15))
                .foregroundStyle(AtlasColors.inkSoft)
                .lineSpacing(5)
                .fixedSize(horizontal: false, vertical: true)
        }
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
                DeimosIconView(icon: .sparkles, size: 36, color: AtlasColors.lemonInk)
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
                        Image(systemName: star <= rating ? "star.fill" : "star")
                            .font(.system(size: 32))
                            .foregroundStyle(star <= rating ? AtlasColors.accentWarning : AtlasColors.rule)
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
                        .fill(.white.opacity(0.25))
                        .frame(width: 100, height: 100)
                    Image(systemName: "wrench.and.screwdriver.fill")
                        .font(.system(size: 44))
                        .foregroundStyle(AtlasColors.lemonInk)
                }

                Text("系统维护中")
                    .font(AtlasTypography.titleLarge())
                    .foregroundStyle(AtlasColors.lemonInk)

                Text("万叶正在进行升级维护，很快就会回来。感谢你的耐心等待！")
                    .font(.system(size: 16))
                    .foregroundStyle(AtlasColors.olive)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)

                HStack(spacing: 6) {
                    Image(systemName: "clock")
                        .font(.system(size: 14))
                    Text("预计 30 分钟内恢复")
                        .font(AtlasTypography.caption())
                }
                .foregroundStyle(AtlasColors.lemonInk)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(.white.opacity(0.3))
                .clipShape(Capsule())

                Spacer()
            }
        }
    }
}

// MARK: - Shared compliance styling (S14-S19)

/// Design tokens shared across S14-S19 compliance screens.
private enum ComplianceStyle {
    /// `#F8FAFC` — data row / steps card background.
    static let cardBg = Color(hex: 0xF8FAFC)
    /// `#687083` — row body grey text.
    static let greyText = Color(hex: 0x687083)
    /// `#5A6472` — card body grey text.
    static let bodyGrey = Color(hex: 0x5A6472)
    /// `#8A94A6` — row body faint grey text.
    static let faintGrey = Color(hex: 0x8A94A6)
    /// `#FFF1E8` — pink deletion-warning background.
    static let warningBg = Color(hex: 0xFFF1E8)
}

/// Builds the S14-S19 page header: back button 36×36 r18 + title 32pt Bold.
@ViewBuilder
func compliancePageHeader(title: String, dismiss: DismissAction) -> some View {
    VStack(alignment: .leading, spacing: 16) {
        AtlasNavBackButton(action: { dismiss() })
        Text(title)
            .font(.system(size: 32, weight: .bold))
            .foregroundStyle(AtlasColors.ink)
    }
}

/// Lemon-soft summary card (#F6FFC7-equivalent) r20 + border, used for S14/S15/S16/S18 highlight cards.
@ViewBuilder
func complianceLemonCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: 10) {
        content()
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
    .background(AtlasColors.lemonSoft)
    .overlay(
        RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
            .stroke(AtlasColors.border, lineWidth: 1)
    )
    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
}

/// Data row card (#F8FAFC) r20 + border, used for S14/S18 rows.
@ViewBuilder
func complianceDataCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: 6) {
        content()
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
    .background(ComplianceStyle.cardBg)
    .overlay(
        RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
            .stroke(AtlasColors.border, lineWidth: 1)
    )
    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
}

/// Lemon-strong primary action button: 350×52 r26, lemonInk 14pt SemiBold.
@ViewBuilder
func complianceLemonButton(title: String, isLoading: Bool, action: @escaping () -> Void) -> some View {
    Button(action: action) {
        HStack(spacing: 8) {
            if isLoading {
                ProgressView().tint(AtlasColors.lemonInk)
            }
            Text(title)
                .font(.system(size: 14, weight: .semibold))
        }
        .frame(maxWidth: .infinity)
        .frame(height: 52)
        .foregroundStyle(AtlasColors.lemonInk)
        .background(AtlasColors.lemonStrong)
        .clipShape(Capsule())
    }
    .buttonStyle(.plain)
}

// MARK: - S14 Privacy Center (Ardot 179:536)

/// S14 Privacy Center — "隐私与数据".
///
/// Layout per design: back + title → lemon-soft summary card → data row cards
/// (#F8FAFC) → policy links card.
struct PrivacyCenterView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                compliancePageHeader(title: "隐私与数据", dismiss: dismiss)

                // Privacy Summary Card (179:543) — lemon-soft
                complianceLemonCard {
                    Text("提交前可查看数据用途")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text("账号、搜索、聊天、用户内容会用于核心功能；可随时管理同意与删除请求。")
                        .font(.system(size: 13))
                        .foregroundStyle(ComplianceStyle.bodyGrey)
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                }

                // Data Row Account (179:546)
                complianceDataCard {
                    Text("账号资料")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text("邮箱、手机号、头像、Agent 归属")
                        .font(.system(size: 12))
                        .foregroundStyle(ComplianceStyle.greyText)
                }

                // Data Row User Content (179:549)
                complianceDataCard {
                    Text("用户内容")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text("想法、评论、聊天、搜索历史")
                        .font(.system(size: 12))
                        .foregroundStyle(ComplianceStyle.greyText)
                }

                // Privacy Links (179:552) — #F8FAFC card
                complianceDataCard {
                    Text("政策链接")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    HStack(spacing: 4) {
                        Button("隐私政策") { openURL(LegalLinks.privacyURL) }
                        Text("·").foregroundStyle(ComplianceStyle.bodyGrey)
                        Button("服务条款") { openURL(LegalLinks.termsURL) }
                        Text("·").foregroundStyle(ComplianceStyle.bodyGrey)
                        Button("数据删除") { openURL(LegalLinks.privacyURL) }
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.primary)
                }
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
    }
}

// MARK: - S15 AI Data Consent (Ardot 179:555)

/// S15 AI Data Consent — "AI 数据处理".
///
/// Layout per design: back + title → lemon-soft consent card with title 16pt SemiBold,
/// body 13pt + consent toggle (lemon-strong).
struct AIDataConsentView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage(AppPreferencesStore.Keys.aiProcessingConsent) private var consentGiven = true

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                compliancePageHeader(title: "AI 数据处理", dismiss: dismiss)

                // Consent Card (179:562) — lemon-soft
                complianceLemonCard {
                    Text("你的输入会用于生成建议")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text("万叶会把你主动提交的想法、评论和聊天内容发送到 AI 服务生成摘要、标签、Fork 建议。不会请求与功能无关的数据。")
                        .font(.system(size: 13))
                        .foregroundStyle(ComplianceStyle.bodyGrey)
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack {
                        Toggle("已同意 AI 数据处理", isOn: $consentGiven)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(AtlasColors.ink)
                            .tint(AtlasColors.lemonStrong)
                    }
                    .padding(.top, 4)
                }

                Text("关闭后，万叶将无法生成摘要、标签或 Fork 建议，但仍可创建想法。")
                    .font(.system(size: 12))
                    .foregroundStyle(ComplianceStyle.faintGrey)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
    }
}

// MARK: - S16 Report Content (Ardot 179:566)

/// S16 Report Content — "举报内容".
///
/// Layout per design: back + title → reported context card (#F8FAFC) →
/// reason list card (lemon-soft) → submit button (lemon-strong r26).
struct ReportContentView: View {
    @Environment(\.dismiss) private var dismiss

    let targetType: String
    let targetID: String
    let contextTitle: String
    let contextBody: String
    var onSubmit: (String) -> Void

    @State private var selectedReason: String
    @State private var isSubmitting = false

    private let reasons: [(id: String, title: String)] = [
        ("harassment", "冒犯、骚扰或仇恨内容"),
        ("spam", "垃圾内容或误导信息"),
        ("infringement", "侵犯版权或冒用身份"),
    ]

    init(targetType: String, targetID: String, contextTitle: String, contextBody: String, onSubmit: @escaping (String) -> Void) {
        self.targetType = targetType
        self.targetID = targetID
        self.contextTitle = contextTitle
        self.contextBody = contextBody
        self.onSubmit = onSubmit
        _selectedReason = State(initialValue: "harassment")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                compliancePageHeader(title: "举报内容", dismiss: dismiss)

                // Reported Context (179:573) — #F8FAFC card
                complianceDataCard {
                    Text(contextTitle)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text(contextBody)
                        .font(.system(size: 13))
                        .foregroundStyle(ComplianceStyle.bodyGrey)
                        .fixedSize(horizontal: false, vertical: true)
                }

                // Reason List (179:576) — lemon-soft card
                complianceLemonCard {
                    Text("选择原因")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)

                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(reasons, id: \.id) { reason in
                            Button {
                                withAnimation(.easeInOut(duration: 0.15)) {
                                    selectedReason = reason.id
                                }
                            } label: {
                                HStack(spacing: 10) {
                                    Image(systemName: selectedReason == reason.id ? "largecircle.fill.circle" : "circle")
                                        .font(.system(size: 16))
                                        .foregroundStyle(selectedReason == reason.id ? AtlasColors.lemonStrong : ComplianceStyle.faintGrey)
                                    Text(reason.title)
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundStyle(AtlasColors.ink)
                                    Spacer()
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                // Submit Report Button (179:581) — lemon-strong r26
                complianceLemonButton(title: "提交举报", isLoading: isSubmitting) {
                    Task { await submit() }
                }
                .disabled(isSubmitting)
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
    }

    private func submit() async {
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            try await APIClient.shared.submitReport(
                targetType: targetType,
                targetID: targetID,
                reason: selectedReason,
                detail: ""
            )
            ToastCenter.shared.showSuccess("举报已提交")
            onSubmit(selectedReason)
            dismiss()
        } catch {
            ToastCenter.shared.showError("提交失败", message: error.localizedDescription)
        }
    }
}

// MARK: - S17 Block User (Ardot 179:583)

/// S17 Block User — "屏蔽用户".
///
/// Layout per design: back + title → user block card (#F8FAFC, avatar + copy) →
/// safety options card (lemon-soft) → confirm button (lemon-strong r26).
struct BlockUserView: View {
    @Environment(\.dismiss) private var dismiss

    let userID: String
    let userName: String
    let userAvatarURL: String?
    var onBlocked: () -> Void

    @State private var hideContent = true
    @State private var submitToQueue = false
    @State private var preserveEvidence = true
    @State private var isBlocking = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                compliancePageHeader(title: "屏蔽用户", dismiss: dismiss)

                // User Block Card (179:590) — #F8FAFC, avatar + copy
                HStack(alignment: .top, spacing: 14) {
                    EntityAvatar.user(id: userID, url: userAvatarURL.flatMap(URL.init(string:)), name: userName, size: 54)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(userName)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(AtlasColors.ink)
                        Text("屏蔽后不会再看到对方评论、私信或关注动态。")
                            .font(.system(size: 13))
                            .foregroundStyle(ComplianceStyle.bodyGrey)
                            .lineSpacing(4)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(ComplianceStyle.cardBg)
                .overlay(
                    RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                        .stroke(AtlasColors.border, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))

                // Safety Options (179:593) — lemon-soft card
                complianceLemonCard {
                    VStack(alignment: .leading, spacing: 12) {
                        optionToggle("隐藏此用户的内容", isOn: $hideContent)
                        optionToggle("同时提交审核队列", isOn: $submitToQueue)
                        optionToggle("保留证据用于客服处理", isOn: $preserveEvidence)
                    }
                }

                // Confirm Block Button (179:597) — lemon-strong r26
                complianceLemonButton(title: "确认屏蔽", isLoading: isBlocking) {
                    Task { await block() }
                }
                .disabled(isBlocking)
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
    }

    @ViewBuilder
    private func optionToggle(_ title: String, isOn: Binding<Bool>) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(AtlasColors.ink)
            Spacer()
            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(AtlasColors.lemonStrong)
        }
    }

    private func block() async {
        isBlocking = true
        defer { isBlocking = false }
        do {
            try await APIClient.shared.blockUser(id: userID)
            await BlocklistStore.shared.block(id: userID, name: userName)
            ToastCenter.shared.showSuccess("已屏蔽 \(userName)")
            onBlocked()
            dismiss()
        } catch {
            ToastCenter.shared.showError("屏蔽失败", message: error.localizedDescription)
        }
    }
}

// MARK: - S18 Support Contact (Ardot 179:599)

/// S18 Support Contact — "联系支持".
///
/// Layout per design: back + title → support card (lemon-soft) →
/// privacy/terms rows (#F8FAFC) → email button (lemon-strong r26).
struct SupportContactView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                compliancePageHeader(title: "联系支持", dismiss: dismiss)

                // Support Card (179:606) — lemon-soft
                complianceLemonCard {
                    Text("我们会处理举报和账号请求")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("support@wanye.app")
                            .foregroundStyle(AtlasColors.primary)
                        Text("通常 24 小时内响应社区安全与账号问题。")
                            .foregroundStyle(ComplianceStyle.bodyGrey)
                    }
                    .font(.system(size: 13))
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
                }

                // Support Row Privacy (179:609) — #F8FAFC
                Button {
                    openURL(LegalLinks.privacyURL)
                } label: {
                    complianceDataCard {
                        Text("隐私政策")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(AtlasColors.ink)
                        Text("查看数据收集、保留、删除政策")
                            .font(.system(size: 12))
                            .foregroundStyle(ComplianceStyle.greyText)
                    }
                }
                .buttonStyle(.plain)

                // Support Row Terms (179:612) — #F8FAFC
                Button {
                    openURL(LegalLinks.termsURL)
                } label: {
                    complianceDataCard {
                        Text("服务条款")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(AtlasColors.ink)
                        Text("社区规则、AI 使用边界、账号责任")
                            .font(.system(size: 12))
                            .foregroundStyle(ComplianceStyle.greyText)
                    }
                }
                .buttonStyle(.plain)

                // Email Support Button (179:615) — lemon-strong r26
                complianceLemonButton(title: "发送邮件", isLoading: false) {
                    if let url = URL(string: "mailto:support@wanye.app") {
                        openURL(url)
                    }
                }
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
    }
}

// MARK: - S19 Delete Account (Ardot 179:617)

/// S19 Delete Account — "删除账号".
///
/// Layout per design: back + title → pink warning card (#FFF1E8 r20) →
/// steps card (#F8FAFC r20) → delete button (#E5484D r26) →
/// cancel button (lemonSoft r26, olive text).
struct DeleteAccountView: View {
    @Environment(\.dismiss) private var dismiss
    var onDeleteRequested: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                compliancePageHeader(title: "删除账号", dismiss: dismiss)

                // Deletion Warning Card (179:624) — pink #FFF1E8 r20
                VStack(alignment: .leading, spacing: 10) {
                    Text("这会删除账号和关联个人数据")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text("将删除个人资料、登录凭据、设备 token、通知设置。已发布想法和评论会按社区规则匿名化或移除。")
                        .font(.system(size: 13))
                        .foregroundStyle(ComplianceStyle.bodyGrey)
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(ComplianceStyle.warningBg)
                .overlay(
                    RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                        .stroke(AtlasColors.border, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))

                // Deletion Steps (179:627) — #F8FAFC r20
                VStack(alignment: .leading, spacing: 12) {
                    stepRow("1. 验证邮箱或手机号")
                    stepRow("2. 显示删除预计完成时间")
                    stepRow("3. 完成后发送确认通知")
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(ComplianceStyle.cardBg)
                .overlay(
                    RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                        .stroke(AtlasColors.border, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))

                // Cancel Button (179:633) — lemonSoft r26, olive text (safe action first per Apple HIG)
                Button {
                    dismiss()
                } label: {
                    Text("保留账号")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .foregroundStyle(AtlasColors.olive)
                        .background(AtlasColors.lemonSoft)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)

                // Delete Confirm Button (179:631) — #E5484D r26, white text (destructive action second)
                Button {
                    onDeleteRequested()
                    dismiss()
                } label: {
                    Text("确认删除账号")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .foregroundStyle(.white)
                        .background(AtlasColors.destructive)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
    }

    @ViewBuilder
    private func stepRow(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(AtlasColors.ink)
    }
}
