import SwiftUI
import UserNotifications

@MainActor
final class PushNotificationManager {
    static let shared = PushNotificationManager()

    private enum StorageKey {
        static let deviceID = "deimos.push.device_id"
        static let pendingToken = "deimos.push.pending_token"
    }

    private(set) var deviceRegistered = false
    private var pendingTokenHex: String? {
        get { UserDefaults.standard.string(forKey: StorageKey.pendingToken) }
        set {
            if let newValue {
                UserDefaults.standard.set(newValue, forKey: StorageKey.pendingToken)
            } else {
                UserDefaults.standard.removeObject(forKey: StorageKey.pendingToken)
            }
        }
    }

    private var registeredDeviceID: String? {
        get { UserDefaults.standard.string(forKey: StorageKey.deviceID) }
        set {
            if let newValue {
                UserDefaults.standard.set(newValue, forKey: StorageKey.deviceID)
            } else {
                UserDefaults.standard.removeObject(forKey: StorageKey.deviceID)
            }
        }
    }

    func registerDeviceToken(_ deviceToken: Data) async {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        guard APIClient.shared.authToken != nil else {
            pendingTokenHex = token
            deviceRegistered = false
            return
        }
        await uploadToken(token)
    }

    func onUserAuthenticated() async {
        if let pending = pendingTokenHex {
            await uploadToken(pending)
            pendingTokenHex = nil
            return
        }

        let settings = await UNUserNotificationCenter.current().notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            UIApplication.shared.registerForRemoteNotifications()
        default:
            break
        }
    }

    func onUserLoggedOut() async {
        if let deviceID = registeredDeviceID {
            try? await APIClient.shared.unregisterDevice(id: deviceID)
        }
        registeredDeviceID = nil
        pendingTokenHex = nil
        deviceRegistered = false
    }

    private func uploadToken(_ token: String) async {
        do {
            let device = try await APIClient.shared.registerDeviceToken(token)
            registeredDeviceID = device.id
            deviceRegistered = true
        } catch {
            pendingTokenHex = token
            deviceRegistered = false
        }
    }

    func markRegistrationFailed() {
        deviceRegistered = false
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        WeChatShareService.registerIfConfigured()
        return true
    }

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        return WeChatOpenSDKRouting.handleOpenURL(url)
    }

    func application(
        _ application: UIApplication,
        continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {
        if WeChatOpenSDKRouting.handleUniversalLink(userActivity) { return true }
        return false
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            await PushNotificationManager.shared.registerDeviceToken(deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in
            PushNotificationManager.shared.markRegistrationFailed()
        }
    }
}

@main
struct DeimosApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var session = AuthSession()
    @State private var deepLinkRouter = DeepLinkRouter()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(deepLinkRouter)
                .tint(AtlasColors.ink)
                .atlasToastHost()
                .atlasKeyboardToolbar()
                .onOpenURL { url in
                    if WeChatOpenSDKRouting.handleOpenURL(url) { return }
                    if GoogleSignInBootstrap.handleURL(url) { return }
                    deepLinkRouter.handle(url: url)
                }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { userActivity in
                    _ = WeChatOpenSDKRouting.handleUniversalLink(userActivity)
                }
                .task {
                    if GoogleSignInBootstrap.isSignInEnabled {
                        await GoogleSignInBootstrap.shared.configureIfNeeded()
                    }
                }
        }
    }
}
