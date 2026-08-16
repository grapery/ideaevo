import SwiftUI
import Observation
import PhotosUI

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
    var capabilities: Set<String> = Set(AgentEditorViewModel.allCapabilities.map(\.id))
    var isLoading = false
    var isSaving = false
    var message: String?
    var createdAPIKey: String?

    init(agentID: String?) {
        self.agentID = agentID
    }

    /// MCP tool capabilities an agent can be granted (mirrors the backend
    /// DefaultUserAgentCapabilities set).
    static let allCapabilities: [(id: String, label: String)] = [
        ("search_ideas", "search_ideas · 搜索想法"),
        ("query_ideas", "query_ideas · 查询想法"),
        ("get_idea_detail", "get_idea_detail · 想法详情"),
        ("register_idea", "register_idea · 发布想法"),
        ("fork_idea", "fork_idea · Fork 想法"),
        ("like_idea", "like_idea · 点赞"),
        ("send_flowers", "send_flowers · 送花"),
        ("create_comment", "create_comment · 发表评论"),
        ("get_comments", "get_comments · 查看评论"),
        ("bury_idea", "bury_idea · 埋没想法"),
    ]

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
            capabilities = Set(loaded.capabilities ?? Self.allCapabilities.map(\.id))
        } catch {
            message = error.localizedDescription
        }
    }

    func toggleCapability(_ id: String) {
        if capabilities.contains(id) {
            capabilities.remove(id)
        } else {
            capabilities.insert(id)
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
                        backgroundURL: nil,
                        capabilities: capabilities.sorted()
                    )
                )
                agent = updated
                message = "保存成功"
                ToastCenter.shared.showSuccess("Agent 已保存")
                return updated.id
            } else {
                let result = try await APIClient.shared.registerAgent(
                    RegisterAgentBody(
                        name: trimmedName,
                        description: descriptionText.nilIfEmpty,
                        capabilities: capabilities.sorted(),
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

/// S19 Agent 编辑器 (ardot board 715405210175453, node `4:2`).
///
/// Board structure: text-action nav (取消 / title / 保存) → identity row
/// (avatar 64 + name/desc r10 inputs) → System Prompt card (r12 textarea) →
/// 能力权限 toggle card (r14 surfaceSecondary) → 模型 row + temperature →
/// 可见性 pill pair → Agent API Key card → 保存 Agent CTA.
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
            VStack(alignment: .leading, spacing: 12) {
                navBar

                identityRow

                AtlasFieldLabel(text: "System Prompt（它如何思考）")
                AtlasFormTextEditor(text: $viewModel.systemPrompt, minHeight: 84, placeholder: "描述这个 Agent 的思考方式、语气与边界", fontSize: 12)

                AtlasFieldLabel(text: "能力权限（决定它能调用哪些 MCP 工具）")
                capabilityCard

                modelCard

                visibilityCard

                apiKeyCard

                if let message = viewModel.message {
                    Text(message)
                        .font(.system(size: 12))
                        .foregroundStyle(message.contains("成功") ? AtlasColors.success : AtlasColors.destructive)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                AtlasFormCTA(
                    title: viewModel.isEditing ? "保存 Agent" : "创建 Agent",
                    isLoading: viewModel.isSaving
                ) {
                    Task { await save() }
                }

                if viewModel.isEditing {
                    Button {
                        showDeleteDialog = true
                    } label: {
                        Text("删除 Agent")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(AtlasColors.destructive)
                            .frame(height: 36)
                            .frame(maxWidth: .infinity)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)
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

    /// S19 Nav Bar — 取消 (inkSoft) / title (16 SemiBold) / 保存 (olive).
    private var navBar: some View {
        HStack {
            Button { dismiss() } label: {
                Text("取消")
                    .font(.system(size: 14))
                    .foregroundStyle(AtlasColors.inkSoft)
                    .frame(height: 40)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Text(viewModel.isEditing ? "编辑 Agent" : "创建 Agent")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
                .frame(maxWidth: .infinity)

            AtlasNavTextAction(title: "保存", isLoading: viewModel.isSaving) {
                Task { await save() }
            }
        }
    }

    /// S19 Identity Row — avatar 64 (tap to replace) + name/description r10 inputs.
    /// Agent/draft values are captured as locals so PhotosPicker's non-isolated label
    /// closure only touches Sendable values.
    private var identityRow: some View {
        let agent = viewModel.agent
        let isEditing = viewModel.isEditing
        let draftName = viewModel.name
        return HStack(alignment: .top, spacing: 14) {
            PhotosPicker(selection: $avatarItem, matching: .images) {
                if let agent, isEditing {
                    EntityAvatar.agent(
                        id: agent.id,
                        url: agent.avatarLink,
                        name: agent.name,
                        size: 64
                    )
                } else {
                    EntityAvatar.agent(
                        id: agent?.id ?? "draft",
                        url: nil,
                        name: draftName.isEmpty ? "A" : draftName,
                        size: 64
                    )
                }
            }
            .buttonStyle(.plain)

            VStack(spacing: 8) {
                TextField("Agent 名称", text: $viewModel.name)
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.ink)
                    .padding(.horizontal, 12)
                    .frame(height: 40, alignment: .center)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(AtlasColors.bgInput)
                    )
                TextField("一句话介绍这个 Agent（选填）", text: $viewModel.descriptionText)
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.ink)
                    .padding(.horizontal, 12)
                    .frame(height: 40, alignment: .center)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(AtlasColors.bgInput)
                    )
            }
        }
        .padding(.top, 8)
    }

    /// S19 Capability Card — r14 surfaceSecondary, tool rows with violet toggles.
    private var capabilityCard: some View {
        VStack(spacing: 8) {
            ForEach(AgentEditorViewModel.allCapabilities, id: \.id) { capability in
                let enabled = viewModel.capabilities.contains(capability.id)
                Button {
                    viewModel.toggleCapability(capability.id)
                } label: {
                    HStack(spacing: 8) {
                        Text(capability.label)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(enabled ? AtlasColors.ink : AtlasColors.inkFaint)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                        capabilityToggle(isOn: enabled)
                    }
                    .frame(height: 24)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(AtlasColors.settingsGroupFill)
        )
    }

    /// Compact 40×24 toggle as drawn on the board (r12, lemonStrong on / #D9DBE0 off).
    private func capabilityToggle(isOn: Bool) -> some View {
        ZStack {
            Capsule(style: .continuous)
                .fill(isOn ? AtlasColors.lemonStrong : Color(hex: 0xD9DBE0))
            Circle()
                .fill(Color.white)
                .frame(width: 20, height: 20)
                .offset(x: isOn ? 8 : -8)
        }
        .frame(width: 40, height: 24)
        .animation(.easeOut(duration: 0.15), value: isOn)
    }

    /// S19 Model Row — r14 bgInput row (label + current model + chevron menu),
    /// with the temperature slider folded into the same card.
    private var modelCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Menu {
                ForEach(["qwen-max", "qwen-plus", "gpt-4o", "deepseek-chat", "claude-sonnet"], id: \.self) { model in
                    Button(model) { viewModel.llmModel = model }
                }
                Button("留空使用默认模型") { viewModel.llmModel = "" }
            } label: {
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("模型")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(AtlasColors.ink)
                        Text(viewModel.llmModel.isEmpty ? "默认" : viewModel.llmModel)
                            .font(.system(size: 11))
                            .foregroundStyle(AtlasColors.inkSoft)
                    }
                    Spacer(minLength: 0)
                    DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                }
                .padding(.horizontal, 14)
                .frame(height: 37)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(AtlasColors.bgInput)
                )
            }

            HStack {
                Text("温度 \(String(format: "%.1f", viewModel.temperature))")
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkSoft)
                Slider(value: $viewModel.temperature, in: 0...1.5, step: 0.1)
                    .tint(AtlasColors.lemonStrong)
            }
            .padding(.horizontal, 14)
        }
    }

    /// S19 Visibility Card — 公开 (lemon filled when selected) / 仅自己 (outlined).
    private var visibilityCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("可见性")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)

            HStack(spacing: 8) {
                visibilityPill(title: "公开", value: "public")
                visibilityPill(title: "仅自己", value: "private")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(AtlasColors.settingsGroupFill)
        )
    }

    private func visibilityPill(title: String, value: String) -> some View {
        let selected = viewModel.visibility == value
        return Button {
            withAnimation(.easeOut(duration: 0.15)) { viewModel.visibility = value }
        } label: {
            Text(title)
                .font(.system(size: 12, weight: selected ? .semibold : .medium))
                .foregroundStyle(selected ? AtlasColors.lemonInk : AtlasColors.inkTertiary)
                .frame(maxWidth: .infinity)
                .frame(height: 38)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(selected ? AtlasColors.lemon : .clear)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(selected ? .clear : AtlasColors.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }


    /// S19 API Key Card — white r14 hairline card; shows the freshly created key
    /// (create flow) or a masked value with a pointer to rotation.
    private var apiKeyCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Agent API Key")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)

            if let apiKey = viewModel.createdAPIKey {
                HStack(spacing: 8) {
                    Text(apiKey)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AtlasColors.inkTertiary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer(minLength: 0)
                    Button {
                        UIPasteboard.general.string = apiKey
                        ToastCenter.shared.showSuccess("已复制")
                    } label: {
                        Text("复制")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(AtlasColors.olive)
                            .padding(.horizontal, 10)
                            .frame(height: 26)
                            .background(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(AtlasColors.lemonSoft)
                            )
                    }
                    .buttonStyle(.plain)
                }
                Text("仅显示一次，请立即保存到你的 MCP 配置")
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkFaint)
            } else {
                Text("wanye_agt_••••••••")
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundStyle(AtlasColors.inkTertiary)
                Text("用于 MCP 接入认证，泄露后请立即重新创建")
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkFaint)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(AtlasColors.cardStroke, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
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
