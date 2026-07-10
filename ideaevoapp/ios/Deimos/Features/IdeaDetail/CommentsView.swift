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
            AtlasPushNavBar(title: navTitle, onBack: { dismiss() })

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

    private var navTitle: String {
        commentCount > 0 ? "评论 · \(commentCount)" : "评论"
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

    private var composer: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let replyingTo {
                HStack {
                    Text("回复 \(replyingTo.comment.displayName)")
                        .font(.system(size: 13))
                        .foregroundStyle(AtlasColors.accentActive)
                    Spacer()
                    Button("取消") { self.replyingTo = nil }
                        .font(.system(size: 13))
                        .foregroundStyle(AtlasColors.inkFaint)
                }
                .padding(.horizontal, AtlasMetrics.pageX)
            }
            BottomInputBar(
                text: $draft,
                placeholder: replyingTo == nil ? "写下你的想法…" : "写下回复…",
                isSending: viewModel.isSending,
                canSend: canSend,
                onSend: { Task { await submitComment() } }
            )
        }
        .padding(.bottom, 0)
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
        } else if viewModel.comments.isEmpty {
            VStack(spacing: 16) {
                IdeaContextBar(
                    slug: contextSlug,
                    subtitle: contextSubtitle,
                    iconURL: AvatarDefaults.url(kind: .idea, id: ideaID, raw: iconURL),
                    ideaID: ideaID
                )
                .padding(.horizontal, AtlasMetrics.pageX)
                .padding(.top, AtlasMetrics.sectionGap)

                AtlasDesignedEmptyStates.commentsEmpty()
                if session.isAuthenticated {
                    Text("在下方输入框写下第一条评论")
                        .font(AtlasTypography.mobileSubheadline())
                        .foregroundStyle(AtlasColors.inkFaint)
                }
            }
            .frame(maxHeight: .infinity)
        } else {
            ScrollView {
                LazyVStack(spacing: 0) {
                    IdeaContextBar(
                        slug: contextSlug,
                        subtitle: contextSubtitle,
                        iconURL: AvatarDefaults.url(kind: .idea, id: ideaID, raw: iconURL),
                        ideaID: ideaID
                    )
                    .padding(.horizontal, AtlasMetrics.pageX)
                    .padding(.vertical, 12)
                    FeedRowDivider()

                    ForEach(Array(viewModel.comments.enumerated()), id: \.element.comment.id) { index, item in
                        VStack(spacing: 0) {
                            commentCell(item)
                            FeedRowDivider()
                        }
                    }
                }
                .padding(.vertical, 0)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private func commentCell(_ item: FlatComment) -> some View {
        let isAgent = item.comment.authorType == "agent"
        return HStack(alignment: .top, spacing: 10) {
            commentAvatar(item.comment)
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(item.comment.displayName)
                        .font(AtlasTypography.feedName())
                        .foregroundStyle(AtlasColors.ink)
                    if isAgent {
                        Text("Agent")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(AtlasColors.aiStart)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(AtlasColors.purpleSoft)
                            .clipShape(Capsule())
                    }
                    Text(item.comment.createdAt.relativeShort)
                        .font(AtlasTypography.feedBody())
                        .foregroundStyle(AtlasColors.inkSoft)
                    if let label = item.comment.sentimentLabel {
                        Text(label)
                            .font(.system(size: 10))
                            .foregroundStyle(AtlasColors.primary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(AtlasColors.chipSelectedBg)
                            .clipShape(Capsule())
                    }
                }
                if let replyTo = item.replyTo {
                    Text("回复 \(replyTo.displayName)")
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkFaint)
                }
                Text(item.comment.content)
                    .font(AtlasTypography.feedBody())
                    .foregroundStyle(AtlasColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if item.depth == 0 {
                    Button("回复") { replyingTo = item }
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AtlasColors.primary)
                }
            }
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.leading, item.depth > 0 ? CGFloat(item.depth * 24) : 0)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
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
        if await viewModel.send(ideaID: ideaID, content: draft, parentID: parentID) {
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
