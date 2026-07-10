import Foundation

struct User: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let email: String?
    let phone: String?
    let phoneVerified: Bool
    let avatarURL: String?
    let backgroundURL: String?
    let avatarSource: String?
    let bio: String?
    let authProvider: String
    let role: String
    let emailVerified: Bool
    let followerCount: Int
    let followingCount: Int
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, name, email, phone, bio, role
        case phoneVerified = "phone_verified"
        case avatarURL = "avatar_url"
        case backgroundURL = "background_url"
        case avatarSource = "avatar_source"
        case authProvider = "auth_provider"
        case emailVerified = "email_verified"
        case followerCount = "follower_count"
        case followingCount = "following_count"
        case createdAt = "created_at"
    }

    var avatarLink: URL? {
        AvatarDefaults.url(kind: .user, id: id, raw: avatarURL)
    }
}

struct AuthResponse: Decodable, Sendable {
    let user: User
    let token: String?
    let message: String?
}

struct FlexibleAuthResponse: Decodable, Sendable {
    let user: User?
    let token: String?
    let pendingToken: String?
    let status: String?

    enum CodingKeys: String, CodingKey {
        case user, token, status
        case pendingToken = "pending_token"
    }
}

struct MeResponse: Decodable, Sendable {
    let user: User
}

struct APIErrorResponse: Decodable, Sendable {
    let error: String
}

enum APIError: LocalizedError, Sendable {
    case invalidURL
    case unauthorized
    case server(String)
    case similarIdeas(message: String, matches: [SimilarIdeaMatch])
    case decoding(Error)
    case network(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "无效的请求地址"
        case .unauthorized: return "请先登录"
        case .server(let message): return message
        case .similarIdeas(let message, _): return message
        case .decoding: return "数据解析失败"
        case .network: return "网络连接失败，请确认 API 服务已启动"
        }
    }
}

struct SimilarIdeaMatch: Decodable, Sendable, Identifiable {
    let idea: Idea
    let similarity: Double

    var id: String { idea.id }
}

struct CreateIdeaConflictResponse: Decodable, Sendable {
    let error: String
    let similarIdeas: [SimilarIdeaMatch]?

    enum CodingKeys: String, CodingKey {
        case error
        case similarIdeas = "similar_ideas"
    }
}
