import SwiftUI

struct VerifyEmailLinkView: View {
    let token: String
    var onDone: () -> Void

    @State private var phase: LoadPhase = .loading
    @State private var message = ""

    private enum LoadPhase {
        case loading, success, error
    }

    var body: some View {
        VStack(spacing: 16) {
            sheetHeader(title: "邮箱验证", onClose: onDone)
            statusCard
            if phase == .success {
                AtlasPrimaryButton(title: "完成") { onDone() }
            } else if phase == .error {
                AtlasOutlineButton(title: "关闭") { onDone() }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.bottom, 24)
        .background(AtlasColors.surface)
        .task { await verify() }
    }

    @ViewBuilder
    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            switch phase {
            case .loading:
                HStack(spacing: 10) {
                    ProgressView()
                    Text("正在验证邮箱…")
                        .font(.system(size: 14))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
            case .success:
                Text("验证成功")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(AtlasColors.accentActive)
                Text(message)
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.inkSoft)
            case .error:
                Text("链接无效或已过期")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(AtlasColors.coral)
                Text(message)
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.inkSoft)
            }
        }
        .padding(AtlasMetrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.fill)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }

    private func verify() async {
        do {
            try await APIClient.shared.verifyEmail(token: token)
            phase = .success
            message = "邮箱已验证，你现在可以正常使用账号功能。"
        } catch {
            phase = .error
            message = error.localizedDescription
        }
    }
}

struct ResetPasswordLinkView: View {
    let token: String
    var onDone: () -> Void

    @State private var password = ""
    @State private var confirm = ""
    @State private var isSubmitting = false
    @State private var phase: Phase = .form
    @State private var errorMessage: String?

    private enum Phase {
        case form, success, expired
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                sheetHeader(title: "重置密码", onClose: onDone)

                if phase == .expired {
                    expiredCard
                } else if phase == .success {
                    successCard
                } else {
                    formCard
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.bottom, 24)
        }
        .background(AtlasColors.surface)
        .onAppear {
            if token.isEmpty {
                phase = .expired
            }
        }
    }

    private var formCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("设置新密码后，请使用新密码登录。")
                .font(.system(size: 13))
                .foregroundStyle(AtlasColors.inkSoft)
            secureField("新密码", text: $password)
            secureField("确认新密码", text: $confirm)
            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.coral)
            }
            AtlasPrimaryButton(title: "重置密码", isLoading: isSubmitting) {
                Task { await submit() }
            }
            AtlasOutlineButton(title: "取消") { onDone() }
        }
    }

    private var successCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("密码已重置，请使用新密码登录。")
                .font(.system(size: 14))
                .foregroundStyle(AtlasColors.inkSoft)
                .padding(AtlasMetrics.cardPadding)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AtlasColors.accentActiveSoft)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
            AtlasPrimaryButton(title: "完成") { onDone() }
        }
    }

    private var expiredCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("重置链接缺失或已过期，请重新申请忘记密码邮件。")
                .font(.system(size: 14))
                .foregroundStyle(AtlasColors.inkSoft)
                .padding(AtlasMetrics.cardPadding)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
            AtlasOutlineButton(title: "关闭") { onDone() }
        }
    }

    private func secureField(_ title: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(AtlasTypography.overline())
                .foregroundStyle(AtlasColors.inkFaint)
            AtlasTextField(placeholder: title, text: text, isSecure: true, height: AtlasMetrics.inputHeight)
                .padding(.horizontal, 4)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
        }
    }

    private func submit() async {
        guard password.count >= 6 else {
            errorMessage = "密码至少 6 位"
            return
        }
        guard password == confirm else {
            errorMessage = "两次密码不一致"
            return
        }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        do {
            try await APIClient.shared.resetPassword(token: token, newPassword: password)
            phase = .success
        } catch {
            if error.localizedDescription.contains("expired") || error.localizedDescription.contains("无效") {
                phase = .expired
            } else {
                errorMessage = error.localizedDescription
            }
        }
    }
}

@ViewBuilder
private func sheetHeader(title: String, onClose: @escaping () -> Void) -> some View {
    VStack(spacing: 12) {
        AtlasSheetGrabber()
            .padding(.top, 8)
        HStack {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
            Spacer()
            Button("关闭", action: onClose)
                .font(.system(size: 15))
                .foregroundStyle(AtlasColors.inkFaint)
        }
    }
}
