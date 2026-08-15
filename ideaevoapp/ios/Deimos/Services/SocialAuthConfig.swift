import Foundation

enum SocialAuthConfig {
    /// Google OAuth iOS client ID (`*.apps.googleusercontent.com`).
    /// Priority: `GoogleService-Info.plist` → Info.plist `GIDClientID` → legacy keys below.
    static var googleIOSClientID: String {
        if let env = ProcessInfo.processInfo.environment["IDEEVO_GOOGLE_IOS_CLIENT_ID"],
           !env.isEmpty {
            return env
        }
        if let plist = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String,
           !plist.isEmpty {
            return plist
        }
        if let plist = Bundle.main.object(forInfoDictionaryKey: "IDEEVOGoogleIOSClientID") as? String,
           !plist.isEmpty {
            return plist
        }
        return ""
    }

    /// URL scheme from `GoogleService-Info.plist` or derived from client ID.
    static var googleReversedClientID: String? {
        if let url = Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist"),
           let data = try? Data(contentsOf: url) {
            var format = PropertyListSerialization.PropertyListFormat.xml
            if let plist = try? PropertyListSerialization.propertyList(from: data, options: [], format: &format),
               let dict = plist as? [String: Any],
               let reversed = dict["REVERSED_CLIENT_ID"] as? String,
               !reversed.isEmpty {
                return reversed
            }
        }

        let clientID = googleIOSClientID
        guard clientID.hasSuffix(".apps.googleusercontent.com") else { return nil }
        let prefix = String(clientID.dropLast(".apps.googleusercontent.com".count))
        guard !prefix.isEmpty else { return nil }
        return "com.googleusercontent.apps.\(prefix)"
    }

    static var wechatAppID: String {
        if let env = ProcessInfo.processInfo.environment["WECHAT_APP_ID"],
           !env.isEmpty {
            return env
        }
        if let env = ProcessInfo.processInfo.environment["IDEEVO_WECHAT_APP_ID"],
           !env.isEmpty {
            return env
        }
        if let plist = Bundle.main.object(forInfoDictionaryKey: "WeChatAppID") as? String,
           !plist.isEmpty {
            return plist
        }
        if let plist = Bundle.main.object(forInfoDictionaryKey: "IDEEVOWeChatAppID") as? String,
           !plist.isEmpty {
            return plist
        }
        return ""
    }

    static var wechatUniversalLink: String {
        if let env = ProcessInfo.processInfo.environment["IDEEVO_WECHAT_UNIVERSAL_LINK"],
           !env.isEmpty {
            return env
        }
        if let plist = Bundle.main.object(forInfoDictionaryKey: "WeChatUniversalLink") as? String,
           !plist.isEmpty {
            return plist
        }
        if let plist = Bundle.main.object(forInfoDictionaryKey: "IDEEVOWeChatUniversalLink") as? String,
           !plist.isEmpty {
            return plist
        }
        return ""
    }

    static var googleNativeEnabled: Bool {
        !googleIOSClientID.isEmpty || hasGoogleServiceInfo
    }

    static var wechatNativeEnabled: Bool {
        WeChatConfiguration.isConfigured
    }

    private static var hasGoogleServiceInfo: Bool {
        Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist") != nil
    }
}
