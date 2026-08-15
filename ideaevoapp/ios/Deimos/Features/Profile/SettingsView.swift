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
    case deleteAccount          // S19 Delete Account (DEBUG deep-link only)
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
            // ardot S11 (`237:369`) Content frame: pad [top=12, horizontal=20, bottom=40], gap=8.
            VStack(spacing: 8) {
                // SECTION 1 — 账户 (ardot 237:369 Section Account)
                AtlasSettingsSectionLabel(text: "账户")
                mergedGroup {
                    mergedSettingsLink(title: "账号与安全", subtitle: "邮箱、手机号、密码", route: .accountSecurity)
                    Divider().padding(.leading, 16)
                    mergedSettingsLink(title: "编辑资料", subtitle: "头像、昵称、bio", route: .editProfile)
                }

                // SECTION 2 — 偏好与支持 (ardot 237:369 Section Preferences)
                AtlasSettingsSectionLabel(text: "偏好与支持").padding(.top, 4)
                mergedGroup {
                    mergedSettingsLink(title: "通知偏好", subtitle: "送花、评论、关注、Fork", route: .notificationPreferences)
                    Divider().padding(.leading, 16)
                    mergedSettingsLink(title: "隐私与数据", subtitle: "AI 数据处理与政策链接", route: .privacySafety)
                    Divider().padding(.leading, 16)
                    mergedSettingsLink(title: "联系支持", subtitle: "support@deimos.app", route: .contactSupport)
                }

                // SECTION 3 — Agent 与设备 (ardot 237:369 Agent & Device Settings)
                // Grouped #F2F2F7 container holding two white cr14 rows.
                AtlasSettingsSectionLabel(text: "Agent 与设备").padding(.top, 4)
                AtlasSettingsGroup(grouped: true) {
                    Button { route = .myAgents } label: {
                        AtlasSettingsGroupedRow(title: "我的 Agents", subtitle: "管理公开性、想法与 API Key") {
                            DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkSoft)
                        }
                    }
                    .buttonStyle(.plain)

                    Button { route = .devices } label: {
                        AtlasSettingsGroupedRow(title: "登录设备", subtitle: "当前 iPhone · 管理推送授权") {
                            DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkSoft)
                        }
                    }
                    .buttonStyle(.plain)
                }

                // Log Out — #F2F2F7 capsule (ardot 237:369 Log Out)
                AtlasSettingsLogoutButton(isLoading: isLoggingOut) {
                    Task {
                        isLoggingOut = true
                        await session.logout()
                        isLoggingOut = false
                        dismiss()
                    }
                }
                .padding(.top, 4)

                Button { route = .deleteAccount } label: {
                    Text("删除账户")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.destructiveFill)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(AtlasColors.warningSoft)
                        .clipShape(Capsule(style: .continuous))
                }
                .buttonStyle(.plain)

                Text("删除后，公开想法与 Agent 归属将按服务规则处理。")
                    .font(.system(size: 10))
                    .foregroundStyle(AtlasColors.inkFaint)
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        // S11 toolbar (ardot `237:369` C/Push Nav Bar): floating glass overlay — content scrolls under.
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
            case .deleteAccount:
                DeleteAccountView()
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
                case "deleteAccount": route = .deleteAccount
                default: break
                }
            }
        }
        #endif
    }

    /// ardot S11 row builder: independent bordered 56h row, 17pt Semibold title + 13pt inkSoft
    /// subtitle, trailing chevron `#8A94A6` (default) or custom trailing (e.g. status pill).
    private func settingsLink(
        title: String,
        subtitle: String,
        route: SettingsRoute
    ) -> some View {
        Button { self.route = route } label: {
            AtlasSettingsNavRow(title: title, subtitle: subtitle) {
                DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkSoft)
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

    private func mergedGroup<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: 0) { content() }
            .background(AtlasColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(AtlasColors.settingsRowStroke, lineWidth: 1)
            }
    }

    private func mergedSettingsLink(title: String, subtitle: String, route: SettingsRoute) -> some View {
        Button { self.route = route } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                Spacer()
                DeimosIconView(icon: .chevronRight, size: 12, color: AtlasColors.inkSoft)
            }
            .padding(.horizontal, 16)
            .frame(height: 56)
            .contentShape(Rectangle())
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
        case .deleteAccount: return "delete-account"
        }
    }
}
