import SwiftUI

/// S11 Settings sub-routes (ardot `179:6`). Grouped into 4 cards on the main screen:
/// Account & Safety · Notifications · Agent Workspace · Privacy/Support/About.
enum SettingsRoute: Hashable {
    case accountSecurity       // S36 Account & Security
    case editProfile           // S20 Edit Public Identity
    case notificationPreferences // S37 Notification Preferences
    case devices               // S38 Notification Devices
    case myAgents              // S13 My Agents
    case privacySafety         // S14 Privacy & Safety Center
    case about                 // S18 Support Contact + policies
    case blocklist             // S39 Blocked Users (under Privacy)
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
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                // ardot `195:5` — lemonSoft summary card. Top edge scrolls under the floating
                // glass toolbar; bottom edge is the start of the settings stack.
                AtlasSettingsSummaryCard(
                    title: "身份与安全状态",
                    message: "公开主页只展示昵称、简介与公开作品；邮箱、手机和登录方式仅自己可见。"
                )

                // Group · Account & Safety (ardot `195:8`)
                AtlasSettingsGroup {
                    settingsLink(
                        title: "账号与安全",
                        subtitle: "登录方式、验证与永久注销",
                        route: .accountSecurity
                    )
                    AtlasSettingsGroupDivider()
                    settingsLink(
                        title: "公开身份",
                        subtitle: "头像、昵称、背景与简介",
                        route: .editProfile
                    )
                }

                // Group · Notifications (ardot `195:16`)
                AtlasSettingsGroup {
                    settingsLink(
                        title: "通知偏好",
                        subtitle: "互动提醒、邮件摘要与系统权限",
                        route: .notificationPreferences
                    ) {
                        AtlasSettingsStatusPill(text: "已开启")
                    }
                    AtlasSettingsGroupDivider()
                    settingsLink(
                        title: "通知设备",
                        subtitle: "管理接收推送的 iPhone 与 iPad",
                        route: .devices
                    )
                }

                // Group · Agent Workspace (ardot `195:25`)
                AtlasSettingsGroup {
                    settingsLink(
                        title: "Agent 工作区",
                        subtitle: "身份、权限、公开性与 API Key",
                        route: .myAgents
                    )
                }

                // Group · Privacy, Support & About (ardot `195:29`)
                AtlasSettingsGroup {
                    settingsLink(
                        title: "隐私与安全",
                        subtitle: "AI 数据授权、屏蔽名单与政策",
                        route: .privacySafety
                    )
                    AtlasSettingsGroupDivider()
                    settingsLink(
                        title: "帮助与关于",
                        subtitle: "联系支持、服务条款与版本",
                        route: .about
                    )
                }

                // Danger Zone — logout (ardot `195:37`)
                AtlasSettingsLogoutButton(isLoading: isLoggingOut) {
                    Task {
                        isLoggingOut = true
                        await session.logout()
                        isLoggingOut = false
                        dismiss()
                    }
                }

                // Version footer
                Text("火卫二 \(appVersion)")
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.inkFaint)
                    .padding(.top, 2)
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
            case .notificationPreferences: NotificationPreferencesView()
            case .devices: DeviceManagementView()
            case .myAgents: MyAgentsView()
            case .privacySafety: PrivacySafetyView(
                onBlocklist: { route = .blocklist },
                onPrivacyPolicy: { route = .privacyPolicy },
                onTerms: { route = .termsOfService }
            )
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
        #if DEBUG
        // Verify-only launch hook: `--deimos-goto-settings-sub=<route>` deep-links straight
        // to a settings sub-screen for visual review of the toolbar redesign.
        // Routes: accountSecurity, editProfile, notificationPreferences, devices,
        // myAgents, privacySafety, about, privacyPolicy, contactSupport.
        .onAppear {
            if let arg = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--deimos-goto-settings-sub=") }) {
                let key = arg.replacingOccurrences(of: "--deimos-goto-settings-sub=", with: "")
                switch key {
                case "accountSecurity": route = .accountSecurity
                case "editProfile": route = .editProfile
                case "notificationPreferences": route = .notificationPreferences
                case "devices": route = .devices
                case "myAgents": route = .myAgents
                case "privacySafety": route = .privacySafety
                case "about": route = .about
                case "privacyPolicy": route = .privacyPolicy
                case "contactSupport": route = .contactSupport
                default: break
                }
            }
        }
        #endif
    }

    /// ardot S11 row builder: 56h, two-line title+subtitle, trailing chevron (default) or custom
    /// trailing view (e.g. status pill). No leading icon per the design spec.
    private func settingsLink(
        title: String,
        subtitle: String,
        route: SettingsRoute
    ) -> some View {
        Button { self.route = route } label: {
            AtlasSettingsNavRow(title: title, subtitle: subtitle) {
                DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
            }
        }
        .buttonStyle(.plain)
    }

    /// Variant with a custom trailing view (e.g. status pill instead of chevron).
    private func settingsLink<Trailing: View>(
        title: String,
        subtitle: String,
        route: SettingsRoute,
        @ViewBuilder trailing: @escaping () -> Trailing
    ) -> some View {
        Button { self.route = route } label: {
            AtlasSettingsNavRow(title: title, subtitle: subtitle) { trailing() }
        }
        .buttonStyle(.plain)
    }
}

extension SettingsRoute: Identifiable {
    var id: String {
        switch self {
        case .accountSecurity: return "account"
        case .editProfile: return "edit"
        case .notificationPreferences: return "notify"
        case .devices: return "devices"
        case .myAgents: return "my-agents"
        case .privacySafety: return "privacy-safety"
        case .blocklist: return "blocklist"
        case .about: return "about"
        case .privacyPolicy: return "privacy"
        case .termsOfService: return "terms"
        case .communityGuidelines: return "community"
        case .contactSupport: return "support"
        }
    }
}
