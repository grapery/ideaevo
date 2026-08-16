import SwiftUI

struct ChatThreadView: View {
    let sessionID: String
    /// Active session — starts as the pushed session, replaced when the user switches
    /// agents from the thread header (creates a fresh session for the new agent).
    @State private var activeSessionID: String
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
    @State private var failedSend: FailedChatSend?
    @State private var rateLimitMessage: String?
    /// ardot S07b: holds the streaming Task so it can be cancelled from the Stop button.
    @State private var streamingTask: Task<Void, Never>?
    @State private var showAgentSwitcher = false

    private var isSheetZoomActive: Bool {
        showArchiveResult
    }

    init(sessionID: String, title: String) {
        self.sessionID = sessionID
        _activeSessionID = State(initialValue: sessionID)
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
                                        sessionID: activeSessionID,
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

                        if let failedSend {
                            ChatSendFailureRow(content: failedSend.content) {
                                retryFailedSend()
                            }
                        }

                        if let rateLimitMessage {
                            ChatRateLimitBanner(message: rateLimitMessage)
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
                isStreaming: streamingAssistantID != nil,
                onStop: { stopStreaming() }
            ) {
                Task { await send() }
            }
        }
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: isSheetZoomActive)
        // S07 toolbar (ardot `237:289` Thread Nav): solid white bar + solid grey back circle +
        // LEFT-aligned title + idea-context subtitle + trailing archive circle. This is NOT the
        // glass-overlay push bar used by settings — chat has its own distinct header per spec.
        .safeAreaInset(edge: .top, spacing: 0) {
            ChatThreadNavBar(
                title: title,
                subtitle: "AI Agent · 在线",
                agentID: session?.agentID ?? "",
                agentAvatarURL: session?.agent?.avatarLink,
                onBack: { dismiss() }
            ) {
                Button {
                    showAgentSwitcher = true
                } label: {
                    DeimosIconView(icon: .refresh, size: 16, color: AtlasColors.ink)
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(AtlasColors.surfaceSecondary))
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("切换 Agent")
            }
            .contextMenu {
                Button("封存对话") { Task { await archiveSession() } }
            }
        }
        .navigationBarHidden(true)
        .suppressTabBar()
        .sheet(isPresented: $showArchiveResult) {
            archiveResultSheet
        }
        .sheet(isPresented: $showAgentSwitcher) {
            ChatAgentPickerView(ideaID: nil, ideaTitle: nil) { agent in
                Task { await switchAgent(agent) }
            }
            .presentationDetents([.medium, .large])
        }
        .task { await loadMessages() }
        .navigationDestination(item: $ideaRoute) { route in
            IdeaDetailView(ideaID: route.id)
        }
    }

    /// ardot S07e (`351:96` Cold Start Empty): dark #1A2403 hero card (22pt Bold white title +
    /// 14pt lemon subtitle + lemon "开始聊天" CTA pill) above 3 starter prompt cards.
    /// Tapping a prompt fills the draft (doesn't auto-send) so the user can edit before sending.
    private var chatEmptyState: some View {
        VStack(alignment: .leading, spacing: 14) {
            // Dark hero card — agent identity surface, mirrors the AI Hero from the Chat List.
            VStack(alignment: .leading, spacing: 12) {
                Text("✦ 欢迎和 \(title) 对话")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                Text(contextIdea != nil
                     ? "基于当前 Idea 上下文，从下面的建议开始，或直接提问。"
                     : "登记想法、语义搜索、Fork 建议。从下面的建议开始，或直接提问。")
                    .font(.system(size: 14))
                    .foregroundStyle(AtlasColors.lemon)
                    .fixedSize(horizontal: false, vertical: true)
                Text("开始聊天")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(AtlasColors.lemonInk)
                    .padding(.horizontal, 20)
                    .frame(height: 40)
                    .background(Capsule().fill(AtlasColors.lemonStrong))
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(AtlasColors.lemonInk)
            )

            Text("建议从这里开始")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AtlasColors.inkSoft)
                .padding(.top, 4)

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
            let result = try await APIClient.shared.archiveSession(id: activeSessionID)
            archiveSummary = result.summary
            showArchiveResult = true
            ToastCenter.shared.showSuccess("已封存对话")
        } catch {
            ToastCenter.shared.showError("封存失败", message: error.localizedDescription)
        }
    }

    /// S03 Switch Agent — creates a fresh session with the picked agent and rebuilds
    /// the thread state in place (title, avatar, messages, stream target).
    private func switchAgent(_ agent: Agent) async {
        do {
            let fresh = try await APIClient.shared.createSession(agentID: agent.id, title: agent.name)
            activeSessionID = fresh.id
            title = agent.name
            session = fresh
            contextIdea = nil
            messages = []
            activityText = nil
            await loadMessages()
            ToastCenter.shared.showSuccess("已切换到 \(agent.name)")
        } catch {
            ToastCenter.shared.showError("切换失败", message: error.localizedDescription)
        }
    }

    private func loadMessages() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--deimos-chat-preview") {
            title = AppConfig.systemAssistantName
            let now = Date()
            messages = [
                ChatMessage(
                    id: "preview-assistant-1",
                    sessionID: activeSessionID,
                    role: "assistant",
                    content: "我已经读取了这个 Idea。你想先 Fork 成公寓版，还是补充储能模块？",
                    contentType: "markdown",
                    userFeedback: nil,
                    createdAt: now.addingTimeInterval(-180)
                ),
                ChatMessage(
                    id: "preview-user-1",
                    sessionID: activeSessionID,
                    role: "user",
                    content: "先 Fork 成公寓版。",
                    contentType: "text",
                    userFeedback: nil,
                    createdAt: now.addingTimeInterval(-120)
                ),
                ChatMessage(
                    id: "preview-assistant-2",
                    sessionID: activeSessionID,
                    role: "assistant",
                    content: "可以。我会保留峰谷电价调度，把设备范围收敛到公共照明、电梯与集中空调，并生成一个更轻量的执行清单。",
                    contentType: "markdown",
                    userFeedback: nil,
                    createdAt: now.addingTimeInterval(-60)
                ),
            ]
            activityText = "正在创建 Fork · 步骤 2/3"
            pendingFeedbackIDs = []
            if ProcessInfo.processInfo.arguments.contains("--deimos-chat-send-failed") {
                failedSend = FailedChatSend(content: "展开讲讲公寓版的节能策略")
                activityText = nil
            } else if ProcessInfo.processInfo.arguments.contains("--deimos-chat-rate-limit") {
                rateLimitMessage = "429 · 发送过于频繁，请 30 秒后再试"
                activityText = nil
            }
            return
        }
        #endif
        // Load messages first — the chat is unusable without them. Session detail (used for
        // the context banner + agent name) is best-effort enrichment, so a failure there
        // must never block the message list.
        do {
            messages = try await APIClient.shared.getMessages(sessionID: activeSessionID)
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
            if let fetched = try? await APIClient.shared.getSession(id: activeSessionID) {
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
        failedSend = nil
        rateLimitMessage = nil
        draft = ""
        let tempUser = ChatMessage(
            id: UUID().uuidString,
            sessionID: activeSessionID,
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
            sessionID: activeSessionID,
            role: "assistant",
            content: "",
            contentType: "markdown",
            userFeedback: nil,
            createdAt: Date()
        ))

        defer { isSending = false }

        // ardot S07b: wrap the streaming loop in a cancellable Task so the Stop button can end it.
        let task = Task {
            do {
                for try await event in streamService.stream(sessionID: activeSessionID, content: content, token: token) {
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
                        applySendFailure(
                            message: message,
                            content: content,
                            userMessageID: tempUser.id,
                            assistantMessageID: assistantID
                        )
                        ToastCenter.shared.showError("发送失败", message: message)
                    }
                }
                messages = try await APIClient.shared.getMessages(sessionID: activeSessionID)
                pendingFeedbackIDs = []
                streamingAssistantID = nil
            } catch is CancellationError {
                // User tapped Stop — keep whatever was streamed so far.
                activityText = nil
                streamingAssistantID = nil
            } catch {
                errorMessage = error.localizedDescription
                activityText = nil
                streamingAssistantID = nil
                applySendFailure(
                    message: error.localizedDescription,
                    content: content,
                    userMessageID: tempUser.id,
                    assistantMessageID: assistantID
                )
                ToastCenter.shared.showError("发送失败", message: error.localizedDescription)
            }
        }
        streamingTask = task
        await task.value
        streamingTask = nil
    }

    /// ardot S07b (`351:32` Stop Generation): cancel the in-flight streaming Task. The partial
    /// assistant content already streamed remains visible; we just stop appending more.
    private func stopStreaming() {
        streamingTask?.cancel()
        streamingTask = nil
        streamingAssistantID = nil
        activityText = nil
    }

    private func applySendFailure(
        message: String,
        content: String,
        userMessageID: String,
        assistantMessageID: String
    ) {
        messages.removeAll { $0.id == assistantMessageID }
        pendingFeedbackIDs.remove(assistantMessageID)

        let normalized = message.lowercased()
        if normalized.contains("429") || message.contains("频繁") || normalized.contains("rate limit") {
            rateLimitMessage = "429 · 发送过于频繁，请稍后再试"
        } else {
            messages.removeAll { $0.id == userMessageID }
            failedSend = FailedChatSend(content: content)
        }
    }

    private func retryFailedSend() {
        guard let failedSend else { return }
        draft = failedSend.content
        self.failedSend = nil
        Task { await send() }
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

private struct FailedChatSend {
    let content: String
}

/// Ardot S07d (`351:74`): failed user bubble with a red outline and an inline retry affordance.
private struct ChatSendFailureRow: View {
    let content: String
    let onRetry: () -> Void

    var body: some View {
        Button(action: onRetry) {
            VStack(alignment: .trailing, spacing: 6) {
                Text(content)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(AtlasColors.lemonInk)
                    .multilineTextAlignment(.leading)
                    .padding(.horizontal, 14)
                    .frame(minHeight: 46)
                    .background(AtlasColors.warningSoft)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .stroke(AtlasColors.destructiveFill, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))

                HStack(spacing: 5) {
                    DeimosIconView(icon: .refresh, size: 12, color: AtlasColors.destructiveFill)
                    Text("发送失败 · 点击重试")
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.destructiveFill)
                }
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .buttonStyle(.plain)
    }
}

/// Ardot S07R (`237:608`): rate-limit feedback remains in the conversation, not only in a Toast.
private struct ChatRateLimitBanner: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.system(size: 14))
            .foregroundStyle(AtlasColors.destructiveFill)
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: 52)
            .background(AtlasColors.warningSoft)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
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
            // ardot S07f (`351:129`): AI header is "Agent Name · HH:MM" — 12pt Semibold #0F1B2D.
            // Previously rendered only the name; the timestamp gives chronological context.
            if message.isAssistant, showsTextBubble || isStreaming || !ideaSuggestions.isEmpty {
                HStack(spacing: 6) {
                    Text(agentName)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text("· \(timestampText)")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                .padding(.leading, 2)
            }

            if isStreaming && message.content.isEmpty {
                // Typing indicator — three bouncing lemon dots inside the assistant bubble.
                // Background matches the real assistant bubble (#F5F6F7) per ardot S07.
                HStack(alignment: .top, spacing: 0) {
                    ChatTypingIndicator()
                        .background(AtlasColors.chatAssistantBubble)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    Spacer(minLength: 0)
                }
            } else if showsTextBubble {
                HStack(alignment: .top, spacing: 0) {
                    if message.isUser { Spacer(minLength: 0) }
                    // Bubble content — hug text width, cap at 260pt max.
                    // S03 (ardot 715405210175453 `2:5`): 13pt Regular on white assistant /
                    // lemonStrong user bubbles, r18, 12pt padding.
                    // Streaming appends a blinking cursor after text.
                    Group {
                        if message.isAssistant, message.contentType == "markdown" {
                            VStack(alignment: .leading, spacing: 0) {
                                MarkdownBody(markdown: message.content, textColor: AtlasColors.ink)
                                if isStreaming {
                                    ChatStreamingCursor()
                                        .padding(.top, 2)
                                }
                            }
                            .frame(maxWidth: 232, alignment: .leading)
                        } else {
                            (Text(message.content.plainSummary)
                                .font(.system(size: 13))
                                .foregroundStyle(message.isUser ? AtlasColors.lemonInk : AtlasColors.ink)
                            + Text(isStreaming ? "  " : ""))
                            .fixedSize(horizontal: false, vertical: true)
                            .overlay(alignment: message.isUser ? .trailing : .leading) {
                                if isStreaming {
                                    ChatStreamingCursor()
                                        .padding(.leading, message.isUser ? 0 : -2)
                                }
                            }
                        }
                    }
                    .frame(maxWidth: 260, alignment: message.isUser ? .trailing : .leading)
                    .fixedSize(horizontal: message.isUser, vertical: true)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 12)
                    .background(message.isUser ? AtlasColors.lemonChat : AtlasColors.chatAssistantBubble)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
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
            if message.isAssistant, (showsTextBubble || !ideaSuggestions.isEmpty), !isStreaming {
                actionBar
            } else if message.isUser, showsTextBubble, !isStreaming {
                Text(timestampText)
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkSoft)
                    .padding(.trailing, 2)
            }
        }
        .onAppear { feedback = message.userFeedback }
        .onChange(of: message.userFeedback) { _, newValue in
            feedback = newValue
        }
    }

    /// ardot S07a (`351:1` Action Row): pill-style message actions.
    /// - Like: 56×32 lemon (#F3FFC8) pill with icon + count when active; 32×32 bare icon when idle
    /// - Dislike: 32×32 bare icon, fills with lemon tint when active
    /// - Copy: 32×32 bare icon, turns to check when just-copied
    /// - Timestamp: right-aligned 11pt inkSoft
    /// Replaces the old bare-icon row — the pill treatment gives users clear feedback state.
    private var actionBar: some View {
        HStack(spacing: 4) {
            // Like — pill with count when active.
            likePill
                .accessibilityLabel("有帮助")

            // Dislike — bare circle icon, lemon tint when active.
            circleAction(
                icon: .close,
                active: feedback == "dislike",
                action: { Task { await toggleFeedback(rating: "dislike") } }
            )
            .accessibilityLabel("无帮助")

            // Copy — bare circle icon, shows check briefly after copy.
            circleAction(
                icon: copied ? .check : .document,
                active: copied,
                activeColor: AtlasColors.lemonStrong,
                iconColorActive: AtlasColors.lemonInk,
                action: { copyMessage() }
            )
            .accessibilityLabel(copied ? "已复制" : "复制")

            Spacer(minLength: 8)

            Text(timestampText)
                .font(.system(size: 11))
                .foregroundStyle(AtlasColors.inkSoft)
        }
        .padding(.horizontal, 2)
    }

    /// Like pill — 56×32 lemon pill (#F3FFC8) with icon + count when active; bare 32×32 icon idle.
    /// The count is the user's own feedback (1) since the model doesn't expose aggregate counts yet.
    private var likePill: some View {
        Button {
            Task { await toggleFeedback(rating: "like") }
        } label: {
            if feedback == "like" {
                // Active state — lemon pill with icon + "1".
                HStack(spacing: 4) {
                    DeimosIconView(icon: .check, size: 13, color: AtlasColors.lemonInk)
                    Text("1")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(AtlasColors.lemonInk)
                        .monospacedDigit()
                }
                .padding(.horizontal, 8)
                .frame(height: 32)
                .background(Capsule(style: .continuous).fill(AtlasColors.chatActivityFill))
            } else {
                // Idle state — bare icon.
                DeimosIconView(icon: .check, size: 13, color: AtlasColors.inkSoft)
                    .frame(width: 32, height: 32)
            }
        }
        .buttonStyle(.plain)
        // Smooth transition between idle bare icon and active pill.
        .animation(.easeInOut(duration: 0.18), value: feedback)
    }

    /// Bare circle action — 32×32 icon button, optional lemon tint background when active.
    private func circleAction(
        icon: DeimosIcon,
        active: Bool,
        activeColor: Color = AtlasColors.chatActivityFill,
        iconColorActive: Color = AtlasColors.lemonInk,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            DeimosIconView(icon: icon, size: 13, color: active ? iconColorActive : AtlasColors.inkSoft)
                .frame(width: 32, height: 32)
                .background(
                    Group {
                        if active {
                            Capsule().fill(activeColor)
                        } else {
                            Color.clear
                        }
                    }
                )
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.18), value: active)
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
