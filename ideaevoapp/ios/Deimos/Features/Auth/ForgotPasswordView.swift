import SwiftUI

/// S12 找回密码 — 画板表单页。
/// 40pt 圆形返回 + 标题;描述 13 Regular #8A94A6;邮箱 / 邮箱验证码 + 发送验证码(lemonSoft
/// 底 olive 字)/ 新密码;r24 CTA(lemonStrong 底 lemonInk 字);底部「返回登录」olive 链接。
/// 后端为邮件 token 重置:验证码栏位接收邮件链接中的 token,深度链接流程(ResetPasswordLinkView)不受影响。
struct ForgotPasswordView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var code = ""
    @State private var newPassword = ""
    @State private var isSendingCode = false
    @State private var isResetting = false
    @State private var countdown = 0
    @State private var countdownTimer: Timer?

    private var canSubmit: Bool {
        !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && newPassword.count >= 8
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            AtlasSubPageNavBar(title: "找回密码", onBack: { dismiss() })

            Text("输入注册时使用的邮箱，我们会发送验证码到你的邮箱，验证后即可重设密码。")
                .font(.system(size: 13))
                .foregroundStyle(AtlasColors.inkTertiary)
                .lineSpacing(7)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 12) {
                AtlasFormTextField(placeholder: "邮箱", text: $email, keyboard: .emailAddress)

                HStack(spacing: 10) {
                    AtlasFormTextField(placeholder: "邮箱验证码", text: $code)
                    sendCodeButton
                }

                AtlasFormTextField(placeholder: "新密码（8 位以上）", text: $newPassword, secure: true)
            }
            .padding(.top, 8)

            AtlasFormCTA(
                title: "重置密码",
                fill: AtlasColors.lemonStrong,
                textColor: AtlasColors.lemonInk,
                isLoading: isResetting
            ) {
                Task { await reset() }
            }
            .disabled(!canSubmit)

            HStack(spacing: 4) {
                Button("返回登录") { dismiss() }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AtlasColors.olive)
            }
            .padding(.top, 6)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24)
        .padding(.top, 6)
        .padding(.bottom, 20)
        .background(AtlasColors.canvas.ignoresSafeArea())
        .presentationDragIndicator(.hidden)
        .onDisappear { countdownTimer?.invalidate() }
    }

    /// S12 `Code Row`:112×48 r12 lemonSoft 底、olive SemiBold 13。发送后进入 60s 冷却。
    private var sendCodeButton: some View {
        Button {
            Task { await sendCode() }
        } label: {
            Group {
                if isSendingCode {
                    ProgressView()
                        .tint(AtlasColors.olive)
                } else if countdown > 0 {
                    Text("重新发送 \(countdown)s")
                } else {
                    Text("发送验证码")
                }
            }
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(AtlasColors.olive)
            .frame(minWidth: 112, minHeight: 48)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(AtlasColors.lemonSoft)
            )
        }
        .buttonStyle(.plain)
        .disabled(isSendingCode || countdown > 0)
    }

    private func sendCode() async {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.contains("@"), trimmed.contains(".") else {
            ToastCenter.shared.showError("请输入正确的邮箱")
            return
        }
        isSendingCode = true
        defer { isSendingCode = false }
        do {
            try await APIClient.shared.forgotPassword(email: trimmed)
            startCountdown()
            ToastCenter.shared.showSuccess("验证码已发送", message: "请查收邮箱中的重置链接")
        } catch {
            ToastCenter.shared.showError(error.localizedDescription)
        }
    }

    private func reset() async {
        guard canSubmit else { return }
        isResetting = true
        defer { isResetting = false }
        do {
            try await APIClient.shared.resetPassword(
                token: code.trimmingCharacters(in: .whitespacesAndNewlines),
                newPassword: newPassword
            )
            ToastCenter.shared.showSuccess("密码已重置", message: "请使用新密码登录")
            dismiss()
        } catch {
            ToastCenter.shared.showError(error.localizedDescription)
        }
    }

    private func startCountdown() {
        countdown = 60
        countdownTimer?.invalidate()
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { timer in
            Task { @MainActor in
                countdown = max(0, countdown - 1)
                if countdown == 0 { timer.invalidate() }
            }
        }
    }
}
