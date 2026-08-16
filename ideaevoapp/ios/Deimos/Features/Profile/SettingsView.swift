import SwiftUI

/// Settings sub-routes. Binding/management flows beyond what the settings surface
/// itself shows live one push deeper (账号与安全 hub, 通知偏好, etc.).
enum SettingsRoute: Hashable {
    case accountSecurity       // 账号与安全 hub (bindings, blocklist, delete account)
    case editProfile           // S27 编辑资料
    case privacyPolicy
    case termsOfService
    case communityGuidelines
    case deleteAccount
}

/// S17 设置 (ardot board 715405210175453, node `2:774`).
///
/// Structure per the board: inline nav → 账号绑定 status group → 偏好 group
/// (互动通知 toggle / 清除缓存 / 关于火卫二) → 通用 nav rows → 退出登录 pill.
/// Group cards are borderless `#F2F2F7` r16 with 44pt rows; the logout pill is a
/// standalone destructive-text capsule.
struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session
    @State private var route: SettingsRoute?
    @State private var isLoggingOut = false
    @State private var cacheSize: String = "…"

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        return "v\(version)"
    }

    /// Master interaction-notify switch: on = any of the per-channel preferences on.
    private var notifyMaster: Binding<Bool> {
        Binding(
            get: {
                AppPreferencesStore.notifyFlowers
                    || AppPreferencesStore.notifyComments
                    || AppPreferencesStore.notifyFollows
            },
            set: { on in
                AppPreferencesStore.notifyFlowers = on
                AppPreferencesStore.notifyComments = on
                AppPreferencesStore.notifyFollows = on
            }
        )
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                AtlasSubPageNavBar(title: "设置", onBack: { dismiss() })

                AtlasFormGroupLabel(text: "账号绑定")
                AtlasFormGroupCard {
                    bindRow(label: "邮箱", value: session.user?.email ?? "未绑定", bound: session.user?.email != nil)
                    bindRow(label: "手机号", value: Self.maskedPhone(session.user?.phone), bound: session.user?.phone != nil)
                    bindRow(label: "微信", value: session.user?.authProvider == "wechat" ? "已绑定" : "去绑定", bound: session.user?.authProvider == "wechat")
                    bindRow(label: "Google", value: session.user?.authProvider == "google" ? "已绑定" : "去绑定", bound: session.user?.authProvider == "google")
                }

                AtlasFormGroupLabel(text: "偏好")
                AtlasFormGroupCard {
                    AtlasFormGroupRow(label: "互动通知", height: 52) {
                        AtlasFormToggle(isOn: notifyMaster)
                    }
                    Button { clearCache() } label: {
                        AtlasFormGroupRow(label: "清除缓存") {
                            AtlasFormGroupValue(text: cacheSize)
                            AtlasRowChevron()
                        }
                    }
                    .buttonStyle(.plain)
                    AtlasFormGroupRow(label: "关于火卫二") {
                        AtlasFormGroupValue(text: appVersion)
                    }
                }

                Button {
                    Task {
                        isLoggingOut = true
                        await session.logout()
                        isLoggingOut = false
                        dismiss()
                    }
                } label: {
                    Group {
                        if isLoggingOut {
                            ProgressView()
                                .controlSize(.small)
                                .tint(AtlasColors.destructive)
                        } else {
                            Text("退出登录")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(AtlasColors.destructive)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                }
                .buttonStyle(.plain)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(AtlasColors.settingsGroupFill)
                )
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .disabled(isLoggingOut)
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
        .task { refreshCacheSize() }
        .navigationDestination(item: $route) { destination in
            switch destination {
            case .accountSecurity: AccountSecurityView()
            case .editProfile: EditProfileView()
            case .privacyPolicy: PrivacyPolicyView()
            case .termsOfService:
                LegalDocumentView(title: "用户协议", sections: LegalDocuments.terms)
            case .communityGuidelines:
                LegalDocumentView(title: "社区规范", sections: LegalDocuments.community)
            case .deleteAccount:
                DeleteAccountView()
            }
        }
        #if DEBUG
        .onAppear {
            if let arg = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--deimos-goto-settings-sub=") }) {
                let key = arg.replacingOccurrences(of: "--deimos-goto-settings-sub=", with: "")
                switch key {
                case "accountSecurity": route = .accountSecurity
                case "editProfile": route = .editProfile
                case "privacyPolicy": route = .privacyPolicy
                case "deleteAccount": route = .deleteAccount
                default: break
                }
            }
        }
        #endif
    }

    /// 账号绑定 status row (S17 Bind Group rows): 14 Regular ink label, trailing
    /// value — 12 Regular inkSoft for identity values, success green for 已绑定,
    /// olive Medium for 去绑定. Tapping routes to the 账号与安全 hub where the
    /// actual binding flows live.
    private func bindRow(label: String, value: String, bound: Bool) -> some View {
        let isBindAction = value == "去绑定" || value == "未绑定"
        let valueColor: Color = {
            if value == "已绑定" { return AtlasColors.success }
            if value == "去绑定" { return AtlasColors.olive }
            return AtlasColors.inkSoft
        }()
        return Button { route = .accountSecurity } label: {
            AtlasFormGroupRow(label: label) {
                Text(value)
                    .font(.system(size: 12, weight: value == "去绑定" ? .medium : .regular))
                    .foregroundStyle(isBindAction && value == "未绑定" ? AtlasColors.inkFaint : valueColor)
            }
        }
        .buttonStyle(.plain)
    }

    private func navRow(_ label: String, route target: SettingsRoute) -> some View {
        Button { route = target } label: {
            AtlasFormGroupRow(label: label) {
                AtlasRowChevron()
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Cache

    private func refreshCacheSize() {
        let bytes = URLCache.shared.currentDiskUsage + URLCache.shared.currentMemoryUsage
        cacheSize = Self.formatBytes(bytes)
    }

    private func clearCache() {
        URLCache.shared.removeAllCachedResponses()
        let tmp = FileManager.default.temporaryDirectory
        if let items = try? FileManager.default.contentsOfDirectory(at: tmp, includingPropertiesForKeys: nil) {
            for item in items { try? FileManager.default.removeItem(at: item) }
        }
        refreshCacheSize()
        ToastCenter.shared.showSuccess("缓存已清除")
    }

    static func formatBytes(_ bytes: Int) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }

    static func maskedPhone(_ phone: String?) -> String {
        guard let phone, phone.count >= 7 else { return phone ?? "未绑定" }
        return "\(phone.prefix(3))****\(phone.suffix(4))"
    }
}

/// Small chevron affordance for group rows (S17 uses inkFaint #A9B2C0 strokes).
struct AtlasRowChevron: View {
    var body: some View {
        DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
    }
}

extension SettingsRoute: Identifiable {
    var id: String {
        switch self {
        case .accountSecurity: return "account"
        case .editProfile: return "edit"
        case .privacyPolicy: return "privacy"
        case .termsOfService: return "terms"
        case .communityGuidelines: return "community"
        case .deleteAccount: return "delete-account"
        }
    }
}
