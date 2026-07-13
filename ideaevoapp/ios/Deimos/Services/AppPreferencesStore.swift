import Foundation

enum AppPreferencesStore {
    /// Public raw key strings for `@AppStorage` usage in SwiftUI views.
    enum Keys {
        static let language = "deimos.pref.language"
        static let notifyFlowers = "deimos.pref.notify.flowers"
        static let notifyComments = "deimos.pref.notify.comments"
        static let notifyFollows = "deimos.pref.notify.follows"
        static let pushEnabled = "deimos.pref.push.enabled"
        static let hasOnboarded = "deimos.pref.hasOnboarded"
        static let aiProcessingConsent = "deimos.pref.ai.consent"
    }

    private enum Key {
        static let language = "deimos.pref.language"
        static let notifyFlowers = "deimos.pref.notify.flowers"
        static let notifyComments = "deimos.pref.notify.comments"
        static let notifyFollows = "deimos.pref.notify.follows"
        static let pushEnabled = "deimos.pref.push.enabled"
        static let hasOnboarded = "deimos.pref.hasOnboarded"
        static let aiProcessingConsent = "deimos.pref.ai.consent"
    }

    static var hasCompletedOnboarding: Bool {
        get { UserDefaults.standard.bool(forKey: Key.hasOnboarded) }
        set { UserDefaults.standard.set(newValue, forKey: Key.hasOnboarded) }
    }

    static var language: String {
        get { UserDefaults.standard.string(forKey: Key.language) ?? "zh-Hans" }
        set { UserDefaults.standard.set(newValue, forKey: Key.language) }
    }

    static var languageLabel: String {
        language == "en" ? "English" : "简体中文"
    }

    static var pushEnabled: Bool {
        get { UserDefaults.standard.object(forKey: Key.pushEnabled) as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: Key.pushEnabled) }
    }

    static var notifyFlowers: Bool {
        get { UserDefaults.standard.object(forKey: Key.notifyFlowers) as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: Key.notifyFlowers) }
    }

    static var notifyComments: Bool {
        get { UserDefaults.standard.object(forKey: Key.notifyComments) as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: Key.notifyComments) }
    }

    static var notifyFollows: Bool {
        get { UserDefaults.standard.object(forKey: Key.notifyFollows) as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: Key.notifyFollows) }
    }

    static var aiProcessingConsent: Bool {
        get { UserDefaults.standard.object(forKey: Key.aiProcessingConsent) as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: Key.aiProcessingConsent) }
    }

    static func shouldShowNotification(action: String) -> Bool {
        guard pushEnabled else { return false }
        switch action {
        case "flower", "flowers":
            return notifyFlowers
        case "comment":
            return notifyComments
        case "follow", "fork":
            return notifyFollows
        default:
            return true
        }
    }

    static func apply(_ prefs: NotificationPreferences) {
        pushEnabled = prefs.pushEnabled
        notifyFlowers = prefs.pushFlowers
        notifyComments = prefs.pushComments
        notifyFollows = prefs.pushFollows
    }

    static func makeUpdateBody() -> UpdateNotificationPreferencesBody {
        UpdateNotificationPreferencesBody(
            pushFlowers: notifyFlowers,
            pushComments: notifyComments,
            pushFollows: notifyFollows,
            pushEnabled: pushEnabled
        )
    }
}
