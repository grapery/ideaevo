#if !targetEnvironment(simulator)
import Foundation

enum WeChatOAuthService {
    static var isAvailable: Bool {
        WeChatConfiguration.isConfigured
    }

    static var isWeChatInstalled: Bool {
        WeChatShareService.isWeChatInstalled
    }

    @MainActor
    static func signIn() async throws -> String {
        guard isAvailable else {
            throw OAuthError.failed("微信登录未配置")
        }

        WeChatShareService.registerIfConfigured()

        guard isWeChatInstalled else {
            throw OAuthError.failed("请先安装微信客户端")
        }

        let state = generateState()

        return try await withCheckedThrowingContinuation { continuation in
            final class ResumeGuard: @unchecked Sendable {
                private let lock = NSLock()
                private var resumed = false

                func resume(_ cont: CheckedContinuation<String, Error>, with result: Result<String, Error>) {
                    lock.lock()
                    defer { lock.unlock() }
                    guard !resumed else { return }
                    resumed = true
                    cont.resume(with: result)
                }
            }

            let guardBox = ResumeGuard()

            WeChatResponseHandler.shared.beginAuth(state: state) { result in
                guardBox.resume(continuation, with: result)
            }

            let request = SendAuthReq()
            request.scope = "snsapi_userinfo"
            request.state = state

            WXApi.send(request) { success in
                if success { return }
                WeChatResponseHandler.shared.cancelAuth()
                guardBox.resume(continuation, with: .failure(OAuthError.failed("无法唤起微信")))
            }
        }
    }

    private static func generateState() -> String {
        let timestamp = String(Int(Date().timeIntervalSince1970))
        let random = UUID().uuidString.prefix(8)
        return "wechat_\(timestamp)_\(random)"
    }
}
#endif
