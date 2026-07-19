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
            // S07 Thread Nav (ardot 237:291): 56h, SOLID white bg (not glass), back is a 44×44
            // #F2F3F5 solid circle (not floating glass), title 17pt Semibold + 12pt Regular subtitle,
            // left-aligned. The thread is the focus — no glass blur, no centered capsule.
            HStack(spacing: 12) {
                Button { dismiss() } label: {
                    DeimosIconView(icon: .chevronBack, size: 17, color: AtlasColors.ink)
                        .frame(width: 44, height: 44)
                        .background(AtlasColors.surfaceSecondary, in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("返回")

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                        .lineLimit(1)
                    Text("带着 Idea 上下文")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(1)
                }

                Spacer()
            }
            .padding(.horizontal, 20)
            .frame(height: 56)
            .background(AtlasColors.canvas)
            .overlay(alignment: .bottom) {
                Rectangle().fill(AtlasColors.border.opacity(0.45)).frame(height: 1)
            }

            if let errorMessage, !isLoading {
                chatErrorBanner(errorMessage)
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
                                agentName: title,
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
                placeholder: "给万叶助手发消息...",
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

    private func chatErrorBanner(_ message: String) -> some View {
        Button {
            Task { await loadMessages() }
        } label: {
            HStack(spacing: 8) {
                Text(message)
                    .font(AtlasTypography.mobileSubheadline())
                    .foregroundStyle(AtlasColors.coral)
                    .lineLimit(2)
                Spacer(minLength: 8)
                DeimosIconView(icon: .refresh, size: 14, color: AtlasColors.coral)
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 48)
            .background(AtlasColors.coralSoft)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        }
        .buttonStyle(.plain)
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

        Haptics.light()
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
    let agentName: String
    let feedbackEnabled: Bool
    var onIdeaTap: (String) -> Void = { _ in }

    @State private var feedback: String?
    @State private var copied = false

    private var ideaSuggestions: [ChatIdeaSuggestion] {
        ChatIdeaSuggestionParser.suggestions(from: message)
    }

    private var showsTextBubble: Bool {
        guard !message.content.isEmpty else { return false }
        if message.contentType == "json", !ideaSuggestions.isEmpty { return false }
        return true
    }

    /// "14:28" style timestamp for the action row.
    private var timestampText: String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: message.createdAt)
    }

    var body: some View {
        VStack(alignment: message.isUser ? .trailing : .leading, spacing: 6) {
            // AI header — agent name above the bubble (user messages have no header).
            if message.isAssistant, showsTextBubble || !ideaSuggestions.isEmpty {
                Text(agentName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                    .padding(.leading, 4)
            }

            if showsTextBubble {
                HStack(alignment: .top, spacing: 0) {
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

            // Per-message action row: like / dislike / copy + timestamp (right).
            // Matches ardot S07 message action pattern (AI-chat style).
            if showsTextBubble || !ideaSuggestions.isEmpty {
                actionBar
            }
        }
        .onAppear { feedback = message.userFeedback }
        .onChange(of: message.userFeedback) { _, newValue in
            feedback = newValue
        }
    }

    /// Like / dislike / copy icon row with a right-aligned timestamp.
    private var actionBar: some View {
        HStack(spacing: 14) {
            actionButton(icon: .check, active: feedback == "like", activeColor: AtlasColors.accentActive) {
                Task { await toggleFeedback(rating: "like") }
            }
            .accessibilityLabel("有帮助")

            actionButton(icon: .close, active: feedback == "dislike", activeColor: AtlasColors.destructive) {
                Task { await toggleFeedback(rating: "dislike") }
            }
            .accessibilityLabel("无帮助")

            actionButton(icon: .document, active: copied, activeColor: AtlasColors.accentActive) {
                copyMessage()
            }
            .accessibilityLabel(copied ? "已复制" : "复制")

            Spacer(minLength: 8)

            Text(timestampText)
                .font(.system(size: 11))
                .foregroundStyle(AtlasColors.inkFaint)
        }
        .padding(.horizontal, 2)
    }

    private func actionButton(icon: DeimosIcon, active: Bool, activeColor: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            DeimosIconView(icon: icon, size: 15, color: active ? activeColor : AtlasColors.inkFaint)
        }
        .buttonStyle(.plain)
    }

    private func copyMessage() {
        UIPasteboard.general.string = message.content.plainSummary
        withAnimation { copied = true }
        Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            await MainActor.run { withAnimation { copied = false } }
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
            DeimosIconView(icon: .sparkles, size: 18, color: AtlasColors.lemonInk)
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
