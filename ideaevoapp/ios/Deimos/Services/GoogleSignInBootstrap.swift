import Foundation
import UIKit

// GoogleSignIn SPM module requires proper Xcode project linking.
// When the module is available, the real implementation is used.
// When not available (e.g. CI builds without SPM), a stub is used.
// To enable native Google Sign-In, add the GoogleSignIn SPM package
// to the Xcode project target → Frameworks, Libraries, and Embedded Content.

#if canImport(GoogleSignIn)
import GoogleSignIn

@MainActor
final class GoogleSignInBootstrap {
    static let shared = GoogleSignInBootstrap()

    static var isSignInEnabled: Bool { true }

    private var didAttemptConfigure = false

    private init() {}

    func configureIfNeeded() async {
        guard Self.isSignInEnabled else { return }
        guard !didAttemptConfigure else { return }
        didAttemptConfigure = true

        if GIDSignIn.sharedInstance.configuration != nil {
            return
        }

        guard let clientID = Self.resolveClientID() else {
            return
        }

        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
    }

    static func handleURL(_ url: URL) -> Bool {
        guard isSignInEnabled, GIDSignIn.sharedInstance.configuration != nil else { return false }
        return GIDSignIn.sharedInstance.handle(url)
    }

    static func signIn() async throws -> String {
        guard isSignInEnabled else {
            throw OAuthError.failed("Google 登录未配置")
        }
        await shared.configureIfNeeded()

        guard GIDSignIn.sharedInstance.configuration != nil else {
            throw OAuthError.failed("Google 登录未配置")
        }

        guard let presenter = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .rootViewController else {
            throw OAuthError.failed("无法打开 Google 登录")
        }

        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
        guard let idToken = result.user.idToken?.tokenString else {
            throw OAuthError.failed("无法读取 Google 凭证")
        }
        return idToken
    }

    private static func resolveClientID() -> String? {
        if let clientID = loadClientIDFromGoogleServiceInfo() {
            return clientID
        }
        if let clientID = loadClientIDFromInfoPlist() {
            return clientID
        }
        let legacy = SocialAuthConfig.googleIOSClientID
        return legacy.isEmpty ? nil : legacy
    }

    private static func loadClientIDFromGoogleServiceInfo() -> String? {
        guard let url = Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist"),
              let data = try? Data(contentsOf: url) else {
            return nil
        }
        var format = PropertyListSerialization.PropertyListFormat.xml
        guard let plist = try? PropertyListSerialization.propertyList(from: data, options: [], format: &format),
              let dict = plist as? [String: Any],
              let clientID = dict["CLIENT_ID"] as? String,
              !clientID.isEmpty else {
            return nil
        }
        return clientID
    }

    private static func loadClientIDFromInfoPlist() -> String? {
        let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String
        if let clientID, !clientID.isEmpty { return clientID }
        return nil
    }
}

#else
// Fallback stub when GoogleSignIn SPM module is not linked.
// Google login falls back to the web OAuth flow via OAuthService.

final class GoogleSignInBootstrap {
    static let shared = GoogleSignInBootstrap()
    static var isSignInEnabled: Bool { false }
    static func handleURL(_ url: URL) -> Bool { false }
    func configureIfNeeded() async {}
    static func signIn() async throws -> String {
        throw OAuthError.failed("Google 原生登录不可用，请使用网页登录")
    }
}
#endif
