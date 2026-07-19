import Foundation

struct AppNotification: Codable, Identifiable, Sendable {
    let id: String
    let actorType: String
    let actorID: String
    let actorName: String
    let action: String
    let targetType: String
    let targetID: String
    let summary: String
    let isRead: Bool
    let createdAt: Date
    let actorAvatar: String?
    let targetTitle: String?

    enum CodingKeys: String, CodingKey {
        case id, action, summary
        case actorType = "actor_type"
        case actorID = "actor_id"
        case actorName = "actor_name"
        case actorAvatar = "actor_avatar"
        case targetType = "target_type"
        case targetID = "target_id"
        case targetTitle = "target_title"
        case isRead = "read"
        case createdAt = "created_at"
    }

    var actorAvatarLink: URL? {
        let kind: AvatarDefaults.Kind = actorType == "agent" ? .agent : .user
        return AvatarDefaults.url(kind: kind, id: actorID, raw: actorAvatar)
    }

    var actionIcon: String {
        switch action {
        case "flower", "flowers": return "🌸"
        case "comment": return "💬"
        case "fork": return "🔱"
        case "follow": return "👤"
        default: return "🔔"
        }
    }

    var title: String {
        switch action {
        case "flower", "flowers":
            return "\(actorName) 给你的想法送了一朵花"
        case "comment":
            return "\(actorName) 评论了你的想法"
        case "fork":
            return "\(actorName) Fork 了你的想法"
        case "follow":
            return "\(actorName) 关注了你"
        default:
            return "\(actorName) \(action)"
        }
    }

    var meta: String {
        let time = createdAt.relativeShort
        if summary.isEmpty { return time }
        return "\(summary) · \(time)"
    }

    /// Subtitle for compact list rows (timestamp shown separately).
    var listSubtitle: String? {
        if let title = targetTitle, !title.isEmpty {
            return "「\(title)」"
        }
        if summary.isEmpty { return nil }
        return summary
    }
}

struct NotificationsResponse: Decodable, Sendable {
    let items: [AppNotification]
    let total: Int
    let unread: Int
}

struct NotificationPreferences: Codable, Sendable {
    let userID: String
    var pushFlowers: Bool
    var pushComments: Bool
    var pushFollows: Bool
    var pushEnabled: Bool
    var emailOnFollow: Bool
    var emailOnComment: Bool
    var emailOnFlower: Bool
    var emailOnMention: Bool
    var emailWeeklyDigest: Bool

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case pushFlowers = "push_flowers"
        case pushComments = "push_comments"
        case pushFollows = "push_follows"
        case pushEnabled = "push_enabled"
        case emailOnFollow = "email_on_follow"
        case emailOnComment = "email_on_comment"
        case emailOnFlower = "email_on_flower"
        case emailOnMention = "email_on_mention"
        case emailWeeklyDigest = "email_weekly_digest"
    }

    static let defaults = NotificationPreferences(
        userID: "",
        pushFlowers: true,
        pushComments: true,
        pushFollows: true,
        pushEnabled: true,
        emailOnFollow: true,
        emailOnComment: true,
        emailOnFlower: true,
        emailOnMention: false,
        emailWeeklyDigest: true
    )
}

struct UpdateNotificationPreferencesBody: Encodable, Sendable {
    var pushFlowers: Bool?
    var pushComments: Bool?
    var pushFollows: Bool?
    var pushEnabled: Bool?
    var emailOnFollow: Bool?
    var emailOnComment: Bool?
    var emailOnFlower: Bool?
    var emailOnMention: Bool?
    var emailWeeklyDigest: Bool?

    enum CodingKeys: String, CodingKey {
        case pushFlowers = "push_flowers"
        case pushComments = "push_comments"
        case pushFollows = "push_follows"
        case pushEnabled = "push_enabled"
        case emailOnFollow = "email_on_follow"
        case emailOnComment = "email_on_comment"
        case emailOnFlower = "email_on_flower"
        case emailOnMention = "email_on_mention"
        case emailWeeklyDigest = "email_weekly_digest"
    }
}

struct RegisterDeviceBody: Encodable, Sendable {
    let token: String
    let platform: String
}

struct UserDevice: Codable, Identifiable, Sendable {
    let id: String
    let userID: String
    let token: String?
    let platform: String
    let createdAt: Date?
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, token, platform
        case userID = "user_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct UserDevicesResponse: Decodable, Sendable {
    let items: [UserDevice]
}
