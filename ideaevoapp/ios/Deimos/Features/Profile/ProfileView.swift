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
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Header row — bell icon (right) + settings gear
                HStack {
                    Spacer()
                    bellButton
                    settingsButton
                }
                .padding(.horizontal, 20)
                .padding(.top, 4)

                // Compact profile header — avatar + name + bio + meta labels
                profileHeader(user)

                // Inline stat labels — small, no big card
                statLabels(user)

                // Quick actions — pill buttons
                HStack(spacing: 10) {
                    pillButton("发布想法", icon: "plus", isPrimary: true) { showPublishIdea = true }
                    pillButton("我的 Agent", icon: "sparkles", isPrimary: false) { showMyAgents = true }
                }
                .padding(.horizontal, 20)

                // Recent ideas — compact rows
                if !ideas.isEmpty {
                    ideasSection
                        .padding(.horizontal, 20)
                }
            }
            .padding(.bottom, AtlasMetrics.bottomClear)
        }
    }

    // MARK: - Bell button (top-right, with red dot)

    private var bellButton: some View {
        Button { showNotifications = true } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "bell")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(AtlasColors.ink)
                    .frame(width: 36, height: 36)
                    .background(AtlasColors.surfaceSecondary)
                    .clipShape(Circle())

                if unreadCount > 0 {
                    Circle()
                        .fill(AtlasColors.destructive)
                        .frame(width: 8, height: 8)
                        .offset(x: -2, y: 2)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var settingsButton: some View {
        Button { showSettings = true } label: {
            Image(systemName: "gearshape")
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(AtlasColors.ink)
                .frame(width: 36, height: 36)
                .background(AtlasColors.surfaceSecondary)
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Compact profile header

    /// Avatar (48px) + name label + bio label + meta labels — no big card wrapper.
    private func profileHeader(_ user: User) -> some View {
        HStack(alignment: .top, spacing: 12) {
            EntityAvatar.user(
                id: user.id,
                url: user.avatarLink,
                name: user.name,
                size: 48
            )

            VStack(alignment: .leading, spacing: 4) {
                Text(user.name)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)

                if let bio = user.bio, !bio.isEmpty {
                    Text(bio)
                        .font(.system(size: 13))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(2)
                }
            }
            .padding(.top, 2)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
    }

    // MARK: - Inline stat labels — small labels with icons, no big card

    private func statLabels(_ user: User) -> some View {
        HStack(spacing: 16) {
            statChip(icon: "square.grid.2x2", value: "\(profile?.ideaCount ?? 0)", label: "想法") {
                showMyIdeas = true
            }
            statChip(icon: "person.2", value: "\(user.followerCount)", label: "粉丝") {
                followListRoute = FollowListRoute(userID: user.id, kind: .followers)
            }
            statChip(icon: "person.crop.circle.badge.plus", value: "\(user.followingCount)", label: "关注") {
                followListRoute = FollowListRoute(userID: user.id, kind: .following)
            }
            Spacer()
        }
        .padding(.horizontal, 20)
    }

    /// Small stat chip — 14×14 icon + value 15pt Bold + label 12pt, all inline.
    private func statChip(icon: String, value: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.olive)
                Text(value)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)
                    .monospacedDigit()
                Text(label)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(AtlasColors.inkSoft)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Pill button

    private func pillButton(_ title: String, icon: String, isPrimary: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .semibold))
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(isPrimary ? AtlasColors.lemonInk : AtlasColors.ink)
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(isPrimary ? AtlasColors.lemonStrong : AtlasColors.surface)
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(AtlasColors.border, lineWidth: isPrimary ? 0 : 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(AtlasPressableStyle())
    }

    // MARK: - Ideas section

    private var ideasSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("我的想法")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)
                Spacer()
                Button("全部") { showMyIdeas = true }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(AtlasColors.olive)
            }

            ForEach(ideas.prefix(3)) { idea in
                Button {
                    selectedRoute = IdeaRoute(id: idea.id)
                } label: {
                    HStack(spacing: 10) {
                        EntityAvatar.idea(id: idea.id, url: idea.iconLink, name: idea.displaySlug, size: 36)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(idea.displayTitle)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(AtlasColors.ink)
                                .lineLimit(1)
                            Text(idea.feedSummaryText ?? "")
                                .font(.system(size: 13))
                                .foregroundStyle(AtlasColors.inkSoft)
                                .lineLimit(1)
                        }
                        Spacer()
                        Text(idea.createdAt.relativeShort)
                            .font(.system(size: 12))
                            .foregroundStyle(AtlasColors.inkFaint)
                    }
                    .padding(14)
                    .background(AtlasColors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(AtlasColors.border, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }
}
