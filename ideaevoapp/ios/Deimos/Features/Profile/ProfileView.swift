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
            // v6 large title header
            HStack(alignment: .center) {
                Text("我的工作台")
                    .font(AtlasTypography.largeTitle())
                    .foregroundStyle(AtlasColors.ink)

                Spacer()

                Button { showSettings = true } label: {
                    Image(systemName: "gearshape")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(AtlasColors.ink)
                        .frame(width: 40, height: 40)
                        .background(AtlasColors.surfaceSecondary)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.top, 8)
            .padding(.bottom, 16)

            ScrollView {
            VStack(spacing: 16) {
                // v6 Owner Dashboard Card (Ardot 149:391)
                OwnerDashboardCard(
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
                .padding(.horizontal, AtlasMetrics.pageX)

                notificationsRow

                if !ideas.isEmpty {
                    ideasSection
                        .padding(.horizontal, AtlasMetrics.pageX)
                }
            }
            .padding(.bottom, AtlasMetrics.bottomClear)
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
                Text("待处理事项")
                    .font(AtlasTypography.sectionHeader())
                    .foregroundStyle(AtlasColors.ink)
                Spacer()
                Button("全部") { showMyIdeas = true }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AtlasColors.primary)
            }

            ForEach(ideas.prefix(3)) { idea in
                Button {
                    selectedRoute = IdeaRoute(id: idea.id)
                } label: {
                    CompactListCard(
                        leading: {
                            EntityAvatar.idea(id: idea.id, url: idea.iconLink, name: idea.displaySlug, size: 40)
                        },
                        title: idea.displayTitle,
                        subtitle: idea.feedSummaryText,
                        timestamp: idea.createdAt.relativeShort,
                        showsBorder: true,
                        layoutStyle: .card
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - v6 Owner Dashboard Card (Ardot 149:391)

/// v6 Owner Dashboard Card — flat profile card replacing the v5 MyProfileFloatHero.
/// Spec: 345×~250, r24, #EDEFF3 border, shadow rgba(15,27,45,0.05).
/// Contains: avatar-row (72px avatar + name + handle) → bio → divider → SPACE_EVENLY stats.
struct OwnerDashboardCard: View {
    let user: User
    let profile: UserProfileData?
    let onPublish: () -> Void
    let onMyAgents: () -> Void
    let onFollowers: () -> Void
    let onFollowing: () -> Void
    let onMyIdeas: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Avatar row
            HStack(spacing: 14) {
                EntityAvatar.user(
                    id: user.id,
                    url: user.avatarLink,
                    name: user.name,
                    size: 72
                )

                VStack(alignment: .leading, spacing: 4) {
                    Text(user.name)
                        .font(AtlasTypography.titleMedium())
                        .foregroundStyle(AtlasColors.ink)
                        .lineLimit(2)

                    if let bio = user.bio, !bio.isEmpty {
                        Text(bio)
                            .font(.system(size: 14))
                            .foregroundStyle(AtlasColors.inkSoft)
                            .lineLimit(2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            // Bio line (v6 spec: dashboard description)
            Text("管理你的想法、Agent 和收到的互动；继续推进还没完成的创作。")
                .font(AtlasTypography.feedBody())
                .foregroundStyle(AtlasColors.ink)
                .fixedSize(horizontal: false, vertical: true)

            // Divider
            Rectangle()
                .fill(Color(hex: 0xF0F2F5))
                .frame(height: 1)

            // Stats — SPACE_EVENLY (v6 spec: equal gutters including outer edges)
            HStack(spacing: 0) {
                Spacer(minLength: 0)
                statButton(value: "\(profile?.ideaCount ?? 0)", label: "想法", action: onMyIdeas)
                Spacer(minLength: 0)
                statButton(value: "\(user.followerCount)", label: "粉丝", action: onFollowers)
                Spacer(minLength: 0)
                statButton(value: "\(user.followingCount)", label: "关注", action: onFollowing)
                Spacer(minLength: 0)
            }

            // Quick actions (v6 spec: quick-actions row)
            HStack(spacing: 10) {
                quickActionButton("发布想法", icon: "plus", isPrimary: true, action: onPublish)
                quickActionButton("我的 Agent", icon: "sparkles", isPrimary: false, action: onMyAgents)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCover, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCover, style: .continuous)
                .stroke(AtlasColors.borderProfile, lineWidth: 1)
        )
        .atlasProfileCard()
    }

    private func statButton(value: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Text(value)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)
                    .monospacedDigit()
                Text(label)
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.inkSoft)
            }
        }
        .buttonStyle(.plain)
    }

    private func quickActionButton(_ title: String, icon: String, isPrimary: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                Text(title)
                    .font(AtlasTypography.mobileSubheadline())
            }
            .foregroundStyle(isPrimary ? Color.white : AtlasColors.ink)
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(isPrimary ? AtlasColors.primaryAction : AtlasColors.surface)
            .overlay(
                Capsule()
                    .stroke(AtlasColors.border, lineWidth: isPrimary ? 0 : 1)
            )
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}
