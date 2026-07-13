import Foundation
import os

enum AppConfig {
    static let systemAssistantName = "万叶助手"

    /// Override in scheme: IDEEVO_API_URL=http://127.0.0.1:9200/api
    /// Release builds may set `IDEEVOApiBaseURL` in Info.plist.
    static var apiBaseURL: URL {
        if let env = ProcessInfo.processInfo.environment["IDEEVO_API_URL"],
           let url = URL(string: env) {
            return url
        }
        if let plist = Bundle.main.object(forInfoDictionaryKey: "IDEEVOApiBaseURL") as? String,
           !plist.isEmpty,
           let url = URL(string: plist) {
            return url
        }
        #if DEBUG
        return URL(string: "http://127.0.0.1:9200/api")!
        #else
        return URL(string: "https://api.deimos.app/api")!
        #endif
    }

    /// Web origin for legal pages (`/privacy`, etc.). Derived from API URL when not set.
    static var webBaseURL: URL {
        if let env = ProcessInfo.processInfo.environment["IDEEVO_WEB_URL"],
           let url = URL(string: env) {
            return url
        }
        if let plist = Bundle.main.object(forInfoDictionaryKey: "IDEEVOWebBaseURL") as? String,
           !plist.isEmpty,
           let url = URL(string: plist) {
            return url
        }
        var components = URLComponents(url: apiBaseURL, resolvingAgainstBaseURL: false)!
        var path = components.path
        if path.hasSuffix("/api") {
            path = String(path.dropLast(4))
        }
        components.path = path.isEmpty ? "/" : path
        components.query = nil
        components.fragment = nil
        return components.url ?? URL(string: "https://deimos.app")!
    }

    /// Resolves an endpoint path against `apiBaseURL`.
    /// `URL(string:relativeTo:)` replaces the base's last path component (`api` → `ideas`),
    /// so we join paths explicitly via `URLComponents`.
    static func apiURL(path: String) -> URL? {
        let trimmed = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let endpointPath: String
        let query: String?
        if let queryStart = trimmed.firstIndex(of: "?") {
            endpointPath = String(trimmed[..<queryStart])
            query = String(trimmed[trimmed.index(after: queryStart)...])
        } else {
            endpointPath = trimmed
            query = nil
        }

        guard var components = URLComponents(url: apiBaseURL, resolvingAgainstBaseURL: false) else {
            return nil
        }

        var basePath = components.path
        if basePath.hasSuffix("/") {
            basePath.removeLast()
        }
        components.path = "\(basePath)/\(endpointPath)"
        if let query, !query.isEmpty {
            components.percentEncodedQuery = query
        }
        return components.url
    }
}

@MainActor
final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private var token: String?
    private var pendingToken: String?

    init(session: URLSession = .shared) {
        self.session = session
        self.token = KeychainStore.loadToken()
        self.pendingToken = KeychainStore.loadPendingToken()
    }

    var authToken: String? { token }
    var phoneBindToken: String? { pendingToken }

    func setToken(_ token: String?) {
        self.token = token
        if let token {
            try? KeychainStore.saveToken(token)
        } else {
            KeychainStore.deleteToken()
        }
    }

    func setPendingToken(_ token: String?) {
        self.pendingToken = token
        if let token {
            try? KeychainStore.savePendingToken(token)
        } else {
            KeychainStore.deletePendingToken()
        }
    }

    // MARK: - Auth

    func login(email: String, password: String) async throws -> User {
        let body = ["email": email, "password": password]
        let response: AuthResponse = try await request(
            path: "/auth/user/login",
            method: "POST",
            jsonBody: body,
            auth: .none
        )
        if let token = response.token { setToken(token) }
        return response.user
    }

    func register(name: String, email: String, password: String) async throws -> User {
        let body = ["name": name, "email": email, "password": password]
        let response: AuthResponse = try await request(
            path: "/auth/user/register",
            method: "POST",
            jsonBody: body,
            auth: .none
        )
        if let token = response.token { setToken(token) }
        return response.user
    }

    func me() async throws -> User {
        let response: MeResponse = try await request(path: "/auth/user/me", auth: .user)
        return response.user
    }

    func logout() async {
        _ = try? await request(path: "/auth/user/logout", method: "POST", auth: .user) as EmptyResponse
        setToken(nil)
        setPendingToken(nil)
    }

    func forgotPassword(email: String) async throws {
        let body = ["email": email]
        _ = try await request(
            path: "/auth/user/forgot-password",
            method: "POST",
            jsonBody: body,
            auth: .none
        ) as MessageResponse
    }

    func signInWithApple(identityToken: String, email: String?, name: String?, nonce: String? = nil) async throws -> User {
        var body: [String: String] = ["identity_token": identityToken]
        if let email, !email.isEmpty { body["email"] = email }
        if let name, !name.isEmpty { body["name"] = name }
        if let nonce, !nonce.isEmpty { body["nonce"] = nonce }
        let response: AuthResponse = try await request(
            path: "/auth/user/apple",
            method: "POST",
            jsonBody: body,
            auth: .none
        )
        if let token = response.token { setToken(token) }
        return response.user
    }

    func signInWithGoogle(idToken: String) async throws -> OAuthResult {
        let response: FlexibleAuthResponse = try await request(
            path: "/auth/user/google",
            method: "POST",
            jsonBody: ["id_token": idToken],
            auth: .none
        )
        return try resolveFlexibleAuth(response, provider: "google")
    }

    func signInWithWeChat(code: String) async throws -> OAuthResult {
        let response: FlexibleAuthResponse = try await request(
            path: "/auth/user/wechat",
            method: "POST",
            jsonBody: ["code": code],
            auth: .none
        )
        return try resolveFlexibleAuth(response, provider: "wechat")
    }

    private func resolveFlexibleAuth(_ response: FlexibleAuthResponse, provider: String) throws -> OAuthResult {
        if response.status == "pending", let pending = response.pendingToken {
            setPendingToken(pending)
            return OAuthResult(status: "pending", provider: provider, token: nil, pendingToken: pending, errorCode: nil)
        }
        if let token = response.token, let user = response.user {
            setToken(token)
            setPendingToken(nil)
            _ = user
            return OAuthResult(status: "success", provider: provider, token: token, pendingToken: nil, errorCode: nil)
        }
        throw APIError.server("登录失败")
    }

    func completeOAuth(_ result: OAuthResult) async throws -> User? {
        if result.status == "success", let token = result.token {
            setToken(token)
            setPendingToken(nil)
            return try await me()
        }
        if result.status == "pending", let pending = result.pendingToken {
            setPendingToken(pending)
            return nil
        }
        let code = result.errorCode ?? "oauth_failed"
        throw APIError.server(oauthErrorMessage(code))
    }

    private func oauthErrorMessage(_ code: String) -> String {
        switch code {
        case "oauth_state": return "OAuth 验证失败，请重试"
        case "oauth_failed", "wechat_oauth_failed": return "登录失败，请重试"
        case "oauth_conflict": return "该邮箱已用密码注册，请使用密码登录"
        case "google_not_configured": return "Google 登录未配置"
        case "google_auth_failed": return "Google 登录验证失败"
        case "wechat_not_configured": return "微信登录未配置"
        case "apple_not_configured": return "Apple 登录未配置"
        case "apple_auth_failed": return "Apple 登录验证失败"
        default: return "登录失败"
        }
    }

    func userProfile(id: String) async throws -> UserProfileData {
        let response: UserProfileResponse = try await request(path: "/users/\(id)/profile", auth: .none)
        return response.profile
    }

    func userPublicProfile(id: String) async throws -> UserProfileEnvelope {
        let auth: AuthMode = token != nil ? .user : .none
        return try await request(path: "/users/\(id)/profile", auth: auth)
    }

    func getUserIdeas(userID: String, limit: Int = 20) async throws -> [Idea] {
        let response: IdeasResponse = try await request(
            path: "/users/\(userID)/ideas?limit=\(limit)",
            auth: .none
        )
        return response.ideas
    }

    func getUserAgents(userID: String, limit: Int = 50) async throws -> [Agent] {
        let auth: AuthMode = token != nil ? .user : .none
        let response: AgentsResponse = try await request(
            path: "/users/\(userID)/agents?limit=\(limit)",
            auth: auth
        )
        return response.agents
    }

    func followUser(id: String) async throws {
        _ = try await request(path: "/users/\(id)/follow", method: "POST", auth: .user) as MessageResponse
    }

    func unfollowUser(id: String) async throws {
        _ = try await request(path: "/users/\(id)/follow", method: "DELETE", auth: .user) as MessageResponse
    }

    // MARK: - Moderation

    func listBlocks() async throws -> UsersListResponse {
        try await request(path: "/user/blocks", auth: .user)
    }

    func blockUser(id: String) async throws {
        _ = try await request(path: "/users/\(id)/block", method: "POST", auth: .user) as MessageResponse
    }

    func unblockUser(id: String) async throws {
        _ = try await request(path: "/users/\(id)/block", method: "DELETE", auth: .user) as MessageResponse
    }

    func submitReport(targetType: String, targetID: String, reason: String, detail: String) async throws {
        let body = SubmitReportBody(
            targetType: targetType,
            targetID: targetID,
            reason: reason,
            detail: detail
        )
        _ = try await request(
            path: "/reports",
            method: "POST",
            encodableBody: body,
            auth: .user
        ) as MessageResponse
    }

    // MARK: - Ideas

    func queryIdeas(
        limit: Int = 20,
        offset: Int = 0,
        sort: String = "newest",
        status: String? = nil,
        category: String? = nil
    ) async throws -> IdeasResponse {
        var path = "/ideas?sort=\(sort)&limit=\(limit)&offset=\(offset)"
        if let status, !status.isEmpty {
            path += "&status=\(status)"
        }
        if let category, !category.isEmpty {
            path += "&category=\(category)"
        }
        return try await request(path: path, auth: .none)
    }

    func searchIdeas(query: String, page: Int = 1, limit: Int = 20, status: String = "active") async throws -> SearchResponse {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        let statusEncoded = status.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? status
        return try await request(
            path: "/ideas/search?q=\(encoded)&page=\(page)&limit=\(limit)&status=\(statusEncoded)",
            auth: .none
        )
    }

    func getIdeaVersions(ideaID: String) async throws -> [IdeaVersionSummary] {
        let response: IdeaVersionsResponse = try await request(path: "/ideas/\(ideaID)/versions", auth: .none)
        return response.versions
    }

    func shareIdea(id: String) async throws {
        _ = try await request(path: "/ideas/\(id)/share", method: "POST", auth: .user) as MessageResponse
    }

    func getIdea(id: String) async throws -> Idea {
        try await request(path: "/ideas/\(id)", auth: .none)
    }

    func getFlowers(ideaID: String) async throws -> [FlowerDonor] {
        let response: FlowersResponse = try await request(path: "/ideas/\(ideaID)/flowers", auth: .none)
        return response.donors
    }

    func getForkChildren(ideaID: String) async throws -> [Idea] {
        let response: IdeasResponse = try await request(path: "/ideas/\(ideaID)/fork-children", auth: .none)
        return response.ideas
    }

    func getForks(ideaID: String) async throws -> [ForkRecord] {
        try await request(path: "/ideas/\(ideaID)/forks", auth: .none)
    }

    func getIdeaVersion(ideaID: String, versionID: String) async throws -> IdeaVersionDetail {
        try await request(path: "/ideas/\(ideaID)/versions/\(versionID)", auth: .none)
    }

    func updateIdeaDescription(ideaID: String, description: String, changelog: String?) async throws -> Idea {
        let body = UpdateIdeaDescriptionBody(description: description, changelog: changelog)
        return try await request(
            path: "/ideas/\(ideaID)/description",
            method: "PATCH",
            encodableBody: body,
            auth: .user
        )
    }

    func updateIdeaMeta(ideaID: String, body: UpdateIdeaMetaBody) async throws -> Idea {
        try await request(
            path: "/ideas/\(ideaID)/meta",
            method: "PATCH",
            encodableBody: body,
            auth: .user
        )
    }

    func presignIdeaUpload(ideaID: String, kind: String, contentType: String) async throws -> PresignResponse {
        let body = IdeaPresignRequest(contentType: contentType, kind: kind)
        return try await request(
            path: "/ideas/\(ideaID)/upload/presign",
            method: "POST",
            encodableBody: body,
            auth: .user
        )
    }

    func uploadIdeaImage(ideaID: String, kind: String, data: Data, contentType: String = "image/jpeg") async throws -> String {
        let presign = try await presignIdeaUpload(ideaID: ideaID, kind: kind, contentType: contentType)
        try await uploadPresigned(data: data, uploadURL: presign.uploadURL, contentType: contentType)
        return presign.publicURL
    }

    func verifyEmail(token: String) async throws {
        let encoded = token.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? token
        _ = try await request(path: "/auth/user/verify?token=\(encoded)", auth: .none) as MessageResponse
    }

    func resetPassword(token: String, newPassword: String) async throws {
        let body = ResetPasswordBody(token: token, newPassword: newPassword)
        _ = try await request(
            path: "/auth/user/reset-password",
            method: "POST",
            encodableBody: body,
            auth: .none
        ) as MessageResponse
    }

    func setMessageFeedback(sessionID: String, messageID: String, rating: String) async throws {
        let body = MessageFeedbackBody(rating: rating)
        _ = try await request(
            path: "/sessions/\(sessionID)/messages/\(messageID)/feedback",
            method: "POST",
            encodableBody: body,
            auth: .user
        ) as MessageResponse
    }

    func clearMessageFeedback(sessionID: String, messageID: String) async throws {
        _ = try await request(
            path: "/sessions/\(sessionID)/messages/\(messageID)/feedback",
            method: "DELETE",
            auth: .user
        ) as MessageResponse
    }

    func likeIdea(id: String) async throws {
        _ = try await request(path: "/ideas/\(id)/like", method: "POST", auth: .user) as MessageResponse
    }

    func unlikeIdea(id: String) async throws {
        _ = try await request(path: "/ideas/\(id)/like", method: "DELETE", auth: .user) as MessageResponse
    }

    func getLikeStatus(id: String) async throws -> Bool {
        let response: LikeStatusResponse = try await request(path: "/ideas/\(id)/like", auth: .user)
        return response.liked
    }

    func toggleLike(id: String, currentlyLiked: Bool) async throws {
        if currentlyLiked {
            try await unlikeIdea(id: id)
        } else {
            try await likeIdea(id: id)
        }
    }

    func sendFlower(ideaID: String) async throws {
        _ = try await request(path: "/ideas/\(ideaID)/flowers", method: "POST", jsonBody: [String: String](), auth: .user) as MessageResponse
    }

    func forkIdea(id: String, title: String, description: String, reason: String) async throws -> Idea {
        let body = ForkIdeaBody(title: title, description: description, reason: reason, category: nil)
        return try await request(
            path: "/ideas/\(id)/fork",
            method: "POST",
            encodableBody: body,
            auth: .user
        )
    }

    func createIdea(
        title: String,
        description: String,
        category: String = "other",
        agentID: String? = nil
    ) async throws -> Idea {
        let body = CreateIdeaBody(
            title: title,
            description: description,
            category: category,
            tags: nil,
            repoURL: nil,
            demoURL: nil,
            agentID: agentID
        )
        return try await request(
            path: "/ideas",
            method: "POST",
            encodableBody: body,
            auth: .user
        )
    }

    func buryIdea(id: String, reason: String) async throws -> Idea {
        let body = BuryIdeaBody(reason: reason)
        return try await request(
            path: "/ideas/\(id)/bury",
            method: "POST",
            encodableBody: body,
            auth: .user
        )
    }

    // MARK: - Reactions

    func getReactions(ideaID: String) async throws -> ReactionsResponse {
        try await request(path: "/ideas/\(ideaID)/reactions", auth: .none)
    }

    func react(ideaID: String, emoji: String) async throws {
        _ = try await request(
            path: "/ideas/\(ideaID)/reactions",
            method: "POST",
            jsonBody: ["emoji": emoji],
            auth: .user
        ) as ReactResponse
    }

    func unreact(ideaID: String) async throws {
        _ = try await request(path: "/ideas/\(ideaID)/reactions", method: "DELETE", auth: .user) as MessageResponse
    }

    // MARK: - Comments

    func getComments(ideaID: String) async throws -> [WanyeComment] {
        try await request(path: "/ideas/\(ideaID)/comments", auth: .none)
    }

    func createComment(ideaID: String, content: String, parentID: String? = nil) async throws -> WanyeComment {
        let body = CreateCommentBody(content: content, parentID: parentID, sentiment: nil)
        return try await request(
            path: "/ideas/\(ideaID)/comments",
            method: "POST",
            encodableBody: body,
            auth: .user
        )
    }

    // MARK: - Profile settings

    func updateProfile(
        name: String? = nil,
        bio: String? = nil,
        avatarURL: String? = nil,
        backgroundURL: String? = nil,
        avatarSource: String? = nil
    ) async throws -> User {
        let body = UpdateProfileBody(
            name: name,
            bio: bio,
            avatarURL: avatarURL,
            backgroundURL: backgroundURL,
            avatarSource: avatarSource
        )
        let response: UpdateProfileResponse = try await request(
            path: "/user/profile",
            method: "PATCH",
            encodableBody: body,
            auth: .user
        )
        return response.user
    }

    func presignUpload(kind: String, contentType: String) async throws -> PresignResponse {
        let body = PresignRequest(kind: kind, contentType: contentType)
        return try await request(
            path: "/user/upload/presign",
            method: "POST",
            encodableBody: body,
            auth: .user
        )
    }

    func uploadPresigned(data: Data, uploadURL: String, contentType: String) async throws {
        guard let url = URL(string: uploadURL) else { throw APIError.invalidURL }
        var putRequest = URLRequest(url: url)
        putRequest.httpMethod = "PUT"
        putRequest.setValue(contentType, forHTTPHeaderField: "Content-Type")
        putRequest.httpBody = data
        #if DEBUG
        let uploadStarted = Date()
        APIDebugLogger.logRequest(putRequest, bodyOverride: "\(data.count) bytes")
        #endif
        let (responseData, response): (Data, URLResponse)
        do {
            (responseData, response) = try await session.data(for: putRequest)
        } catch {
            #if DEBUG
            APIDebugLogger.logTransportError(error, request: putRequest, started: uploadStarted)
            #endif
            throw APIError.network(error)
        }
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            #if DEBUG
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            APIDebugLogger.logResponse(
                request: putRequest,
                status: status,
                data: responseData,
                started: uploadStarted
            )
            #endif
            throw APIError.server("图片上传失败")
        }
        #if DEBUG
        APIDebugLogger.logResponse(
            request: putRequest,
            status: http.statusCode,
            data: responseData,
            started: uploadStarted
        )
        #endif
    }

    func uploadImage(kind: String, data: Data, contentType: String = "image/jpeg") async throws -> String {
        let presign = try await presignUpload(kind: kind, contentType: contentType)
        try await uploadPresigned(data: data, uploadURL: presign.uploadURL, contentType: contentType)
        return presign.publicURL
    }

    func resetAvatar() async throws -> User {
        let response: UpdateProfileResponse = try await request(
            path: "/user/avatar/reset",
            method: "POST",
            auth: .user
        )
        return response.user
    }

    func resetBackground() async throws -> User {
        let response: UpdateProfileResponse = try await request(
            path: "/user/background/reset",
            method: "POST",
            auth: .user
        )
        return response.user
    }

    func deleteAccount(body: DeleteAccountBody) async throws {
        _ = try await request(
            path: "/user/account",
            method: "DELETE",
            encodableBody: body,
            auth: .user
        ) as MessageResponse
        setToken(nil)
        setPendingToken(nil)
    }

    func sendPhoneCode(phone: String, purpose: String? = nil) async throws {
        let body = PhoneCodeBody(phone: phone, purpose: purpose)
        let authMode: AuthMode = token != nil ? .user : .pending
        _ = try await request(
            path: "/auth/phone/send-code",
            method: "POST",
            encodableBody: body,
            auth: authMode
        ) as MessageResponse
    }

    func verifyPhone(phone: String, code: String) async throws -> User {
        let body = PhoneVerifyBody(phone: phone, code: code)
        let response: PhoneVerifyResponse = try await request(
            path: "/auth/phone/verify",
            method: "POST",
            encodableBody: body,
            auth: .pending
        )
        if let token = response.token {
            setToken(token)
            setPendingToken(nil)
        }
        return response.user
    }

    func verifyPhoneAsUser(phone: String, code: String) async throws -> User {
        let body = PhoneVerifyBody(phone: phone, code: code)
        let response: PhoneVerifyResponse = try await request(
            path: "/auth/phone/verify",
            method: "POST",
            encodableBody: body,
            auth: .user
        )
        return response.user
    }

    func changePassword(oldPassword: String, newPassword: String) async throws {
        let body = ChangePasswordBody(oldPassword: oldPassword, newPassword: newPassword)
        _ = try await request(
            path: "/user/password",
            method: "POST",
            encodableBody: body,
            auth: .user
        ) as MessageResponse
    }

    // MARK: - Activity & Notifications

    func activityFeed(limit: Int = 30) async throws -> ActivityFeedResponse {
        try await request(path: "/activity/feed?limit=\(limit)", auth: .none)
    }

    func followingFeed(limit: Int = 20) async throws -> [ActivityView] {
        let response: FollowingFeedResponse = try await request(
            path: "/activity/following?limit=\(limit)",
            auth: .user
        )
        return response.activities
    }

    func getFollowers(userID: String, limit: Int = 50, offset: Int = 0) async throws -> UsersListResponse {
        let auth: AuthMode = token != nil ? .user : .none
        return try await request(
            path: "/users/\(userID)/followers?limit=\(limit)&offset=\(offset)",
            auth: auth
        )
    }

    func getFollowing(userID: String, limit: Int = 50, offset: Int = 0) async throws -> UsersListResponse {
        let auth: AuthMode = token != nil ? .user : .none
        return try await request(
            path: "/users/\(userID)/following?limit=\(limit)&offset=\(offset)",
            auth: auth
        )
    }

    func unreadNotificationCount() async throws -> Int {
        let response: UnreadCountResponse = try await request(
            path: "/notifications/unread-count",
            auth: .user
        )
        return response.count
    }

    func filteredUnreadNotificationCount(limit: Int = 100) async throws -> Int {
        let response = try await notifications(limit: limit)
        return response.items.filter { !$0.isRead && AppPreferencesStore.shouldShowNotification(action: $0.action) }.count
    }

    func notifications(limit: Int = 30, offset: Int = 0) async throws -> NotificationsResponse {
        try await request(path: "/notifications?limit=\(limit)&offset=\(offset)", auth: .user)
    }

    func markAllNotificationsRead() async throws {
        _ = try await request(path: "/notifications/read-all", method: "POST", auth: .user) as MessageResponse
    }

    func markNotificationRead(id: String) async throws {
        _ = try await request(path: "/notifications/read/\(id)", method: "POST", auth: .user) as MessageResponse
    }

    // MARK: - Agents

    func listAgents(limit: Int = 50, offset: Int = 0) async throws -> AgentsResponse {
        try await request(path: "/agents?limit=\(limit)&offset=\(offset)", auth: .none)
    }

    func getAgent(id: String) async throws -> Agent {
        try await request(path: "/agents/\(id)", auth: .none)
    }

    func getAgentStats(id: String) async throws -> AgentStats {
        try await request(path: "/agents/\(id)/stats", auth: .none)
    }

    func getAgentIdeas(id: String, limit: Int = 20) async throws -> [Idea] {
        let response: IdeasResponse = try await request(path: "/agents/\(id)/ideas?limit=\(limit)", auth: .none)
        return response.ideas
    }

    func agentFollowStatus(id: String) async throws -> Bool {
        let response: FollowStatusResponse = try await request(
            path: "/agents/\(id)/follow",
            auth: authToken != nil ? .user : .none
        )
        return response.isFollowing
    }

    func followAgent(id: String) async throws {
        _ = try await request(path: "/agents/\(id)/follow", method: "POST", auth: .user) as MessageResponse
    }

    func unfollowAgent(id: String) async throws {
        _ = try await request(path: "/agents/\(id)/follow", method: "DELETE", auth: .user) as MessageResponse
    }

    func findSystemAssistant() async throws -> Agent? {
        let agents = try await listAgents(limit: 100).agents
        return agents.first { $0.name == AppConfig.systemAssistantName }
    }

    func myAgents(limit: Int = 50, offset: Int = 0) async throws -> [Agent] {
        let response: AgentsResponse = try await request(
            path: "/my/agents?limit=\(limit)&offset=\(offset)",
            auth: .user
        )
        return response.agents
    }

    func rotateAgentAPIKey(id: String) async throws -> String {
        struct RotateResponse: Decodable { let apiKey: String
            enum CodingKeys: String, CodingKey { case apiKey = "api_key" }
        }
        let response: RotateResponse = try await request(
            path: "/agents/\(id)/rotate-api-key",
            method: "POST",
            auth: .user
        )
        return response.apiKey
    }

    func registerAgent(_ body: RegisterAgentBody) async throws -> RegisterAgentResponse {
        try await request(
            path: "/auth/register",
            method: "POST",
            encodableBody: body,
            auth: .user
        )
    }

    func updateAgent(id: String, body: UpdateAgentBody) async throws -> Agent {
        try await request(
            path: "/agents/\(id)",
            method: "PUT",
            encodableBody: body,
            auth: .user
        )
    }

    func deleteAgent(id: String) async throws {
        _ = try await request(path: "/agents/\(id)", method: "DELETE", auth: .user) as MessageResponse
    }

    func presignAgentUpload(agentID: String, kind: String, contentType: String) async throws -> PresignResponse {
        let body = AgentPresignRequest(kind: kind, contentType: contentType)
        return try await request(
            path: "/agents/\(agentID)/upload/presign",
            method: "POST",
            encodableBody: body,
            auth: .user
        )
    }

    func uploadAgentImage(agentID: String, kind: String, data: Data, contentType: String = "image/jpeg") async throws -> String {
        let presign = try await presignAgentUpload(agentID: agentID, kind: kind, contentType: contentType)
        try await uploadPresigned(data: data, uploadURL: presign.uploadURL, contentType: contentType)
        return presign.publicURL
    }

    func resetAgentAvatar(agentID: String) async throws -> Agent {
        try await request(
            path: "/agents/\(agentID)/avatar/reset",
            method: "POST",
            auth: .user
        )
    }

    func resetIdeaIcon(ideaID: String) async throws -> Idea {
        try await request(
            path: "/ideas/\(ideaID)/icon/reset",
            method: "POST",
            auth: .user
        )
    }

    func getNotificationPreferences() async throws -> NotificationPreferences {
        try await request(path: "/user/notification-preferences", auth: .user)
    }

    func updateNotificationPreferences(_ body: UpdateNotificationPreferencesBody) async throws -> NotificationPreferences {
        try await request(
            path: "/user/notification-preferences",
            method: "PATCH",
            encodableBody: body,
            auth: .user
        )
    }

    func registerDeviceToken(_ token: String, platform: String = "ios") async throws -> UserDevice {
        let body = RegisterDeviceBody(token: token, platform: platform)
        return try await request(
            path: "/user/devices",
            method: "POST",
            encodableBody: body,
            auth: .user
        )
    }

    func unregisterDevice(id: String) async throws {
        _ = try await request(path: "/user/devices/\(id)", method: "DELETE", auth: .user) as MessageResponse
    }

    // MARK: - Chat

    func listSessions(limit: Int = 30) async throws -> [ChatSession] {
        let response: SessionsResponse = try await request(path: "/sessions?limit=\(limit)", auth: .user)
        return response.sessions
    }

    func createSession(agentID: String, title: String? = nil, ideaID: String? = nil) async throws -> ChatSession {
        let body = CreateSessionBody(agentID: agentID, title: title, ideaID: ideaID)
        let response: SessionResponse = try await request(
            path: "/sessions",
            method: "POST",
            encodableBody: body,
            auth: .user
        )
        return response.session
    }

    func getMessages(sessionID: String, limit: Int = 50) async throws -> [ChatMessage] {
        let response: MessagesResponse = try await request(
            path: "/sessions/\(sessionID)/messages?limit=\(limit)",
            auth: .user
        )
        return response.messages
    }

    func ensureWanyeSession() async throws -> ChatSession {
        let sessions = try await listSessions()
        if let existing = sessions.first(where: { $0.agent?.name == AppConfig.systemAssistantName || $0.title.contains("万叶") }) {
            return existing
        }
        guard let assistant = try await findSystemAssistant() else {
            throw APIError.server("未找到万叶助手 Agent")
        }
        return try await createSession(agentID: assistant.id, title: AppConfig.systemAssistantName)
    }

    func renameSession(id: String, title: String) async throws {
        _ = try await request(
            path: "/sessions/\(id)",
            method: "PATCH",
            jsonBody: ["title": title],
            auth: .user
        ) as MessageResponse
    }

    func deleteSession(id: String) async throws {
        _ = try await request(path: "/sessions/\(id)", method: "DELETE", auth: .user) as MessageResponse
    }

    func forkSession(id: String, title: String? = nil) async throws -> ChatSession {
        struct ForkBody: Encodable {
            let title: String?
        }
        let response: SessionResponse = try await request(
            path: "/sessions/\(id)/fork",
            method: "POST",
            encodableBody: ForkBody(title: title),
            auth: .user
        )
        return response.session
    }

    /// Archive a chat session — backend packages context + extracts summary.
    func archiveSession(id: String) async throws -> ArchiveResult {
        let response: ArchiveResultResponse = try await request(
            path: "/sessions/\(id)/archive",
            method: "POST",
            auth: .user
        )
        return response.result
    }

    // MARK: - Transport

    enum AuthMode {
        case none
        case user
        case pending
    }

    private struct EmptyResponse: Decodable {}
    private struct MessageResponse: Decodable { let message: String? }

    private func request<T: Decodable>(
        path: String,
        method: String = "GET",
        jsonBody: [String: String]? = nil,
        encodableBody: (any Encodable)? = nil,
        auth: AuthMode
    ) async throws -> T {
        guard let url = AppConfig.apiURL(path: path) else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")

        if let jsonBody {
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = try JSONEncoder.api.encode(jsonBody)
        } else if let encodableBody {
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = try JSONEncoder.api.encode(encodableBody)
        } else if method != "GET" {
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = Data("{}".utf8)
        }

        if auth == .user {
            guard let token else { throw APIError.unauthorized }
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        } else if auth == .pending {
            guard let pendingToken else { throw APIError.unauthorized }
            urlRequest.setValue("Bearer \(pendingToken)", forHTTPHeaderField: "Authorization")
        }

        #if DEBUG
        let requestStarted = Date()
        APIDebugLogger.logRequest(urlRequest)
        #endif

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch {
            #if DEBUG
            APIDebugLogger.logTransportError(error, request: urlRequest, started: requestStarted)
            #endif
            throw APIError.network(error)
        }

        guard let http = response as? HTTPURLResponse else {
            #if DEBUG
            APIDebugLogger.logResponse(
                request: urlRequest,
                status: -1,
                data: data,
                started: requestStarted,
                note: "无效的服务器响应"
            )
            #endif
            throw APIError.server("无效的服务器响应")
        }

        if http.statusCode == 401 {
            #if DEBUG
            APIDebugLogger.logResponse(
                request: urlRequest,
                status: http.statusCode,
                data: data,
                started: requestStarted,
                note: "未授权"
            )
            #endif
            throw APIError.unauthorized
        }

        guard (200..<300).contains(http.statusCode) else {
            #if DEBUG
            APIDebugLogger.logResponse(
                request: urlRequest,
                status: http.statusCode,
                data: data,
                started: requestStarted,
                note: "请求失败"
            )
            #endif
            if http.statusCode == 409,
               method == "POST",
               path == "/ideas" || path.hasSuffix("/ideas"),
               let conflict = try? JSONDecoder.api.decode(CreateIdeaConflictResponse.self, from: data) {
                throw APIError.similarIdeas(
                    message: conflict.error,
                    matches: conflict.similarIdeas ?? []
                )
            }
            if let apiError = try? JSONDecoder.api.decode(APIErrorResponse.self, from: data) {
                throw APIError.server(apiError.error)
            }
            throw APIError.server("请求失败 (\(http.statusCode))")
        }

        #if DEBUG
        APIDebugLogger.logResponse(
            request: urlRequest,
            status: http.statusCode,
            data: data,
            started: requestStarted
        )
        #endif

        do {
            return try JSONDecoder.api.decode(T.self, from: data)
        } catch {
            #if DEBUG
            APIDebugLogger.logDecodingError(error, request: urlRequest, data: data)
            #endif
            throw APIError.decoding(error)
        }
    }
}

#if DEBUG
private enum APIDebugLogger {
    private static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.wanye.deimos",
        category: "API"
    )

    private static let sensitiveKeys: Set<String> = [
        "password",
        "oldPassword",
        "newPassword",
        "identity_token",
        "token",
        "code",
        "pending_token",
        "pendingToken",
    ]

    private static let maxBodyCharacters = 4_096

    static func logRequest(_ request: URLRequest, bodyOverride: String? = nil) {
        let method = request.httpMethod ?? "GET"
        let url = request.url?.absoluteString ?? "<unknown>"
        logger.debug("→ \(method, privacy: .public) \(url, privacy: .public)")

        if let headers = request.allHTTPHeaderFields, !headers.isEmpty {
            let formatted = headers
                .sorted { $0.key.lowercased() < $1.key.lowercased() }
                .map { key, value in
                    let safeValue = key.lowercased() == "authorization"
                        ? redactBearer(value)
                        : value
                    return "\(key): \(safeValue)"
                }
                .joined(separator: ", ")
            logger.debug("  headers: \(formatted, privacy: .public)")
        }

        if let bodyOverride {
            logger.debug("  body: \(bodyOverride, privacy: .public)")
        } else if let body = request.httpBody {
            logger.debug("  body: \(formatBody(body), privacy: .public)")
        }
    }

    static func logResponse(
        request: URLRequest,
        status: Int,
        data: Data,
        started: Date,
        note: String? = nil
    ) {
        let elapsedMs = durationMs(since: started)
        let url = request.url?.absoluteString ?? "<unknown>"
        let statusLabel = status >= 0 ? "\(status)" : "—"
        if let note {
            logger.debug("← \(statusLabel, privacy: .public) \(url, privacy: .public) (\(elapsedMs, privacy: .public)ms) \(note, privacy: .public)")
        } else {
            logger.debug("← \(statusLabel, privacy: .public) \(url, privacy: .public) (\(elapsedMs, privacy: .public)ms)")
        }
        if !data.isEmpty {
            logger.debug("  body: \(formatBody(data), privacy: .public)")
        }
    }

    static func logTransportError(
        _ error: Error,
        request: URLRequest,
        started: Date
    ) {
        let elapsedMs = durationMs(since: started)
        let url = request.url?.absoluteString ?? "<unknown>"
        logger.error("✗ \(url, privacy: .public) (\(elapsedMs, privacy: .public)ms) transport: \(error.localizedDescription, privacy: .public)")
    }

    static func logDecodingError(_ error: Error, request: URLRequest, data: Data) {
        let url = request.url?.absoluteString ?? "<unknown>"
        logger.error("✗ \(url, privacy: .public) decode: \(error.localizedDescription, privacy: .public)")
        if !data.isEmpty {
            logger.error("  raw: \(formatBody(data), privacy: .public)")
        }
    }

    private static func durationMs(since started: Date) -> String {
        String(format: "%.0f", Date().timeIntervalSince(started) * 1_000)
    }

    private static func redactBearer(_ value: String) -> String {
        value.hasPrefix("Bearer ") ? "Bearer [redacted]" : "[redacted]"
    }

    private static func formatBody(_ data: Data) -> String {
        guard !data.isEmpty else { return "(empty)" }

        if let json = try? JSONSerialization.jsonObject(with: data),
           let redacted = redactJSON(json),
           let pretty = try? JSONSerialization.data(
               withJSONObject: redacted,
               options: [.sortedKeys, .prettyPrinted]
           ),
           let text = String(data: pretty, encoding: .utf8) {
            return truncate(text)
        }

        if let text = String(data: data, encoding: .utf8) {
            return truncate(text)
        }

        return "\(data.count) bytes"
    }

    private static func redactJSON(_ value: Any) -> Any? {
        switch value {
        case let dict as [String: Any]:
            var redacted: [String: Any] = [:]
            for (key, nested) in dict {
                if sensitiveKeys.contains(key) {
                    redacted[key] = "[redacted]"
                } else if let nestedRedacted = redactJSON(nested) {
                    redacted[key] = nestedRedacted
                }
            }
            return redacted
        case let array as [Any]:
            return array.compactMap { redactJSON($0) }
        default:
            return value
        }
    }

    private static func truncate(_ text: String) -> String {
        guard text.count > maxBodyCharacters else { return text }
        let end = text.index(text.startIndex, offsetBy: maxBodyCharacters)
        return String(text[..<end]) + "…(\(text.count) chars)"
    }
}
#endif
