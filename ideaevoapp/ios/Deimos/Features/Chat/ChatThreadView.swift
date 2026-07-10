import SwiftUI

struct ChatThreadView: View {
    let sessionID: String
    @State private var title: String

    @Environment(\.dismiss) private var dismiss
    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var activityText: String?
    @State private var isLoading = true
    @State private var isSending = false
    @State private var errorMessage: String?
    @State private var pendingFeedbackIDs: Set<String> = []
    @State private var ideaRoute: IdeaRoute?
    @State private var showActionMenu = false
    @State private var showRenameSheet = false
    @State private var renameDraft = ""
    @State private var showDeleteDialog = false
    @State private var isWorking = false

    private var isSheetZoomActive: Bool {
        showActionMenu || showRenameSheet
    }

    init(sessionID: String, title: String) {
        self.sessionID = sessionID
        _title = State(initialValue: title)
    }

    private let streamService = ChatStreamService()

    var body: some View {
        VStack(spacing: 0) {
            AtlasPushNavBar(title: title, onBack: { dismiss() }) {
                AtlasToolbarFloatIconButton(icon: .more) {
                    showActionMenu = true
                }
            }

            if let errorMessage, messages.isEmpty, !isLoading {
                AtlasOfflineBanner(message: errorMessage) {
                    Task { await loadMessages() }
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
            }

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        if isLoading && messages.isEmpty {
                            ChatThreadLoadingSkeleton()
                        }
                        if let activityText {
                            toolActivityBar(activityText)
                        }
                        ForEach(messages) { message in
                            ChatMessageBubble(
                                message: message,
                                sessionID: sessionID,
                                feedbackEnabled: message.isAssistant && !pendingFeedbackIDs.contains(message.id),
                                onIdeaTap: { ideaRoute = IdeaRoute(id: $0) }
                            )
                            .id(message.id)
                        }
                    }
                    .padding(.horizontal, AtlasMetrics.pageX)
                    .padding(.vertical, 16)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: messages.count) { _, _ in
                    if let last = messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            BottomInputBar(
                text: $draft,
                placeholder: "和 Agent 聊聊…",
                isSending: isSending,
                onSend: { Task { await send() } }
            )
        }
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: isSheetZoomActive)
        .navigationBarHidden(true)
        .suppressTabBar()
        .sheet(isPresented: $showActionMenu) {
            AtlasActionMenuSheet(actions: [
                AtlasMenuAction(title: "重命名对话") {
                    renameDraft = title
                    showRenameSheet = true
                },
                AtlasMenuAction(title: "删除对话", destructive: true) {
                    showDeleteDialog = true
                },
            ]) {
                showActionMenu = false
            }
            .presentationDetents([.height(180)])
        }
        .sheet(isPresented: $showRenameSheet) {
            renameSheet
        }
        .overlay {
            if showDeleteDialog {
                AtlasCenterDialog(
                    title: "删除对话？",
                    message: "删除后无法恢复，消息记录将被清除。",
                    destructiveTitle: "删除",
                    cancelTitle: "取消",
                    isLoading: isWorking,
                    onConfirm: { Task { await deleteSession() } },
                    onCancel: { showDeleteDialog = false }
                )
            }
        }
        .task { await loadMessages() }
        .navigationDestination(item: $ideaRoute) { route in
            IdeaDetailView(ideaID: route.id)
        }
    }

    private func toolActivityBar(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(AtlasColors.accentActive)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(red: 0.91, green: 0.96, blue: 0.93))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private var renameSheet: some View {
        VStack(spacing: 16) {
            AtlasSheetGrabber()

            AtlasSheetTitleRow(
                title: "重命名对话",
                showsCheck: true,
                onClose: { showRenameSheet = false },
                onCheck: { Task { await submitRename() } }
            )

            AtlasTextField(placeholder: "会话标题", text: $renameDraft, height: AtlasMetrics.inputHeight)
                .padding(.horizontal, 4)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))

            AtlasPrimaryButton(title: "保存", isLoading: isWorking) {
                Task { await submitRename() }
            }
        }
        .padding(20)
        .background(AtlasColors.surface)
        .presentationDetents([.height(260)])
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(AtlasMetrics.radiusSheet)
    }

    private func submitRename() async {
        let newTitle = renameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !newTitle.isEmpty else { return }
        isWorking = true
        defer { isWorking = false }
        do {
            try await APIClient.shared.renameSession(id: sessionID, title: newTitle)
            title = newTitle
            showRenameSheet = false
            ToastCenter.shared.showSuccess("已重命名")
        } catch {
            ToastCenter.shared.showError("重命名失败", message: error.localizedDescription)
        }
    }

    private func deleteSession() async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await APIClient.shared.deleteSession(id: sessionID)
            showDeleteDialog = false
            dismiss()
        } catch {
            ToastCenter.shared.showError("删除失败", message: error.localizedDescription)
        }
    }

    private func loadMessages() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            messages = try await APIClient.shared.getMessages(sessionID: sessionID)
            pendingFeedbackIDs = []
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func send() async {
        let content = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        guard let token = APIClient.shared.authToken else { return }

        isSending = true
        draft = ""
        let tempUser = ChatMessage(
            id: UUID().uuidString,
            sessionID: sessionID,
            role: "user",
            content: content,
            contentType: "text",
            userFeedback: nil,
            createdAt: Date()
        )
        messages.append(tempUser)
        let assistantID = UUID().uuidString
        pendingFeedbackIDs.insert(assistantID)
        messages.append(ChatMessage(
            id: assistantID,
            sessionID: sessionID,
            role: "assistant",
            content: "",
            contentType: "markdown",
            userFeedback: nil,
            createdAt: Date()
        ))

        defer { isSending = false }

        do {
            for try await event in streamService.stream(sessionID: sessionID, content: content, token: token) {
                switch event {
                case .chunk(let text):
                    updateAssistant(id: assistantID, content: text)
                case .activity(let text):
                    activityText = text
                case .done(let text):
                    updateAssistant(id: assistantID, content: text)
                    activityText = nil
                case .error(let message):
                    errorMessage = message
                    activityText = nil
                    ToastCenter.shared.showError("发送失败", message: message)
                }
            }
            messages = try await APIClient.shared.getMessages(sessionID: sessionID)
            pendingFeedbackIDs = []
        } catch {
            errorMessage = error.localizedDescription
            activityText = nil
            ToastCenter.shared.showError("发送失败", message: error.localizedDescription)
        }
    }

    private func updateAssistant(id: String, content: String) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        let old = messages[index]
        messages[index] = ChatMessage(
            id: old.id,
            sessionID: old.sessionID,
            role: old.role,
            content: content,
            contentType: old.contentType,
            userFeedback: old.userFeedback,
            createdAt: old.createdAt
        )
    }
}

struct ChatMessageBubble: View {
    let message: ChatMessage
    let sessionID: String
    let feedbackEnabled: Bool
    var onIdeaTap: (String) -> Void = { _ in }

    @State private var feedback: String?

    private var ideaSuggestions: [ChatIdeaSuggestion] {
        ChatIdeaSuggestionParser.suggestions(from: message)
    }

    private var showsTextBubble: Bool {
        guard !message.content.isEmpty else { return false }
        if message.contentType == "json", !ideaSuggestions.isEmpty { return false }
        return true
    }

    var body: some View {
        VStack(alignment: message.isUser ? .trailing : .leading, spacing: 6) {
            if showsTextBubble {
                HStack {
                    if message.isUser { Spacer(minLength: 48) }
                    Group {
                        if message.isAssistant, message.contentType == "markdown" {
                            MarkdownBody(markdown: message.content)
                        } else {
                            Text(message.content.plainSummary)
                                .font(.system(size: 14))
                                .foregroundStyle(message.isUser ? Color.white : AtlasColors.ink)
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: 260, alignment: message.isUser ? .trailing : .leading)
                    .background(message.isUser ? AtlasColors.primary : Color(hex: 0xF1F5F9))
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    if !message.isUser { Spacer(minLength: 48) }
                }
            }

            if message.isAssistant, !ideaSuggestions.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(ideaSuggestions) { suggestion in
                        ChatIdeaSuggestionCard(suggestion: suggestion) {
                            onIdeaTap(suggestion.id)
                        }
                    }
                }
            }

            if message.isAssistant, showsTextBubble || !ideaSuggestions.isEmpty {
                if feedbackEnabled {
                    HStack(spacing: 8) {
                        feedbackButton(title: "有帮助", rating: "like", icon: .check)
                        feedbackButton(title: "无帮助", rating: "dislike", icon: .close)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(AtlasColors.fill)
                    .clipShape(Capsule())
                    .padding(.leading, 4)
                } else if let feedback {
                    Text(feedback == "like" ? "已标记为有帮助" : "已标记为无帮助")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.accentActive)
                        .padding(.leading, 4)
                }
            }
        }
        .onAppear { feedback = message.userFeedback }
        .onChange(of: message.userFeedback) { _, newValue in
            feedback = newValue
        }
    }

    private func feedbackButton(title: String, rating: String, icon: DeimosIcon) -> some View {
        Button {
            Task { await toggleFeedback(rating: rating) }
        } label: {
            HStack(spacing: 4) {
                DeimosIconView(
                    icon: icon,
                    size: 11,
                    color: feedback == rating ? AtlasColors.accentActive : AtlasColors.inkFaint
                )
                Text(title)
                    .font(.system(size: 12, weight: feedback == rating ? .semibold : .regular))
                    .foregroundStyle(feedback == rating ? AtlasColors.accentActive : AtlasColors.inkSoft)
            }
        }
        .buttonStyle(.plain)
        .disabled(!feedbackEnabled)
    }

    private func toggleFeedback(rating: String) async {
        if feedback == rating {
            do {
                try await APIClient.shared.clearMessageFeedback(sessionID: sessionID, messageID: message.id)
                feedback = nil
            } catch {
                ToastCenter.shared.showError("清除反馈失败", message: error.localizedDescription)
            }
            return
        }
        do {
            try await APIClient.shared.setMessageFeedback(sessionID: sessionID, messageID: message.id, rating: rating)
            feedback = rating
        } catch {
            ToastCenter.shared.showError("反馈失败", message: error.localizedDescription)
        }
    }
}
