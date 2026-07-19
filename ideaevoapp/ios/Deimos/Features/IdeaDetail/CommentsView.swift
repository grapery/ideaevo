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
            AtlasPushNavBar(title: commentCount > 0 ? "评论 · \(commentCount)" : "评论", onBack: { dismiss() })

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

    /// S05 Comment input bar — #F4F5F8 bg r28, 56h, send button 40h r20 lemonStrong (Ardot 179:272).
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
            HStack(spacing: 8) {
                AtlasMultilineTextField(
                    placeholder: replyingTo == nil ? "写下评论或给 Agent 一个建议" : "写下回复…",
                    text: $draft,
                    minHeight: 40,
                    maxHeight: 100,
                    onSubmit: { Task { await submitComment() } }
                )
                .padding(.horizontal, 14)
                .padding(.vertical, 4)

                Button {
                    Task { await submitComment() }
                } label: {
                    DeimosIconView(icon: .send, size: 18, color: canSend ? AtlasColors.lemonInk : AtlasColors.inkFaint)
                        .frame(width: 40, height: 40)
                        .background(canSend ? AtlasColors.lemonStrong : AtlasColors.inkDisabled)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(!canSend)
            }
            .padding(8)
            .background(AtlasColors.surfaceSecondary)
            .overlay(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .stroke(AtlasColors.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.bottom, 8)
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
                LazyVStack(spacing: 0) {
                    // S05 Idea context card — lemon-soft bg r20 (Ardot 179:255)
                    ideaContextCard
                        .padding(.top, 4)

                    if viewModel.comments.isEmpty {
                        AtlasDesignedEmptyStates.commentsEmpty()
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

    // MARK: - S05 Idea context card (lemon-soft, r20)

    private var ideaContextCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(ideaTitle)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
                .lineLimit(1)
            Text("\(commentCount) 条评论")
                .font(.system(size: 12))
                .foregroundStyle(AtlasColors.inkTertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(AtlasColors.lemonSoft)
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    // MARK: - S05 Comment stream

    /// The discussion view is a continuous reading flow. Cards would make short comments feel too heavy.
    private func commentCard(_ item: FlatComment) -> some View {
        let isAgent = item.comment.authorType == "agent"
        return HStack(alignment: .top, spacing: 12) {
            commentAvatar(item.comment)

            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 5) {
                    Text(item.comment.displayName)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    if isAgent {
                        Text("Agent")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(AtlasColors.lemonInk)
                    }
                    Text("· \(item.comment.createdAt.relativeShort)")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkTertiary)
                }

                if let replyTo = item.replyTo {
                    Text("回复 \(replyTo.displayName)")
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkFaint)
                }

                Text(item.comment.content)
                    .font(.system(size: 14))
                    .foregroundStyle(AtlasColors.ink)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 12) {
                    Button("回复") { replyingTo = item }
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AtlasColors.olive)
                    if let label = item.comment.sentimentLabel {
                        Text(label)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(AtlasColors.olive)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 16)
        .overlay(alignment: .bottom) {
            Rectangle().fill(AtlasColors.rule).frame(height: 0.5)
        }
        .padding(.leading, item.depth > 0 ? CGFloat(item.depth * 20) : 0)
    }

    @ViewBuilder
    private func commentAvatar(_ comment: WanyeComment) -> some View {
        if comment.authorType == "agent" {
            EntityAvatar.agent(
                id: comment.userID,
                url: comment.avatarLink,
                name: comment.displayName,
                size: 32
            )
        } else {
            EntityAvatar.user(
                id: comment.userID,
                url: comment.avatarLink,
                name: comment.displayName,
                size: 32
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
