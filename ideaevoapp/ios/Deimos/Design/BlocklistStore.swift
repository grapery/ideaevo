import Foundation
import Observation

// MARK: - Blocklist (S11BL) — synced with API, cached locally

struct BlockedUserStub: Identifiable, Codable, Hashable {
    let id: String
    let name: String
}

@MainActor
@Observable
final class BlocklistStore {
    static let shared = BlocklistStore()

    private let key = "deimos.blocklist"

    private(set) var entries: [BlockedUserStub] = []

    private init() {
        loadLocalCache()
    }

    func isBlocked(_ id: String) -> Bool {
        entries.contains { $0.id == id }
    }

    func sync() async {
        guard APIClient.shared.authToken != nil else {
            loadLocalCache()
            return
        }
        do {
            let response = try await APIClient.shared.listBlocks()
            entries = response.users.map { BlockedUserStub(id: $0.id, name: $0.name) }
            saveLocalCache()
        } catch {
            loadLocalCache()
        }
    }

    func block(id: String, name: String) async {
        if APIClient.shared.authToken != nil {
            do {
                try await APIClient.shared.blockUser(id: id)
            } catch {
                ToastCenter.shared.showError("拉黑失败", message: error.localizedDescription)
                return
            }
        }
        var list = entries
        guard !list.contains(where: { $0.id == id }) else { return }
        list.append(BlockedUserStub(id: id, name: name))
        entries = list
        saveLocalCache()
    }

    func unblock(_ id: String) async {
        if APIClient.shared.authToken != nil {
            _ = try? await APIClient.shared.unblockUser(id: id)
        }
        entries = entries.filter { $0.id != id }
        saveLocalCache()
    }

    func clear() {
        entries = []
        UserDefaults.standard.removeObject(forKey: key)
    }

    private func loadLocalCache() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let decoded = try? JSONDecoder().decode([BlockedUserStub].self, from: data) else {
            entries = []
            return
        }
        entries = decoded
    }

    private func saveLocalCache() {
        if let data = try? JSONEncoder().encode(entries) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}
