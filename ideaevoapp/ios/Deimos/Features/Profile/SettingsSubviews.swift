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
    @State private var isUploadingAvatar = false

    var body: some View {
        // PhotosPicker 的 label 闭包是非隔离上下文,先取出局部值再捕获。
        let currentUser = session.user

        return ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                AtlasSubPageNavBar(title: "编辑资料", onBack: { dismiss() }) {
                    AtlasNavTextAction(title: "保存", isLoading: isSaving) {
                        Task { await save() }
                    }
                }

                PhotosPicker(selection: $avatarItem, matching: .images) {
                    VStack(spacing: 8) {
                        EntityAvatar.user(
                            id: currentUser?.id ?? "current-user",
                            url: currentUser?.avatarLink,
                            name: currentUser?.name ?? name,
                            size: 84
                        )
                        Text(isUploadingAvatar ? "头像上传中…" : "更换头像")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(AtlasColors.olive)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
                }
                .buttonStyle(.plain)
                .disabled(isUploadingAvatar)

                AtlasFormField(label: "昵称") {
                    AtlasFormTextField(placeholder: "昵称", text: $name)
                }

                AtlasFormField(label: "简介") {
                    AtlasFormTextEditor(text: $bio, minHeight: 76, placeholder: "一句话介绍自己")
                }

                if let message {
                    Text(message)
                        .font(AtlasTypography.meta())
                        .foregroundStyle(message.contains("成功") ? AtlasColors.success : AtlasColors.destructive)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                AtlasFormGroupLabel(text: "账号信息（只读）")
                AtlasFormGroupCard {
                    AtlasFormGroupRow(label: "邮箱") {
                        AtlasFormGroupValue(text: session.user?.email ?? "未绑定")
                    }
                    AtlasFormGroupRow(label: "手机号") {
                        AtlasFormGroupValue(text: SettingsView.maskedPhone(session.user?.phone))
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
        .onAppear {
            name = session.user?.name ?? ""
            bio = session.user?.bio ?? ""
        }
        .onChange(of: avatarItem) { _, item in
            guard let item else { return }
            Task { await uploadImage(item) }
        }
    }

    private func uploadImage(_ item: PhotosPickerItem) async {
        isUploadingAvatar = true
        message = nil
        defer { isUploadingAvatar = false }
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw APIError.server("无法读取图片")
            }
            let publicURL = try await APIClient.shared.uploadImage(kind: "avatar", data: data, contentType: "image/jpeg")
            let user = try await APIClient.shared.updateProfile(avatarURL: publicURL, avatarSource: "upload")
            session.user = user
            message = "头像已更新"
            avatarItem = nil
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
            ToastCenter.shared.showSuccess("资料已更新")
        } catch { message = error.localizedDescription }
    }
}

// MARK: - S36 Account & Security · Navigation Hub

/// Sub-routes pushed from AccountSecurityView (kept local — these don't belong in the
/// top-level SettingsRoute enum since they're only reachable from this screen).
enum AccountSecurityRoute: Hashable {
    case blocklist
    case deleteAccount
}

/// 账号与安全 hub (entry row on S06 我的): login-method info + binding/phone rows +
/// blocklist (S29) and delete-account (S28) destinations, in the board's group language.
struct AccountSecurityView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session

    @State private var route: AccountSecurityRoute?
    @State private var showPhoneBind = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                AtlasSubPageNavBar(title: "账号与安全", onBack: { dismiss() })

                AtlasFormGroupLabel(text: "登录方式")
                AtlasFormGroupCard {
                    AtlasFormGroupRow(label: "登录方式") {
                        AtlasFormGroupValue(text: session.user.map { providerLabel($0.authProvider) } ?? "—")
                    }
                    AtlasFormGroupRow(label: "邮箱") {
                        AtlasFormGroupValue(
                            text: session.user?.email ?? "未设置",
                            color: (session.user?.emailVerified ?? false) ? AtlasColors.success : AtlasColors.inkSoft
                        )
                    }
                    AtlasFormGroupRow(label: "手机号", height: 52) {
                        Button { showPhoneBind = true } label: {
                            HStack(spacing: 4) {
                                AtlasFormGroupValue(text: phoneValueLabel)
                                DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }

                AtlasFormGroupLabel(text: "安全")
                AtlasFormGroupCard {
                    Button { route = .blocklist } label: {
                        AtlasFormGroupRow(label: "黑名单管理") {
                            AtlasRowChevron()
                        }
                    }
                    .buttonStyle(.plain)
                    Button { route = .deleteAccount } label: {
                        AtlasFormGroupRow(label: "删除账号") {
                            AtlasFormGroupValue(text: "永久删除账户与资料", color: AtlasColors.destructive)
                            AtlasRowChevron()
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
        .navigationDestination(item: $route) { destination in
            switch destination {
            case .blocklist: BlocklistView()
            case .deleteAccount: DeleteAccountView()
            }
        }
        #if DEBUG
        // Verify-only launch hook: `--deimos-goto-blocklist` pushes the S29 screen directly.
        .onAppear {
            if ProcessInfo.processInfo.arguments.contains("--deimos-goto-blocklist") {
                route = .blocklist
            }
        }
        #endif
        .fullScreenCover(isPresented: $showPhoneBind) { PhoneBindView() }
    }

    private var phoneValueLabel: String {
        guard let user = session.user else { return "未绑定" }
        if user.phoneVerified, let phone = user.phone, !phone.isEmpty {
            return "已绑定 \(phone)"
        }
        return user.authProvider == "wechat" ? "去绑定" : "去绑定"
    }

    private func providerLabel(_ provider: String) -> String {
        switch provider {
        case "apple": return "Apple"
        case "google": return "Google"
        case "wechat": return "微信"
        case "email": return "邮箱"
        default: return provider
        }
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

    private var canProceed: Bool {
        session.user.map { canProceedDelete(for: $0.authProvider) } ?? false
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                AtlasSubPageNavBar(title: "删除账号", onBack: { dismiss() })

                VStack(alignment: .leading, spacing: 8) {
                    Text("这会删除账号和关联个人数据")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.destructive)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("个人资料、登录凭证、设备 token 和通知设置将被删除。")
                        .font(.system(size: 13))
                        .foregroundStyle(AtlasColors.inkTertiary)
                        .lineSpacing(6)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(AtlasColors.dangerSoft)
                )

                VStack(alignment: .leading, spacing: 6) {
                    Text("1. 验证身份（密码或短信）")
                    Text("2. 显示删除预计完成时间")
                    Text("3. 输入 DELETE 确认执行")
                }
                .font(.system(size: 13))
                .foregroundStyle(AtlasColors.ink)
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(AtlasColors.settingsGroupFill)
                )

                verificationFields

                AtlasFormCTA(
                    title: "确认删除",
                    fill: AtlasColors.destructive,
                    textColor: .white,
                    height: 52,
                    isLoading: isDeleting
                ) {
                    showDeleteDialog = true
                }
                .opacity(canProceed ? 1 : 0.5)

                Button { dismiss() } label: {
                    Text("保留账号")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .frame(height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
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

    /// S28 Confirm Fields — email shows the password field, google/apple the DELETE
    /// field; the wechat path keeps its phone + SMS pair (not covered by the board).
    @ViewBuilder
    private var verificationFields: some View {
        if let user = session.user {
            switch user.authProvider {
            case "email":
                AtlasFormField(label: "输入密码确认注销") {
                    AtlasFormTextField(placeholder: "\(String(repeating: "•", count: 8))", text: $deletePassword, secure: true)
                }
            case "google", "apple":
                AtlasFormField(label: "输入 DELETE 确认注销") {
                    AtlasFormTextField(placeholder: "DELETE", text: $deleteConfirm)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                }
            case "wechat":
                VStack(spacing: 12) {
                    AtlasFormField(label: "绑定手机号") {
                        AtlasFormTextField(placeholder: "手机号", text: $deletePhone, keyboard: .phonePad)
                    }
                    HStack(spacing: 12) {
                        AtlasFormTextField(placeholder: "短信验证码", text: $deleteSMSCode, keyboard: .numberPad)
                        Button {
                            Task {
                                try? await APIClient.shared.sendPhoneCode(
                                    phone: deletePhone.trimmingCharacters(in: .whitespacesAndNewlines),
                                    purpose: "account_delete"
                                )
                            }
                        } label: {
                            Text("发送验证码")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(AtlasColors.olive)
                                .padding(.horizontal, 12)
                                .frame(height: 40)
                                .background(Capsule(style: .continuous).fill(AtlasColors.lemonSoft))
                        }
                        .buttonStyle(.plain)
                    }
                }
            default:
                Text("当前登录方式不支持在此注销")
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.inkFaint)
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


// MARK: - S38 Notification Devices · GET/DELETE /user/devices


// MARK: - S14 Privacy & Safety Center · Data + Blocks + Policies


// MARK: - S18 Support Contact · App Review Safety


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
            .font(.system(size: 16))
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
