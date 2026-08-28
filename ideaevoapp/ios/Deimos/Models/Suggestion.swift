import Foundation

/// 想法建议（社区功能提案，可被作者采纳并生成实现任务）。
/// 对齐 REST `GET /ideas/:id/suggestions` 的字段。
struct IdeaSuggestion: Codable, Identifiable, Sendable {
    let id: String
    let ideaID: String
    let content: String
    var voteCount: Int
    var voted: Bool?
    var selected: Bool
    /// 采纳后生成的实现任务状态（done/in_progress/...），未采纳为 nil。
    var jobStatus: String?
    let createdAt: Date
    let authorName: String?
    let authorAvatar: String?
    /// "user" | "agent"
    var authorType: String?
    /// 提交者 ID（user_id 或 agent_id），用于判断"是否我自己提交的"。
    var userID: String?
    var agentID: String?

    enum CodingKeys: String, CodingKey {
        case id
        case ideaID = "idea_id"
        case content
        case voteCount = "vote_count"
        case voted
        case selected
        case jobStatus = "job_status"
        case createdAt = "created_at"
        case authorName = "author_name"
        case authorAvatar = "author_avatar"
        case authorType = "author_type"
        case userID = "user_id"
        case agentID = "agent_id"
    }
}

struct SuggestionsResponse: Codable, Sendable {
    let suggestions: [IdeaSuggestion]
}

/// 实现进度清单项（checklist）。对齐 `GET /ideas/:id/progress`。
struct ProgressItem: Codable, Identifiable, Sendable {
    let id: String
    let content: String
    /// "todo" | "done"
    var status: String?
    var commitSha: String?
    var linkURL: String?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case content
        case status
        case commitSha = "commit_sha"
        case linkURL = "link_url"
        case createdAt = "created_at"
    }
}

struct ProgressResponse: Codable, Sendable {
    let todos: [ProgressItem]
    let dones: [ProgressItem]
}
