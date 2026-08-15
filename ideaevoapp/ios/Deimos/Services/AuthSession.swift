import Foundation
import Observation

@MainActor
@Observable
final class AuthSession {
    var user: User?
    var isBootstrapping = true
    var isAuthenticated: Bool { user != nil }
    var bootstrapError: String?

    private let api = APIClient.shared

    func bootstrap() async {
        defer { isBootstrapping = false }
        bootstrapError = nil
        guard KeychainStore.loadToken() != nil else { return }
        do {
            user = try await api.me()
            await PushNotificationManager.shared.onUserAuthenticated()
            await BlocklistStore.shared.sync()
        } catch {
            api.setToken(nil)
            user = nil
            bootstrapError = error.localizedDescription
        }
    }

    func login(email: String, password: String) async throws {
        user = try await api.login(email: email, password: password)
        await PushNotificationManager.shared.onUserAuthenticated()
        await BlocklistStore.shared.sync()
    }

    func register(name: String, email: String, password: String) async throws {
        user = try await api.register(name: name, email: email, password: password)
        await PushNotificationManager.shared.onUserAuthenticated()
        await BlocklistStore.shared.sync()
    }

    func logout() async {
        await PushNotificationManager.shared.onUserLoggedOut()
        await api.logout()
        user = nil
        BlocklistStore.shared.clear()
        FeedCache.clear()
    }
}
