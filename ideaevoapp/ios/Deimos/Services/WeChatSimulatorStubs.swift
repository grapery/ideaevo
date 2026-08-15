#if targetEnvironment(simulator)
import Foundation
import SwiftUI

// Simulator stubs for WeChat SDK (not linkable on Apple Silicon simulator due to missing arm64-sim slice)
// Real implementations are compiled on device builds via #if !targetEnvironment(simulator)

enum WeChatConfiguration {
    static var isConfigured: Bool { false }
    static var appID: String { "" }
    static var universalLink: String { "" }
}

enum WeChatOpenSDKRouting {
    static func handleOpenURL(_ url: URL) -> Bool { false }
    static func handleUniversalLink(_ userActivity: NSUserActivity) -> Bool { false }
}

enum WeChatShareService {
    static var isWeChatInstalled: Bool { false }
    static func registerIfConfigured() {}
}

struct WeChatPhoneBindView: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        VStack(spacing: 20) {
            Text("绑定手机号")
                .font(.headline)
            Text("微信登录需要绑定手机号（模拟器不可用）")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button("关闭") { dismiss() }
                .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}

enum WeChatOAuthService {
    static func requestCode() async throws -> String {
        throw NSError(domain: "WeChat", code: -1, userInfo: [NSLocalizedDescriptionKey: "微信登录在模拟器不可用"])
    }
    static func signIn() async throws -> String {
        throw NSError(domain: "WeChat", code: -1, userInfo: [NSLocalizedDescriptionKey: "微信登录在模拟器不可用"])
    }
}

final class WeChatResponseHandler {
    static let shared = WeChatResponseHandler()
}
#endif
