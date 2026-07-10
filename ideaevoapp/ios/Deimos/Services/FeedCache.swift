import Foundation

enum FeedCache {
    private static let plazaKey = "deimos.cache.plaza"
    private static let maxAge: TimeInterval = 60 * 30

    struct CachedPlaza: Codable {
        let savedAt: Date
        let ideas: [Idea]
    }

    static func loadPlaza() -> [Idea]? {
        loadPlaza(maxAge: maxAge)
    }

    static func loadPlazaStale() -> [Idea]? {
        loadPlaza(maxAge: .infinity)
    }

    private static func loadPlaza(maxAge: TimeInterval) -> [Idea]? {
        guard let data = UserDefaults.standard.data(forKey: plazaKey),
              let cached = try? JSONDecoder.api.decode(CachedPlaza.self, from: data),
              Date().timeIntervalSince(cached.savedAt) < maxAge else {
            return nil
        }
        return cached.ideas
    }

    static func savePlaza(_ ideas: [Idea]) {
        let cached = CachedPlaza(savedAt: Date(), ideas: ideas)
        if let data = try? JSONEncoder.api.encode(cached) {
            UserDefaults.standard.set(data, forKey: plazaKey)
        }
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: plazaKey)
    }
}
