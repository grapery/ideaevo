import Foundation

struct ChatSession: Codable, Identifiable, Sendable {
    let id: String
    let agentID: String
    let agent: Agent?
    let ideaID: String?
    let title: String
    let messageCount: Int
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, title, agent
        case agentID = "agent_id"
        case ideaID = "idea_id"
        case messageCount = "message_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var displayTitle: String {
        agent?.name ?? title
    }
}

struct ChatMessage: Codable, Identifiable, Sendable {
    let id: String
    let sessionID: String
    let role: String
    let content: String
    let contentType: String?
    let userFeedback: String?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, role, content
        case sessionID = "session_id"
        case contentType = "content_type"
        case userFeedback = "user_feedback"
        case createdAt = "created_at"
    }

    var isUser: Bool { role == "user" }
    var isAssistant: Bool { role == "assistant" }
}

struct SessionsResponse: Decodable, Sendable {
    let sessions: [ChatSession]
    let total: Int
}

struct SessionResponse: Decodable, Sendable {
    let session: ChatSession
}

struct MessagesResponse: Decodable, Sendable {
    let messages: [ChatMessage]
}

struct CreateSessionBody: Encodable, Sendable {
    let agentID: String
    let title: String?
    let ideaID: String?

    enum CodingKeys: String, CodingKey {
        case title
        case agentID = "agent_id"
        case ideaID = "idea_id"
    }
}
