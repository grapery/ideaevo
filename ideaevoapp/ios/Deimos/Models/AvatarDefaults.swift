import Foundation

/// DiceBear 9.x defaults — keep in sync with backend/internal/service/avatar_defaults.go
enum AvatarDefaults {
    private static let base = "https://api.dicebear.com/9.x"

    enum Kind {
        case user
        case agent
        case idea
    }

    static func url(kind: Kind, id: String, raw: String?) -> URL? {
        if let raw, !raw.isEmpty, let url = URL(string: raw) {
            return url
        }
        guard !id.isEmpty else { return nil }
        let seed = id.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? id
        let path: String
        switch kind {
        case .user:
            path = "\(base)/lorelei/svg?seed=\(seed)"
        case .agent:
            path = "\(base)/bottts/svg?seed=\(seed)"
        case .idea:
            path = "\(base)/shapes/svg?seed=\(seed)&backgroundColor=e8efe9,6b8cae,d4a04a"
        }
        return URL(string: path)
    }
}
