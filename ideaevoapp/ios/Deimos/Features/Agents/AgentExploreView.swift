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
            let resp = try await APIClient.shared.listAgents(offset: 0)
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
                .font(.system(size: 17, weight: .semibold))
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
                    .font(.system(size: 12, weight: viewModel.filter == filter ? .semibold : .regular))
                    .foregroundStyle(viewModel.filter == filter ? .white : AtlasColors.inkSoft)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(viewModel.filter == filter ? AtlasColors.primary : AtlasColors.surface)
                    .clipShape(Capsule())
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
        }
        .padding(.top, 12)
        .padding(.bottom, 4)
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
        .background(AtlasColors.entityAgent.opacity(0.45))
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
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
                            .font(.system(size: 15, weight: .bold))
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
        .atlasElevatedCard()
    }

    private func agentActionRow(_ agent: Agent) -> some View {
        let following = viewModel.followStatus[agent.id] == true
        return HStack(spacing: 8) {
            Button {
                Task { await toggleFollow(agent.id) }
            } label: {
                Text(following ? "已关注" : "关注")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(following ? AtlasColors.accentActive : .white)
                    .frame(maxWidth: .infinity)
                    .frame(height: AtlasMetrics.primaryButtonHeight)
                    .background(following ? AtlasColors.accentActiveSoft : AtlasColors.primary)
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
            }
            .buttonStyle(.plain)

            Button {
                Task { await openChat(agent) }
            } label: {
                Text("对话")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                    .frame(maxWidth: .infinity)
                    .frame(height: AtlasMetrics.primaryButtonHeight)
                    .background(AtlasColors.surface)
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
            VStack(alignment: .leading, spacing: 16) {
                settingsBackHeader(title: viewModel.isEditing ? "编辑 Agent" : "新建 Agent", dismiss: dismiss)

                if viewModel.isEditing, let agent = viewModel.agent {
                    ProfileBanner(
                        backgroundURL: agent.backgroundURL,
                        avatarURL: agent.avatarURL,
                        avatarEntityID: agent.id,
                        avatarKind: .agent,
                        avatarSize: 64
                    )
                    .padding(.horizontal, -AtlasMetrics.pageX)

                    HStack(spacing: 12) {
                        PhotosPicker(selection: $avatarItem, matching: .images) {
                            Text("更换头像").font(.system(size: 14, weight: .medium)).foregroundStyle(AtlasColors.ink)
                        }
                        PhotosPicker(selection: $backgroundItem, matching: .images) {
                            Text("更换背景").font(.system(size: 14, weight: .medium)).foregroundStyle(AtlasColors.ink)
                        }
                        Button("恢复默认头像") {
                            Task { await viewModel.resetAvatar() }
                        }
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(AtlasColors.inkFaint)
                    }
                } else {
                    newAgentHero
                }

                editorField("名称", text: $viewModel.name)
                editorMultiline("描述", text: $viewModel.descriptionText, minHeight: 80)
                editorMultiline("系统提示词", text: $viewModel.systemPrompt, minHeight: 120)
                editorField("模型（留空用默认）", text: $viewModel.llmModel)

                VStack(alignment: .leading, spacing: 8) {
                    Text("温度 \(String(format: "%.1f", viewModel.temperature))")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkFaint)
                    Slider(value: $viewModel.temperature, in: 0...1.5, step: 0.1)
                        .tint(AtlasColors.ink)
                }

                settingsGroupedCard {
                    Picker("可见性", selection: $viewModel.visibility) {
                        Text("公开").tag("public")
                        Text("私有").tag("private")
                    }
                    .pickerStyle(.menu)
                    .padding(.horizontal, 16)
                    .frame(height: 52)
                    Divider().overlay(AtlasColors.rule)
                    Toggle("允许关注", isOn: $viewModel.allowFollow)
                        .padding(.horizontal, 16)
                        .frame(height: 52)
                        .tint(AtlasColors.accentActive)
                    Divider().overlay(AtlasColors.rule)
                    Toggle("允许对话", isOn: $viewModel.allowChat)
                        .padding(.horizontal, 16)
                        .frame(height: 52)
                        .tint(AtlasColors.accentActive)
                }

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
                        .foregroundStyle(message.contains("成功") ? AtlasColors.accentActive : AtlasColors.coral)
                }

                AtlasPrimaryButton(title: "保存", isLoading: viewModel.isSaving) {
                    Task { await save() }
                }

                if viewModel.isEditing {
                    Button("删除 Agent") { showDeleteDialog = true }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.coral)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .overlay(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous).stroke(AtlasColors.coral))
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
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

    private var newAgentHero: some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous)
                .fill(AtlasColors.entityAgent)
                .frame(width: 56, height: 56)
                .overlay {
                    DeimosIconView(icon: .users, size: 24, color: AtlasColors.ink.opacity(0.6))
                }
            VStack(alignment: .leading, spacing: 4) {
                Text("创建 Agent")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                Text("配置名称、提示词与权限，创建后可获取 API Key")
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.inkSoft)
            }
            Spacer(minLength: 0)
        }
        .padding(AtlasMetrics.cardPadding)
        .background(AtlasColors.entityAgent.opacity(0.35))
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }

    private func editorField(_ placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(placeholder)
                .font(AtlasTypography.overline())
                .foregroundStyle(AtlasColors.inkFaint)
            AtlasTextField(placeholder: placeholder, text: text, height: AtlasMetrics.inputHeight)
                .padding(.horizontal, 4)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
        }
    }

    private func editorMultiline(_ placeholder: String, text: Binding<String>, minHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(placeholder)
                .font(AtlasTypography.overline())
                .foregroundStyle(AtlasColors.inkFaint)
            AtlasTextEditor(text: text, minHeight: minHeight)
                .padding(8)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
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
