import SwiftUI
import Observation

@MainActor
@Observable
final class ChatListViewModel {
    var sessions: [ChatSession] = []
    var previews: [String: String] = [:]
    var searchQuery = ""
    var isLoading = false
    var errorMessage: String?

    var filteredSessions: [ChatSession] {
        let trimmed = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        let base: [ChatSession]
        if trimmed.isEmpty {
            base = sessions
        } else {
            base = sessions.filter {
                $0.displayTitle.localizedCaseInsensitiveContains(trimmed)
                    || ($0.agent?.name.localizedCaseInsensitiveContains(trimmed) ?? false)
            }
        }
        return base
            .filter { BlocklistFiltering.chatSession($0) }
            .sorted { lhs, rhs in
            let lhsPinned = Self.isAssistantSession(lhs)
            let rhsPinned = Self.isAssistantSession(rhs)
            if lhsPinned != rhsPinned { return lhsPinned }
            return lhs.updatedAt > rhs.updatedAt
        }
    }

    static func isAssistantSession(_ session: ChatSession) -> Bool {
        session.displayTitle == AppConfig.systemAssistantName
            || session.agent?.name == AppConfig.systemAssistantName
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let loaded = try await APIClient.shared.listSessions()
            sessions = loaded
            await loadPreviews(for: loaded)
        } catch {
            errorMessage = error.localizedDescription
            sessions = []
            previews = [:]
        }
    }

    func renameSession(id: String, title: String) async throws {
        try await APIClient.shared.renameSession(id: id, title: title)
        await load()
    }

    func deleteSession(id: String) async throws {
        try await APIClient.shared.deleteSession(id: id)
        await load()
    }

    func forkSession(id: String) async throws -> ChatSession {
        let forked = try await APIClient.shared.forkSession(id: id)
        await load()
        return forked
    }

    private func loadPreviews(for sessions: [ChatSession]) async {
        var next: [String: String] = [:]
        await withTaskGroup(of: (String, String?).self) { group in
            for session in sessions.prefix(12) {
                group.addTask {
                    let messages = try? await APIClient.shared.getMessages(sessionID: session.id, limit: 1)
                    let preview = messages?.last?.content.plainSummary
                    return (session.id, preview)
                }
            }
            for await (id, preview) in group {
                if let preview, !preview.isEmpty {
                    next[id] = preview
                }
            }
        }
        previews = next
    }
}

struct ChatListView: View {
    @Environment(AuthSession.self) private var session
    @State private var viewModel = ChatListViewModel()
    @State private var selectedSession: ChatSessionRoute?
    @State private var showAgentPicker = false
    @State private var showRenameSheet = false
    @State private var sessionToRename: ChatSession?
    @State private var renameDraft = ""
    @State private var sessionToDelete: ChatSession?
    @State private var showDeleteDialog = false
    @State private var isWorking = false
    @State private var showAuthSheet = false

    private var isSheetZoomActive: Bool {
        showAgentPicker || showRenameSheet || showAuthSheet
    }

    var body: some View {
        Group {
            if !session.isAuthenticated {
                guestContent
            } else {
                authenticatedContent
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: isSheetZoomActive)
        .navigationBarHidden(true)
        .navigationDestination(item: $selectedSession) { route in
            ChatThreadView(sessionID: route.id, title: route.title)
        }
        .sheet(isPresented: $showAgentPicker) {
            ChatAgentPickerView(ideaID: nil, ideaTitle: nil) { agent in
                Task { await createSession(agent: agent) }
            }
        }
        .sheet(isPresented: $showRenameSheet) {
            if let chatSession = sessionToRename {
                renameSheet(chatSession)
            }
        }
        .overlay {
            if showDeleteDialog, let chatSession = sessionToDelete {
                AtlasCenterDialog(
                    title: "删除对话？",
                    message: "删除后无法恢复，消息记录将被清除。",
                    destructiveTitle: "删除",
                    cancelTitle: "取消",
                    isLoading: isWorking,
                    onConfirm: { Task { await deleteSession(chatSession) } },
                    onCancel: {
                        showDeleteDialog = false
                        sessionToDelete = nil
                    }
                )
            }
        }
        .task(id: session.isAuthenticated) {
            guard session.isAuthenticated else { return }
            await viewModel.load()
        }
        .sheet(isPresented: $showAuthSheet) {
            AuthRequiredSheet()
        }
    }

    private var guestContent: some View {
        ScrollView {
            // Content Wrapper (S06 179:389): VERTICAL itemSpacing=16, padding=[24,24,0,0]
            VStack(alignment: .leading, spacing: 16) {
                // Large Title (S06 179:391)
                Text("对话")
                    .font(.system(size: 36, weight: .heavy))
                    .foregroundStyle(AtlasColors.ink)

                aiAssistantHero

                Spacer(minLength: 0)
                AtlasDesignedEmptyStates.chatEmpty {
                    showAuthSheet = true
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, AtlasMetrics.bottomClear)
        }
    }

    private var authenticatedContent: some View {
        // Content Wrapper (S06 179:389): VERTICAL itemSpacing=16, padding=[24,24,0,0]
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Large Title (S06 179:391)
                Text("对话")
                    .font(.system(size: 36, weight: .heavy))
                    .foregroundStyle(AtlasColors.ink)

                // AI Assistant Hero (S06 179:392)
                aiAssistantHero

                if viewModel.isLoading && viewModel.sessions.isEmpty {
                    HStack { Spacer(); ProgressView(); Spacer() }
                        .padding(.top, 40)
                } else if let error = viewModel.errorMessage, viewModel.sessions.isEmpty {
                    errorEmptyState(error)
                } else if viewModel.sessions.isEmpty {
                    sessionsEmptyState
                } else {
                    // Section Header (S06 179:397): "最近会话" 24pt ExtraBold
                    Text("最近会话")
                        .font(.system(size: 24, weight: .heavy))
                        .foregroundStyle(AtlasColors.ink)

                    LazyVStack(spacing: 16) {
                        ForEach(viewModel.sessions, id: \.id) { chatSession in
                            sessionCard(chatSession)
                        }
                    }
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, AtlasMetrics.bottomClear)
        }
    }

    /// AI Assistant Hero (S06 179:392): VERTICAL itemSpacing=8, padding=[18,0,16,18], r28,
    /// lemon bg + stroke #E7EAF0, 342×136.
    private var aiAssistantHero: some View {
        Button {
            if let assistant = viewModel.sessions.first(where: { ChatListViewModel.isAssistantSession($0) }) {
                selectedSession = ChatSessionRoute(id: assistant.id, title: assistant.displayTitle)
            } else {
                if session.isAuthenticated {
                    showAgentPicker = true
                } else {
                    showAuthSheet = true
                }
            }
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                // Hero Title (S06 179:393): 20pt Bold lemonInk, lineHeight=26
                Text("把零散想法整理成可发布的 idea")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(AtlasColors.lemonInk)
                    .lineLimit(2)

                // Hero Body (S06 179:394): 13pt Regular olive, lineHeight=18
                Text("支持搜索、登记、Fork、状态更新和评论建议。")
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.olive)
                    .lineLimit(2)

                // Start Chat Button (S06 179:395): 112×36 r18 bg=white, "开始对话" 12pt SemiBold olive
                Text("开始对话")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AtlasColors.olive)
                    .padding(.horizontal, 18)
                    .frame(height: 36)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, 18)
            .padding(.top, 16)
            .padding(.trailing, 0)
            .padding(.bottom, 0)
            .frame(height: 136)
            .background(AtlasColors.lemon)
            .overlay(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .stroke(AtlasColors.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var sessionsEmptyState: some View {
        VStack(spacing: 16) {
            AtlasDesignedEmptyStates.chatEmpty {
                showAgentPicker = true
            }
        }
    }

    private func errorEmptyState(_ error: String) -> some View {
        AtlasDesignedEmptyStates.loadFailed(message: error) {
            Task { await viewModel.load() }
        }
        .frame(maxWidth: .infinity)
    }

    /// Session Card (S06 179:398): HORIZONTAL itemSpacing=12, padding=[14,0,14,14], r20,
    /// bg=#F8FAFC + stroke, 342×96.
    /// Avatar: 50×50 r25 lemonStrong. Summary: 15pt SemiBold ink, two-line.
    private func sessionCard(_ chatSession: ChatSession) -> some View {
        let pinned = ChatListViewModel.isAssistantSession(chatSession)
        let summary = viewModel.previews[chatSession.id] ?? "开始新的讨论"
        let displayText = pinned ? "万叶助手\n\(summary)" : "\(chatSession.displayTitle)\n\(summary)"

        return Button {
            selectedSession = ChatSessionRoute(id: chatSession.id, title: chatSession.displayTitle)
        } label: {
            HStack(spacing: 12) {
                // Avatar (S06 179:399): 50×50 r25 bg=lemonStrong — solid circle
                Circle()
                    .fill(AtlasColors.lemonStrong)
                    .frame(width: 50, height: 50)

                // Session Summary (S06 179:400): two-line text 15pt SemiBold ink, lineHeight=22
                Text(displayText)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                    .lineSpacing(22 - 15 * 1.2) // approximate lineHeight=22
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Menu {
                    Button("重命名") {
                        renameDraft = chatSession.title
                        sessionToRename = chatSession
                        showRenameSheet = true
                    }
                    Button("Fork 会话") {
                        selectedSession = ChatSessionRoute(id: chatSession.id, title: chatSession.displayTitle)
                    }
                    Button("删除", role: .destructive) {
                        sessionToDelete = chatSession
                        showDeleteDialog = true
                    }
                } label: {
                    DeimosIconView(icon: .more, size: 16, color: AtlasColors.inkFaint)
                        .frame(width: 32, height: 32)
                }
                .disabled(isWorking)
            }
            .padding(.horizontal, 14)
            .padding(.top, 14)
            .padding(.bottom, 0)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: 96)
            .background(Color(hex: 0xF8FAFC))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(AtlasColors.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func renameSheet(_ chatSession: ChatSession) -> some View {
        VStack(spacing: 16) {
            AtlasSheetGrabber()
                .padding(.top, 4)

            AtlasSheetTitleRow(
                title: "重命名对话",
                showsCheck: true,
                onClose: {
                    showRenameSheet = false
                    sessionToRename = nil
                },
                onCheck: {
                    Task { await submitRename(chatSession) }
                }
            )

            AtlasTextField(placeholder: "会话标题", text: $renameDraft, height: AtlasMetrics.inputHeight)
                .padding(.horizontal, 4)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))

            AtlasPrimaryButton(title: "保存", isLoading: isWorking) {
                Task { await submitRename(chatSession) }
            }
        }
        .padding(20)
        .background(AtlasColors.surface)
        .presentationDetents([.height(280)])
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(AtlasMetrics.radiusSheet)
    }

    private func createSession(agent: Agent) async {
        isWorking = true
        defer { isWorking = false }
        do {
            let chatSession = try await APIClient.shared.createSession(agentID: agent.id, title: agent.name)
            await viewModel.load()
            selectedSession = ChatSessionRoute(id: chatSession.id, title: agent.name)
        } catch {
            viewModel.errorMessage = error.localizedDescription
        }
    }

    private func submitRename(_ chatSession: ChatSession) async {
        let title = renameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        isWorking = true
        defer { isWorking = false }
        do {
            try await viewModel.renameSession(id: chatSession.id, title: title)
            showRenameSheet = false
            sessionToRename = nil
            ToastCenter.shared.showSuccess("已重命名")
        } catch {
            ToastCenter.shared.showError("重命名失败", message: error.localizedDescription)
        }
    }

    private func deleteSession(_ chatSession: ChatSession) async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await viewModel.deleteSession(id: chatSession.id)
            showDeleteDialog = false
            sessionToDelete = nil
            ToastCenter.shared.showSuccess("已删除")
        } catch {
            ToastCenter.shared.showError("删除失败", message: error.localizedDescription)
        }
    }

    private func forkSession(_ chatSession: ChatSession) async {
        isWorking = true
        defer { isWorking = false }
        do {
            let forked = try await viewModel.forkSession(id: chatSession.id)
            selectedSession = ChatSessionRoute(id: forked.id, title: forked.displayTitle)
            ToastCenter.shared.showSuccess("已 Fork 会话")
        } catch {
            ToastCenter.shared.showError("Fork 失败", message: error.localizedDescription)
        }
    }
}

struct ChatSessionRoute: Identifiable, Hashable {
    let id: String
    let title: String
}
