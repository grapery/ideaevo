#if !targetEnvironment(simulator)
import Foundation
import UIKit

enum WeChatConfiguration {
    static var appID: String {
        SocialAuthConfig.wechatAppID
    }

    static var universalLink: String {
        SocialAuthConfig.wechatUniversalLink
    }

    static var isConfigured: Bool {
        !appID.isEmpty && !universalLink.isEmpty
    }
}

final class WeChatResponseHandler: NSObject, WXApiDelegate {
    static let shared = WeChatResponseHandler()

    private var authCompletion: ((Result<String, Error>) -> Void)?
    private var expectedState: String?

    func beginAuth(state: String, completion: @escaping (Result<String, Error>) -> Void) {
        expectedState = state
        authCompletion = completion
    }

    func cancelAuth() {
        expectedState = nil
        authCompletion = nil
    }

    func onReq(_ req: BaseReq) {}

    func onResp(_ resp: BaseResp) {
        guard let authResp = resp as? SendAuthResp else { return }
        handleAuthResponse(authResp)
    }

    private func handleAuthResponse(_ resp: SendAuthResp) {
        let completion = authCompletion
        authCompletion = nil
        let state = expectedState
        expectedState = nil

        guard resp.errCode == 0 else {
            if resp.errCode == -2 {
                deliverAuthCompletion(completion, result: .failure(OAuthError.cancelled))
                return
            }
            let message = resp.errStr ?? "微信登录失败 (\(resp.errCode))"
            deliverAuthCompletion(completion, result: .failure(OAuthError.failed(message)))
            return
        }

        guard let code = resp.code, !code.isEmpty else {
            deliverAuthCompletion(completion, result: .failure(OAuthError.failed("无法获取微信授权码")))
            return
        }

        if let returnedState = resp.state, let state, returnedState != state {
            deliverAuthCompletion(completion, result: .failure(OAuthError.failed("微信登录验证失败")))
            return
        }

        deliverAuthCompletion(completion, result: .success(code))
    }

    private func deliverAuthCompletion(_ completion: ((Result<String, Error>) -> Void)?, result: Result<String, Error>) {
        guard let completion else { return }
        if Thread.isMainThread {
            completion(result)
        } else {
            DispatchQueue.main.async {
                completion(result)
            }
        }
    }
}

enum WeChatOpenSDKRouting {
    @discardableResult
    static func handleOpenURL(_ url: URL) -> Bool {
        guard WeChatConfiguration.isConfigured else { return false }
        return WXApi.handleOpen(url, delegate: WeChatResponseHandler.shared)
    }

    @discardableResult
    static func handleUniversalLink(_ userActivity: NSUserActivity) -> Bool {
        guard WeChatConfiguration.isConfigured else { return false }
        return WXApi.handleOpenUniversalLink(userActivity, delegate: WeChatResponseHandler.shared)
    }
}

enum WeChatShareService {
    static var isWeChatInstalled: Bool {
        guard WeChatConfiguration.isConfigured else { return false }
        return WXApi.isWXAppInstalled()
    }

    static func registerIfConfigured() {
        guard WeChatConfiguration.isConfigured else { return }
        WXApi.registerApp(WeChatConfiguration.appID, universalLink: WeChatConfiguration.universalLink)
    }
}
#endif
