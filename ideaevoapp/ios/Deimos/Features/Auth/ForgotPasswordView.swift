import SwiftUI

struct ForgotPasswordView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var isSending = false
    @State private var message: String?
    @State private var isSuccess = false

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack {
                Spacer()
                Button("关闭") { dismiss() }
                    .font(AtlasTypography.feedBody())
                    .foregroundStyle(AtlasColors.inkFaint)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("忘记密码")
                    .font(AtlasTypography.screenTitle())
                    .foregroundStyle(AtlasColors.ink)

                Text("输入注册邮箱，我们会发送重置链接。")
                    .font(AtlasTypography.feedBody())
                    .foregroundStyle(AtlasColors.inkFaint)
            }

            AtlasTextField(placeholder: "邮箱", text: $email, keyboardType: .emailAddress, returnKeyType: .done, height: AtlasMetrics.inputHeight)
                .padding(.horizontal, 4)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))

            if let message {
                Text(message)
                    .font(AtlasTypography.meta())
                    .foregroundStyle(isSuccess ? AtlasColors.accentActive : AtlasColors.coral)
            }

            AtlasPrimaryButton(title: "发送重置邮件", isLoading: isSending) {
                Task { await send() }
            }

            Spacer()
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.top, 16)
        .padding(.bottom, 32)
        .background(AtlasColors.canvas)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }

    private func send() async {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            message = "请输入邮箱"
            isSuccess = false
            return
        }
        isSending = true
        message = nil
        defer { isSending = false }
        do {
            try await APIClient.shared.forgotPassword(email: trimmed)
            isSuccess = true
            message = "如果该邮箱已注册，重置邮件已发送"
            ToastCenter.shared.showSuccess("邮件已发送", message: "请查收邮箱中的重置链接")
        } catch {
            isSuccess = false
            message = error.localizedDescription
        }
    }
}
