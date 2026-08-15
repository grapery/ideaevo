import Foundation

/// DiceBear 9.x defaults — keep in sync with backend/internal/service/avatar_defaults.go
/// Styles chosen for visual harmony with lemon-green theme.
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
            // Lorelei — soft, friendly human avatar
            path = "\(base)/lorelei/svg?seed=\(seed)&backgroundColor=f2ffc5,cbea16"
        case .agent:
            // Botts — geometric robot avatar, matches AI agent identity
            path = "\(base)/bottts/svg?seed=\(seed)&backgroundColor=d8ff3f,cbea16"
        case .idea:
            // Shapes — abstract geometric, matches idea identity
            path = "\(base)/shapes/svg?seed=\(seed)&backgroundColor=f2ffc5,d8ff3f,eef4ff"
        }
        return URL(string: path)
    }
}
