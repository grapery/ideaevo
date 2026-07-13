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
    @State private var isArchiving = false
    @State private var archiveSummary: String?
    @State private var showArchiveResult = false

    private var isSheetZoomActive: Bool {
        showArchiveResult
    }

    init(sessionID: String, title: String) {
        self.sessionID = sessionID
        _title = State(initialValue: title)
    }

    private let streamService = ChatStreamService()

    var body: some View {
        VStack(spacing: 0) {
            // S07 Chat Header: back + avatar + title (left) | archive button (right)
            HStack(spacing: 12) {
                AtlasNavBackButton(action: { dismiss() })

                Circle()
                    .fill(AtlasColors.lemonStrong)
                    .frame(width: 42, height: 42)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(AtlasColors.ink)
                        .lineLimit(1)
                    Text("在线 · SSE 流式回复")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(1)
                }

                Spacer()

                // Archive button — 36×36 r18 bg-muted
                Button {
                    Task { await archiveSession() }
                } label: {
                    Image(systemName: "archivebox.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(AtlasColors.ink)
                        .frame(width: 36, height: 36)
                        .background(AtlasColors.surfaceSecondary)
                        .clipShape(Circle())
                }
                .buttonStyle(AtlasPressableStyle())
            }
            .padding(.horizontal, 20)
            .frame(height: 58)

            if let errorMessage, messages.isEmpty, !isLoading {
                AtlasOfflineBanner(message: errorMessage) {
                    Task { await loadMessages() }
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
            }

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: AtlasMetrics.chatGap) {
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
                    .padding(.horizontal, 20)
                    .padding(.vertical, 14)
                }
                // Tap to dismiss keyboard — tap anywhere on the message scroll area
                .onTapGesture {
                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
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
                placeholder: "问万叶一个问题",
                isSending: isSending,
                onSend: { Task { await send() } }
            )
        }
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: isSheetZoomActive)
        .navigationBarHidden(true)
        .suppressTabBar()
        .sheet(isPresented: $showArchiveResult) {
            archiveResultSheet
        }
        .task { await loadMessages() }
        .navigationDestination(item: $ideaRoute) { route in
            IdeaDetailView(ideaID: route.id)
        }
    }

    private func toolActivityBar(_ text: String) -> some View {
        Text(text)
            .font(AtlasTypography.caption())
            .foregroundStyle(AtlasColors.accentActive)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(red: 0.91, green: 0.96, blue: 0.93))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    /// Archive result sheet — shows summary after archiving.
    private var archiveResultSheet: some View {
        VStack(spacing: 16) {
            AtlasSheetGrabber()

            Text("对话已封存")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(AtlasColors.ink)

            if let summary = archiveSummary {
                Text(summary)
                    .font(.system(size: 14))
                    .foregroundStyle(AtlasColors.inkSoft)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(Color(hex: 0xF8FAFC))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(AtlasColors.border, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }

            Text("聊天上下文已打包封存，可在「我的 Agent」中查看归档。")
                .font(.system(size: 13))
                .foregroundStyle(AtlasColors.inkFaint)

            AtlasPrimaryButton(title: "完成") {
                showArchiveResult = false
                dismiss()
            }
        }
        .padding(20)
        .background(AtlasColors.surface)
        .presentationDetents([.height(380)])
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(AtlasMetrics.radiusSheet)
    }

    /// Archive the session — calls backend to package + extract summary.
    private func archiveSession() async {
        isArchiving = true
        defer { isArchiving = false }
        do {
            let result = try await APIClient.shared.archiveSession(id: sessionID)
            archiveSummary = result.summary
            showArchiveResult = true
            ToastCenter.shared.showSuccess("已封存对话")
        } catch {
            ToastCenter.shared.showError("封存失败", message: error.localizedDescription)
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
                HStack(alignment: .top, spacing: 10) {
                    // AI avatar next to AI messages
                    if !message.isUser {
                        aiAvatar
                    }
                    if message.isUser { Spacer(minLength: 0) }
                    // Bubble content — hug text width, cap at 260pt max
                    Group {
                        if message.isAssistant, message.contentType == "markdown" {
                            MarkdownBody(markdown: message.content)
                                .frame(maxWidth: 232)
                        } else {
                            Text(message.content.plainSummary)
                                .font(message.isUser
                                      ? .system(size: 13, weight: .semibold)
                                      : .system(size: 13, weight: .medium))
                                .foregroundStyle(message.isUser ? AtlasColors.lemonInk : Color(hex: 0x253044))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: 260, alignment: message.isUser ? .trailing : .leading)
                    .fixedSize(horizontal: true, vertical: false)
                    .padding(.horizontal, 14)
                    .padding(.top, 12)
                    .padding(.bottom, 10)
                    .background(message.isUser ? AtlasColors.lemonStrong : Color(hex: 0xF1F5FF))
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    if !message.isUser { Spacer(minLength: 0) }
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

    /// v7 AI avatar — 40px lemon circle with sparkles icon.
    private var aiAvatar: some View {
        ZStack {
            Circle()
                .fill(AtlasColors.lemon)
                .frame(width: 40, height: 40)
            Image(systemName: "sparkles")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(AtlasColors.lemonInk)
        }
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
