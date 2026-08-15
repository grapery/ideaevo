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

    func archiveSession(id: String) async throws {
        _ = try await APIClient.shared.archiveSession(id: id)
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
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("--deimos-goto-chat-first"),
               let first = viewModel.filteredSessions.first {
                selectedSession = ChatSessionRoute(id: first.id, title: first.displayTitle)
            }
            #endif
        }
        .sheet(isPresented: $showAuthSheet) {
            AuthRequiredSheet()
        }
        #if DEBUG
        // Verify-only launch hook: `--deimos-goto-chat=<sessionID>` deep-links straight to a
        // chat thread for visual review against the ardot S07 design spec.
        .onAppear {
            if let arg = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--deimos-goto-chat=") }) {
                let id = arg.replacingOccurrences(of: "--deimos-goto-chat=", with: "")
                if !id.isEmpty { selectedSession = ChatSessionRoute(id: id, title: "对话") }
            }
        }
        #endif
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
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Text("DEIMOS")
                    .font(AtlasTypography.overline())
                    .foregroundStyle(AtlasColors.inkSoft)
                Text("对话")
                    .font(AtlasTypography.largeTitle())
                    .foregroundStyle(AtlasColors.ink)
                    .atlasTrackedTitle(30)
            }

            Spacer()

            // ardot S06 (`237:161` New Chat): 64×36 #BEE90D lemon capsule cr18 + 14pt Semibold
            // #1A2403 label "新建".
            Button(action: newChatAction) {
                Text("新建")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(AtlasColors.lemonInk)
                    .padding(.horizontal, 16)
                    .frame(height: 36)
                    .background(AtlasColors.lemonStrong)
                    .clipShape(Capsule(style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.top, 8)
        .padding(.bottom, 20)
    }

    private var authenticatedContent: some View {
        VStack(spacing: 0) {
            chatHeader(newChatAction: { showAgentPicker = true })

            HStack(spacing: 10) {
                DeimosIconView(icon: .search, size: 16, color: AtlasColors.inkFaint)
                TextField("搜索会话...", text: $viewModel.searchQuery)
                    .font(.system(size: 15))
                    .foregroundStyle(AtlasColors.ink)
            }
            .padding(.horizontal, 16)
            .frame(height: 44)
            .background(AtlasColors.bgInput)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .padding(.horizontal, AtlasMetrics.pageX)
                .padding(.bottom, 16)

            if viewModel.isLoading && viewModel.sessions.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if let error = viewModel.errorMessage, viewModel.sessions.isEmpty {
                errorEmptyState(error)
            } else if viewModel.filteredSessions.isEmpty && !viewModel.searchQuery.isEmpty {
                searchEmptyState
            } else if viewModel.sessions.isEmpty {
                sessionsEmptyState
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        Text("最近会话")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(AtlasColors.ink)

                        VStack(spacing: 0) {
                            ForEach(Array(viewModel.filteredSessions.enumerated()), id: \.element.id) { index, chatSession in
                                sessionCard(chatSession)
                                if index < viewModel.filteredSessions.count - 1 {
                                    Divider().padding(.leading, 56)
                                }
                            }
                        }
                        .background(AtlasColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(AtlasColors.border, lineWidth: 1)
                        }
                    }
                    .padding(.horizontal, AtlasMetrics.pageX)
                    .padding(.bottom, AtlasMetrics.bottomClear)
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

    /// ardot S06 (`237:154` C/List Row): 342×56 white row with a 40×40 lemon avatar circle
    /// (cr20) + 16pt Semibold #0F1B2D title + 13pt Regular #8A94A6 subtitle (single line).
    /// Trailing menu (rename/fork/delete) is preserved as the row's long-press affordance —
    /// the design shows no trailing element but the functionality is still needed.
    private func sessionCard(_ chatSession: ChatSession) -> some View {
        let pinned = ChatListViewModel.isAssistantSession(chatSession)
        return ChatSessionSwipeRow(
            onArchive: {
                Task {
                    do {
                        try await viewModel.archiveSession(id: chatSession.id)
                        ToastCenter.shared.showSuccess("对话已归档")
                    } catch {
                        ToastCenter.shared.showError("归档失败", message: error.localizedDescription)
                    }
                }
            },
            onDelete: {
                sessionToDelete = chatSession
                showDeleteDialog = true
            }
        ) {
            HStack(alignment: .center, spacing: 12) {
                EntityAvatar.agent(
                    id: chatSession.agentID,
                    url: chatSession.agent?.avatarLink,
                    name: chatSession.displayTitle,
                    size: 36
                )

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(chatSession.displayTitle)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(AtlasColors.ink)
                            .lineLimit(1)
                        if pinned {
                            Text("助手")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(AtlasColors.lemonInk)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Capsule(style: .continuous).fill(AtlasColors.lemon))
                        }
                    }
                    Text(viewModel.previews[chatSession.id] ?? "开始新的讨论")
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 56)
            .contentShape(Rectangle())
            .onTapGesture {
                selectedSession = ChatSessionRoute(id: chatSession.id, title: chatSession.displayTitle)
            }
            .contextMenu {
                Button("重命名") {
                    renameDraft = chatSession.title
                    sessionToRename = chatSession
                    showRenameSheet = true
                }
                Button("Fork 会话") {
                    Task { await forkSession(chatSession) }
                }
                Button("归档") {
                    Task {
                        do {
                            try await viewModel.archiveSession(id: chatSession.id)
                            ToastCenter.shared.showSuccess("对话已归档")
                        } catch {
                            ToastCenter.shared.showError("归档失败", message: error.localizedDescription)
                        }
                    }
                }
                Button("删除", role: .destructive) {
                    sessionToDelete = chatSession
                    showDeleteDialog = true
                }
            }
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

/// Ardot S06 (`353:30`) swipe interaction: dragging a chat row left reveals archive and delete
/// actions behind the row. The row settles at -144pt and snaps closed when the drag is cancelled.
private struct ChatSessionSwipeRow<Content: View>: View {
    let onArchive: () -> Void
    let onDelete: () -> Void
    @ViewBuilder let content: () -> Content

    @State private var offset: CGFloat = 0
    @GestureState private var dragOffset: CGFloat = 0

    private let actionWidth: CGFloat = 72

    var body: some View {
        ZStack(alignment: .trailing) {
            HStack(spacing: 0) {
                swipeAction(
                    title: "归档",
                    icon: .archive,
                    color: AtlasColors.inkSoft,
                    action: onArchive
                )
                swipeAction(
                    title: "删除",
                    icon: .trash,
                    color: AtlasColors.destructiveFill,
                    action: onDelete
                )
            }

            content()
                .frame(maxWidth: .infinity)
                .background(AtlasColors.surface)
                .offset(x: effectiveOffset)
                .gesture(
                    DragGesture(minimumDistance: 12)
                        .updating($dragOffset) { value, state, _ in
                            let proposed = offset + value.translation.width
                            state = min(0, max(-actionWidth * 2, proposed)) - offset
                        }
                        .onEnded { value in
                            let proposed = offset + value.translation.width
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
                                offset = proposed < -44 ? -actionWidth * 2 : 0
                            }
                        }
                )
        }
        .frame(minHeight: 56)
        .clipped()
    }

    private var effectiveOffset: CGFloat {
        min(0, max(-actionWidth * 2, offset + dragOffset))
    }

    private func swipeAction(
        title: String,
        icon: DeimosIcon,
        color: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
                offset = 0
            }
            action()
        } label: {
            VStack(spacing: 2) {
                DeimosIconView(icon: icon, size: 16, color: .white)
                Text(title)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(width: actionWidth)
            .frame(maxHeight: .infinity)
            .background(color)
        }
        .buttonStyle(.plain)
    }
}

struct ChatSessionRoute: Identifiable, Hashable {
    let id: String
    let title: String
}
