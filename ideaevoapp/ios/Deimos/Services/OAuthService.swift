import AuthenticationServices
import UIKit

struct OAuthResult: Sendable {
    let status: String
    let provider: String
    let token: String?
    let pendingToken: String?
    let errorCode: String?
}

enum OAuthError: LocalizedError {
    case cancelled
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .cancelled: return "已取消登录"
        case .failed(let message): return message
        }
    }
}

enum OAuthProvider: String, Sendable {
    case google
    case wechat
}

@MainActor
final class OAuthPresentationContext: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = OAuthPresentationContext()

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}

@MainActor
final class OAuthService {
    static let shared = OAuthService()

    private var activeSession: ASWebAuthenticationSession?

    func signIn(provider: OAuthProvider) async throws -> OAuthResult {
        switch provider {
        case .google where SocialAuthConfig.googleNativeEnabled:
            await GoogleSignInBootstrap.shared.configureIfNeeded()
            let idToken = try await GoogleSignInBootstrap.signIn()
            return try await APIClient.shared.signInWithGoogle(idToken: idToken)
        case .wechat where SocialAuthConfig.wechatNativeEnabled:
            let code = try await WeChatOAuthService.signIn()
            return try await APIClient.shared.signInWithWeChat(code: code)
        default:
            return try await signInViaWeb(provider: provider)
        }
    }

    private func signInViaWeb(provider: OAuthProvider) async throws -> OAuthResult {
        guard let url = URL(string: "/auth/\(provider.rawValue)?mode=mobile", relativeTo: AppConfig.apiBaseURL) else {
            throw APIError.invalidURL
        }

        return try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "deimos") { callbackURL, error in
                if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    continuation.resume(throwing: OAuthError.cancelled)
                    return
                }
                if let error {
                    continuation.resume(throwing: OAuthError.failed(error.localizedDescription))
                    return
                }
                guard let callbackURL else {
                    continuation.resume(throwing: OAuthError.failed("无效的回调"))
                    return
                }
                continuation.resume(returning: Self.parseCallback(callbackURL))
            }
            session.presentationContextProvider = OAuthPresentationContext.shared
            session.prefersEphemeralWebBrowserSession = false
            activeSession = session
            session.start()
        }
    }

    private static func parseCallback(_ url: URL) -> OAuthResult {
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        func value(_ name: String) -> String? {
            items.first { $0.name == name }?.value
        }
        return OAuthResult(
            status: value("status") ?? "error",
            provider: value("provider") ?? "",
            token: value("token"),
            pendingToken: value("pending_token"),
            errorCode: value("error_code")
        )
    }
}
