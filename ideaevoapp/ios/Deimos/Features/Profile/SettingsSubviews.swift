import SwiftUI
import PhotosUI
import UserNotifications
import UIKit

// MARK: - Shared helpers (ardot C/Push Nav Bar `237:94`, pinned above scroll content)

@ViewBuilder
func settingsBackHeader(title: String, dismiss: DismissAction) -> some View {
    // float-liquid glass overlay — matches the Settings main page (AtlasOverlayPushNavBar).
    // Transparent container + independent floating-glass back circle + title capsule, so
    // content scrolls under the toolbar. Previously used AtlasPushNavBar (solid-canvas bar)
    // which produced an inconsistent toolbar language across settings screens.
    AtlasOverlayPushNavBar(title: title, onBack: { dismiss() })
}

/// Legacy grouped card container retained for screens that build rows inline (BlocklistView).
/// White surface, hairline border, 16pt padding, 20pt radius.
@ViewBuilder
func settingsGroupedCard<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: 0) {
        content()
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(16)
    .background(AtlasColors.surface)
    .overlay(
        RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
            .stroke(AtlasColors.rule, lineWidth: 1)
    )
    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
}

// MARK: - S20 Edit Public Identity · PATCH /user/profile

struct EditProfileView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session

    @State private var name = ""
    @State private var bio = ""
    @State private var isSaving = false
    @State private var message: String?
    @State private var avatarItem: PhotosPickerItem?
    @State private var backgroundItem: PhotosPickerItem?
    @State private var isUploadingAvatar = false
    @State private var isUploadingBackground = false

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                AtlasSettingsSubSummaryCard(
                    title: "公开身份只展示可被搜索的字段",
                    message: "昵称、简介、头像与背景对所有人可见；联系方式与登录凭据不会出现在公开主页。"
                )

                // Avatar / background picker card
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 16) {
                        ProfileBanner(
                            backgroundURL: session.user?.backgroundURL,
                            avatarURL: session.user?.avatarURL,
                            avatarSize: 64
                        )
                        .frame(width: 64, height: 64)
                        VStack(alignment: .leading, spacing: 6) {
                            Text("头像与背景")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(AtlasColors.ink)
                            Text("建议头像 400×400，背景 1500×500")
                                .font(.system(size: 12))
                                .foregroundStyle(AtlasColors.inkFaint)
                        }
                        Spacer(minLength: 0)
                    }

                    HStack(spacing: 10) {
                        PhotosPicker(selection: $avatarItem, matching: .images) {
                            pickerLabel(isUploadingAvatar ? "头像上传中…" : "更换头像")
                        }
                        .disabled(isUploadingAvatar || isUploadingBackground)
                        PhotosPicker(selection: $backgroundItem, matching: .images) {
                            pickerLabel(isUploadingBackground ? "背景上传中…" : "更换背景")
                        }
                        .disabled(isUploadingAvatar || isUploadingBackground)
                    }

                    HStack(spacing: 16) {
                        Button("恢复默认头像") { Task { await resetAvatar() } }
                            .font(.system(size: 13))
                            .foregroundStyle(AtlasColors.inkSoft)
                        Button("恢复默认背景") { Task { await resetBackground() } }
                            .font(.system(size: 13))
                            .foregroundStyle(AtlasColors.inkSoft)
                        Spacer(minLength: 0)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(cardSurface)
                .overlay(cardBorder)

                // Nickname + bio card
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("昵称")
                            .font(.system(size: 12))
                            .foregroundStyle(AtlasColors.inkFaint)
                        TextField("昵称", text: $name)
                            .font(.system(size: 15))
                            .foregroundStyle(AtlasColors.ink)
                            .padding(.vertical, 10)
                            .padding(.horizontal, 12)
                            .background(AtlasColors.bgInput)
                            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("简介")
                            .font(.system(size: 12))
                            .foregroundStyle(AtlasColors.inkFaint)
                        TextEditor(text: $bio)
                            .font(.system(size: 15))
                            .foregroundStyle(AtlasColors.ink)
                            .frame(minHeight: 92)
                            .padding(8)
                            .background(AtlasColors.bgInput)
                            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
                            .scrollContentBackground(.hidden)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(cardSurface)
                .overlay(cardBorder)

                if let message {
                    Text(message)
                        .font(AtlasTypography.meta())
                        .foregroundStyle(message.contains("成功") ? AtlasColors.success : AtlasColors.destructive)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                AtlasPrimaryButton(title: "保存", isLoading: isSaving) {
                    Task { await save() }
                }
                .padding(.top, 2)
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "公开身份", dismiss: dismiss)
        }
        .navigationBarHidden(true)
        .suppressTabBar()
        .onAppear {
            name = session.user?.name ?? ""
            bio = session.user?.bio ?? ""
        }
        .onChange(of: avatarItem) { _, item in
            guard let item else { return }
            Task { await uploadImage(item, kind: "avatar") }
        }
        .onChange(of: backgroundItem) { _, item in
            guard let item else { return }
            Task { await uploadImage(item, kind: "background") }
        }
    }

    private func pickerLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(AtlasColors.lemonInk)
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .background(Capsule(style: .continuous).fill(AtlasColors.lemonSoft))
    }

    private var cardSurface: some View {
        RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
            .fill(AtlasColors.surface)
    }
    private var cardBorder: some View {
        RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
            .stroke(AtlasColors.rule, lineWidth: 1)
    }

    private func uploadImage(_ item: PhotosPickerItem, kind: String) async {
        if kind == "avatar" { isUploadingAvatar = true } else { isUploadingBackground = true }
        message = nil
        defer { isUploadingAvatar = false; isUploadingBackground = false }
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw APIError.server("无法读取图片")
            }
            let publicURL = try await APIClient.shared.uploadImage(kind: kind, data: data, contentType: "image/jpeg")
            let user: User
            if kind == "avatar" {
                user = try await APIClient.shared.updateProfile(avatarURL: publicURL, avatarSource: "upload")
            } else {
                user = try await APIClient.shared.updateProfile(backgroundURL: publicURL)
            }
            session.user = user
            message = kind == "avatar" ? "头像已更新" : "背景已更新"
        } catch {
            message = error.localizedDescription
        }
    }

    private func resetAvatar() async {
        message = nil
        do {
            session.user = try await APIClient.shared.resetAvatar()
            message = "已恢复默认头像"
        } catch { message = error.localizedDescription }
    }

    private func resetBackground() async {
        message = nil
        do {
            session.user = try await APIClient.shared.resetBackground()
            message = "已恢复默认背景"
        } catch { message = error.localizedDescription }
    }

    private func save() async {
        isSaving = true
        message = nil
        defer { isSaving = false }
        do {
            let user = try await APIClient.shared.updateProfile(
                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                bio: bio.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            session.user = user
            message = "保存成功"
        } catch { message = error.localizedDescription }
    }
}

// MARK: - S36 Account & Security · Navigation Hub

/// Sub-routes pushed from AccountSecurityView (kept local — these don't belong in the
/// top-level SettingsRoute enum since they're only reachable from this screen).
enum AccountSecurityRoute: Hashable {
    case changePassword
    case deleteAccount
}

/// S36 v2 — navigation hub. The old screen stuffed change-password, phone-bind and
/// delete-account into one long scroll. Now it's a hub: summary + login-method info rows +
/// 3 nav rows that each push/sheet to a dedicated screen. ardot S36 (`295:50`).
struct AccountSecurityView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session

    @State private var route: AccountSecurityRoute?
    @State private var showPhoneBind = false

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                AtlasSettingsSubSummaryCard(
                    title: "私密账户控制",
                    message: "邮箱、手机号、登录方式与验证状态仅自己可见；公开主页不会返回这些字段。"
                )

                // ardot `295:57` data rows
                AtlasSettingsDataRow("登录方式", message: session.user.map { providerLabel($0.authProvider) } ?? "—")
                AtlasSettingsDataRow(
                    "邮箱与手机号",
                    message: session.user.map { emailPhoneLabel($0) } ?? "—"
                )

                // 3-function hub group. Each row routes to a dedicated screen.
                AtlasSettingsGroup {
                    Button { route = .changePassword } label: {
                        AtlasSettingsNavRow(title: "修改密码", subtitle: "更新登录密码") {
                            DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                        }
                    }
                    .buttonStyle(.plain)
                    AtlasSettingsGroupDivider()
                    Button { showPhoneBind = true } label: {
                        AtlasSettingsNavRow(title: "手机号绑定", subtitle: phoneBindSubtitle) {
                            DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                        }
                    }
                    .buttonStyle(.plain)
                    AtlasSettingsGroupDivider()
                    Button { route = .deleteAccount } label: {
                        AtlasSettingsNavRow(title: "注销账户", subtitle: "永久删除账户与个人资料") {
                            DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                        }
                    }
                    .buttonStyle(.plain)
                }

                AtlasSettingsLinksCard(
                    title: "密码与注销",
                    message: "修改密码 · 按登录方式验证后永久注销"
                )
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "账号与安全", dismiss: dismiss)
        }
        .navigationBarHidden(true)
        .suppressTabBar()
        .navigationDestination(item: $route) { destination in
            switch destination {
            case .changePassword: ChangePasswordView()
            case .deleteAccount: DeleteAccountView()
            }
        }
        .sheet(isPresented: $showPhoneBind) { PhoneBindView() }
    }

    /// Dynamic subtitle for the phone-bind nav row: shows the bound phone or a hint.
    private var phoneBindSubtitle: String {
        guard let user = session.user else { return "未绑定" }
        if user.phoneVerified, let phone = user.phone, !phone.isEmpty {
            return "已绑定 \(phone)"
        }
        return user.authProvider == "wechat" ? "微信注销需要验证" : "提升账户安全"
    }

    private func providerLabel(_ provider: String) -> String {
        switch provider {
        case "apple": return "Apple · 已连接"
        case "google": return "Google · 已连接"
        case "wechat": return "微信 · 已连接"
        case "email": return "邮箱 · 已连接"
        default: return provider
        }
    }

    private func emailPhoneLabel(_ user: User) -> String {
        var parts: [String] = []
        if let email = user.email, !email.isEmpty {
            parts.append(user.emailVerified ? "邮箱已验证" : "邮箱未验证")
        }
        if let phone = user.phone, !phone.isEmpty {
            parts.append(user.phoneVerified ? "手机号已绑定" : "手机号未验证")
        }
        return parts.isEmpty ? "未设置" : parts.joined(separator: " · ")
    }
}

// MARK: - S36b Change Password · POST /auth/user/change-password

/// Dedicated change-password screen extracted from the old AccountSecurityView.
/// ardot S36b (`329:1`). Summary + current/new password inputs + update button.
struct ChangePasswordView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var oldPassword = ""
    @State private var newPassword = ""
    @State private var isSaving = false
    @State private var message: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                AtlasSettingsSubSummaryCard(
                    title: "修改登录密码",
                    message: "新密码至少 6 位；修改后当前会话不退出，其他设备会要求重新登录。"
                )

                VStack(alignment: .leading, spacing: 14) {
                    Text("修改密码")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)

                    SecureField("当前密码", text: $oldPassword)
                        .styleSettingsInput()
                    SecureField("新密码（至少 6 位）", text: $newPassword)
                        .styleSettingsInput()

                    if let message {
                        Text(message)
                            .font(AtlasTypography.meta())
                            .foregroundStyle(message.contains("成功") ? AtlasColors.success : AtlasColors.destructive)
                    }

                    AtlasPrimaryButton(title: "更新密码", isLoading: isSaving) {
                        Task { await changePassword() }
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(cardSurface)
                .overlay(cardBorder)
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "修改密码", dismiss: dismiss)
        }
        .navigationBarHidden(true)
        .suppressTabBar()
    }

    private func changePassword() async {
        isSaving = true
        message = nil
        defer { isSaving = false }
        do {
            try await APIClient.shared.changePassword(oldPassword: oldPassword, newPassword: newPassword)
            oldPassword = ""
            newPassword = ""
            message = "密码修改成功"
        } catch { message = error.localizedDescription }
    }
}

// MARK: - S36c Delete Account · POST /auth/user/delete

/// Dedicated delete-account screen extracted from the old AccountSecurityView.
/// ardot S36c (`329:15`). Warning summary + provider-specific confirm input +
/// permanent-delete button + center confirmation dialog.
struct DeleteAccountView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session

    @State private var deleteConfirm = ""
    @State private var deletePassword = ""
    @State private var deletePhone = ""
    @State private var deleteSMSCode = ""
    @State private var isDeleting = false
    @State private var showDeleteDialog = false

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                AtlasSettingsSubSummaryCard(
                    title: "永久注销账户",
                    message: "此操作不可恢复。将删除登录凭证、个人资料与手机号绑定；公开内容或 Fork 引用如按社区规则保留，将与账号身份解绑并匿名化展示。"
                )

                VStack(alignment: .leading, spacing: 14) {
                    Text("注销账户")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.destructive)

                    if let user = session.user {
                        switch user.authProvider {
                        case "email":
                            SecureField("输入密码确认注销", text: $deletePassword)
                                .styleSettingsInput()
                        case "google", "apple":
                            TextField("输入 DELETE 确认注销", text: $deleteConfirm)
                                .styleSettingsInput()
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.characters)
                        case "wechat":
                            TextField("绑定手机号", text: $deletePhone)
                                .styleSettingsInput()
                                .keyboardType(.phonePad)
                            HStack(spacing: 8) {
                                TextField("短信验证码", text: $deleteSMSCode)
                                    .styleSettingsInput()
                                    .keyboardType(.numberPad)
                                Button("发送验证码") {
                                    Task {
                                        try? await APIClient.shared.sendPhoneCode(
                                            phone: deletePhone.trimmingCharacters(in: .whitespacesAndNewlines),
                                            purpose: "account_delete"
                                        )
                                    }
                                }
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(AtlasColors.lemonInk)
                            }
                        default:
                            Text("当前登录方式不支持在此注销")
                                .font(.system(size: 13))
                                .foregroundStyle(AtlasColors.inkFaint)
                        }
                    }

                    Text("公开内容或 Fork 引用如按社区规则保留，将与账号身份解绑并匿名化展示。")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkFaint)

                    Button {
                        showDeleteDialog = true
                    } label: {
                        Text("永久注销账户")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(AtlasColors.destructive)
                            .frame(maxWidth: .infinity)
                            .frame(height: 46)
                            .background(AtlasColors.destructive.opacity(0.08))
                            .clipShape(Capsule(style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(isDeleting)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(cardSurface)
                .overlay(cardBorder)
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "注销账户", dismiss: dismiss)
        }
        .navigationBarHidden(true)
        .suppressTabBar()
        .overlay {
            if showDeleteDialog {
                AtlasCenterDialog(
                    title: "永久注销账户？",
                    message: deleteDialogMessage,
                    destructiveTitle: "永久注销",
                    cancelTitle: "取消",
                    isLoading: isDeleting,
                    onConfirm: { Task { await deleteAccount() } },
                    onCancel: { showDeleteDialog = false }
                )
            }
        }
    }

    private var deleteDialogMessage: String {
        "此操作不可恢复。将删除登录凭证、个人资料与手机号绑定；公开内容或 Fork 引用如按社区规则保留，将与账号身份解绑并匿名化展示。"
    }

    private func canProceedDelete(for provider: String) -> Bool {
        switch provider {
        case "email": return !deletePassword.isEmpty
        case "google", "apple": return deleteConfirm.uppercased() == "DELETE"
        case "wechat": return !deletePhone.isEmpty && !deleteSMSCode.isEmpty
        default: return false
        }
    }

    private func deleteAccount() async {
        guard let user = session.user else { return }
        guard canProceedDelete(for: user.authProvider) else {
            ToastCenter.shared.showError("请完成确认信息")
            return
        }
        isDeleting = true
        defer { isDeleting = false }
        do {
            let body: DeleteAccountBody
            switch user.authProvider {
            case "email":
                body = DeleteAccountBody(password: deletePassword, confirmText: nil, phone: nil, smsCode: nil)
            case "google", "apple":
                body = DeleteAccountBody(password: nil, confirmText: deleteConfirm, phone: nil, smsCode: nil)
            case "wechat":
                body = DeleteAccountBody(
                    password: nil, confirmText: nil,
                    phone: deletePhone.trimmingCharacters(in: .whitespacesAndNewlines),
                    smsCode: deleteSMSCode.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            default:
                ToastCenter.shared.showError("不支持的登录方式")
                return
            }
            try await APIClient.shared.deleteAccount(body: body)
            showDeleteDialog = false
            ToastCenter.shared.showSuccess("账户已注销")
            await session.logout()
            dismiss()
        } catch {
            ToastCenter.shared.showError("注销失败", message: error.localizedDescription)
        }
    }
}

// MARK: - S37 Notification Preferences · GET/PATCH /user/notification-preferences

struct NotificationPreferencesView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var flowers = AppPreferencesStore.notifyFlowers
    @State private var comments = AppPreferencesStore.notifyComments
    @State private var follows = AppPreferencesStore.notifyFollows
    @State private var pushStatus: UNAuthorizationStatus = .notDetermined
    @State private var isRequestingPush = false

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                AtlasSettingsSubSummaryCard(
                    title: "系统权限与账户偏好独立",
                    message: "先检查 iOS 推送权限，再同步站内推送和邮件偏好；修改后即时保存。"
                )

                // ardot `295:76` push row
                AtlasSettingsDataRow("推送提醒", message: "总开关 · 评论 · 鲜花 · 关注")
                AtlasSettingsDataRow("邮件提醒", message: "关注 · 评论 · 鲜花 · 提及 · 每周摘要")

                pushPermissionCard

                togglesCard

                AtlasSettingsLinksCard(
                    title: "当前状态",
                    message: pushStatusLabel
                )
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "通知偏好", dismiss: dismiss)
        }
        .navigationBarHidden(true)
        .suppressTabBar()
        .onChange(of: flowers) { _, v in AppPreferencesStore.notifyFlowers = v }
        .onChange(of: comments) { _, v in AppPreferencesStore.notifyComments = v }
        .onChange(of: follows) { _, v in AppPreferencesStore.notifyFollows = v }
        .task { await refreshPushStatus() }
    }

    private var pushPermissionCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("系统推送")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)

            switch pushStatus {
            case .notDetermined:
                AtlasPrimaryButton(title: "开启推送通知", isLoading: isRequestingPush) {
                    Task { await requestPushPermission() }
                }
            case .denied:
                AtlasOutlineButton(title: "前往系统设置开启") {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                }
                Text("推送权限已被拒绝，可在系统设置中重新开启。")
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.destructive)
            case .authorized, .provisional, .ephemeral:
                Text("推送权限已开启")
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.success)
            @unknown default:
                Text("推送状态未知")
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.inkFaint)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cardSurface)
        .overlay(cardBorder)
    }

    private var togglesCard: some View {
        VStack(spacing: 0) {
            toggleRow("送花", isOn: $flowers)
            AtlasSettingsGroupDivider()
            toggleRow("评论与回复", isOn: $comments)
            AtlasSettingsGroupDivider()
            toggleRow("关注与 Fork", isOn: $follows)
        }
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
    }

    private func toggleRow(_ title: String, isOn: Binding<Bool>) -> some View {
        Toggle(title, isOn: isOn)
            .font(.system(size: 15))
            .foregroundStyle(AtlasColors.ink)
            .padding(.horizontal, 16)
            .frame(height: 52)
            .tint(AtlasColors.lemonStrong)
    }

    private var pushStatusLabel: String {
        switch pushStatus {
        case .authorized, .provisional, .ephemeral:
            return "推送已允许 · 偏好已同步"
        case .denied:
            return "推送未开启 · 偏好仅影响站内提醒"
        case .notDetermined:
            return "尚未请求推送权限"
        @unknown default:
            return "推送状态未知"
        }
    }

    private func refreshPushStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        pushStatus = settings.authorizationStatus
    }

    private func requestPushPermission() async {
        isRequestingPush = true
        defer { isRequestingPush = false }
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            if granted {
                await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
            }
        } catch {
            ToastCenter.shared.showError("无法请求推送权限", message: error.localizedDescription)
        }
        await refreshPushStatus()
    }
}

// MARK: - S38 Notification Devices · GET/DELETE /user/devices

struct DeviceManagementView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                AtlasSettingsSubSummaryCard(
                    title: "这里管理推送目标，不是登录会话",
                    message: "设备记录只用于接收通知。移除旧设备后，该设备不再收到推送。"
                )

                AtlasSettingsDataRow("这台 iPhone", message: "iOS · 刚刚同步")
                AtlasSettingsDataRow("iPad Pro", message: "iPadOS · 12 天前同步")

                // Push settings link card
                Button {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("推送通知")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(AtlasColors.ink)
                            Text("在系统设置中管理通知授权")
                                .font(.system(size: 12))
                                .foregroundStyle(AtlasColors.inkFaint)
                        }
                        Spacer()
                        DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(cardSurface)
                    .overlay(cardBorder)
                }
                .buttonStyle(.plain)

                AtlasSettingsLinksCard(
                    title: "移除旧设备",
                    message: "操作立即生效，可在设备上重新授权"
                )
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "通知设备", dismiss: dismiss)
        }
        .navigationBarHidden(true)
        .suppressTabBar()
    }
}

// MARK: - S14 Privacy & Safety Center · Data + Blocks + Policies

struct PrivacySafetyView: View {
    @Environment(\.dismiss) private var dismiss
    var onBlocklist: () -> Void
    var onPrivacyPolicy: () -> Void
    var onTerms: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                AtlasSettingsSubSummaryCard(
                    title: "公开身份与账户数据严格分离",
                    message: "公开主页只包含昵称、简介、头像和公开作品；账号凭据仅用于登录与找回。"
                )

                AtlasSettingsDataRow("公开主页", message: "昵称、简介、头像、公开 Agent 与想法")
                AtlasSettingsDataRow("AI 与内容数据", message: "对话、搜索与内容处理授权，可查看和调整")

                AtlasSettingsGroup {
                    Button {
                        onBlocklist()
                    } label: {
                        AtlasSettingsNavRow(title: "屏蔽名单", subtitle: "查看与解除已屏蔽的用户") {
                            DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                        }
                    }
                    .buttonStyle(.plain)
                    AtlasSettingsGroupDivider()
                    Button {
                        onPrivacyPolicy()
                    } label: {
                        AtlasSettingsNavRow(title: "隐私政策", subtitle: "数据收集、保留与删除规则") {
                            DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                        }
                    }
                    .buttonStyle(.plain)
                    AtlasSettingsGroupDivider()
                    Button {
                        onTerms()
                    } label: {
                        AtlasSettingsNavRow(title: "服务条款", subtitle: "使用规则与内容责任") {
                            DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                        }
                    }
                    .buttonStyle(.plain)
                }

                AtlasSettingsLinksCard(
                    title: "安全与政策",
                    message: "屏蔽名单 · 举报记录 · 隐私政策 · 服务条款"
                )
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "隐私与安全", dismiss: dismiss)
        }
        .navigationBarHidden(true)
        .suppressTabBar()
    }
}

// MARK: - S18 Support Contact · App Review Safety

struct ContactSupportView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                AtlasSettingsSubSummaryCard(
                    title: "账号、隐私与社区安全支持",
                    message: "support@wanye.app\n请附问题类型与必要上下文，我们会跟进处理。"
                )

                AtlasSettingsGroup {
                    supportLink(
                        title: "邮件支持",
                        subtitle: "support@wanye.app"
                    ) {
                        if let url = URL(string: "mailto:support@wanye.app?subject=Deimos%20%E5%8F%8D%E9%A6%88") {
                            openURL(url)
                        }
                    }
                    AtlasSettingsGroupDivider()
                    supportLink(
                        title: "帮助中心",
                        subtitle: "常见问题、使用指南、社区规范"
                    ) {
                        if let url = URL(string: "https://wanye.app/help") { openURL(url) }
                    }
                }

                AtlasSettingsLinksCard(
                    title: "隐私政策",
                    message: "查看数据收集、保留、删除政策"
                )
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "联系支持", dismiss: dismiss)
        }
        .navigationBarHidden(true)
        .suppressTabBar()
    }

    private func supportLink(title: String, subtitle: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            AtlasSettingsNavRow(title: title, subtitle: subtitle) {
                DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Shared card primitives (private to this file)

private var cardSurface: some View {
    RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
        .fill(AtlasColors.surface)
}
private var cardBorder: some View {
    RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
        .stroke(AtlasColors.rule, lineWidth: 1)
}

private struct SettingsInputStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 15))
            .foregroundStyle(AtlasColors.ink)
            .padding(.vertical, 12)
            .padding(.horizontal, 14)
            .background(AtlasColors.bgInput)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
    }
}

private extension View {
    func styleSettingsInput() -> some View {
        modifier(SettingsInputStyle())
    }
}
