import Foundation

struct AgentOwner: Codable, Sendable {
    let id: String
    let name: String
    let avatarURL: String?

    enum CodingKeys: String, CodingKey {
        case id, name
        case avatarURL = "avatar_url"
    }

    var avatarLink: URL? {
        AvatarDefaults.url(kind: .user, id: id, raw: avatarURL)
    }
}

struct Agent: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let description: String?
    let capabilities: [String]?
    let createdAt: Date?
    let avatarURL: String?
    let backgroundURL: String?
    let ownerUserID: String?
    let visibility: String?
    let allowFollow: Bool?
    let allowChat: Bool?
    let systemPrompt: String?
    let llmModel: String?
    let temperature: Double?
    let maxTokens: Int?
    let followerCount: Int?
    let owner: AgentOwner?
    let isFollowing: Bool?

    enum CodingKeys: String, CodingKey {
        case id, name, description, visibility, owner
        case capabilities
        case createdAt = "created_at"
        case avatarURL = "avatar_url"
        case backgroundURL = "background_url"
        case ownerUserID = "owner_user_id"
        case allowFollow = "allow_follow"
        case allowChat = "allow_chat"
        case systemPrompt = "system_prompt"
        case llmModel = "llm_model"
        case temperature
        case maxTokens = "max_tokens"
        case followerCount = "follower_count"
        case isFollowing = "is_following"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        avatarURL = try container.decodeIfPresent(String.self, forKey: .avatarURL)
        backgroundURL = try container.decodeIfPresent(String.self, forKey: .backgroundURL)
        ownerUserID = try container.decodeIfPresent(String.self, forKey: .ownerUserID)
        visibility = try container.decodeIfPresent(String.self, forKey: .visibility)
        allowFollow = try container.decodeIfPresent(Bool.self, forKey: .allowFollow)
        allowChat = try container.decodeIfPresent(Bool.self, forKey: .allowChat)
        systemPrompt = try container.decodeIfPresent(String.self, forKey: .systemPrompt)
        llmModel = try container.decodeIfPresent(String.self, forKey: .llmModel)
        temperature = try container.decodeIfPresent(Double.self, forKey: .temperature)
        maxTokens = try container.decodeIfPresent(Int.self, forKey: .maxTokens)
        followerCount = try container.decodeIfPresent(Int.self, forKey: .followerCount)
        owner = try container.decodeIfPresent(AgentOwner.self, forKey: .owner)
        isFollowing = try container.decodeIfPresent(Bool.self, forKey: .isFollowing)
        capabilities = Self.decodeStringArray(from: container, forKey: .capabilities)
    }

    static func capabilityLabel(_ slug: String) -> String {
        let labels: [String: String] = [
            "search_ideas": "搜索想法",
            "query_ideas": "查询想法",
            "get_idea_detail": "想法详情",
            "register_idea": "注册想法",
            "fork_idea": "Fork 想法",
            "like_idea": "点赞",
            "bury_idea": "埋葬",
            "send_flowers": "送花",
            "create_comment": "评论",
            "get_comments": "读取评论",
        ]
        return labels[slug] ?? slug
    }

    var capabilityLabels: [String] {
        (capabilities ?? []).map(Self.capabilityLabel)
    }

    var visibilityLabel: String? {
        switch visibility {
        case "private": return "仅自己可见"
        case "public", nil, "": return "公开"
        default: return visibility
        }
    }

    var avatarLink: URL? {
        AvatarDefaults.url(kind: .agent, id: id, raw: avatarURL)
    }

    private static func decodeStringArray(from container: KeyedDecodingContainer<CodingKeys>, forKey key: CodingKeys) -> [String]? {
        if let array = try? container.decodeIfPresent([String].self, forKey: key) {
            return array
        }
        if let raw = try? container.decodeIfPresent(String.self, forKey: key),
           let data = raw.data(using: .utf8),
           let array = try? JSONDecoder.api.decode([String].self, from: data) {
            return array
        }
        return nil
    }
}
