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

    private enum CodingKeys: String, CodingKey {
        case results, page, limit, offset
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // The Go API serializes an empty slice as `null`; treat it as an empty result set so
        // Search can render the designed no-results state instead of a parsing error.
        results = try container.decodeIfPresent([SearchMatch].self, forKey: .results) ?? []
        page = try container.decodeIfPresent(Int.self, forKey: .page)
        limit = try container.decodeIfPresent(Int.self, forKey: .limit)
        offset = try container.decodeIfPresent(Int.self, forKey: .offset)
    }

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
    let title: String
    let description: String?
    let changelog: String
    let stats: VersionStats
    let createdAt: Date
    let isCurrent: Bool

    enum CodingKeys: String, CodingKey {
        case id, version, title, description, changelog, stats
        case createdAt = "created_at"
        case isCurrent = "is_current"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        version = try container.decode(Int.self, forKey: .version)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "v\(version)"
        description = try container.decodeIfPresent(String.self, forKey: .description)
        changelog = try container.decodeIfPresent(String.self, forKey: .changelog) ?? ""
        stats = try container.decodeIfPresent(VersionStats.self, forKey: .stats) ?? VersionStats()
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        isCurrent = try container.decodeIfPresent(Bool.self, forKey: .isCurrent) ?? false
    }
}

struct IdeaVersionsResponse: Decodable, Sendable {
    let versions: [IdeaVersionSummary]
}

struct VersionStats: Decodable, Sendable, Hashable {
    let forkCount: Int
    let commentCount: Int
    let flowerCount: Int
    let reactionCount: Int

    enum CodingKeys: String, CodingKey {
        case forkCount = "fork_count"
        case commentCount = "comment_count"
        case flowerCount = "flower_count"
        case reactionCount = "reaction_count"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        forkCount = try container.decodeIfPresent(Int.self, forKey: .forkCount) ?? 0
        commentCount = try container.decodeIfPresent(Int.self, forKey: .commentCount) ?? 0
        flowerCount = try container.decodeIfPresent(Int.self, forKey: .flowerCount) ?? 0
        reactionCount = try container.decodeIfPresent(Int.self, forKey: .reactionCount) ?? 0
    }

    init(forkCount: Int = 0, commentCount: Int = 0, flowerCount: Int = 0, reactionCount: Int = 0) {
        self.forkCount = forkCount
        self.commentCount = commentCount
        self.flowerCount = flowerCount
        self.reactionCount = reactionCount
    }
}

struct VersionStatsRow: Decodable, Sendable, Hashable {
    let versionID: String
    let version: Int
    let stats: VersionStats

    enum CodingKeys: String, CodingKey {
        case versionID = "version_id"
        case version, stats
    }
}

struct IdeaStats: Decodable, Sendable {
    let likeCount: Int
    let flowerCount: Int
    let forkCount: Int
    let commentCount: Int
    let viewCount: Int
    let referenceCount: Int
    let reactionCount: Int
    let versionCount: Int
    let imageCount: Int
    let linkCount: Int
    let versionStats: [VersionStatsRow]

    enum CodingKeys: String, CodingKey {
        case likeCount = "like_count"
        case flowerCount = "flower_count"
        case forkCount = "fork_count"
        case commentCount = "comment_count"
        case viewCount = "view_count"
        case referenceCount = "reference_count"
        case reactionCount = "reaction_count"
        case versionCount = "version_count"
        case imageCount = "image_count"
        case linkCount = "link_count"
        case versionStats = "version_stats"
    }
}

struct IdeaLineageStats: Decodable, Sendable {
    let totalForks: Int
    let activeBranches: Int
    let contributors: Int

    enum CodingKeys: String, CodingKey {
        case totalForks = "total_forks"
        case activeBranches = "active_branches"
        case contributors
    }
}

struct IdeaLineage: Decodable, Sendable {
    let idea: Idea
    let currentVersion: IdeaVersionDetail
    let origin: ForkRecord?
    let sourceIdea: Idea?
    let sourceVersion: IdeaVersionDetail?
    let children: [Idea]
    let stats: IdeaLineageStats

    enum CodingKeys: String, CodingKey {
        case idea, origin, children, stats
        case currentVersion = "current_version"
        case sourceIdea = "source_idea"
        case sourceVersion = "source_version"
    }
}

struct UserActivityResponse: Decodable, Sendable {
    let activities: [ActivityView]
    let total: Int
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
    let followerCount: Int
    let callCount: Int
    let recentActivity: [ActivityView]?

    enum CodingKeys: String, CodingKey {
        case ideaCount = "idea_count"
        case totalLikes = "total_likes"
        case totalFlowers = "total_flowers"
        case totalForks = "total_forks"
        case followerCount = "follower_count"
        case callCount = "call_count"
        case recentActivity = "recent_activity"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        ideaCount = try container.decodeIfPresent(Int.self, forKey: .ideaCount) ?? 0
        totalLikes = try container.decodeIfPresent(Int.self, forKey: .totalLikes) ?? 0
        totalFlowers = try container.decodeIfPresent(Int.self, forKey: .totalFlowers) ?? 0
        totalForks = try container.decodeIfPresent(Int.self, forKey: .totalForks) ?? 0
        followerCount = try container.decodeIfPresent(Int.self, forKey: .followerCount) ?? 0
        callCount = try container.decodeIfPresent(Int.self, forKey: .callCount) ?? 0
        recentActivity = try container.decodeIfPresent([ActivityView].self, forKey: .recentActivity)
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
    var capabilities: [String]? = nil

    enum CodingKeys: String, CodingKey {
        case name, description, visibility, temperature, capabilities
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
