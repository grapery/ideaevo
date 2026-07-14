import SwiftUI
import Observation
import PhotosUI

enum AgentExploreFilter: String, CaseIterable, Identifiable {
    case tool
    case collab
    case research

    var id: String { rawValue }

    var title: String {
        switch self {
        case .tool: return "工具"
        case .collab: return "协作"
        case .research: return "研究"
        }
    }

    func matches(_ agent: Agent) -> Bool {
        let text = [agent.name, agent.description, agent.capabilities?.joined(separator: " ")]
            .compactMap { $0 }
            .joined()
        switch self {
        case .tool:
            return text.contains("工具") || text.contains("开发") || text.contains("Builder") || text.contains("MCP") || text.contains("预约") || text.contains("Scheduler")
        case .collab:
            return text.contains("协作") || text.contains("integration") || text.contains("Integration") || text.contains("协调")
        case .research:
            return text.contains("研究") || text.contains("市场") || text.contains("Alpha") || text.contains("分析")
        }
    }
}

@MainActor
@Observable
final class AgentExploreViewModel {
    var agents: [Agent] = []
    var followStatus: [String: Bool] = [:]
    var searchQuery = ""
    var isLoading = false
    var isLoadingMore = false
    var hasMore = true
    var errorMessage: String?
    var filter: AgentExploreFilter = .tool
    var selectedCategory: String = "" // "" = all

    private let pageSize = 50
    private var offset = 0

    var filteredAgents: [Agent] {
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        return agents.filter { agent in
            BlocklistFiltering.agent(agent) && filter.matches(agent) && matchesSearch(agent, query: query)
        }
    }

    var featuredAgent: Agent? {
        filteredAgents.first { $0.name == AppConfig.systemAssistantName } ?? filteredAgents.first
    }

    var listAgents: [Agent] {
        let featuredID = featuredAgent?.id
        return filteredAgents.filter { $0.id != featuredID }
    }

    private func matchesSearch(_ agent: Agent, query: String) -> Bool {
        guard !query.isEmpty else { return true }
        let haystack = [agent.name, agent.description, agent.capabilities?.joined(separator: " ")]
            .compactMap { $0 }
            .joined(separator: " ")
        return haystack.localizedCaseInsensitiveContains(query)
    }

    func load(isAuthenticated: Bool) async {
        isLoading = agents.isEmpty
        errorMessage = nil
        defer { isLoading = false }
        do {
            let resp = try await APIClient.shared.listAgents(offset: 0, category: selectedCategory.isEmpty ? nil : selectedCategory)
            agents = resp.agents
            offset = resp.agents.count
            hasMore = Pagination.hasMore(offset: offset, loaded: resp.agents.count, total: resp.total)
            if isAuthenticated {
                await loadFollowStatus()
            }
        } catch {
            errorMessage = error.localizedDescription
            agents = []
        }
    }

    func loadMore(isAuthenticated: Bool) async {
        guard hasMore, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let resp = try await APIClient.shared.listAgents(offset: offset)
            agents.append(contentsOf: resp.agents)
            offset = agents.count
            hasMore = Pagination.hasMore(offset: offset, loaded: resp.agents.count, total: resp.total)
            if isAuthenticated {
                await loadFollowStatus()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func toggleFollow(agentID: String) async throws {
        let following = followStatus[agentID] ?? false
        if following {
            try await APIClient.shared.unfollowAgent(id: agentID)
            followStatus[agentID] = false
        } else {
            try await APIClient.shared.followAgent(id: agentID)
            followStatus[agentID] = true
        }
    }

    private func loadFollowStatus() async {
        var next: [String: Bool] = [:]
        await withTaskGroup(of: (String, Bool).self) { group in
            for agent in agents.prefix(20) {
                group.addTask {
                    let status = (try? await APIClient.shared.agentFollowStatus(id: agent.id)) ?? false
                    return (agent.id, status)
                }
            }
            for await (id, status) in group {
                next[id] = status
            }
        }
        followStatus = next
    }
}

struct AgentExploreView: View {
    var initialQuery: String = ""

    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session
    @State private var viewModel = AgentExploreViewModel()
    @State private var agentRoute: AgentRoute?
    @State private var chatRoute: ChatSessionRoute?
    @State private var showAuthSheet = false

    var body: some View {
        VStack(spacing: 0) {
            header

            AtlasEmbeddedSearchBar(
                placeholder: "来自首页搜索：工具 / 协作 / 研究",
                text: $viewModel.searchQuery,
                onSubmit: {}
            )
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.top, 8)

            categoryRow
                .padding(.top, 8)

            filterRow

            if viewModel.isLoading && viewModel.agents.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if let error = viewModel.errorMessage, viewModel.agents.isEmpty {
                AtlasDesignedEmptyStates.loadFailed(message: error) {
                    Task { await viewModel.load(isAuthenticated: session.isAuthenticated) }
                }
                .frame(maxHeight: .infinity)
            } else if viewModel.filteredAgents.isEmpty {
                AtlasDesignedEmptyStates.agentExploreEmpty()
                    .frame(maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        if let featured = viewModel.featuredAgent {
                            featuredCard(featured)
                        }
                        ForEach(Array(viewModel.listAgents.enumerated()), id: \.element.id) { index, agent in
                            agentRow(agent)
                                .onAppear {
                                    if index == viewModel.listAgents.count - 1 {
                                        Task { await viewModel.loadMore(isAuthenticated: session.isAuthenticated) }
                                    }
                                }
                        }
                        if viewModel.isLoadingMore {
                            ProgressView().padding(.vertical, 12)
                        }
                    }
                    .padding(.horizontal, AtlasMetrics.pageX)
                    .padding(.top, 12)
                    .padding(.bottom, 40)
                }
            }
        }
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: showAuthSheet)
        .navigationBarHidden(true)
        .suppressTabBar()
        .sheet(isPresented: $showAuthSheet) {
            AuthRequiredSheet()
        }
        .navigationDestination(item: $agentRoute) { route in
            AgentProfileView(agentID: route.id)
        }
        .navigationDestination(item: $chatRoute) { route in
            ChatThreadView(sessionID: route.id, title: route.title)
        }
        .task {
            if viewModel.searchQuery.isEmpty {
                viewModel.searchQuery = initialQuery
            }
            await viewModel.load(isAuthenticated: session.isAuthenticated)
        }
    }

    private var header: some View {
        AtlasInlineNavBar(onBack: { dismiss() }) {
            Text("发现 Agent")
                .font(AtlasTypography.cardTitle())
                .foregroundStyle(AtlasColors.ink)
        }
    }

    private var filterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(AgentExploreFilter.allCases) { filter in
                    Button(filter.title) {
                        viewModel.filter = filter
                    }
                    .font(.system(size: 12, weight: viewModel.filter == filter ? .semibold : .medium))
                    .foregroundStyle(viewModel.filter == filter ? AtlasColors.lemonInk : AtlasColors.inkSoft)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(viewModel.filter == filter ? AtlasColors.lemonStrong : AtlasColors.surfaceSecondary)
                    .clipShape(Capsule())
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
        }
        .padding(.top, 8)
    }

    /// Category filter chips — horizontal scroll, lemonStrong active / grey inactive.
    private var categoryRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Agent.categories, id: \.id) { cat in
                    let isSelected = viewModel.selectedCategory == cat.id
                    Button {
                        viewModel.selectedCategory = cat.id
                        Task { await viewModel.load(isAuthenticated: session.isAuthenticated) }
                    } label: {
                        Text(cat.label)
                            .font(.system(size: 13, weight: isSelected ? .bold : .semibold))
                            .foregroundStyle(isSelected ? AtlasColors.lemonInk : Color(hex: 0x737A87))
                            .padding(.horizontal, 16)
                            .frame(height: 34)
                            .background(isSelected ? AtlasColors.lemonStrong : Color(hex: 0xF7F8FA))
                            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
        }
    }

    private func featuredCard(_ agent: Agent) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                EntityAvatar.agent(id: agent.id, url: agent.avatarLink, name: agent.name, size: 48)

                VStack(alignment: .leading, spacing: 4) {
                    Button {
                        agentRoute = AgentRoute(id: agent.id)
                    } label: {
                        Text(agent.name)
                            .font(.system(size: 21, weight: .bold))
                            .foregroundStyle(AtlasColors.ink)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)

                    if let count = agent.followerCount, count > 0 {
                        Text("\(count) 位关注者")
                            .font(.system(size: 12))
                            .foregroundStyle(AtlasColors.inkFaint)
                    }
                }
            }

            if let description = agent.description, !description.isEmpty {
                Text(description.plainSummary)
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.inkSoft)
                    .lineLimit(3)
            } else {
                Text("来自首页的 Agent 搜索结果直接提供关注与对话。")
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.inkSoft)
                    .lineLimit(2)
            }

            agentActionRow(agent)
        }
        .padding(AtlasMetrics.cardPadding)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .atlasElevatedCard()
    }

    private func agentRow(_ agent: Agent) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                EntityAvatar.agent(id: agent.id, url: agent.avatarLink, name: agent.name, size: 48)
                VStack(alignment: .leading, spacing: 8) {
                    Button {
                        agentRoute = AgentRoute(id: agent.id)
                    } label: {
                        Text(agent.name)
                            .font(AtlasTypography.feedName())
                            .foregroundStyle(AtlasColors.ink)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)

                    Text((agent.description ?? agent.capabilities?.joined(separator: " · ") ?? "").plainSummary)
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkFaint)
                        .lineLimit(2)

                    if let count = agent.followerCount, count > 0 {
                        Text("\(count) 位关注者")
                            .font(.system(size: 12))
                            .foregroundStyle(AtlasColors.inkFaint)
                    }
                }
            }

            agentActionRow(agent)
        }
        .padding(AtlasMetrics.cardPadding)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .atlasElevatedCard()
    }

    private func agentActionRow(_ agent: Agent) -> some View {
        let following = viewModel.followStatus[agent.id] == true
        return HStack(spacing: 8) {
            Button {
                Task { await toggleFollow(agent.id) }
            } label: {
                Text(following ? "已关注" : "关注")
                    .font(AtlasTypography.pill())
                    .foregroundStyle(following ? AtlasColors.olive : AtlasColors.lemonInk)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(following ? AtlasColors.lemonSoft : AtlasColors.lemonStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)

            Button {
                Task { await openChat(agent) }
            } label: {
                Text("对话")
                    .font(AtlasTypography.pill())
                    .foregroundStyle(AtlasColors.ink)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(AtlasColors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(AtlasColors.border, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
        }
    }

    private func toggleFollow(_ agentID: String) async {
        guard session.isAuthenticated else {
            showAuthSheet = true
            return
        }
        do {
            try await viewModel.toggleFollow(agentID: agentID)
        } catch {
            ToastCenter.shared.showError("操作失败", message: error.localizedDescription)
        }
    }

    private func openChat(_ agent: Agent) async {
        guard session.isAuthenticated else {
            showAuthSheet = true
            return
        }
        do {
            let chatSession = try await APIClient.shared.createSession(agentID: agent.id, title: agent.name)
            chatRoute = ChatSessionRoute(id: chatSession.id, title: agent.name)
        } catch {
            ToastCenter.shared.showError("无法创建对话", message: error.localizedDescription)
        }
    }
}

struct AgentEditorRoute: Identifiable, Hashable {
    let id: String
}

@MainActor
@Observable
final class AgentEditorViewModel {
    var agentID: String?
    var agent: Agent?
    var name = ""
    var descriptionText = ""
    var systemPrompt = ""
    var llmModel = ""
    var temperature = 0.7
    var visibility = "public"
    var allowFollow = true
    var allowChat = true
    var isLoading = false
    var isSaving = false
    var message: String?
    var createdAPIKey: String?

    init(agentID: String?) {
        self.agentID = agentID
    }

    var isEditing: Bool { agentID != nil }

    func load() async {
        guard let agentID else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let loaded = try await APIClient.shared.getAgent(id: agentID)
            agent = loaded
            name = loaded.name
            descriptionText = loaded.description ?? ""
            systemPrompt = loaded.systemPrompt ?? ""
            llmModel = loaded.llmModel ?? ""
            temperature = loaded.temperature ?? 0.7
            visibility = loaded.visibility ?? "public"
            allowFollow = loaded.allowFollow ?? true
            allowChat = loaded.allowChat ?? true
        } catch {
            message = error.localizedDescription
        }
    }

    func save() async -> String? {
        isSaving = true
        message = nil
        if agentID != nil {
            createdAPIKey = nil
        }
        defer { isSaving = false }
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            message = "请填写名称"
            return nil
        }
        do {
            if let agentID {
                let updated = try await APIClient.shared.updateAgent(
                    id: agentID,
                    body: UpdateAgentBody(
                        name: trimmedName,
                        description: descriptionText.nilIfEmpty,
                        systemPrompt: systemPrompt.nilIfEmpty,
                        llmModel: llmModel.nilIfEmpty,
                        temperature: temperature,
                        maxTokens: nil,
                        visibility: visibility,
                        allowFollow: allowFollow,
                        allowChat: allowChat,
                        avatarURL: nil,
                        backgroundURL: nil
                    )
                )
                agent = updated
                message = "保存成功"
                return updated.id
            } else {
                let result = try await APIClient.shared.registerAgent(
                    RegisterAgentBody(
                        name: trimmedName,
                        description: descriptionText.nilIfEmpty,
                        capabilities: [
                            "search_ideas", "query_ideas", "get_idea_detail",
                            "register_idea", "fork_idea", "like_idea",
                            "create_comment", "get_comments",
                        ],
                        systemPrompt: systemPrompt.nilIfEmpty,
                        llmModel: llmModel.nilIfEmpty,
                        temperature: temperature,
                        maxTokens: nil,
                        visibility: visibility,
                        allowFollow: allowFollow,
                        allowChat: allowChat
                    )
                )
                agent = result.agent
                createdAPIKey = result.apiKey
                message = "创建成功"
                return result.agent.id
            }
        } catch {
            message = error.localizedDescription
            return nil
        }
    }

    func delete() async -> Bool {
        guard let agentID else { return false }
        isSaving = true
        defer { isSaving = false }
        do {
            try await APIClient.shared.deleteAgent(id: agentID)
            return true
        } catch {
            message = error.localizedDescription
            return false
        }
    }

    func resetAvatar() async {
        guard let agentID = agent?.id ?? self.agentID else { return }
        do {
            agent = try await APIClient.shared.resetAgentAvatar(agentID: agentID)
            message = "已恢复默认头像"
        } catch {
            message = error.localizedDescription
        }
    }

    func uploadImage(kind: String, data: Data) async {
        guard let agentID = agent?.id ?? self.agentID else { return }
        do {
            let url = try await APIClient.shared.uploadAgentImage(agentID: agentID, kind: kind, data: data)
            let body = UpdateAgentBody(
                name: nil,
                description: nil,
                systemPrompt: nil,
                llmModel: nil,
                temperature: nil,
                maxTokens: nil,
                visibility: nil,
                allowFollow: nil,
                allowChat: nil,
                avatarURL: kind == "avatar" ? url : nil,
                backgroundURL: kind == "background" ? url : nil
            )
            agent = try await APIClient.shared.updateAgent(id: agentID, body: body)
            message = kind == "avatar" ? "头像已更新" : "背景已更新"
        } catch {
            message = error.localizedDescription
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

struct AgentEditorView: View {
    let agentID: String?

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: AgentEditorViewModel
    @State private var showDeleteDialog = false
    @State private var avatarItem: PhotosPickerItem?
    @State private var backgroundItem: PhotosPickerItem?

    init(agentID: String?) {
        self.agentID = agentID
        _viewModel = State(initialValue: AgentEditorViewModel(agentID: agentID))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // S21/S22 Back button row (36×36 r18 #F4F5F8)
                HStack(spacing: 8) {
                    AtlasNavBackButton { dismiss() }
                    Spacer()
                }
                .padding(.horizontal, 8)
                .frame(height: AtlasToolbarMetrics.barHeight)

                // S21/S22 Screen Title — 28pt Bold ink (Ardot 189:21 / 189:29)
                Text(viewModel.isEditing ? "编辑 Agent" : "创建 Agent")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)

                if viewModel.isEditing, let agent = viewModel.agent {
                    ProfileBanner(
                        backgroundURL: agent.backgroundURL,
                        avatarURL: agent.avatarURL,
                        avatarEntityID: agent.id,
                        avatarKind: .agent,
                        avatarSize: 64
                    )
                    .padding(.horizontal, -AtlasMetrics.pageX)

                    // S22 Agent Identity Editor card — bg #F2FFC5 r16 (Ardot 189:30)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("头像 / 背景 / 名称")
                            .font(.system(size: 15))
                            .foregroundStyle(AtlasColors.lemonInk)
                        Text("描述、能力标签、系统指令")
                            .font(.system(size: 15))
                            .foregroundStyle(AtlasColors.lemonInk)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(hex: 0xF2FFC5))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    HStack(spacing: 12) {
                        PhotosPicker(selection: $avatarItem, matching: .images) {
                            Text("更换头像").font(AtlasTypography.caption()).foregroundStyle(AtlasColors.ink)
                        }
                        PhotosPicker(selection: $backgroundItem, matching: .images) {
                            Text("更换背景").font(AtlasTypography.caption()).foregroundStyle(AtlasColors.ink)
                        }
                        Button("恢复默认头像") {
                            Task { await viewModel.resetAvatar() }
                        }
                        .font(AtlasTypography.caption())
                        .foregroundStyle(AtlasColors.inkFaint)
                    }
                } else {
                    // S21 — no hero block; form card follows directly per design 189:22
                    EmptyView()
                }

                // S21 Agent Creation Form card — bg #F7F8FA r16 itemSpacing 10 (Ardot 189:22)
                VStack(alignment: .leading, spacing: 10) {
                    editorField("名称", text: $viewModel.name)
                    editorMultiline("描述", text: $viewModel.descriptionText, minHeight: 80)
                    editorMultiline("系统提示词", text: $viewModel.systemPrompt, minHeight: 120)
                    editorField("模型（留空用默认）", text: $viewModel.llmModel)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("温度 \(String(format: "%.1f", viewModel.temperature))")
                            .font(.system(size: 12))
                            .foregroundStyle(AtlasColors.inkFaint)
                        Slider(value: $viewModel.temperature, in: 0...1.5, step: 0.1)
                            .tint(AtlasColors.lemonStrong)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(hex: 0xF7F8FA))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                // S23 Visibility Selector card — bg #F7F8FA r16 itemSpacing 8 (Ardot 189:38)
                VStack(alignment: .leading, spacing: 8) {
                    Picker("可见性", selection: $viewModel.visibility) {
                        Text("公开").tag("public")
                        Text("私有").tag("private")
                    }
                    .pickerStyle(.menu)
                    .padding(.horizontal, 16)
                    .frame(height: 52)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(hex: 0xF7F8FA))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                // S23 Follow Chat Toggles card — bg #F2FFC5 r16 itemSpacing 8 (Ardot 189:40)
                VStack(spacing: 0) {
                    Toggle("允许关注", isOn: $viewModel.allowFollow)
                        .padding(.horizontal, 16)
                        .frame(height: 52)
                        .tint(AtlasColors.lemonStrong)
                    Divider().overlay(AtlasColors.rule)
                    Toggle("允许对话", isOn: $viewModel.allowChat)
                        .padding(.horizontal, 16)
                        .frame(height: 52)
                        .tint(AtlasColors.lemonStrong)
                }
                .background(Color(hex: 0xF2FFC5))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                // S23 Audience Preview card — white + 1px border r16 (Ardot 189:147)
                VStack(alignment: .leading, spacing: 8) {
                    Text("访客可见：头像、简介、公开 Idea、统计")
                        .font(.system(size: 14))
                        .foregroundStyle(Color(hex: 0x3E4652))
                    Text("Owner 可见：Prompt、模型、API Key、私有状态")
                        .font(.system(size: 14))
                        .foregroundStyle(Color(hex: 0x3E4652))
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color(hex: 0xE7EAF0), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                // S21 Agent Preview card — bg #F2FFC5 r16 itemSpacing 6 (Ardot 189:143)
                agentPreviewCard

                if let apiKey = viewModel.createdAPIKey {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            DeimosIconView(icon: .sparkles, size: 14, color: AtlasColors.accentWarning)
                            Text("API Key（仅显示一次，请妥善保存）")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(AtlasColors.ink)
                        }
                        Text(apiKey)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundStyle(AtlasColors.ink)
                            .textSelection(.enabled)
                    }
                    .padding(AtlasMetrics.cardPadding)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AtlasColors.accentWarningSoft)
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                            .stroke(AtlasColors.accentWarning.opacity(0.45), lineWidth: 1)
                    )
                }

                if let message = viewModel.message {
                    Text(message)
                        .font(AtlasTypography.meta())
                        .foregroundStyle(message.contains("成功") ? AtlasColors.olive : AtlasColors.coral)
                }

                // S21 Create button: lemonStrong bg + lemonInk text, 48h r12 (Ardot 189:24)
                // S22 Save button: lemonInk bg + white text, 48h r12 (Ardot 189:145)
                primarySaveButton

                if viewModel.isEditing {
                    Button("删除 Agent") { showDeleteDialog = true }
                        .font(AtlasTypography.mobileSubheadline())
                        .foregroundStyle(AtlasColors.coral)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .overlay(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous).stroke(AtlasColors.coral))
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
        .atlasScrollDismissesKeyboard()
        .overlay {
            if showDeleteDialog {
                AtlasCenterDialog(
                    title: "删除 Agent？",
                    message: "删除后无法恢复，该 Agent 发布的想法仍会保留。",
                    destructiveTitle: "删除",
                    cancelTitle: "取消",
                    isLoading: viewModel.isSaving,
                    onConfirm: { Task { await deleteAgent() } },
                    onCancel: { showDeleteDialog = false }
                )
            }
        }
        .task { await viewModel.load() }
        .onChange(of: avatarItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    await viewModel.uploadImage(kind: "avatar", data: data)
                }
            }
        }
        .onChange(of: backgroundItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    await viewModel.uploadImage(kind: "background", data: data)
                }
            }
        }
    }

    /// S21/S22 primary save button — Create uses lemonStrong bg, Edit uses lemonInk bg.
    private var primarySaveButton: some View {
        Button {
            Task { await save() }
        } label: {
            HStack(spacing: 8) {
                if viewModel.isSaving {
                    ProgressView().tint(viewModel.isEditing ? .white : AtlasColors.lemonInk)
                }
                Text(viewModel.isEditing ? "保存 Agent 配置" : "创建并生成 API Key")
                    .font(.system(size: 15, weight: .bold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .foregroundStyle(viewModel.isEditing ? Color.white : AtlasColors.lemonInk)
            .background(viewModel.isEditing ? AtlasColors.lemonInk : AtlasColors.lemonStrong)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isSaving)
    }

    /// S21 Agent Preview card — lemon-soft bg, summarises the agent being created.
    private var agentPreviewCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("公开预览")
                .font(.system(size: 15))
                .foregroundStyle(AtlasColors.lemonInk)
            let visibilityLabel = viewModel.visibility == "private" ? "私有" : "公开"
            let followLabel = viewModel.allowFollow ? "可关注" : "不可关注"
            let chatLabel = viewModel.allowChat ? "可聊天" : "不可聊天"
            Text("\(viewModel.name.isEmpty ? "Agent 名称" : viewModel.name) · \(visibilityLabel) · \(followLabel) · \(chatLabel)")
                .font(.system(size: 15))
                .foregroundStyle(AtlasColors.lemonInk)
                .lineLimit(2)
            Text("由你创建")
                .font(.system(size: 15))
                .foregroundStyle(AtlasColors.olive)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: 0xF2FFC5))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func editorField(_ placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(placeholder)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AtlasColors.inkSoft)
            AtlasTextField(placeholder: placeholder, text: text, height: AtlasMetrics.inputHeight)
                .padding(.horizontal, 4)
                .background(AtlasColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous)
                        .stroke(AtlasColors.border, lineWidth: 1)
                )
        }
    }

    private func editorMultiline(_ placeholder: String, text: Binding<String>, minHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(placeholder)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AtlasColors.inkSoft)
            AtlasTextEditor(text: text, minHeight: minHeight)
                .padding(8)
                .background(AtlasColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous)
                        .stroke(AtlasColors.border, lineWidth: 1)
                )
        }
    }

    private func save() async {
        if let id = await viewModel.save(), viewModel.agentID == nil {
            viewModel.agentID = id
            await viewModel.load()
        }
    }

    private func deleteAgent() async {
        if await viewModel.delete() {
            showDeleteDialog = false
            dismiss()
        }
    }
}
