import SwiftUI

struct ChatThreadView: View {
    let sessionID: String
    @State private var title: String

    @Environment(\.dismiss) private var dismiss
    @State private var session: ChatSession?
    @State private var contextIdea: Idea?
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
    @State private var streamingAssistantID: String?

    private var isSheetZoomActive: Bool {
        showArchiveResult
    }

    init(sessionID: String, title: String) {
        self.sessionID = sessionID
        _title = State(initialValue: title)
    }

    private let streamService = ChatStreamService()

    /// Default starter prompts shown when the conversation is empty. ardot S07b.
    private let starterPrompts: [(DeimosIcon, String)] = [
        (.sparkles, "这个想法怎么落地？"),
        (.fork, "能不能给个更轻量的子版本？"),
        (.info, "这个方案的实现风险是什么？")
    ]

    /// Messages grouped by calendar day, preserving order. Each group is rendered with a
    /// leading `ChatDateDivider`. Used by the message list to match Apple Messages' pattern.
    private var groupedMessages: [(date: Date, messages: [ChatMessage])] {
        let cal = Calendar.current
        let grouped = Dictionary(grouping: messages) { cal.startOfDay(for: $0.createdAt) }
        return grouped.keys.sorted().map { ($0, grouped[$0] ?? []) }
    }

    var body: some View {
        VStack(spacing: 0) {
            // S07 v2: scrollable message list fills the space; toolbar + composer float above.
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: AtlasMetrics.chatGap) {
                        // Pinned idea context banner — only when the session carries an ideaID.
                        if let idea = contextIdea {
                            ChatIdeaContextBanner(
                                title: idea.displayTitle,
                                version: nil
                            ) {
                                ideaRoute = IdeaRoute(id: idea.id)
                            }
                            .padding(.top, 6)
                        }

                        if isLoading && messages.isEmpty {
                            ChatThreadLoadingSkeleton()
                                .padding(.top, 12)
                        } else if let errorMessage, messages.isEmpty {
                            // Error state — show retry banner instead of starter prompts so the
                            // user knows the load failed (not that the conversation is empty).
                            chatErrorBanner(errorMessage)
                                .padding(.top, 24)
                        } else if messages.isEmpty {
                            // Empty state — starter prompts to lower the cold-start cost.
                            chatEmptyState
                                .padding(.top, 24)
                        } else {
                            ForEach(groupedMessages, id: \.date) { group in
                                ChatDateDivider(date: group.date)
                                ForEach(group.messages) { message in
                                    ChatMessageBubble(
                                        message: message,
                                        sessionID: sessionID,
                                        agentName: title,
                                        isStreaming: streamingAssistantID == message.id,
                                        feedbackEnabled: message.isAssistant && !pendingFeedbackIDs.contains(message.id),
                                        onIdeaTap: { ideaRoute = IdeaRoute(id: $0) }
                                    )
                                    .id(message.id)
                                }
                            }
                        }

                        if let activityText {
                            ChatToolActivityPill(text: activityText)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, 4)
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
                .onChange(of: activityText) { _, _ in
                    if let last = messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            BottomInputBar(
                text: $draft,
                placeholder: session.map { "给 \($0.agent?.name ?? "Agent") 发消息..." } ?? "发送消息...",
                isSending: isSending,
                onSend: { Task { await send() } }
            )
        }
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: isSheetZoomActive)
        // S07 v2 toolbar: float-liquid glass — back circle + left-aligned title/subtitle +
        // trailing archive circle. Replaces the old solid `AtlasColors.canvas` bar + hairline.
        .safeAreaInset(edge: .top, spacing: 0) {
            chatToolbar
        }
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

    /// Float-liquid glass toolbar. The title is left-aligned (not centered in a capsule) so
    /// the agent name + idea-context subtitle read like a nav bar. Trailing archive button.
    private var chatToolbar: some View {
        HStack(spacing: 10) {
            AtlasToolbarFloatIconButton(icon: .chevronBack, size: AtlasMetrics.backButtonSize, iconSize: 17) {
                dismiss()
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)
                Text(contextIdea != nil ? "带着 Idea 上下文" : "对话")
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkSoft)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            AtlasToolbarFloatIconButton(icon: .document, size: AtlasMetrics.backButtonSize, iconSize: 17) {
                Task { await archiveSession() }
            }
            .accessibilityLabel("封存对话")
        }
        .padding(.horizontal, AtlasMetrics.detailX)
        .frame(height: AtlasToolbarMetrics.barHeight)
    }

    /// Empty-conversation state: a friendly header + 3 starter prompt chips.
    /// Tapping a chip fills the draft (doesn't auto-send) so the user can edit before sending.
    private var chatEmptyState: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("和 \(title) 开启对话")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)
                Text(contextIdea != nil
                     ? "基于当前 Idea 上下文，选一个建议开始或直接提问"
                     : "选一个建议开始，或直接输入你的问题")
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.inkSoft)
            }
            ForEach(starterPrompts, id: \.1) { icon, text in
                ChatStarterPrompt(text: text, icon: icon) {
                    draft = text
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
        // Load messages first — the chat is unusable without them. Session detail (used for
        // the context banner + agent name) is best-effort enrichment, so a failure there
        // must never block the message list.
        do {
            messages = try await APIClient.shared.getMessages(sessionID: sessionID)
            pendingFeedbackIDs = []
        } catch {
            errorMessage = error.localizedDescription
            messages = []
            return
        }
        // Best-effort session fetch — overrides the placeholder title with the real agent
        // name and discovers the pinned idea context. Failures are swallowed silently so a
        // session-detail glitch never blocks the readable message thread.
        if session == nil {
            if let fetched = try? await APIClient.shared.getSession(id: sessionID) {
                session = fetched
                if let agentName = fetched.agent?.name, !agentName.isEmpty {
                    title = agentName
                } else if !fetched.title.isEmpty {
                    title = fetched.title
                }
                if let ideaID = fetched.ideaID, contextIdea == nil {
                    contextIdea = try? await APIClient.shared.getIdea(id: ideaID)
                }
            }
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
        streamingAssistantID = assistantID
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
                    streamingAssistantID = nil
                case .error(let message):
                    errorMessage = message
                    activityText = nil
                    streamingAssistantID = nil
                    ToastCenter.shared.showError("发送失败", message: message)
                }
            }
            messages = try await APIClient.shared.getMessages(sessionID: sessionID)
            pendingFeedbackIDs = []
            streamingAssistantID = nil
        } catch {
            errorMessage = error.localizedDescription
            activityText = nil
            streamingAssistantID = nil
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
    var isStreaming: Bool = false
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
            if message.isAssistant, showsTextBubble || isStreaming || !ideaSuggestions.isEmpty {
                Text(agentName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                    .padding(.leading, 4)
            }

            if isStreaming && message.content.isEmpty {
                // Typing indicator — three bouncing lemon dots inside the assistant bubble.
                // Replaces the old empty bubble shown while the first chunk streams in.
                HStack(alignment: .top, spacing: 0) {
                    ChatTypingIndicator()
                        .background(Color(hex: 0xF1F5FF))
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    Spacer(minLength: 0)
                }
            } else if showsTextBubble {
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
            if (showsTextBubble || !ideaSuggestions.isEmpty) && !isStreaming {
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
