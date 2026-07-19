import SwiftUI

enum SettingsRoute: Hashable {
    case accountSecurity
    case editProfile
    case appPreferences
    case notificationPreferences
    case devices
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
        ScrollView {
        VStack(spacing: 24) {
                AtlasSettingsSection(title: "账户") {
                    settingsLink(
                        icon: .lock, color: AtlasColors.ink,
                        title: "账户与安全", subtitle: "邮箱、手机号、密码",
                        route: .accountSecurity
                    )
                    AtlasSettingsDivider(leadingInset: 0)
                    settingsLink(
                        icon: .edit, color: AtlasColors.ink,
                        title: "编辑资料", subtitle: "头像、昵称、bio",
                        route: .editProfile
                    )
                }

                AtlasSettingsSection(title: "偏好与支持") {
                    settingsLink(
                        icon: .bell, color: AtlasColors.ink,
                        title: "通知偏好", subtitle: "送花、评论、关注、Fork",
                        route: .notificationPreferences
                    )
                    AtlasSettingsDivider(leadingInset: 0)
                    settingsLink(
                        icon: .shield, color: AtlasColors.ink,
                        title: "隐私与数据", subtitle: "AI 数据处理与政策链接",
                        route: .legalPrivacy
                    )
                    AtlasSettingsDivider(leadingInset: 0)
                    settingsLink(
                        icon: .mail, color: AtlasColors.inkSoft,
                        title: "联系支持", subtitle: "support@deimos.app",
                        route: .contactSupport
                    )
                }

                AtlasSettingsSection(title: "Agent 与设备") {
                    settingsLink(
                        icon: .sparkles, color: AtlasColors.lemonInk,
                        title: "我的 Agents", subtitle: "管理公开性、想法与 API Key",
                        route: .myAgents
                    )
                    AtlasSettingsDivider(leadingInset: 0)
                    settingsLink(
                        icon: .devices, color: AtlasColors.inkSoft,
                        title: "登录设备", subtitle: "当前设备与推送授权",
                        route: .devices
                    )
                }

                    settingsLogoutButton {
                    Task {
                        isLoggingOut = true
                        await session.logout()
                        isLoggingOut = false
                        dismiss()
                    }
                }

            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        // S11 (ardot 296:249): "Toolbar · 设置 · floating glass overlay" — content scrolls under.
        .safeAreaInset(edge: .top, spacing: 0) {
            AtlasOverlayPushNavBar(title: "设置", onBack: { dismiss() })
        }
        .navigationBarHidden(true)
        .suppressTabBar()
        .navigationDestination(item: $route) { destination in
            switch destination {
            case .accountSecurity: AccountSecurityView()
            case .editProfile: EditProfileView()
            case .appPreferences: AppPreferencesView()
            case .notificationPreferences: NotificationPreferencesView()
            case .devices: DeviceManagementView()
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
                ContactSupportView()
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
                value: value,
                showsLeadingIcon: false
            )
        }
        .buttonStyle(.plain)
    }

    private func settingsLogoutButton(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoggingOut { ProgressView().tint(AtlasColors.inkSoft) }
                Text("退出登录")
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(AtlasColors.fill)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isLoggingOut)
    }
}

extension SettingsRoute: Identifiable {
    var id: String {
        switch self {
        case .accountSecurity: return "account"
        case .editProfile: return "edit"
        case .appPreferences: return "prefs"
        case .notificationPreferences: return "notify"
        case .devices: return "devices"
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
