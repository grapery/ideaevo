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
            VStack(alignment: .leading, spacing: 14) {
                // S20 Back button row (36×36 r18 #F4F5F8)
                HStack(spacing: 8) {
                    AtlasNavBackButton { dismiss() }
                    Spacer()
                }
                .padding(.horizontal, 8)
                .frame(height: AtlasToolbarMetrics.barHeight)

                // S20 Screen Title — 28pt Bold ink (Ardot 189:13)
                Text("编辑个人资料")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)

                // S20 Avatar Background Upload card — bg #F7F8FA r16 (Ardot 189:14)
                VStack(alignment: .leading, spacing: 8) {
                    Text("头像、背景图")
                        .font(.system(size: 15))
                        .foregroundStyle(Color(hex: 0x3E4652))
                    Text("昵称、bio、邮箱、手机绑定与密码")
                        .font(.system(size: 15))
                        .foregroundStyle(Color(hex: 0x3E4652))
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(hex: 0xF7F8FA))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                profileBanner

                HStack(spacing: 12) {
                    PhotosPicker(selection: $avatarItem, matching: .images) {
                        Text(isUploadingAvatar ? "头像上传中…" : "更换头像")
                            .font(AtlasTypography.caption())
                            .foregroundStyle(AtlasColors.ink)
                    }
                    .disabled(isUploadingAvatar || isUploadingBackground)

                    PhotosPicker(selection: $backgroundItem, matching: .images) {
                        Text(isUploadingBackground ? "背景上传中…" : "更换背景")
                            .font(AtlasTypography.caption())
                            .foregroundStyle(AtlasColors.ink)
                    }
                    .disabled(isUploadingAvatar || isUploadingBackground)
                }

                // S20 Editable Profile Fields card — white + 1px border r16 (Ardot 189:139)
                VStack(alignment: .leading, spacing: 8) {
                    labeledField("昵称", text: $name)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("简介")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(AtlasColors.inkSoft)
                        AtlasTextEditor(text: $bio, minHeight: 96)
                            .padding(12)
                            .background(AtlasColors.surface)
                            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous)
                                    .stroke(AtlasColors.border, lineWidth: 1)
                            )
                    }
                }
                .padding(16)
                .background(Color.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color(hex: 0xE7EAF0), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                if let message {
                    Text(message)
                        .font(AtlasTypography.meta())
                        .foregroundStyle(message.contains("成功") ? AtlasColors.olive : AtlasColors.coral)
                }

                // S20 Save Profile Button — lemonInk bg, white text, 48h r12 (Ardot 189:16)
                Button {
                    Task { await save() }
                } label: {
                    HStack(spacing: 8) {
                        if isSaving {
                            ProgressView().tint(.white)
                        }
                        Text("保存资料")
                            .font(.system(size: 15, weight: .bold))
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .foregroundStyle(Color.white)
                    .background(AtlasColors.lemonInk)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(isSaving)

                // S20 Account Security Rows — bg #F2FFC5 r16, lemonInk text (Ardot 189:141)
                VStack(alignment: .leading, spacing: 8) {
                    Text("密码 · 可修改")
                        .font(.system(size: 15))
                        .foregroundStyle(AtlasColors.lemonInk)
                    Text("第三方登录 · Apple / Google / 微信")
                        .font(.system(size: 15))
                        .foregroundStyle(AtlasColors.lemonInk)
                    Text("注销账号入口在设置中")
                        .font(.system(size: 15))
                        .foregroundStyle(AtlasColors.lemonInk)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(hex: 0xF2FFC5))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .atlasScrollDismissesKeyboard()
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

    private var profileBanner: some View {
        ZStack(alignment: .bottomLeading) {
            Group {
                if let backgroundURL = session.user?.backgroundURL, let url = URL(string: backgroundURL) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFill()
                        default:
                            defaultBannerGradient
                        }
                    }
                } else {
                    defaultBannerGradient
                }
            }
            .frame(height: 120)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))

            if let user = session.user {
                EntityAvatar.user(
                    id: user.id,
                    url: user.avatarLink,
                    name: user.name,
                    size: 64
                )
                .overlay(Circle().stroke(AtlasColors.surface, lineWidth: 3))
                .offset(x: AtlasMetrics.pageX, y: 32)
            }
        }
        .padding(.bottom, 32)
    }

    private var defaultBannerGradient: some View {
        LinearGradient(
            colors: [
                AtlasColors.entityUser.opacity(0.85),
                AtlasColors.entityUser.opacity(0.35),
                AtlasColors.canvas,
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private func labeledField(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AtlasColors.inkSoft)
            AtlasTextField(placeholder: label, text: text, height: AtlasMetrics.inputHeight)
                .padding(.horizontal, 4)
                .background(AtlasColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous)
                        .stroke(AtlasColors.border, lineWidth: 1)
                )
        }
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
                settingsBackHeader(title: "账户与安全", dismiss: dismiss)

                if let user = session.user {
                    settingsGroupedCard {
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
                }

                phoneBindSection

                Text("修改密码")
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)

                AtlasTextField(placeholder: "当前密码", text: $oldPassword, isSecure: true, height: AtlasMetrics.inputHeight)
                    .padding(.horizontal, 4)
                    .background(AtlasColors.fill)
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
                AtlasTextField(placeholder: "新密码（至少 6 位）", text: $newPassword, isSecure: true, height: AtlasMetrics.inputHeight)
                    .padding(.horizontal, 4)
                    .background(AtlasColors.fill)
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))

                if let message {
                    Text(message)
                        .font(AtlasTypography.meta())
                        .foregroundStyle(message.contains("成功") ? AtlasColors.accentActive : AtlasColors.coral)
                }

                AtlasPrimaryButton(title: "更新密码", isLoading: isSaving) {
                    Task { await changePassword() }
                }

                deleteAccountSection
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: showPhoneBind)
        .navigationBarHidden(true)
        .atlasScrollDismissesKeyboard()
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
                .presentationDetents([.height(380)])
                .presentationDragIndicator(.hidden)
                .presentationCornerRadius(AtlasMetrics.radiusSheet)
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
                        .font(AtlasTypography.caption())
                        .foregroundStyle(AtlasColors.ink)
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
                AtlasTextField(placeholder: "输入密码确认注销", text: $deletePassword, isSecure: true, height: AtlasMetrics.inputHeight)
                    .padding(.horizontal, 4)
                    .background(AtlasColors.fill)
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
            case "google", "apple":
                AtlasTextField(
                    placeholder: "输入 DELETE 确认注销",
                    text: $deleteConfirm,
                    keyboardType: .asciiCapable,
                    height: AtlasMetrics.inputHeight
                )
                .padding(.horizontal, 4)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
            case "wechat":
                AtlasTextField(placeholder: "绑定手机号", text: $deletePhone, keyboardType: .phonePad, height: AtlasMetrics.inputHeight)
                    .padding(.horizontal, 4)
                    .background(AtlasColors.fill)
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
                HStack(spacing: 8) {
                    AtlasTextField(placeholder: "短信验证码", text: $deleteSMSCode, keyboardType: .numberPad, height: AtlasMetrics.inputHeight)
                        .padding(.horizontal, 4)
                        .background(AtlasColors.fill)
                        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
                    Button("发送验证码") {
                        Task {
                            try? await APIClient.shared.sendPhoneCode(
                                phone: deletePhone.trimmingCharacters(in: .whitespacesAndNewlines),
                                purpose: "account_delete"
                            )
                        }
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.ink)
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
        .font(AtlasTypography.mobileSubheadline())
        .foregroundStyle(AtlasColors.coral)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Color(hex: 0xF1E8E8))
        .clipShape(RoundedRectangle(cornerRadius: 25, style: .continuous))
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

            settingsGroupedCard {
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
            .padding(.horizontal, AtlasMetrics.pageX)

            Text("外观与文字大小将在后续版本支持。")
                .font(.system(size: 12))
                .foregroundStyle(AtlasColors.inkFaint)
                .padding(.horizontal, AtlasMetrics.pageX)

            Spacer()
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
    }
}

struct NotificationPreferencesView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var pushEnabled = AppPreferencesStore.pushEnabled
    @State private var flowers = AppPreferencesStore.notifyFlowers
    @State private var comments = AppPreferencesStore.notifyComments
    @State private var follows = AppPreferencesStore.notifyFollows
    @State private var pushStatus: UNAuthorizationStatus = .notDetermined
    @State private var isRequestingPush = false
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var syncMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                settingsBackHeader(title: "通知偏好", dismiss: dismiss)

                pushPermissionSection

                settingsGroupedCard {
                    toggleRow("启用推送通知", isOn: $pushEnabled)
                    Divider().overlay(AtlasColors.rule)
                    toggleRow("送花", isOn: $flowers)
                    Divider().overlay(AtlasColors.rule)
                    toggleRow("评论与回复", isOn: $comments)
                    Divider().overlay(AtlasColors.rule)
                    toggleRow("关注与 Fork", isOn: $follows)
                }
                .disabled(isLoading || isSaving || !pushEnabled)

                if let syncMessage {
                    Text(syncMessage)
                        .font(.system(size: 12))
                        .foregroundStyle(syncMessage.contains("失败") ? AtlasColors.coral : AtlasColors.accentActive)
                }

                Text("偏好会同步到账户；关闭的分类不会在通知列表中显示。")
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.inkFaint)
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .onChange(of: pushEnabled) { _, _ in Task { await persistPreferences() } }
        .onChange(of: flowers) { _, _ in Task { await persistPreferences() } }
        .onChange(of: comments) { _, _ in Task { await persistPreferences() } }
        .onChange(of: follows) { _, _ in Task { await persistPreferences() } }
        .task {
            await refreshPushStatus()
            await loadPreferences()
        }
    }

    private var pushPermissionSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("系统推送")
                .font(AtlasTypography.cardTitle())
                .foregroundStyle(AtlasColors.ink)

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
                    Text(PushNotificationManager.shared.deviceRegistered ? "推送权限已开启 · 设备 token 已同步" : "推送权限已开启")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.accentActive)
                }
            }
            .padding(AtlasMetrics.cardPadding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AtlasColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
            .atlasElevatedCard()
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

    private func loadPreferences() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let prefs = try await APIClient.shared.getNotificationPreferences()
            pushEnabled = prefs.pushEnabled
            flowers = prefs.pushFlowers
            comments = prefs.pushComments
            follows = prefs.pushFollows
            AppPreferencesStore.apply(prefs)
            syncMessage = nil
        } catch {
            syncMessage = "无法从服务器加载，已使用本机缓存"
        }
    }

    private func persistPreferences() async {
        AppPreferencesStore.pushEnabled = pushEnabled
        AppPreferencesStore.notifyFlowers = flowers
        AppPreferencesStore.notifyComments = comments
        AppPreferencesStore.notifyFollows = follows
        isSaving = true
        defer { isSaving = false }
        do {
            let prefs = try await APIClient.shared.updateNotificationPreferences(
                UpdateNotificationPreferencesBody(
                    pushFlowers: flowers,
                    pushComments: comments,
                    pushFollows: follows,
                    pushEnabled: pushEnabled
                )
            )
            AppPreferencesStore.apply(prefs)
            syncMessage = "已保存到账户"
        } catch {
            syncMessage = "保存失败：\(error.localizedDescription)"
        }
    }

    private func toggleRow(_ title: String, isOn: Binding<Bool>) -> some View {
        Toggle(title, isOn: isOn)
            .font(AtlasTypography.mobileBody())
            .padding(.horizontal, 16)
            .frame(minHeight: AtlasMetrics.settingsRowMinHeight)
            .tint(AtlasColors.accentActive)
    }
}

@ViewBuilder
func settingsGroupedCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    VStack(spacing: 0) {
        content()
    }
    .background(AtlasColors.surface)
    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    .atlasElevatedCard()
}

@ViewBuilder
func settingsBackHeader(title: String, dismiss: DismissAction) -> some View {
    VStack(alignment: .leading, spacing: 0) {
        // Back button row
        HStack(spacing: 8) {
            AtlasNavBackButton { dismiss() }
            Spacer()
        }
        .padding(.horizontal, 8)
        .frame(height: AtlasToolbarMetrics.barHeight)

        // Page title — 32pt Bold, left-aligned per S14-S19 design
        if !title.isEmpty {
            Text(title)
                .font(.system(size: 32, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
                .padding(.horizontal, AtlasMetrics.detailX)
                .padding(.bottom, 4)
        }
    }
    .background(AtlasColors.canvas)
}

struct LegalPrivacyView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var docRoute: SettingsRoute?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                settingsBackHeader(title: "法律与隐私", dismiss: dismiss)

                legalSection("隐私与数据", subtitle: "数据用途、隐私选项与删除请求") {
                    docRoute = .privacyCenter
                }
                legalSection("AI 数据处理", subtitle: "AI 生成建议的数据同意管理") {
                    docRoute = .aiDataConsent
                }
                legalSection("隐私政策", subtitle: "说明邮箱、头像、使用数据等收集范围") {
                    docRoute = .privacyPolicy
                }
                legalSection("用户协议", subtitle: "服务规则、内容责任与账号使用条款") {
                    docRoute = .termsOfService
                }
                legalSection("社区规范", subtitle: "UGC 行为准则与举报机制") {
                    docRoute = .communityGuidelines
                }
                legalSection("黑名单", subtitle: "管理已拉黑的用户") {
                    docRoute = .blocklist
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("账户注销")
                        .font(AtlasTypography.mobileSubheadline())
                        .foregroundStyle(AtlasColors.ink)
                    Text("可在「设置 > 账户与安全」中永久注销账户。注销后登录凭证与个人资料将被删除。")
                        .font(.system(size: 13))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                .padding(AtlasMetrics.cardPadding)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AtlasColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard))
                .atlasElevatedCard()

                legalSection("联系支持", subtitle: "隐私疑问、删除失败、申诉渠道") {
                    docRoute = .supportContact
                }

                Button {
                    openURL(LegalLinks.privacyURL)
                } label: {
                    Text("在浏览器中打开完整隐私政策")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkFaint)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .navigationDestination(item: $docRoute) { destination in
            switch destination {
            case .privacyPolicy:
                LegalDocumentView(title: "隐私政策", sections: LegalDocuments.privacy)
            case .termsOfService:
                LegalDocumentView(title: "用户协议", sections: LegalDocuments.terms)
            case .communityGuidelines:
                LegalDocumentView(title: "社区规范", sections: LegalDocuments.community)
            case .contactSupport:
                LegalDocumentView(title: "联系支持", sections: LegalDocuments.support)
            case .blocklist:
                BlocklistView()
            case .privacyCenter:
                PrivacyCenterView()
            case .aiDataConsent:
                AIDataConsentView()
            case .supportContact:
                SupportContactView()
            default:
                EmptyView()
            }
        }
    }

    private func legalSection(_ title: String, subtitle: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(AtlasTypography.mobileSubheadline())
                        .foregroundStyle(AtlasColors.ink)
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkFaint)
                }
                Spacer()
                DeimosIconView(icon: .chevronRight, size: 12, color: AtlasColors.inkFaint)
            }
            .padding(AtlasMetrics.cardPadding)
            .background(AtlasColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard))
            .atlasElevatedCard()
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
                settingsBackHeader(title: "关于万叶", dismiss: dismiss)

                VStack(spacing: 8) {
                    Text("万叶")
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
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                .atlasElevatedCard()
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.bottom, 40)
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
                DeimosIconView(icon: .externalLink, size: 12, color: AtlasColors.inkFaint)
            }
            .padding(.horizontal, 16)
            .frame(height: 52)
        }
        .buttonStyle(.plain)
    }
}
