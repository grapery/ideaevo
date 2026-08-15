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
        Group {
        if viewModel.isEditing {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if viewModel.isEditing, let agent = viewModel.agent {
                    ProfileBanner(
                        backgroundURL: agent.backgroundURL,
                        avatarURL: agent.avatarURL,
                        avatarEntityID: agent.id,
                        avatarKind: .agent,
                        avatarSize: 64
                    )
                    .padding(.horizontal, -AtlasMetrics.pageX)

                    // ardot S22 Agent Identity Editor card — noticeSoft (#F6FFD0) r20.
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
                    .background(AtlasColors.noticeSoft)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))

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
                    editorMultiline("简介", text: $viewModel.descriptionText, minHeight: 80)
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

                // ardot S21 (`237:419` Permissions 350×96): #F6FFD0 fill, cr20.
                // Replaces the older #F2FFC5 lemon tint — the new spec uses a slightly cooler
                // noticeSoft tone. Card holds follow/chat toggles + audience preview.
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
                .background(AtlasColors.noticeSoft)
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
        } else {
            createAgentContent
        }
        }
        .background(AtlasColors.canvas)
        .safeAreaInset(edge: .top, spacing: 0) {
            AtlasOverlayPushNavBar(
                title: viewModel.isEditing ? "编辑 Agent" : "创建 Agent",
                onBack: { dismiss() }
            )
        }
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

    private var createAgentContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                editorField("名称", text: $viewModel.name)
                editorMultiline("简介", text: $viewModel.descriptionText, minHeight: 72)

                VStack(alignment: .leading, spacing: 8) {
                    Text("公开状态")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text("公开 · 允许关注 · 允许聊天")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkSoft)
                    Text("创建后可随时调整权限")
                        .font(.system(size: 10))
                        .foregroundStyle(AtlasColors.oliveMeta)
                }
                .padding(14)
                .frame(maxWidth: .infinity, minHeight: 96, alignment: .leading)
                .background(AtlasColors.noticeSoft)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                if let message = viewModel.message {
                    Text(message)
                        .font(.system(size: 11))
                        .foregroundStyle(message.contains("成功") ? AtlasColors.olive : AtlasColors.coral)
                }

                primarySaveButton
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 12)
            .padding(.bottom, 40)
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
                    .font(.system(size: 17, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .foregroundStyle(viewModel.isEditing ? Color.white : AtlasColors.lemonInk)
            .background(viewModel.isEditing ? AtlasColors.lemonInk : AtlasColors.lemonStrong)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
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
            AtlasTextField(placeholder: placeholder, text: text, height: 44)
                .padding(.horizontal, 4)
                .background(AtlasColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(AtlasColors.border, lineWidth: 1)
                )
        }
    }

    private func editorMultiline(_ placeholder: String, text: Binding<String>, minHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(placeholder)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AtlasColors.inkSoft)
            AtlasTextEditor(text: text, minHeight: minHeight, fontSize: 16)
                .padding(8)
                .frame(height: minHeight)
                .background(AtlasColors.surface)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
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
