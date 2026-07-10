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
        VStack(spacing: 0) {
            chatHeader(newChatAction: { showAuthSheet = true })

            Spacer()
            AtlasDesignedEmptyStates.chatEmpty {
                showAuthSheet = true
            }
            Spacer()
        }
    }

    private func chatHeader(newChatAction: @escaping () -> Void) -> some View {
        AtlasTabScreenHeader(title: "对话") {
            AtlasToolbarFloatIconButton(icon: .plus, iconSize: 16, action: newChatAction)
        }
    }

    private var authenticatedContent: some View {
        VStack(spacing: 0) {
            chatHeader(newChatAction: { showAgentPicker = true })

            AtlasEmbeddedSearchBar(
                placeholder: "搜索会话或 Agent",
                text: $viewModel.searchQuery,
                onSubmit: {}
            )
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.bottom, 12)

            if viewModel.isLoading && viewModel.sessions.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if let error = viewModel.errorMessage, viewModel.sessions.isEmpty {
                errorEmptyState(error)
            } else if viewModel.sessions.isEmpty {
                sessionsEmptyState
            } else if viewModel.filteredSessions.isEmpty {
                searchEmptyState
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(Array(viewModel.filteredSessions.enumerated()), id: \.element.id) { index, chatSession in
                            sessionCard(chatSession)

                            if index < viewModel.filteredSessions.count - 1 {
                                Rectangle()
                                    .fill(AtlasColors.rule)
                                    .frame(height: 1)
                            }
                        }
                    }
                    .padding(.horizontal, AtlasMetrics.pageX)
                    .padding(.top, 12)
                    .padding(.bottom, 16)
                }
            }
        }
    }

    private var sessionsEmptyState: some View {
        VStack(spacing: 16) {
            AtlasDesignedEmptyStates.chatEmpty {
                showAgentPicker = true
            }
            Spacer()
        }
    }

    private var searchEmptyState: some View {
        VStack(spacing: 16) {
            AtlasDesignedEmptyStates.chatSearchEmpty {
                viewModel.searchQuery = ""
            }
            Spacer()
        }
    }

    private func errorEmptyState(_ error: String) -> some View {
        VStack(spacing: 16) {
            AtlasDesignedEmptyStates.loadFailed(message: error) {
                Task { await viewModel.load() }
            }
            Spacer()
        }
    }

    private func sessionCard(_ chatSession: ChatSession) -> some View {
        let pinned = ChatListViewModel.isAssistantSession(chatSession)
        return CompactListCard(
            leading: {
                EntityAvatar.agent(
                    id: chatSession.agentID,
                    url: chatSession.agent?.avatarLink,
                    name: chatSession.displayTitle,
                    size: 48
                )
            },
            title: chatSession.displayTitle,
            subtitle: viewModel.previews[chatSession.id] ?? "开始新的讨论",
            timestamp: chatSession.updatedAt.relativeShort,
            layoutStyle: .flat,
            trailing: {
                HStack(spacing: 6) {
                    if pinned {
                        Text("助手")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(AtlasColors.accentActive)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(AtlasColors.accentActiveSoft)
                            .clipShape(Capsule())
                    }
                    Menu {
                        Button("重命名") {
                            renameDraft = chatSession.title
                            sessionToRename = chatSession
                            showRenameSheet = true
                        }
                        Button("Fork 会话") {
                            Task { await forkSession(chatSession) }
                        }
                        Button("删除", role: .destructive) {
                            sessionToDelete = chatSession
                            showDeleteDialog = true
                        }
                    } label: {
                        DeimosIconView(icon: .more, size: 16, color: AtlasColors.inkFaint)
                            .frame(width: 32, height: 32)
                            .background(AtlasColors.fill)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(isWorking)
                }
            }
        )
        .background(pinned ? AtlasColors.entityAgent.opacity(0.25) : Color.clear)
        .contentShape(Rectangle())
        .onTapGesture {
            selectedSession = ChatSessionRoute(id: chatSession.id, title: chatSession.displayTitle)
        }
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
