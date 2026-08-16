#if !targetEnvironment(simulator)
import SwiftUI

/// S13 绑定手机号 — 画板表单页(微信登录后的手机号绑定)。
/// 40pt 圆形返回 + 标题;64pt lemonSoft hero 图标;描述 13 Regular #8A94A6;
/// 手机号 / 短信验证码 + 获取验证码(lemonSoft 底 olive 字);r24 CTA(lemonStrong 底
/// lemonInk 字);底部「暂不绑定，先逛逛」#A9B2C0 链接。
struct WeChatPhoneBindView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session

    @State private var phone = ""
    @State private var code = ""
    @State private var isSending = false
    @State private var isVerifying = false
    @State private var countdown = 0
    @State private var countdownTimer: Timer?

    private var canSubmit: Bool {
        phone.trimmingCharacters(in: .whitespacesAndNewlines).count >= 11
            && !code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            AtlasSubPageNavBar(title: "绑定手机号", onBack: {
                APIClient.shared.setPendingToken(nil)
                dismiss()
            })

            // S13 Hero Icon — 64×64 r20 lemonSoft, olive phone glyph.
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(AtlasColors.lemonSoft)
                .frame(width: 64, height: 64)
                .overlay(
                    DeimosIconView(icon: .phone, size: 28, color: AtlasColors.olive)
                )

            Text("为了保障账号安全，微信首次登录需要绑定手机号。绑定后可用于接收想法互动通知。")
                .font(.system(size: 13))
                .foregroundStyle(AtlasColors.inkTertiary)
                .lineSpacing(7)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 12) {
                AtlasFormTextField(placeholder: "手机号", text: $phone, keyboard: .phonePad)

                HStack(spacing: 10) {
                    AtlasFormTextField(placeholder: "短信验证码", text: $code, keyboard: .numberPad)
                    sendCodeButton
                }
            }
            .padding(.top, 8)

            AtlasFormCTA(
                title: "完成绑定",
                fill: AtlasColors.lemonStrong,
                textColor: AtlasColors.lemonInk,
                isLoading: isVerifying
            ) {
                Task { await verify() }
            }
            .disabled(!canSubmit)

            HStack(spacing: 4) {
                Button("暂不绑定，先逛逛") {
                    APIClient.shared.setPendingToken(nil)
                    dismiss()
                }
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color(hex: 0xA9B2C0))
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

    /// S13 `Code Row`:112×48 r12 lemonSoft 底、olive SemiBold 13。发送后 60s 冷却。
    private var sendCodeButton: some View {
        Button {
            Task { await sendCode() }
        } label: {
            Group {
                if isSending {
                    ProgressView()
                        .tint(AtlasColors.olive)
                } else if countdown > 0 {
                    Text("重新发送 \(countdown)s")
                } else {
                    Text("获取验证码")
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
        .disabled(isSending || countdown > 0 || phone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }

    private func sendCode() async {
        let trimmed = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 11 else {
            ToastCenter.shared.showError("请输入正确的手机号")
            return
        }
        isSending = true
        defer { isSending = false }
        do {
            try await APIClient.shared.sendPhoneCode(phone: trimmed)
            startCountdown()
            ToastCenter.shared.showSuccess("验证码已发送")
        } catch {
            ToastCenter.shared.showError(error.localizedDescription)
        }
    }

    private func verify() async {
        guard canSubmit else { return }
        isVerifying = true
        defer { isVerifying = false }
        do {
            let user = try await APIClient.shared.verifyPhone(
                phone: phone.trimmingCharacters(in: .whitespacesAndNewlines),
                code: code.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            session.user = user
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
#endif
