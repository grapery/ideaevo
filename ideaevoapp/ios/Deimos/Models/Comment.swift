import Foundation

struct WanyeComment: Codable, Identifiable, Sendable {
    let id: String
    let ideaID: String
    let userID: String
    let parentID: String?
    let content: String
    let sentiment: String?
    let isModerated: Bool
    let createdAt: Date
    let replies: [WanyeComment]?
    let authorName: String?
    let authorAvatar: String?
    let authorType: String?

    enum CodingKeys: String, CodingKey {
        case id, content, sentiment, replies
        case ideaID = "idea_id"
        case userID = "user_id"
        case parentID = "parent_id"
        case isModerated = "is_moderated"
        case createdAt = "created_at"
        case authorName = "author_name"
        case authorAvatar = "author_avatar"
        case authorType = "author_type"
    }

    var displayName: String {
        if let authorName, !authorName.isEmpty { return authorName }
        return CommentDisplayName.format(userID)
    }

    var avatarLink: URL? {
        AvatarDefaults.url(
            kind: authorType == "agent" ? .agent : .user,
            id: userID,
            raw: authorAvatar
        )
    }

    var sentimentLabel: String? {
        switch sentiment {
        case "positive": return "认可"
        case "constructive": return "建议"
        case "neutral": return "讨论"
        default: return nil
        }
    }
}

struct FlatComment: Identifiable, Sendable {
    let comment: WanyeComment
    let depth: Int
    let replyTo: WanyeComment?

    var id: String { comment.id }
}

enum CommentDisplayName {
    static func format(_ userID: String) -> String {
        if userID.isEmpty { return "匿名" }
        if userID.hasPrefix("agent_") {
            return "Agent \(userID.dropFirst(6).prefix(6))"
        }
        if userID.count > 12 {
            return "\(userID.prefix(8))…"
        }
        return userID
    }
}

enum CommentFlattener {
    static func flatten(_ comments: [WanyeComment]) -> [FlatComment] {
        var result: [FlatComment] = []
        for comment in comments {
            result.append(FlatComment(comment: comment, depth: 0, replyTo: nil))
            for reply in comment.replies ?? [] {
                result.append(FlatComment(comment: reply, depth: 1, replyTo: comment))
            }
        }
        return result
    }
}

struct CreateCommentBody: Encodable, Sendable {
    let content: String
    let parentID: String?
    let sentiment: String?

    enum CodingKeys: String, CodingKey {
        case content, sentiment
        case parentID = "parent_id"
    }
}

struct UpdateProfileBody: Encodable, Sendable {
    let name: String?
    let bio: String?
    let avatarURL: String?
    let backgroundURL: String?
    let avatarSource: String?

    enum CodingKeys: String, CodingKey {
        case name, bio
        case avatarURL = "avatar_url"
        case backgroundURL = "background_url"
        case avatarSource = "avatar_source"
    }

    init(
        name: String? = nil,
        bio: String? = nil,
        avatarURL: String? = nil,
        backgroundURL: String? = nil,
        avatarSource: String? = nil
    ) {
        self.name = name
        self.bio = bio
        self.avatarURL = avatarURL
        self.backgroundURL = backgroundURL
        self.avatarSource = avatarSource
    }
}

struct ChangePasswordBody: Encodable, Sendable {
    let oldPassword: String
    let newPassword: String

    enum CodingKeys: String, CodingKey {
        case oldPassword = "old_password"
        case newPassword = "new_password"
    }
}

struct UpdateProfileResponse: Decodable, Sendable {
    let message: String?
    let user: User
}
