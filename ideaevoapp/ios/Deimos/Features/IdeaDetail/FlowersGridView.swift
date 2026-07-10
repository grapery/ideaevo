import SwiftUI
import Observation

@MainActor
@Observable
final class FlowersGridViewModel {
    var idea: Idea?
    var donors: [FlowerDonor] = []
    var isLoading = true
    var errorMessage: String?
    var actionMessage: String?

    func load(ideaID: String, isAuthenticated: Bool) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let ideaTask = APIClient.shared.getIdea(id: ideaID)
            async let flowersTask = APIClient.shared.getFlowers(ideaID: ideaID)
            idea = try await ideaTask
            donors = try await flowersTask
            _ = isAuthenticated
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func sendFlower(isAuthenticated: Bool) async -> Bool {
        guard isAuthenticated else { return false }
        guard let id = idea?.id else { return false }
        do {
            try await APIClient.shared.sendFlower(ideaID: id)
            donors = try await APIClient.shared.getFlowers(ideaID: id)
            if let updated = try? await APIClient.shared.getIdea(id: id) {
                idea = updated
            }
            actionMessage = "已送出鲜花"
            return true
        } catch {
            actionMessage = error.localizedDescription
            return true
        }
    }
}

struct FlowersRoute: Identifiable, Hashable {
    let id: String
    let title: String
    let flowerCount: Int
    var iconURL: String?
    var agentName: String?
    var description: String?

    init(idea: Idea) {
        id = idea.id
        title = idea.displaySlug
        flowerCount = idea.flowerCount
        iconURL = idea.iconURL
        agentName = idea.agent?.name
        description = idea.flowersContextSubtitle
    }
}

struct FlowersGridView: View {
    let ideaID: String
    var initialFlowerCount: Int = 0

    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session
    @State private var viewModel = FlowersGridViewModel()
    @State private var showAuthSheet = false
    @State private var showShareSheet = false
    @State private var sharePayload = ""
    @State private var commentsRoute: CommentsRoute?
    @State private var showForkSheet = false

    private var flowerCount: Int {
        viewModel.idea?.flowerCount ?? initialFlowerCount
    }

    private var isSheetZoomActive: Bool {
        showAuthSheet || showShareSheet
    }

    var body: some View {
        VStack(spacing: 0) {
            AtlasPushNavBar(title: "收到的花", onBack: { dismiss() }) {
                if viewModel.idea != nil {
                    AtlasToolbarFloatTextButton(title: "分享") {
                        if let idea = viewModel.idea {
                            sharePayload = "\(idea.title)\n\(ideaShareURL(idea.id))"
                            showShareSheet = true
                        }
                    }
                }
            }

            content
        }
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: isSheetZoomActive)
        .navigationBarHidden(true)
        .suppressTabBar()
        .safeAreaInset(edge: .bottom) {
            if let idea = viewModel.idea {
                EngagementBar(
                    likeCount: idea.likeCount,
                    flowerCount: idea.flowerCount,
                    forkCount: idea.forkCount,
                    commentCount: idea.commentCount,
                    highlightFlowers: true,
                    onFlower: { Task { await handleSendFlower() } },
                    onComment: { openComments(idea) }
                )
            }
        }
        .sheet(isPresented: $showAuthSheet) {
            AuthRequiredSheet().presentationDetents([.height(260)])
        }
        .sheet(isPresented: $showShareSheet) {
            ShareSheet(items: [sharePayload])
        }
        .navigationDestination(item: $commentsRoute) { route in
            CommentsView(
                ideaID: route.id,
                ideaTitle: route.title,
                commentCount: route.commentCount,
                iconURL: route.iconURL,
                agentName: route.agentName
            )
        }
        .task(id: ideaID) {
            await viewModel.load(ideaID: ideaID, isAuthenticated: session.isAuthenticated)
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.idea == nil {
            Spacer()
            ProgressView()
            Spacer()
        } else if let errorMessage = viewModel.errorMessage, viewModel.idea == nil {
            AtlasDesignedEmptyStates.loadFailed(message: errorMessage) {
                Task { await viewModel.load(ideaID: ideaID, isAuthenticated: session.isAuthenticated) }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let idea = viewModel.idea {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    IdeaContextBar(
                        slug: idea.displaySlug,
                        subtitle: idea.flowersContextSubtitle,
                        iconURL: idea.iconLink,
                        ideaID: idea.id
                    )

                    summarySection

                    if !viewModel.donors.isEmpty {
                        donorListSection
                    }

                    AtlasOutlineButton(title: "送一朵花") {
                        Task { await handleSendFlower() }
                    }
                }
                .padding(.horizontal, AtlasMetrics.pageX)
                .padding(.vertical, AtlasMetrics.sectionGap)
                .padding(.bottom, 16)
            }
        }
    }

    private var summarySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                DeimosIconView(icon: .flower, size: 18, color: AtlasColors.accentFork)
                Text("共收到 \(flowerCount) 朵花")
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)
            }

            if viewModel.donors.isEmpty {
                Text("还没有人送花，成为第一个吧")
                    .font(AtlasTypography.mobileSubheadline())
                    .foregroundStyle(AtlasColors.inkFaint)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: -10) {
                        ForEach(viewModel.donors.prefix(12)) { donor in
                            donorAvatar(donor, size: 40)
                                .overlay(Circle().stroke(AtlasColors.canvas, lineWidth: 2))
                        }
                    }
                    .padding(.trailing, AtlasMetrics.pageX * 0.15)
                }
            }
        }
        .padding(AtlasMetrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }

    private var donorListSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("送花者")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)

            ForEach(Array(viewModel.donors.enumerated()), id: \.element.id) { index, donor in
                FlowerContributorRow(donor: donor)
                if index < viewModel.donors.count - 1 {
                    Rectangle()
                        .fill(AtlasColors.rule)
                        .frame(height: 1)
                }
            }
        }
    }

    @ViewBuilder
    private func donorAvatar(_ donor: FlowerDonor, size: CGFloat) -> some View {
        if donor.isAgent, let agentID = donor.agentID {
            EntityAvatar.agent(id: agentID, url: donor.avatarLink, name: donor.name, size: size)
        } else {
            EntityAvatar.user(
                id: donor.userID ?? donor.id,
                url: donor.avatarLink,
                name: donor.name,
                size: size
            )
        }
    }

    private func handleSendFlower() async {
        guard session.isAuthenticated else {
            showAuthSheet = true
            return
        }
        _ = await viewModel.sendFlower(isAuthenticated: true)
    }

    private func openComments(_ idea: Idea) {
        commentsRoute = CommentsRoute(
            id: idea.id,
            title: idea.title,
            commentCount: idea.commentCount,
            iconURL: idea.iconURL,
            agentName: idea.agent?.name
        )
    }
}

private func ideaShareURL(_ ideaID: String) -> String {
    "deimos://ideas/\(ideaID)"
}
