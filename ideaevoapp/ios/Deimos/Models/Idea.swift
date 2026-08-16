import Foundation

struct Idea: Codable, Identifiable, Sendable {
    let id: String
    let agentID: String
    let agent: Agent?
    let title: String
    let description: String
    let status: String
    let implStatus: String?
    let category: String
    let tags: [String]
    let repoURL: String?
    let demoURL: String?
    let iconURL: String?
    let videoURL: String?
    let coverURL: String?
    let imageURLs: [String]
    let links: [IdeaLink]
    let isMarkdown: Bool
    let forkedFromID: String?
    let likeCount: Int
    let flowerCount: Int
    let forkCount: Int
    let commentCount: Int
    let wishCount: Int
    let viewCount: Int
    let referenceCount: Int
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, title, description, status, category, tags, agent
        case agentID = "agent_id"
        case implStatus = "impl_status"
        case repoURL = "repo_url"
        case demoURL = "demo_url"
        case iconURL = "icon_url"
        case videoURL = "video_url"
        case coverURL = "cover_url"
        case imageURLs = "image_urls"
        case links
        case isMarkdown = "is_markdown"
        case forkedFromID = "forked_from_id"
        case likeCount = "like_count"
        case flowerCount = "flower_count"
        case forkCount = "fork_count"
        case commentCount = "comment_count"
        case wishCount = "wish_count"
        case viewCount = "view_count"
        case referenceCount = "reference_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        agentID = try container.decode(String.self, forKey: .agentID)
        agent = try container.decodeIfPresent(Agent.self, forKey: .agent)
        title = try container.decode(String.self, forKey: .title)
        description = try container.decode(String.self, forKey: .description)
        status = try container.decode(String.self, forKey: .status)
        implStatus = try container.decodeIfPresent(String.self, forKey: .implStatus)
        category = try container.decode(String.self, forKey: .category)
        repoURL = try container.decodeIfPresent(String.self, forKey: .repoURL)
        demoURL = try container.decodeIfPresent(String.self, forKey: .demoURL)
        iconURL = try container.decodeIfPresent(String.self, forKey: .iconURL)
        videoURL = try container.decodeIfPresent(String.self, forKey: .videoURL)
        coverURL = try container.decodeIfPresent(String.self, forKey: .coverURL)
        isMarkdown = try container.decodeIfPresent(Bool.self, forKey: .isMarkdown) ?? true
        imageURLs = Self.decodeStringArray(from: container, forKey: .imageURLs) ?? []
        links = Self.decodeLinks(from: container)
        forkedFromID = try container.decodeIfPresent(String.self, forKey: .forkedFromID)
        likeCount = try container.decodeIfPresent(Int.self, forKey: .likeCount) ?? 0
        flowerCount = try container.decodeIfPresent(Int.self, forKey: .flowerCount) ?? 0
        forkCount = try container.decodeIfPresent(Int.self, forKey: .forkCount) ?? 0
        commentCount = try container.decodeIfPresent(Int.self, forKey: .commentCount) ?? 0
        wishCount = try container.decodeIfPresent(Int.self, forKey: .wishCount) ?? 0
        viewCount = try container.decodeIfPresent(Int.self, forKey: .viewCount) ?? 0
        referenceCount = try container.decodeIfPresent(Int.self, forKey: .referenceCount) ?? 0
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        tags = Self.decodeTags(from: container)
    }

    var statusLabel: String {
        switch status {
        case "active": return "活跃"
        case "implemented": return "已落地"
        case "archived": return "已归档"
        case "buried": return "已埋没"
        default: return status
        }
    }

    var isBuried: Bool { status == "buried" }

    /// True when this idea was forked from another. Fork status is conveyed by this flag (and the
    /// Fork badge on cards), NOT encoded into the title.
    var isFork: Bool { forkedFromID != nil }

    /// Display name of the real human behind this idea: the agent's owner when available.
    /// Falls back to the agent name (e.g. seed agents with no owner), then to a neutral default.
    var authorDisplayName: String {
        if let ownerName = agent?.owner?.name, !ownerName.isEmpty { return ownerName }
        if let agentName = agent?.name, !agentName.isEmpty {
            // System assistant with no owner — don't surface the system name as the author.
            if agent?.isSystemAssistant == true { return "万叶社区" }
            return agentName
        }
        return "万叶社区"
    }

    /// Avatar URL of the real human (agent owner) when available; otherwise the agent's avatar.
    var authorAvatarLink: URL? {
        if let owner = agent?.owner { return owner.avatarLink }
        return agent?.avatarLink
    }

    /// True when the idea's authoring agent is NOT the user's auto-created personal workspace
    /// agent — i.e. it was authored by a distinct AI agent (or the system assistant). Clients use
    /// this to show an "AI Agent" badge on fork cards. Personal-agent forks belong to the real
    /// user and get no AI badge.
    var isAuthoredByDistinctAgent: Bool {
        guard let agent else { return false }
        if agent.isPersonal == true { return false }
        if agent.isSystemAssistant == true { return true }
        // Heuristic fallback for older data without flags: an agent with an owner but whose name
        // doesn't follow the "<user>的想法" personal pattern is a distinct agent.
        if (agent.ownerUserID?.isEmpty ?? true) == false,
           !agent.name.hasSuffix("的想法") {
            return true
        }
        return false
    }

    /// Whether to show the "AI Agent" attribution badge on this idea. Only meaningful for forks:
    /// a fork by the user's personal agent is just the user; a fork by a distinct/system agent is
    /// an AI-agent fork and merits the badge.
    var showsAIAgentBadge: Bool { isFork && isAuthoredByDistinctAgent }

    private static func decodeTags(from container: KeyedDecodingContainer<CodingKeys>) -> [String] {
        if let array = try? container.decode([String].self, forKey: .tags) {
            return array
        }
        if let raw = try? container.decode(String.self, forKey: .tags),
           let data = raw.data(using: .utf8),
           let array = try? JSONDecoder.api.decode([String].self, from: data) {
            return array
        }
        return []
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

    private static func decodeLinks(from container: KeyedDecodingContainer<CodingKeys>) -> [IdeaLink] {
        if let array = try? container.decodeIfPresent([IdeaLink].self, forKey: .links) {
            return array
        }
        if let raw = try? container.decodeIfPresent(String.self, forKey: .links),
           let data = raw.data(using: .utf8),
           let array = try? JSONDecoder.api.decode([IdeaLink].self, from: data) {
            return array
        }
        return []
    }

    var iconLink: URL? {
        AvatarDefaults.url(kind: .idea, id: id, raw: iconURL)
    }

    /// 封面图 URL:优先 coverURL,回退到画廊首图,再回退 icon。
    var coverLink: URL? {
        if let cover = coverURL?.trimmingCharacters(in: .whitespacesAndNewlines), !cover.isEmpty {
            return URL(string: cover)
        }
        return primaryImageURL ?? iconLink
    }

    /// 宣传视频 URL。
    var videoLink: URL? {
        guard let raw = videoURL?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return nil }
        return URL(string: raw)
    }

    var primaryImageURL: URL? {
        imageURLs.compactMap(URL.init(string:)).first
    }

    var externalLinks: [IdeaLink] {
        var values = links
        if let repoURL, !repoURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            values.insert(IdeaLink(kind: "repo", title: "Repo", url: repoURL), at: 0)
        }
        if let demoURL, !demoURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            values.append(IdeaLink(kind: "demo", title: "Demo", url: demoURL))
        }
        return values
    }

    /// Feed 摘要：空或与标题相同时不重复展示。
    var feedSummaryText: String? {
        let body = description.plainSummary.trimmingCharacters(in: .whitespacesAndNewlines)
        let headline = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty, body != headline else { return nil }
        return body
    }

    var feedCategoryLabel: String? {
        let value = category.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }

    var showsFeedStatus: Bool {
        status != "active"
    }

    /// Friendly display title for hero/card surfaces — prefers the full human-readable title;
    /// falls back to `displaySlug` only when title is empty.
    var displayTitle: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? displaySlug : trimmed
    }

    /// Repo slug for identity surfaces; prefers `repo_url` tail, else truncated title.
    var displaySlug: String {
        if let repo = repoURL?.trimmingCharacters(in: .whitespacesAndNewlines), !repo.isEmpty {
            var segment = repo
            if let url = URL(string: repo), let last = url.pathComponents.last, !last.isEmpty, last != "/" {
                segment = last
            } else if let last = repo.split(separator: "/").last {
                segment = String(last)
            }
            if segment.hasSuffix(".git") {
                segment = String(segment.dropLast(4))
            }
            if !segment.isEmpty { return segment }
        }
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.count <= 32 { return trimmed }
        return String(trimmed.prefix(32)) + "…"
    }

    var creatorLine: String {
        // Primary author = the real user (agent owner). The agent name is shown only when it is a
        // distinct authored agent (not the user's auto-created personal workspace agent).
        let author = authorDisplayName
        if isAuthoredByDistinctAgent, let agentName = agent?.name, !agentName.isEmpty {
            return "\(author) 创建 · \(agentName)"
        }
        return "\(author) 创建"
    }

    /// v6 cover card creator info — "姓名 · 相对时间" format (Ardot 149:219).
    var coverCreatorLine: String {
        "\(authorDisplayName) · \(createdAt.relativeShort)"
    }

    var createdUpdatedLine: String {
        "创建于 \(createdAt.absoluteShort) · 更新 \(updatedAt.feedTimestamp)"
    }

    var flowersContextSubtitle: String {
        let summary = feedSummaryText ?? description.plainSummary
        let trimmed = summary.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return creatorLine }
        if trimmed.count <= 48 { return trimmed }
        return String(trimmed.prefix(48)) + "…"
    }
}

struct IdeaLink: Codable, Hashable, Sendable {
    let kind: String
    let title: String
    let url: String

    var label: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
        switch kind {
        case "repo": return "Repo"
        case "demo": return "Demo"
        case "docs": return "Docs"
        default: return kind.isEmpty ? "Link" : kind
        }
    }

    var linkURL: URL? {
        URL(string: url.trimmingCharacters(in: .whitespacesAndNewlines))
    }
}

struct IdeasResponse: Decodable, Sendable {
    let ideas: [Idea]
    /// Present on list endpoints; omitted on e.g. `/ideas/:id/fork-children`.
    let total: Int?
}

struct UnreadCountResponse: Decodable, Sendable {
    let unread: Int

    var count: Int { unread }
}

struct ActivityView: Decodable, Identifiable, Sendable {
    let id: String
    let actorType: String
    let actorID: String
    let action: String
    let targetType: String
    let targetID: String
    let createdAt: Date
    let actorName: String?
    let actorAvatar: String?
    let targetTitle: String?
    let targetDesc: String?
    let targetStatus: String?
    let targetCategory: String?

    enum CodingKeys: String, CodingKey {
        case id, action
        case actorType = "actor_type"
        case actorID = "actor_id"
        case targetType = "target_type"
        case targetID = "target_id"
        case createdAt = "created_at"
        case actorName = "actor_name"
        case actorAvatar = "actor_avatar"
        case targetTitle = "target_title"
        case targetDesc = "target_desc"
        case targetStatus = "target_status"
        case targetCategory = "target_category"
    }

    var ideaID: String? {
        targetType == "idea" ? targetID : nil
    }

    var feedSummary: String {
        let actor = actorName ?? "用户"
        let title = targetTitle ?? "想法"
        switch action {
        case "register", "create": return "\(actor) 发布了「\(title)」"
        case "fork": return "\(actor) fork 了「\(title)」"
        case "share": return "\(actor) 分享了「\(title)」"
        default: return "\(actor) · \(title)"
        }
    }

    var searchHaystack: String {
        [
            actorName,
            targetTitle,
            targetDesc,
            targetCategory,
            feedSummary,
        ]
        .compactMap { $0 }
        .joined(separator: " ")
    }
}

struct FollowingFeedResponse: Decodable, Sendable {
    let activities: [ActivityView]
    let total: Int
}

struct ActivityStats: Decodable, Sendable {
    let todayNewIdeas: Int
    let todayForks: Int
    let activeAgents: Int
    let totalActions: Int

    enum CodingKeys: String, CodingKey {
        case todayNewIdeas = "today_new_ideas"
        case todayForks = "today_forks"
        case activeAgents = "active_agents"
        case totalActions = "total_actions"
    }
}

struct RankingIdea: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let likeCount: Int
    let flowerCount: Int
    let forkCount: Int
    let wishCount: Int?
    let category: String
    let iconURL: String?
    let coverURL: String?

    enum CodingKeys: String, CodingKey {
        case id, title, category
        case likeCount = "like_count"
        case flowerCount = "flower_count"
        case forkCount = "fork_count"
        case wishCount = "wish_count"
        case iconURL = "icon_url"
        case coverURL = "cover_url"
    }

    /// 榜单缩略图:优先封面,回退 icon。
    var thumbLink: URL? {
        if let cover = coverURL?.trimmingCharacters(in: .whitespacesAndNewlines), !cover.isEmpty {
            return URL(string: cover)
        }
        if let icon = iconURL?.trimmingCharacters(in: .whitespacesAndNewlines), !icon.isEmpty {
            return URL(string: icon)
        }
        return nil
    }
}

/// 时间窗榜单条目(今日/本周热榜)。
struct TrendingIdea: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let score: Double
    let category: String
    let iconURL: String?
    let coverURL: String?

    enum CodingKeys: String, CodingKey {
        case id, title, score, category
        case iconURL = "icon_url"
        case coverURL = "cover_url"
    }

    var thumbLink: URL? {
        if let cover = coverURL?.trimmingCharacters(in: .whitespacesAndNewlines), !cover.isEmpty {
            return URL(string: cover)
        }
        if let icon = iconURL?.trimmingCharacters(in: .whitespacesAndNewlines), !icon.isEmpty {
            return URL(string: icon)
        }
        return nil
    }
}

struct RankingResponse: Decodable, Sendable {
    let window: String
    let metric: String
    let ranking: [TrendingIdea]
}

struct ActivityRankings: Decodable, Sendable {
    let popular: [RankingIdea]
    let flowers: [RankingIdea]
    let forks: [RankingIdea]
}

struct ActivityFeedResponse: Decodable, Sendable {
    let stats: ActivityStats
    let activities: [ActivityView]
    let total: Int
    let totalIdeas: Int
    let rankings: ActivityRankings

    enum CodingKeys: String, CodingKey {
        case stats, activities, total, rankings
        case totalIdeas = "total_ideas"
    }
}

extension JSONDecoder {
    static let api: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)

            let isoFractional = ISO8601DateFormatter()
            isoFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = isoFractional.date(from: value) {
                return date
            }

            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime]
            if let date = iso.date(from: value) {
                return date
            }

            let posix = Locale(identifier: "en_US_POSIX")
            let formats = [
                "yyyy-MM-dd'T'HH:mm:ss.SSSXXXXX",
                "yyyy-MM-dd'T'HH:mm:ss.SSSSSSXXXXX",
                "yyyy-MM-dd'T'HH:mm:ssXXXXX",
                "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
                "yyyy-MM-dd'T'HH:mm:ssXXX",
                "yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'",
                "yyyy-MM-dd'T'HH:mm:ss'Z'",
            ]
            for format in formats {
                let formatter = DateFormatter()
                formatter.locale = posix
                formatter.dateFormat = format
                if let date = formatter.date(from: value) {
                    return date
                }
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Invalid date: \(value)"
            )
        }
        return decoder
    }()
}

extension JSONEncoder {
    static let api: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()
}
