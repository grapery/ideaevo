import Foundation

struct FlowerDonor: Codable, Identifiable, Sendable {
    var id: String { userID ?? agentID ?? name }
    let userID: String?
    let agentID: String?
    let name: String
    let avatarURL: String?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case name
        case userID = "user_id"
        case agentID = "agent_id"
        case avatarURL = "avatar_url"
        case createdAt = "created_at"
    }

    var avatarLink: URL? {
        if let userID {
            return AvatarDefaults.url(kind: .user, id: userID, raw: avatarURL)
        }
        if let agentID {
            return AvatarDefaults.url(kind: .agent, id: agentID, raw: avatarURL)
        }
        return nil
    }

    var isAgent: Bool { agentID != nil }
}

struct FlowersResponse: Decodable, Sendable {
    let donors: [FlowerDonor]
}

struct SearchMatch: Decodable, Sendable {
    let idea: Idea
    let similarity: Double
}

struct SearchResponse: Decodable, Sendable {
    let results: [SearchMatch]
    let page: Int?
    let limit: Int?
    let offset: Int?

    /// 语义搜索无精确 total；用「结果数 == limit」判定是否可能还有更多。
    var mayHaveMore: Bool {
        let pageSize = limit ?? results.count
        return !results.isEmpty && results.count >= pageSize
    }
}

struct UserProfileData: Decodable, Sendable {
    let user: User
    let ideaCount: Int
    let agentCount: Int
    let sessionCount: Int
    let followerCount: Int
    let followingCount: Int

    enum CodingKeys: String, CodingKey {
        case user
        case ideaCount = "idea_count"
        case agentCount = "agent_count"
        case sessionCount = "session_count"
        case followerCount = "follower_count"
        case followingCount = "following_count"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        user = try container.decode(User.self, forKey: .user)
        ideaCount = try container.decodeIfPresent(Int.self, forKey: .ideaCount) ?? 0
        agentCount = try container.decodeIfPresent(Int.self, forKey: .agentCount) ?? 0
        sessionCount = try container.decodeIfPresent(Int.self, forKey: .sessionCount) ?? 0
        followerCount = try container.decodeIfPresent(Int.self, forKey: .followerCount) ?? 0
        followingCount = try container.decodeIfPresent(Int.self, forKey: .followingCount) ?? 0
    }
}

struct UserProfileEnvelope: Decodable, Sendable {
    let profile: UserProfileData
    let isFollowing: Bool

    enum CodingKeys: String, CodingKey {
        case profile
        case isFollowing = "is_following"
    }
}

struct UserProfileResponse: Decodable, Sendable {
    let profile: UserProfileData
}

struct IdeaVersionSummary: Decodable, Identifiable, Sendable {
    let id: String
    let version: Int
    let changelog: String
    let createdAt: Date
    let isCurrent: Bool

    enum CodingKeys: String, CodingKey {
        case id, version, changelog
        case createdAt = "created_at"
        case isCurrent = "is_current"
    }
}

struct IdeaVersionsResponse: Decodable, Sendable {
    let versions: [IdeaVersionSummary]
}

struct UsersListResponse: Decodable, Sendable {
    let users: [User]
    let total: Int
    let followingIDs: [String]

    enum CodingKeys: String, CodingKey {
        case users, total
        case followingIDs = "following_ids"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        users = try container.decode([User].self, forKey: .users)
        total = try container.decode(Int.self, forKey: .total)
        followingIDs = try container.decodeIfPresent([String].self, forKey: .followingIDs) ?? []
    }
}

struct SubmitReportBody: Encodable, Sendable {
    let targetType: String
    let targetID: String
    let reason: String
    let detail: String

    enum CodingKeys: String, CodingKey {
        case reason, detail
        case targetType = "target_type"
        case targetID = "target_id"
    }
}

struct AgentsResponse: Decodable, Sendable {
    let agents: [Agent]
    let total: Int
}

struct AgentStats: Decodable, Sendable {
    let ideaCount: Int
    let totalLikes: Int
    let totalFlowers: Int
    let totalForks: Int
    let recentActivity: [ActivityView]?

    enum CodingKeys: String, CodingKey {
        case ideaCount = "idea_count"
        case totalLikes = "total_likes"
        case totalFlowers = "total_flowers"
        case totalForks = "total_forks"
        case recentActivity = "recent_activity"
    }
}

struct FollowStatusResponse: Decodable, Sendable {
    let isFollowing: Bool

    enum CodingKeys: String, CodingKey {
        case isFollowing = "is_following"
    }
}

struct RegisterAgentBody: Encodable, Sendable {
    let name: String
    let description: String?
    let capabilities: [String]?
    let systemPrompt: String?
    let llmModel: String?
    let temperature: Double?
    let maxTokens: Int?
    let visibility: String?
    let allowFollow: Bool?
    let allowChat: Bool?

    enum CodingKeys: String, CodingKey {
        case name, description, capabilities, visibility, temperature
        case systemPrompt = "system_prompt"
        case llmModel = "llm_model"
        case maxTokens = "max_tokens"
        case allowFollow = "allow_follow"
        case allowChat = "allow_chat"
    }
}

struct UpdateAgentBody: Encodable, Sendable {
    let name: String?
    let description: String?
    let systemPrompt: String?
    let llmModel: String?
    let temperature: Double?
    let maxTokens: Int?
    let visibility: String?
    let allowFollow: Bool?
    let allowChat: Bool?
    let avatarURL: String?
    let backgroundURL: String?

    enum CodingKeys: String, CodingKey {
        case name, description, visibility, temperature
        case systemPrompt = "system_prompt"
        case llmModel = "llm_model"
        case maxTokens = "max_tokens"
        case allowFollow = "allow_follow"
        case allowChat = "allow_chat"
        case avatarURL = "avatar_url"
        case backgroundURL = "background_url"
    }
}

struct RegisterAgentResponse: Decodable, Sendable {
    let agent: Agent
    let apiKey: String

    enum CodingKeys: String, CodingKey {
        case agent
        case apiKey = "api_key"
    }
}

struct AgentPresignRequest: Encodable, Sendable {
    let kind: String
    let contentType: String

    enum CodingKeys: String, CodingKey {
        case kind
        case contentType = "content_type"
    }
}
