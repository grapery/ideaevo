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
}

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session
    @State private var route: SettingsRoute?
    @State private var isLoggingOut = false

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    var body: some View {
        VStack(spacing: 0) {
            AtlasPushNavBar(title: "设置", onBack: { dismiss() })

            ScrollView {
            VStack(spacing: 24) {
                AtlasSettingsSection(title: "账户") {
                    settingsLink(
                        icon: .lock, color: AtlasColors.ink,
                        title: "账户与安全", subtitle: "资料、密码、手机号、注销",
                        route: .accountSecurity
                    )
                    AtlasSettingsDivider()
                    settingsLink(
                        icon: .edit, color: AtlasColors.entityUser,
                        title: "编辑资料", subtitle: "昵称、简介、头像",
                        route: .editProfile
                    )
                    AtlasSettingsDivider()
                    settingsLink(
                        icon: .sparkles, color: AtlasColors.entityAgent,
                        title: "我的 Agents", subtitle: "创建、编辑与管理 Agent",
                        route: .myAgents
                    )
                }

                AtlasSettingsSection(title: "偏好") {
                    settingsLink(
                        icon: .sliders, color: AtlasColors.inkSoft,
                        title: "App 偏好", subtitle: "语言、外观",
                        value: AppPreferencesStore.languageLabel,
                        route: .appPreferences
                    )
                    AtlasSettingsDivider()
                    settingsLink(
                        icon: .bell, color: AtlasColors.accentFork,
                        title: "通知偏好", subtitle: "站内通知分类、推送",
                        route: .notificationPreferences
                    )
                }

                AtlasSettingsSection(title: "关于") {
                    settingsLink(
                        icon: .shield, color: AtlasColors.inkFaint,
                        title: "法律与隐私", subtitle: "隐私政策、用户协议、数据权利",
                        route: .legalPrivacy
                    )
                    AtlasSettingsDivider()
                    settingsLink(
                        icon: .info, color: AtlasColors.accentActive,
                        title: "关于万叶", subtitle: "版本、联系支持",
                        value: "v\(appVersion)",
                        route: .about
                    )
                }

                AtlasSettingsLogoutButton(isLoading: isLoggingOut) {
                    Task {
                        isLoggingOut = true
                        await session.logout()
                        isLoggingOut = false
                        dismiss()
                    }
                }

                Text("隐私政策与用户协议可在未登录状态访问；账户注销在账户与安全。")
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.inkFaint)
                    .padding(.horizontal, 4)
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
        .navigationDestination(item: $route) { destination in
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
            }
        }
    }

    private func settingsLink(
        icon: DeimosIcon,
        color: Color,
        title: String,
        subtitle: String,
        value: String? = nil,
        route: SettingsRoute
    ) -> some View {
        Button { self.route = route } label: {
            AtlasSettingsRow(
                icon: icon,
                iconColor: color,
                title: title,
                subtitle: subtitle,
                value: value
            )
        }
        .buttonStyle(.plain)
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
        }
    }
}
