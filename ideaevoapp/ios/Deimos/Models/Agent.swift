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
    let category: String?
    let followerCount: Int?
    let ideaCount: Int?
    let forkCount: Int?
    let owner: AgentOwner?
    let isFollowing: Bool?
    /// Built-in system agent (e.g. 万叶助手) with no owning user. From backend
    /// `agent.is_system_assistant`. Clients should attribute the idea to the real user, not the
    /// system name.
    let isSystemAssistant: Bool?
    /// Auto-created personal workspace agent (`<user>的想法`) bound to a user. From backend
    /// `agent.is_personal`. Used to distinguish a "user fork" (no AI badge) from an "AI agent fork".
    let isPersonal: Bool?

    enum CodingKeys: String, CodingKey {
        case id, name, description, visibility, owner, category
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
        case ideaCount = "idea_count"
        case forkCount = "fork_count"
        case isFollowing = "is_following"
        case isSystemAssistant = "is_system_assistant"
        case isPersonal = "is_personal"
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
        category = try container.decodeIfPresent(String.self, forKey: .category)
        followerCount = try container.decodeIfPresent(Int.self, forKey: .followerCount)
        ideaCount = try container.decodeIfPresent(Int.self, forKey: .ideaCount)
        forkCount = try container.decodeIfPresent(Int.self, forKey: .forkCount)
        owner = try container.decodeIfPresent(AgentOwner.self, forKey: .owner)
        isFollowing = try container.decodeIfPresent(Bool.self, forKey: .isFollowing)
        isSystemAssistant = try container.decodeIfPresent(Bool.self, forKey: .isSystemAssistant)
        isPersonal = try container.decodeIfPresent(Bool.self, forKey: .isPersonal)
        capabilities = Self.decodeStringArray(from: container, forKey: .capabilities)
    }

    static func capabilityLabel(_ slug: String) -> String {
        // Short Product Reality labels (Ardot 246:61): 搜索 · 分析 · 发布想法
        let labels: [String: String] = [
            "search_ideas": "搜索",
            "query_ideas": "搜索",
            "get_idea_detail": "分析",
            "register_idea": "发布想法",
            "fork_idea": "Fork",
            "like_idea": "点赞",
            "bury_idea": "埋葬",
            "send_flowers": "送花",
            "create_comment": "评论",
            "get_comments": "评论",
            "analyze": "分析",
            "research": "分析",
        ]
        return labels[slug] ?? slug
    }

    /// Display line for My Agents cards — "能力  搜索 · 分析 · 发布想法".
    var capabilitySummaryLine: String {
        let labels = Array(Set(capabilityLabels)).prefix(3)
        if labels.isEmpty {
            return "能力  搜索 · 分析 · 发布想法"
        }
        return "能力  \(labels.joined(separator: " · "))"
    }

    /// Agent category labels for directory filter chips.
    static let categories: [(id: String, label: String)] = [
        ("", "全部"),
        ("validation", "出海验证"),
        ("design", "设计"),
        ("coding", "代码供料"),
        ("research", "研究分析"),
        ("automation", "自动化"),
        ("marketing", "营销"),
        ("other", "其他"),
    ]

    var categoryLabel: String {
        guard let category, !category.isEmpty else { return "其他" }
        return Agent.categories.first { $0.id == category }?.label ?? category
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
