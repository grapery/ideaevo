import SwiftUI
import PhotosUI
import UserNotifications
import UIKit

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
            VStack(alignment: .leading, spacing: 16) {
                ProfileBanner(
                    backgroundURL: session.user?.backgroundURL,
                    avatarURL: session.user?.avatarURL,
                    avatarSize: 64
                )
                .padding(.horizontal, -24)

                HStack(spacing: 12) {
                    PhotosPicker(selection: $avatarItem, matching: .images) {
                        Text(isUploadingAvatar ? "头像上传中…" : "更换头像")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(AtlasColors.primary)
                    }
                    .disabled(isUploadingAvatar || isUploadingBackground)

                    PhotosPicker(selection: $backgroundItem, matching: .images) {
                        Text(isUploadingBackground ? "背景上传中…" : "更换背景")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(AtlasColors.primary)
                    }
                    .disabled(isUploadingAvatar || isUploadingBackground)
                }

                HStack(spacing: 12) {
                    Button("恢复默认头像") {
                        Task { await resetAvatar() }
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.inkSoft)

                    Button("恢复默认背景") {
                        Task { await resetBackground() }
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.inkSoft)
                }

                VStack(spacing: 12) {
                    field("昵称", text: $name)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("简介")
                            .font(.system(size: 12))
                            .foregroundStyle(AtlasColors.inkFaint)
                        TextEditor(text: $bio)
                            .frame(minHeight: 100)
                            .padding(8)
                            .background(AtlasColors.surface)
                            .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.rule))
                    }
                }

                if let message {
                    Text(message)
                        .font(AtlasTypography.meta())
                        .foregroundStyle(message.contains("成功") ? AtlasColors.teal : AtlasColors.coral)
                }

                AtlasPrimaryButton(title: "保存", isLoading: isSaving) {
                    Task { await save() }
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "编辑资料", dismiss: dismiss)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
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

    private func uploadImage(_ item: PhotosPickerItem, kind: String) async {
        if kind == "avatar" {
            isUploadingAvatar = true
        } else {
            isUploadingBackground = true
        }
        message = nil
        defer {
            isUploadingAvatar = false
            isUploadingBackground = false
        }
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw APIError.server("无法读取图片")
            }
            let contentType = "image/jpeg"
            let publicURL = try await APIClient.shared.uploadImage(kind: kind, data: data, contentType: contentType)
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
        } catch {
            message = error.localizedDescription
        }
    }

    private func resetBackground() async {
        message = nil
        do {
            session.user = try await APIClient.shared.resetBackground()
            message = "已恢复默认背景"
        } catch {
            message = error.localizedDescription
        }
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
        } catch {
            message = error.localizedDescription
        }
    }

    private func field(_ placeholder: String, text: Binding<String>) -> some View {
        TextField(placeholder, text: text)
            .padding(12)
            .background(AtlasColors.surface)
            .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.rule))
    }
}

struct AccountSecurityView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session

    @State private var oldPassword = ""
    @State private var newPassword = ""
    @State private var isSaving = false
    @State private var message: String?
    @State private var deleteConfirm = ""
    @State private var deletePassword = ""
    @State private var deletePhone = ""
    @State private var deleteSMSCode = ""
    @State private var isDeleting = false
    @State private var showDeleteDialog = false
    @State private var showPhoneBind = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let user = session.user {
                    VStack(spacing: 0) {
                        infoRow("邮箱", value: user.email ?? "—")
                        Divider().overlay(AtlasColors.rule)
                        infoRow("验证状态", value: user.emailVerified ? "已验证" : "未验证")
                        Divider().overlay(AtlasColors.rule)
                        infoRow("登录方式", value: user.authProvider)
                        if let phone = user.phone, !phone.isEmpty {
                            Divider().overlay(AtlasColors.rule)
                            infoRow("手机号", value: user.phoneVerified ? phone : "\(phone)（未验证）")
                        }
                    }
                    .background(AtlasColors.surface)
                    .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.rule))
                }

                phoneBindSection

                Text("修改密码")
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)

                SecureField("当前密码", text: $oldPassword)
                    .padding(12)
                    .background(AtlasColors.surface)
                    .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.rule))
                SecureField("新密码（至少 6 位）", text: $newPassword)
                    .padding(12)
                    .background(AtlasColors.surface)
                    .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.rule))

                if let message {
                    Text(message)
                        .font(AtlasTypography.meta())
                        .foregroundStyle(message.contains("成功") ? AtlasColors.teal : AtlasColors.coral)
                }

                AtlasPrimaryButton(title: "更新密码", isLoading: isSaving) {
                    Task { await changePassword() }
                }

                deleteAccountSection
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "账户与安全", dismiss: dismiss)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
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
        .sheet(isPresented: $showPhoneBind) {
            PhoneBindView()
        }
    }

    @ViewBuilder
    private var phoneBindSection: some View {
        if let user = session.user {
            VStack(alignment: .leading, spacing: 8) {
                Text("手机号")
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)

                if user.phoneVerified, let phone = user.phone, !phone.isEmpty {
                    Text("已绑定 \(phone)")
                        .font(.system(size: 14))
                        .foregroundStyle(AtlasColors.inkSoft)
                    Button("更换手机号") { showPhoneBind = true }
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(AtlasColors.primary)
                } else {
                    Text("绑定手机号可提升账户安全，微信用户注销时需要验证。")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkFaint)
                    AtlasOutlineButton(title: "绑定手机号") {
                        showPhoneBind = true
                    }
                }
            }
            .padding(.top, 4)
        }
    }

    private var deleteDialogMessage: String {
        "此操作不可恢复。将删除登录凭证、个人资料与手机号绑定；公开内容或 Fork 引用如按社区规则保留，将与账号身份解绑并匿名化展示。"
    }

    private func infoRow(_ title: String, value: String) -> some View {
        HStack {
            Text(title).font(.system(size: 14)).foregroundStyle(AtlasColors.inkSoft)
            Spacer()
            Text(value).font(.system(size: 14)).foregroundStyle(AtlasColors.ink)
        }
        .padding(.horizontal, 16)
        .frame(height: 48)
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
        } catch {
            message = error.localizedDescription
        }
    }

    @ViewBuilder
    private var deleteAccountSection: some View {
        Text("注销账户")
            .font(AtlasTypography.cardTitle())
            .foregroundStyle(AtlasColors.coral)
            .padding(.top, 8)

        if let user = session.user {
            switch user.authProvider {
            case "email":
                SecureField("输入密码确认注销", text: $deletePassword)
                    .padding(12)
                    .background(AtlasColors.surface)
                    .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.rule))
            case "google", "apple":
                TextField("输入 DELETE 确认注销", text: $deleteConfirm)
                    .padding(12)
                    .background(AtlasColors.surface)
                    .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.rule))
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.characters)
            case "wechat":
                TextField("绑定手机号", text: $deletePhone)
                    .keyboardType(.phonePad)
                    .padding(12)
                    .background(AtlasColors.surface)
                    .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.rule))
                HStack(spacing: 8) {
                    TextField("短信验证码", text: $deleteSMSCode)
                        .keyboardType(.numberPad)
                        .padding(12)
                        .background(AtlasColors.surface)
                        .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.rule))
                    Button("发送验证码") {
                        Task {
                            try? await APIClient.shared.sendPhoneCode(
                                phone: deletePhone.trimmingCharacters(in: .whitespacesAndNewlines),
                                purpose: "account_delete"
                            )
                        }
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.primary)
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

        Button("永久注销账户") {
            showDeleteDialog = true
        }
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(AtlasColors.coral)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.coral))
        .disabled(isDeleting)
    }

    private func canProceedDelete(for provider: String) -> Bool {
        switch provider {
        case "email":
            return !deletePassword.isEmpty
        case "google", "apple":
            return deleteConfirm.uppercased() == "DELETE"
        case "wechat":
            return !deletePhone.isEmpty && !deleteSMSCode.isEmpty
        default:
            return false
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
                    password: nil,
                    confirmText: nil,
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

struct AppPreferencesView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var language = AppPreferencesStore.language

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            settingsBackHeader(title: "App 偏好", dismiss: dismiss)

            VStack(spacing: 0) {
                Picker("语言", selection: $language) {
                    Text("简体中文").tag("zh-Hans")
                    Text("English").tag("en")
                }
                .pickerStyle(.menu)
                .padding(.horizontal, 16)
                .frame(height: 52)
                .onChange(of: language) { _, newValue in
                    AppPreferencesStore.language = newValue
                }
            }
            .background(AtlasColors.surface)
            .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.rule))
            .padding(.horizontal, 24)

            Text("外观与文字大小将在后续版本支持。")
                .font(.system(size: 12))
                .foregroundStyle(AtlasColors.inkFaint)
                .padding(.horizontal, 24)

            Spacer()
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
    }
}

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
            VStack(alignment: .leading, spacing: 16) {
                pushPermissionSection

                VStack(spacing: 0) {
                    toggleRow("送花", isOn: $flowers)
                    Divider().overlay(AtlasColors.rule)
                    toggleRow("评论与回复", isOn: $comments)
                    Divider().overlay(AtlasColors.rule)
                    toggleRow("关注与 Fork", isOn: $follows)
                }
                .background(AtlasColors.surface)
                .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.rule))
                .padding(.horizontal, 24)

                Text("分类开关保存在本机；关闭的分类不会在通知列表中显示。系统推送需单独授权。")
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.inkFaint)
                    .padding(.horizontal, 24)
            }
            .padding(.bottom, 40)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "通知偏好", dismiss: dismiss)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .onChange(of: flowers) { _, v in AppPreferencesStore.notifyFlowers = v }
        .onChange(of: comments) { _, v in AppPreferencesStore.notifyComments = v }
        .onChange(of: follows) { _, v in AppPreferencesStore.notifyFollows = v }
        .task { await refreshPushStatus() }
    }

    private var pushPermissionSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("系统推送")
                .font(AtlasTypography.cardTitle())
                .foregroundStyle(AtlasColors.ink)
                .padding(.horizontal, 24)

            VStack(alignment: .leading, spacing: 10) {
                Text(pushStatusLabel)
                    .font(.system(size: 14))
                    .foregroundStyle(AtlasColors.inkSoft)

                if pushStatus == .notDetermined {
                    AtlasPrimaryButton(title: "开启推送通知", isLoading: isRequestingPush) {
                        Task { await requestPushPermission() }
                    }
                } else if pushStatus == .denied {
                    AtlasOutlineButton(title: "前往系统设置开启") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            openURL(url)
                        }
                    }
                    Text("推送权限已被拒绝，可在系统设置中重新开启。")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.coral)
                } else {
                    Text("推送权限已开启")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.teal)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AtlasColors.surface)
            .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.rule))
            .padding(.horizontal, 24)
        }
    }

    private var pushStatusLabel: String {
        switch pushStatus {
        case .authorized, .provisional, .ephemeral:
            return "已授权系统推送"
        case .denied:
            return "系统推送未开启"
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
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        } catch {
            ToastCenter.shared.showError("无法请求推送权限", message: error.localizedDescription)
        }
        await refreshPushStatus()
    }

    private func toggleRow(_ title: String, isOn: Binding<Bool>) -> some View {
        Toggle(title, isOn: isOn)
            .font(.system(size: 15))
            .padding(.horizontal, 16)
            .frame(height: 52)
            .tint(AtlasColors.teal)
    }
}

@ViewBuilder
func settingsBackHeader(title: String, dismiss: DismissAction) -> some View {
    // ardot C/Push Nav Bar (237:94): 48h, floating-glass back + 14pt Semibold title in glass
    // capsule. Used pinned above scroll content via `.safeAreaInset(edge: .top)`.
    AtlasPushNavBar(title: title, onBack: { dismiss() })
}

/// Grouped card container used across settings/compliance screens: white surface, hairline rule
/// border, 16pt padding. Reconstructed after the working-tree version was lost.
@ViewBuilder
func settingsGroupedCard<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: 0) {
        content()
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(16)
    .background(AtlasColors.surface)
    .overlay(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous).stroke(AtlasColors.rule, lineWidth: 1))
    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
}

/// Devices management sub-screen (S38 Notification Devices). Reconstructed after the working-tree
/// version was lost. Lists the current device + push permission toggle + sign-out.
struct DeviceManagementView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                settingsGroupedCard {
                    HStack(spacing: 12) {
                        DeimosIconView(icon: .devices, size: 20, color: AtlasColors.ink)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(UIDevice.current.name)
                                .font(AtlasTypography.mobileSubheadline())
                                .foregroundStyle(AtlasColors.ink)
                            Text("当前设备 · iPhone")
                                .font(.system(size: 12))
                                .foregroundStyle(AtlasColors.inkFaint)
                        }
                        Spacer()
                        Text("在线")
                            .font(AtlasTypography.badge())
                            .foregroundStyle(AtlasColors.success)
                    }
                }

                settingsGroupedCard {
                    Link(destination: URL(string: UIApplication.openSettingsURLString)!) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("推送通知")
                                    .font(AtlasTypography.mobileSubheadline())
                                    .foregroundStyle(AtlasColors.ink)
                                Text("在系统设置中管理通知授权")
                                    .font(.system(size: 12))
                                    .foregroundStyle(AtlasColors.inkFaint)
                            }
                            Spacer()
                            DeimosIconView(icon: .chevronRight, size: 12, color: AtlasColors.inkFaint)
                        }
                    }
                    .buttonStyle(.plain)
                }

                settingsGroupedCard {
                    Button {
                        Task { await session.logout() }
                    } label: {
                        HStack {
                            Text("退出登录")
                                .font(AtlasTypography.mobileSubheadline())
                                .foregroundStyle(AtlasColors.destructive)
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "登录设备", dismiss: dismiss)
        }
        .navigationBarHidden(true)
    }
}

struct LegalPrivacyView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                legalSection("隐私政策", subtitle: "说明邮箱、头像、使用数据等收集范围") {
                    openURL(LegalLinks.privacyURL)
                }
                legalSection("用户协议", subtitle: "服务规则、内容责任与账号使用条款") {
                    openURL(LegalLinks.termsURL)
                }
                legalSection("数据权利", subtitle: "访问、更正、删除或导出个人数据") {
                    openURL(LegalLinks.privacyURL)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("账户注销")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(AtlasColors.ink)
                    Text("可在「设置 > 账户与安全」中永久注销账户。注销后登录凭证与个人资料将被删除。")
                        .font(.system(size: 13))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AtlasColors.surface)
                .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.rule))

                legalSection("联系支持", subtitle: "隐私疑问、删除失败、申诉渠道") {
                    openURL(LegalLinks.supportURL)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "法律与隐私", dismiss: dismiss)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
    }

    private func legalSection(_ title: String, subtitle: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(AtlasColors.ink)
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkFaint)
                }
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AtlasColors.inkFaint)
            }
            .padding(16)
            .background(AtlasColors.surface)
            .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.rule))
        }
        .buttonStyle(.plain)
    }
}

struct AboutDeimosView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(spacing: 8) {
                    Text("DEIMOS")
                        .font(AtlasTypography.eyebrow())
                        .tracking(3)
                        .foregroundStyle(AtlasColors.inkFaint)
                    Text("火卫二")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text("版本 \(appVersion)")
                        .font(.system(size: 13))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)

                Text("AI Agent 想法市场。浏览广场不需要登录；登录后可评论、送花、关注与对话。")
                    .font(.system(size: 14))
                    .foregroundStyle(AtlasColors.inkSoft)

                VStack(spacing: 0) {
                    aboutLink("隐私政策") { openURL(LegalLinks.privacyURL) }
                    Divider().overlay(AtlasColors.rule)
                    aboutLink("用户协议") { openURL(LegalLinks.termsURL) }
                    Divider().overlay(AtlasColors.rule)
                    aboutLink("联系支持") { openURL(LegalLinks.supportURL) }
                }
                .background(AtlasColors.surface)
                .overlay(RoundedRectangle(cornerRadius: 2).stroke(AtlasColors.rule))
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "关于火卫二", dismiss: dismiss)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
    }

    private func aboutLink(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .font(.system(size: 15))
                    .foregroundStyle(AtlasColors.ink)
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AtlasColors.inkFaint)
            }
            .padding(.horizontal, 16)
            .frame(height: 52)
        }
        .buttonStyle(.plain)
    }
}

/// Contact support sub-screen (S18 Support Contact). Reconstructed after the working-tree version
/// was lost. Offers mailto + FAQ links. Pinned push nav bar above scroll content.
struct ContactSupportView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("需要帮助？")
                        .font(AtlasTypography.cardTitle())
                        .foregroundStyle(AtlasColors.ink)
                    Text("描述你遇到的问题，我们通常在 1 个工作日内回复。")
                        .font(.system(size: 13))
                        .foregroundStyle(AtlasColors.inkSoft)
                }

                settingsGroupedCard {
                    Button {
                        if let url = URL(string: "mailto:support@wanye.app?subject=Deimos%20%E5%8F%8D%E9%A6%88") {
                            openURL(url)
                        }
                    } label: {
                        HStack(spacing: 12) {
                            DeimosIconView(icon: .mail, size: 18, color: AtlasColors.ink)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("邮件支持")
                                    .font(AtlasTypography.mobileSubheadline())
                                    .foregroundStyle(AtlasColors.ink)
                                Text("support@wanye.app")
                                    .font(.system(size: 12))
                                    .foregroundStyle(AtlasColors.inkFaint)
                            }
                            Spacer()
                            DeimosIconView(icon: .chevronRight, size: 12, color: AtlasColors.inkFaint)
                        }
                    }
                    .buttonStyle(.plain)
                }

                settingsGroupedCard {
                    Link(destination: URL(string: "https://wanye.app/help")!) {
                        HStack(spacing: 12) {
                            DeimosIconView(icon: .info, size: 18, color: AtlasColors.ink)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("帮助中心")
                                    .font(AtlasTypography.mobileSubheadline())
                                    .foregroundStyle(AtlasColors.ink)
                                Text("常见问题、使用指南、社区规范")
                                    .font(.system(size: 12))
                                    .foregroundStyle(AtlasColors.inkFaint)
                            }
                            Spacer()
                            DeimosIconView(icon: .chevronRight, size: 12, color: AtlasColors.inkFaint)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "联系支持", dismiss: dismiss)
        }
        .navigationBarHidden(true)
    }
}
