import SwiftUI

struct PhoneBindView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session

    @State private var phone = ""
    @State private var code = ""
    @State private var isSending = false
    @State private var isVerifying = false
    @State private var message: String?
    @State private var isSuccess = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            AtlasSheetGrabber()
                .padding(.top, 8)

            AtlasSheetTitleRow(title: "绑定手机号", onClose: { dismiss() })

            Text("验证手机号用于账户安全与微信注销确认。")
                .font(AtlasTypography.mobileBody())
                .foregroundStyle(AtlasColors.inkSoft)

            AtlasTextField(placeholder: "手机号", text: $phone, keyboardType: .phonePad, height: AtlasMetrics.inputHeight)
                .padding(.horizontal, 4)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))

            HStack(spacing: 8) {
                AtlasTextField(placeholder: "验证码", text: $code, keyboardType: .numberPad, height: AtlasMetrics.inputHeight)
                    .padding(.horizontal, 4)
                    .background(AtlasColors.fill)
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))

                Button(isSending ? "发送中…" : "获取验证码") {
                    Task { await sendCode() }
                }
                .font(AtlasTypography.caption())
                .foregroundStyle(AtlasColors.ink)
                .disabled(isSending || phone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            if let message {
                Text(message)
                    .font(AtlasTypography.meta())
                    .foregroundStyle(isSuccess ? AtlasColors.accentActive : AtlasColors.coral)
            }

            AtlasPrimaryButton(title: "完成绑定", isLoading: isVerifying) {
                Task { await verify() }
            }
            .disabled(code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.bottom, 24)
        .background(AtlasColors.surface)
    }

    private func sendCode() async {
        let trimmed = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isSending = true
        message = nil
        defer { isSending = false }
        do {
            try await APIClient.shared.sendPhoneCode(phone: trimmed, purpose: "change_phone")
            isSuccess = true
            message = "验证码已发送"
        } catch {
            isSuccess = false
            message = error.localizedDescription
        }
    }

    private func verify() async {
        let trimmedPhone = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedCode = code.trimmingCharacters(in: .whitespacesAndNewlines)
        isVerifying = true
        message = nil
        defer { isVerifying = false }
        do {
            let user = try await APIClient.shared.verifyPhoneAsUser(phone: trimmedPhone, code: trimmedCode)
            session.user = user
            ToastCenter.shared.showSuccess("手机号已绑定")
            dismiss()
        } catch {
            isSuccess = false
            message = error.localizedDescription
        }
    }
}
