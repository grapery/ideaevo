import SwiftUI

enum SettingsRoute: Hashable {
    case accountSecurity
    case editProfile
    case appPreferences
    case notificationPreferences
    case myAgents
    case legalPrivacy
    case blocklist
    case about
    case privacyPolicy
    case termsOfService
    case communityGuidelines
    case contactSupport
    case privacyCenter
    case aiDataConsent
    case supportContact
}

/// S11 Settings — per updated design node tree (195:1–195:41).
///
/// Content Wrapper: VERTICAL itemSpacing=14, padding=[20,20,20,20].
/// Header → Account Status Summary (lemonSoft) → 4 grouped card lists → Danger Zone (logout + delete).
struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session
    @State private var route: SettingsRoute?
    @State private var isLoggingOut = false

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // Header · Back + Title (195:1)
                VStack(alignment: .leading, spacing: 12) {
                    AtlasNavBackButton(action: { dismiss() })
                Text("设置")
                    .font(.system(size: 36, weight: .heavy))
                    .atlasTrackedTitle(36)
                    .foregroundStyle(AtlasColors.ink)
                }

                // Account Status Summary (195:5): lemonSoft r20
                accountStatusSummary

                // Group · Account & Safety (195:8)
                settingsGroup {
                    settingsRow(
                        title: "账号与安全",
                        subtitle: "邮箱、手机号、密码、注销",
                        action: { route = .accountSecurity }
                    )
                    groupDivider
                    settingsRow(
                        title: "编辑资料",
                        subtitle: "头像、昵称、背景与简介",
                        action: { route = .editProfile }
                    )
                }

                // Group · Notifications (195:16)
                settingsGroup {
                    settingsRow(
                        title: "通知偏好",
                        subtitle: "推送、评论、送花、关注、邮件摘要",
                        trailing: .enabledPill,
                        action: { route = .notificationPreferences }
                    )
                    groupDivider
                    settingsRow(
                        title: "登录设备",
                        subtitle: "当前 iPhone · 可移除旧设备 token",
                        action: { route = .accountSecurity }
                    )
                }

                // Group · Agent Workspace (195:25)
                settingsGroup {
                    settingsRow(
                        title: "我的 Agent",
                        subtitle: "详情、编辑、公开性与 API Key",
                        action: { route = .myAgents }
                    )
                }

                // Group · Privacy, Support & About (195:29)
                settingsGroup {
                    settingsRow(
                        title: "隐私与合规",
                        subtitle: "隐私政策、社区规范、AI 数据授权",
                        action: { route = .legalPrivacy }
                    )
                    groupDivider
                    settingsRow(
                        title: "关于与支持",
                        subtitle: "v\(appVersion) · 联系支持 · App Store 合规",
                        action: { route = .about }
                    )
                }

                // Danger Zone (195:37)
                VStack(spacing: 8) {
                    // Logout (195:38): 350×46 r25 bg=#F1F2F8, "退出登录" 15pt Bold ink
                    Button {
                        Task {
                            isLoggingOut = true
                            await session.logout()
                            isLoggingOut = false
                            dismiss()
                        }
                    } label: {
                        HStack {
                            if isLoggingOut { ProgressView().tint(AtlasColors.ink) }
                            Text(isLoggingOut ? "退出中…" : "退出登录")
                                .font(.system(size: 15, weight: .bold))
                        }
                        .foregroundStyle(AtlasColors.ink)
                        .frame(maxWidth: .infinity)
                        .frame(height: 46)
                        .background(Color(hex: 0xF1F2F8))
                        .clipShape(RoundedRectangle(cornerRadius: 25, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(isLoggingOut)

                    // Delete Account (195:40): 350×46 r25 bg=#FFF1E8, "删除账号" 15pt Bold #E5484D
                    Button {
                        route = .accountSecurity
                    } label: {
                        Text("删除账号")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(AtlasColors.destructive)
                            .frame(maxWidth: .infinity)
                            .frame(height: 46)
                            .background(Color(hex: 0xFFF1E8))
                            .clipShape(RoundedRectangle(cornerRadius: 25, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 0)
            .padding(.bottom, 20 + AtlasMetrics.bottomClear)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
        .navigationDestination(item: $route) { destination in
            settingsDestination(destination)
        }
    }

    // MARK: - Account Status Summary (195:5)

    /// lemonSoft r20, padding=14, "账户已登录" 17pt Bold lemonInk + body 13pt olive.
    private var accountStatusSummary: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(session.user != nil ? "账户已登录" : "未登录")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(AtlasColors.lemonInk)
            Text("邮箱、手机号与通知设备会影响账号找回和重要提醒。")
                .font(.system(size: 13))
                .foregroundStyle(AtlasColors.olive)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(AtlasColors.lemonSoft)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    // MARK: - Settings group card

    /// white bg + border r20, VERTICAL itemSpacing=0 (rows manage their own spacing).
    private func settingsGroup<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            content()
        }
        .background(AtlasColors.surface)
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    /// Group divider: 1px #F0F2F5, full width.
    private var groupDivider: some View {
        Rectangle()
            .fill(Color(hex: 0xF0F2F5))
            .frame(height: 1)
    }

    // MARK: - Settings row

    enum RowTrailing { case chevron, enabledPill }

    /// Row: HORIZONTAL SPACE_BETWEEN, padding=14, title+subtitle 17pt SemiBold ink + trailing.
    private func settingsRow(
        title: String,
        subtitle: String,
        trailing: RowTrailing = .chevron,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text(subtitle)
                        .font(.system(size: 13))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                Spacer()
                switch trailing {
                case .chevron:
                    Text("›")
                        .font(.system(size: 24))
                        .foregroundStyle(Color(hex: 0x9AA2AF))
                case .enabledPill:
                    Text("已开启")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(AtlasColors.lemonInk)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
                        .background(AtlasColors.lemonStrong)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
            .padding(14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Navigation destinations

    @ViewBuilder
    private func settingsDestination(_ destination: SettingsRoute) -> some View {
        switch destination {
        case .accountSecurity: AccountSecurityView()
        case .editProfile: EditProfileView()
        case .appPreferences: AppPreferencesView()
        case .notificationPreferences: NotificationPreferencesView()
        case .myAgents: MyAgentsView()
        case .legalPrivacy: LegalPrivacyView()
        case .blocklist: BlocklistView()
        case .about: AboutView(
            onPrivacyPolicy: { route = .privacyPolicy },
            onTerms: { route = .termsOfService },
            onCommunity: { route = .communityGuidelines },
            onReport: { route = .contactSupport }
        )
        case .privacyPolicy: PrivacyPolicyView()
        case .termsOfService:
            LegalDocumentView(title: "用户协议", sections: LegalDocuments.terms)
        case .communityGuidelines:
            LegalDocumentView(title: "社区规范", sections: LegalDocuments.community)
        case .contactSupport:
            LegalDocumentView(title: "联系支持", sections: LegalDocuments.support)
        case .privacyCenter:
            PrivacyCenterView()
        case .aiDataConsent:
            AIDataConsentView()
        case .supportContact:
            SupportContactView()
        }
    }
}

extension SettingsRoute: Identifiable {
    var id: String {
        switch self {
        case .accountSecurity: return "account"
        case .editProfile: return "edit"
        case .appPreferences: return "prefs"
        case .notificationPreferences: return "notify"
        case .myAgents: return "my-agents"
        case .legalPrivacy: return "legal"
        case .blocklist: return "blocklist"
        case .about: return "about"
        case .privacyPolicy: return "privacy"
        case .termsOfService: return "terms"
        case .communityGuidelines: return "community"
        case .contactSupport: return "support"
        case .privacyCenter: return "privacy-center"
        case .aiDataConsent: return "ai-consent"
        case .supportContact: return "support-contact"
        }
    }
}
