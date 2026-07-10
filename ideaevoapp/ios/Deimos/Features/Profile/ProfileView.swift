import SwiftUI

struct ProfileView: View {
    @Environment(AuthSession.self) private var session
    @State private var profile: UserProfileData?
    @State private var ideas: [Idea] = []
    @State private var unreadCount = 0
    @State private var showNotifications = false
    @State private var showSettings = false
    @State private var showMyAgents = false
    @State private var showPublishIdea = false
    @State private var showMyIdeas = false
    @State private var selectedRoute: IdeaRoute?
    @State private var followListRoute: FollowListRoute?

    var body: some View {
        Group {
            if let user = session.user {
                loggedInProfile(user)
            } else {
                LoginView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AtlasColors.canvas)
        .navigationBarHidden(session.user != nil)
        .navigationDestination(isPresented: $showNotifications) {
            NotificationsView()
        }
        .navigationDestination(isPresented: $showSettings) {
            SettingsView()
        }
        .navigationDestination(isPresented: $showMyAgents) {
            MyAgentsView()
        }
        .navigationDestination(isPresented: $showPublishIdea) {
            PublishIdeaView()
        }
        .navigationDestination(isPresented: $showMyIdeas) {
            if let userID = session.user?.id {
                UserProfileView(userID: userID)
            }
        }
        .navigationDestination(item: $selectedRoute) { route in
            IdeaDetailView(ideaID: route.id)
        }
        .navigationDestination(item: $followListRoute) { route in
            FollowersFollowingView(userID: route.userID, initialKind: route.kind)
        }
        .task(id: session.user?.id) {
            guard let userID = session.user?.id else { return }
            profile = try? await APIClient.shared.userProfile(id: userID)
            unreadCount = (try? await APIClient.shared.filteredUnreadNotificationCount()) ?? 0
            if let myIdeas = try? await APIClient.shared.getUserIdeas(userID: userID, limit: 3) {
                ideas = myIdeas
            }
        }
    }

    private func loggedInProfile(_ user: User) -> some View {
        VStack(spacing: 0) {
            AtlasTabScreenHeader(title: "我的") {
                Button { showSettings = true } label: {
                    AtlasToolbarFloatTextLabel(title: "设置")
                }
                .buttonStyle(.plain)
            }

            ScrollView {
            VStack(spacing: 20) {
                MyProfileFloatHero(
                    user: user,
                    profile: profile,
                    onPublish: { showPublishIdea = true },
                    onMyAgents: { showMyAgents = true },
                    onFollowers: {
                        followListRoute = FollowListRoute(userID: user.id, kind: .followers)
                    },
                    onFollowing: {
                        followListRoute = FollowListRoute(userID: user.id, kind: .following)
                    },
                    onMyIdeas: { showMyIdeas = true }
                )

                notificationsRow

                if !ideas.isEmpty {
                    ideasSection
                        .padding(.horizontal, AtlasMetrics.pageX)
                }
            }
            .padding(.bottom, 16)
            }
        }
    }

    private var notificationsRow: some View {
        Button { showNotifications = true } label: {
            CompactListCard(
                leading: {
                    ZStack(alignment: .topTrailing) {
                        DeimosIconView(icon: .bell, size: 18, color: AtlasColors.ink)
                            .frame(width: 40, height: 40)
                            .background(AtlasColors.entityUser.opacity(0.35))
                            .clipShape(Circle())
                        if unreadCount > 0 {
                            Text("\(min(unreadCount, 99))")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 2)
                                .background(AtlasColors.coral)
                                .clipShape(Capsule())
                                .offset(x: 4, y: -2)
                        }
                    }
                },
                title: "通知",
                subtitle: unreadCount > 0 ? "\(unreadCount) 条未读" : "查看互动与系统消息",
                trailing: {
                    DeimosIconView(icon: .chevronRight, size: 13, color: AtlasColors.inkFaint)
                }
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, AtlasMetrics.pageX)
    }

    private var ideasSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("我的想法")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)
                Spacer()
                Button("查看全部") { showMyIdeas = true }
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(AtlasColors.ink)
            }

            ForEach(ideas.prefix(3)) { idea in
                VStack(spacing: 0) {
                    Button {
                        selectedRoute = IdeaRoute(id: idea.id)
                    } label: {
                        IdeaFlatRow(idea: idea)
                    }
                    .buttonStyle(.plain)
                    FeedRowDivider()
                }
            }
        }
    }
}
