import Foundation

struct ReactionsResponse: Decodable, Sendable {
    let counts: [String: Int]
    let mine: String?

    var mineEmoji: String { mine ?? "" }
}

struct ReactResponse: Decodable, Sendable {
    let emoji: String
}

struct BookmarkStatusResponse: Decodable, Sendable {
    let bookmarked: Bool
}

enum ReactionEmoji {
    static let all = ["👍", "🎉", "🚀", "❤️", "👀"]
}

struct ForkIdeaBody: Encodable, Sendable {
    let title: String
    let description: String
    let reason: String
    let category: String?
    let sourceVersionID: String?

    enum CodingKeys: String, CodingKey {
        case title, description, reason, category
        case sourceVersionID = "source_version_id"
    }
}

struct CreateIdeaBody: Encodable, Sendable {
    let title: String
    let description: String
    let category: String?
    let tags: [String]?
    let repoURL: String?
    let demoURL: String?
    let imageURLs: [String]?
    let links: [IdeaLink]?
    let agentID: String?
    let force: Bool

    enum CodingKeys: String, CodingKey {
        case title, description, category, tags
        case repoURL = "repo_url"
        case demoURL = "demo_url"
        case imageURLs = "image_urls"
        case links, force
        case agentID = "agent_id"
    }
}

struct BuryIdeaBody: Encodable, Sendable {
    let reason: String
}

struct PresignRequest: Encodable, Sendable {
    let kind: String
    let contentType: String

    enum CodingKeys: String, CodingKey {
        case kind
        case contentType = "content_type"
    }
}

struct PresignResponse: Decodable, Sendable {
    let uploadURL: String
    let publicURL: String
    let key: String
    let expiresIn: Int

    enum CodingKeys: String, CodingKey {
        case uploadURL = "upload_url"
        case publicURL = "public_url"
        case key
        case expiresIn = "expires_in"
    }
}

struct DeleteAccountBody: Encodable, Sendable {
    let password: String?
    let confirmText: String?
    let phone: String?
    let smsCode: String?

    enum CodingKeys: String, CodingKey {
        case password
        case confirmText = "confirm_text"
        case phone
        case smsCode = "sms_code"
    }
}

struct PhoneCodeBody: Encodable, Sendable {
    let phone: String
    let purpose: String?
}

struct PhoneVerifyBody: Encodable, Sendable {
    let phone: String
    let code: String
}

struct PhoneVerifyResponse: Decodable, Sendable {
    let user: User
    let token: String?
    let message: String?
}

struct LikeStatusResponse: Decodable, Sendable {
    let liked: Bool
}

struct ForkRecord: Decodable, Identifiable, Sendable {
    let id: String
    let sourceIdeaID: String
    let sourceVersionID: String?
    let newIdeaID: String
    let agentID: String
    let reason: String
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, reason
        case sourceIdeaID = "source_idea_id"
        case sourceVersionID = "source_version_id"
        case newIdeaID = "new_idea_id"
        case agentID = "agent_id"
        case createdAt = "created_at"
    }
}

struct IdeaVersionDetail: Decodable, Identifiable, Sendable {
    let id: String
    let ideaID: String
    let version: Int
    let title: String
    let description: String
    let category: String?
    let tags: [String]
    let repoURL: String?
    let demoURL: String?
    let implStatus: String?
    let changelog: String
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, version, title, description, category, tags, changelog
        case ideaID = "idea_id"
        case repoURL = "repo_url"
        case demoURL = "demo_url"
        case implStatus = "impl_status"
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        ideaID = try container.decodeIfPresent(String.self, forKey: .ideaID) ?? ""
        version = try container.decode(Int.self, forKey: .version)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? ""
        description = try container.decodeIfPresent(String.self, forKey: .description) ?? ""
        category = try container.decodeIfPresent(String.self, forKey: .category)
        repoURL = try container.decodeIfPresent(String.self, forKey: .repoURL)
        demoURL = try container.decodeIfPresent(String.self, forKey: .demoURL)
        implStatus = try container.decodeIfPresent(String.self, forKey: .implStatus)
        changelog = try container.decodeIfPresent(String.self, forKey: .changelog) ?? ""
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        if let values = try? container.decode([String].self, forKey: .tags) {
            tags = values
        } else if let raw = try? container.decode(String.self, forKey: .tags),
                  let data = raw.data(using: .utf8),
                  let values = try? JSONDecoder.api.decode([String].self, from: data) {
            tags = values
        } else {
            tags = []
        }
    }
}

struct PublishIdeaVersionBody: Encodable, Sendable {
    let title: String
    let description: String
    let category: String
    let tags: [String]
    let implStatus: String
    let repoURL: String?
    let demoURL: String?
    let changelog: String

    enum CodingKeys: String, CodingKey {
        case title, description, category, tags, changelog
        case implStatus = "impl_status"
        case repoURL = "repo_url"
        case demoURL = "demo_url"
    }
}

struct UpdateIdeaDescriptionBody: Encodable, Sendable {
    let description: String
    let changelog: String?
}

struct UpdateIdeaMetaBody: Encodable, Sendable {
    let implStatus: String?
    let repoURL: String?
    let demoURL: String?
    let iconURL: String?

    enum CodingKeys: String, CodingKey {
        case implStatus = "impl_status"
        case repoURL = "repo_url"
        case demoURL = "demo_url"
        case iconURL = "icon_url"
    }
}

struct UpdateIdeaBody: Encodable, Sendable {
    let title: String?
    let description: String?
    let status: String?
    let implStatus: String?
    let category: String?
    let tags: [String]?
    let repoURL: String?
    let demoURL: String?
    let iconURL: String?
    let imageURLs: [String]?
    let links: [IdeaLink]?
    let changelog: String?

    enum CodingKeys: String, CodingKey {
        case title, description, status, category, tags, links, changelog
        case implStatus = "impl_status"
        case repoURL = "repo_url"
        case demoURL = "demo_url"
        case iconURL = "icon_url"
        case imageURLs = "image_urls"
    }
}

struct IdeaPresignRequest: Encodable, Sendable {
    let contentType: String
    let kind: String

    enum CodingKeys: String, CodingKey {
        case kind
        case contentType = "content_type"
    }
}

struct ResetPasswordBody: Encodable, Sendable {
    let token: String
    let newPassword: String

    enum CodingKeys: String, CodingKey {
        case token
        case newPassword = "new_password"
    }
}

struct MessageFeedbackBody: Encodable, Sendable {
    let rating: String
}
