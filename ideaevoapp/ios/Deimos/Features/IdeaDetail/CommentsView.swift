import SwiftUI
import Observation

@MainActor
@Observable
final class CommentsViewModel {
    var comments: [FlatComment] = []
    var isLoading = false
    var isSending = false
    var errorMessage: String?

    func load(ideaID: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let raw = try await APIClient.shared.getComments(ideaID: ideaID)
            comments = CommentFlattener.flatten(raw)
        } catch {
            errorMessage = error.localizedDescription
            comments = []
        }
    }

    func send(ideaID: String, content: String, parentID: String? = nil) async -> Bool {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        isSending = true
        defer { isSending = false }
        do {
            _ = try await APIClient.shared.createComment(ideaID: ideaID, content: trimmed, parentID: parentID)
            await load(ideaID: ideaID)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}

struct CommentsView: View {
    let ideaID: String
    let ideaTitle: String
    let commentCount: Int
    var iconURL: String?
    var agentName: String?

    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session
    @State private var viewModel = CommentsViewModel()
    @State private var draft = ""
    @State private var showAuthSheet = false
    @State private var replyingTo: FlatComment?
    @FocusState private var composerFocused: Bool

    private var contextSlug: String {
        let trimmed = ideaTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.count <= 28 { return trimmed }
        return String(trimmed.prefix(28)) + "…"
    }

    private var contextSubtitle: String {
        if let agentName, !agentName.isEmpty {
            return agentName
        }
        return "Idea 讨论"
    }

    var body: some View {
        VStack(spacing: 0) {
            content

            if session.isAuthenticated {
                composer
            } else {
                loginPrompt
            }
        }
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: showAuthSheet)
        .navigationBarHidden(true)
        .suppressTabBar()
        .sheet(isPresented: $showAuthSheet) {
            AuthRequiredSheet().presentationDetents([.height(260)])
        }
        .task { await viewModel.load(ideaID: ideaID) }
    }

    private var loginPrompt: some View {
        Button("登录后评论") { showAuthSheet = true }
            .font(AtlasTypography.button())
            .foregroundStyle(AtlasColors.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(AtlasColors.surface)
            .overlay(alignment: .top) { Rectangle().fill(AtlasColors.rule).frame(height: 0.5) }
    }

    /// Ardot S05 (`237:288`): full-width 82pt input bar, 286×44 field and 52pt send button.
    private var composer: some View {
        VStack(spacing: 0) {
            if let replyingTo {
                HStack {
                    Text("回复 \(replyingTo.comment.displayName)")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AtlasColors.olive)
                    Spacer()
                    Button("取消") { self.replyingTo = nil }
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkFaint)
                }
                .padding(.horizontal, AtlasMetrics.detailX)
                .padding(.bottom, 6)
            }
            HStack(spacing: 10) {
                AtlasMultilineTextField(
                    placeholder: replyingTo == nil ? "写下你的评论…" : "写下回复…",
                    text: $draft,
                    minHeight: 44,
                    maxHeight: 44,
                    fontSize: 13,
                    onSubmit: { Task { await submitComment() } }
                )
                .focused($composerFocused)
                .frame(height: 44)
                .padding(.horizontal, 16)
                .background(AtlasColors.bgInput)
                .clipShape(Capsule(style: .continuous))

                Button {
                    Task { await submitComment() }
                } label: {
                    DeimosIconView(icon: .send, size: 18, color: AtlasColors.lemonInk)
                        .frame(width: 44, height: 44)
                        .background(canSend ? AtlasColors.lemonStrong : AtlasColors.inkDisabled)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(!canSend)
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 18)
            .background(AtlasColors.surface)
            .overlay(alignment: .top) {
                Rectangle().fill(AtlasColors.rule).frame(height: 0.5)
            }
        }
    }

    private var canSend: Bool {
        !viewModel.isSending && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.comments.isEmpty {
            Spacer()
            ProgressView()
            Spacer()
        } else {
            ScrollView {
                LazyVStack(spacing: 14) {
                    // S08 Nav Bar (ardot 715405210175453 `2:497`) — inline, scrolls with content.
                    AtlasSubPageNavBar(
                        title: commentCount > 0 ? "评论 \(commentCount)" : "评论",
                        onBack: { dismiss() }
                    )

                    ideaContextCard

                    if viewModel.comments.isEmpty {
                        AtlasDesignedEmptyStates.commentsEmpty {
                            if session.isAuthenticated {
                                composerFocused = true
                            } else {
                                showAuthSheet = true
                            }
                        }
                            .padding(.top, 24)
                    } else {
                        ForEach(viewModel.comments) { item in
                            commentCard(item)
                        }
                    }
                }
                .padding(.horizontal, AtlasMetrics.detailX)
                .padding(.top, 8)
                .padding(.bottom, 16)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    // MARK: - S08 Context Card (surfaceSecondary r14, 40pt thumb)

    private var ideaContextCard: some View {
        HStack(spacing: 10) {
            EntityAvatar.idea(
                id: ideaID,
                url: iconURL.flatMap(URL.init(string:)),
                name: ideaTitle,
                size: 40
            )
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text(ideaTitle)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)
                Text(contextSubtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkSoft)
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(AtlasColors.settingsGroupFill)
        )
    }

    // MARK: - S05 Comment stream

    /// S08 comment row (ardot 715405210175453 `2:497`): 30pt avatar, name · time in one
    /// 12 SemiBold ink line, 13 Regular inkTertiary body (lh 20), 11 Medium inkSoft actions.
    /// Nested replies indent 40pt with a 26pt avatar.
    private func commentCard(_ item: FlatComment) -> some View {
        let isAgent = item.comment.authorType == "agent"
        let isNested = item.depth > 0
        return HStack(alignment: .top, spacing: isNested ? 8 : 10) {
            commentAvatar(item.comment, size: isNested ? 26 : 30)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(item.comment.displayName)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    if isAgent {
                        Text("Agent")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(AtlasColors.olive)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(AtlasColors.lemonSoft)
                            )
                    }
                    Text(item.comment.createdAt.relativeShort)
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkFaint)
                }

                if let replyTo = item.replyTo, !isNested {
                    Text("回复 \(replyTo.displayName)")
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkFaint)
                }

                Text(item.comment.content)
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.inkTertiary)
                    .lineSpacing(7)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 14) {
                    Button("回复") { replyingTo = item }
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(AtlasColors.inkSoft)
                    if let label = item.comment.sentimentLabel {
                        Text(label)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(AtlasColors.inkSoft)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 8)
        .padding(.leading, isNested ? 40 : 0)
    }

    @ViewBuilder
    private func commentAvatar(_ comment: WanyeComment, size: CGFloat) -> some View {
        if comment.authorType == "agent" {
            EntityAvatar.agent(
                id: comment.userID,
                url: comment.avatarLink,
                name: comment.displayName,
                size: size
            )
        } else {
            EntityAvatar.user(
                id: comment.userID,
                url: comment.avatarLink,
                name: comment.displayName,
                size: size
            )
        }
    }

    private func submitComment() async {
        let parentID = replyingTo?.comment.id
        Haptics.light()
        if await viewModel.send(ideaID: ideaID, content: draft, parentID: parentID) {
            Haptics.success()
            draft = ""
            replyingTo = nil
        }
    }
}

struct CommentsRoute: Identifiable, Hashable {
    let id: String
    let title: String
    let commentCount: Int
    var iconURL: String?
    var agentName: String?
}
