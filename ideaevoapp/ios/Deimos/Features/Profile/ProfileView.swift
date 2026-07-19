import SwiftUI

struct ProfileView: View {
    @Environment(AuthSession.self) private var session
    @State private var profile: UserProfileData?
    @State private var ideas: [Idea] = []
    @State private var unreadCount = 0
    @State private var showNotifications = false
    @State private var showMyAgents = false
    @State private var showPublishIdea = false
    @State private var showMyIdeas = false
    @State private var showSettings = false
    @State private var selectedRoute: IdeaRoute?

    /// Set true when a guest (logged-out) user taps the login affordance on the Profile tab.
    /// AuthRequiredSheet pushes the full-screen LoginView.
    @State private var showAuthSheet = false

    var body: some View {
        Group {
            if let user = session.user {
                loggedInProfile(user)
            } else {
                // Guest browsing (S02G): the Profile tab is a lightweight gate, not an inline
                // LoginView. The full-screen auth flow lives in RootView; here we just invite the
                // guest to sign in via AuthRequiredSheet so the tab bar stays consistent.
                guestProfileGate
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .sheet(isPresented: $showAuthSheet) {
            AuthRequiredSheet()
                .atlasBottomSheetStyle()
        }
        .navigationDestination(isPresented: $showNotifications) {
            NotificationsView()
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
        .navigationDestination(isPresented: $showSettings) {
            SettingsView()
        }
        .navigationDestination(item: $selectedRoute) { route in
            IdeaDetailView(ideaID: route.id)
        }
        .task(id: session.user?.id) {
            guard let userID = session.user?.id else { return }
            profile = try? await APIClient.shared.userProfile(id: userID)
            unreadCount = (try? await APIClient.shared.filteredUnreadNotificationCount()) ?? 0
            if let myIdeas = try? await APIClient.shared.getUserIdeas(userID: userID, limit: 3) {
                ideas = myIdeas
            }
        }
        #if DEBUG
        // Verify-only launch hook: pass `--deimos-goto-settings` to deep-link straight to the
        // Settings screen for visual review against the ardot S11 design spec.
        // `--deimos-goto-notifications` deep-links to the Notifications list.
        .onAppear {
            if ProcessInfo.processInfo.arguments.contains("--deimos-goto-settings") {
                showSettings = true
            } else if ProcessInfo.processInfo.arguments.contains("--deimos-goto-notifications") {
                showNotifications = true
            }
        }
        #endif
    }

    /// Lightweight guest gate shown when a logged-out user opens the Profile tab while browsing.
    /// Not a full login form — tapping the CTA opens `AuthRequiredSheet`, which in turn pushes
    /// the full-screen `LoginView` from the RootView auth gate.
    private var guestProfileGate: some View {
        VStack(spacing: 16) {
            Spacer()
            DeimosIconView(icon: .profile, size: 56, color: AtlasColors.inkSoft)
                .frame(width: 88, height: 88)
                .background(AtlasColors.surfaceSecondary, in: Circle())
            Text("登录后查看个人主页")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
            Text("送花、评论、Fork、关注与对话都需要登录 Deimos 账号。")
                .font(AtlasTypography.bodyMedium())
                .foregroundStyle(AtlasColors.inkSoft)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button {
                showAuthSheet = true
            } label: {
                Text("登录 / 注册")
                    .font(AtlasTypography.button())
                    .foregroundStyle(AtlasColors.lemonInk)
                    .frame(maxWidth: .infinity)
                    .frame(height: AtlasMetrics.primaryButtonHeight)
                    .background(AtlasColors.primaryAction)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .padding(.horizontal, AtlasMetrics.pageX)
            Spacer()
        }
        .padding(.vertical, 32)
    }

    private func loggedInProfile(_ user: User) -> some View {
        VStack(spacing: 0) {
            // S35 Top Actions · Floating Glass (ardot 210:4): right-aligned Bell + Settings gear,
            // NO large title — the profile header (avatar + name) below is the identity.
            // primaryAxisAlignItems: MAX, itemSpacing 10.
            HStack(spacing: 10) {
                Spacer()
                Button { showNotifications = true } label: {
                    ZStack(alignment: .topTrailing) {
                        DeimosIconView(icon: .bell, size: 18, color: AtlasColors.ink)
                            .frame(width: 44, height: 44)
                            .atlasToolbarFloat()
                        if unreadCount > 0 {
                            Circle()
                                .fill(AtlasColors.destructive)
                                .frame(width: 8, height: 8)
                                .offset(x: 4, y: -2)
                        }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(unreadCount > 0 ? "通知, \(unreadCount) 条未读" : "通知")

                Button { showSettings = true } label: {
                    DeimosIconView(icon: .gear, size: 18, color: AtlasColors.ink)
                        .frame(width: 44, height: 44)
                        .atlasToolbarFloat()
                }
                .buttonStyle(.plain)
                .accessibilityLabel("设置")
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.top, 8)
            .padding(.bottom, 16)

            ScrollView {
            VStack(spacing: 16) {
                // S09 deliberately separates identity, stats, and actions so each
                // action remains scannable instead of reading as one dashboard card.
                OwnerIdentityCard(
                    user: user,
                    profile: profile
                )
                .padding(.horizontal, AtlasMetrics.pageX)

                OwnerStatsBand(
                    ideaCount: profile?.ideaCount ?? 0,
                    followerCount: user.followerCount,
                    followingCount: user.followingCount,
                    onMyIdeas: { showMyIdeas = true }
                )
                .padding(.horizontal, AtlasMetrics.pageX)

                OwnerActionBar(
                    onPublish: { showPublishIdea = true },
                    onMyAgents: { showMyAgents = true }
                )
                .padding(.horizontal, AtlasMetrics.pageX)

                if !ideas.isEmpty {
                    ideasSection
                        .padding(.horizontal, AtlasMetrics.pageX)
                }
            }
            .padding(.bottom, AtlasMetrics.bottomClear)
            }
        }
    }

    private var ideasSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("最近想法")
                    .font(AtlasTypography.sectionHeader())
                    .foregroundStyle(AtlasColors.ink)
                Spacer()
                Button("全部") { showMyIdeas = true }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AtlasColors.primary)
            }

            ForEach(ideas.prefix(3)) { idea in
                IdeaCoverCard(
                    idea: idea,
                    coverImageURL: idea.iconLink,
                    onTap: { selectedRoute = IdeaRoute(id: idea.id) }
                )
            }
        }
    }
}

// MARK: - Creator Identity Card (Ardot S35 · 210:11)

/// Profile header (ardot S35 210:11): 48×48 lemon circle avatar + name block (Display Name
/// 20pt Bold + Bio 13pt Regular), itemSpacing 12. Identity is the page title — no eyebrow,
/// no DEIMOS CREATOR caption, no heavy card chrome.
struct OwnerIdentityCard: View {
    let user: User
    let profile: UserProfileData?

    var body: some View {
        HStack(spacing: 12) {
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
                    .lineLimit(2)

                Text(user.bio?.isEmpty == false ? (user.bio ?? "") : "AI 想法探索者")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(AtlasColors.inkTertiary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct OwnerStatsBand: View {
    let ideaCount: Int
    let followerCount: Int
    let followingCount: Int
    let onMyIdeas: () -> Void

    var body: some View {
        // Ardot S35 210:16 — inline row of three `icon(13) + value(15pt Bold) + label(12pt)`.
        // itemSpacing 16. Labels: 想法 / 粉丝 / Agent.
        HStack(spacing: 16) {
            statGroup(icon: .sparkles, value: ideaCount, label: "想法", action: onMyIdeas)
            statGroup(icon: .users, value: followerCount, label: "粉丝", action: nil)
            statGroup(icon: .user, value: followingCount, label: "Agent", action: nil)
            Spacer(minLength: 0)
        }
    }

    private func statGroup(icon: DeimosIcon, value: Int, label: String, action: (() -> Void)?) -> some View {
        let content = HStack(spacing: 4) {
            DeimosIconView(icon: icon, size: 13, color: AtlasColors.inkSoft)
            Text("\(value)")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
                .monospacedDigit()
            Text(label)
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(AtlasColors.inkSoft)
        }
        .fixedSize()

        return Group {
            if let action {
                Button(action: action) { content }.buttonStyle(.plain)
            } else {
                content
            }
        }
    }
}

private struct OwnerActionBar: View {
    let onPublish: () -> Void
    let onMyAgents: () -> Void

    var body: some View {
        // Ardot S35 210:29 — two independent 170×44 r22 pills, itemSpacing 10.
        // 发布 Idea (lemon-strong fill, lemonInk text) + 管理 Agent (white fill + border, ink text).
        HStack(spacing: 10) {
            quickActionButton("发布 Idea", icon: .plus, isPrimary: true, action: onPublish)
            quickActionButton("管理 Agent", icon: .sliders, isPrimary: false, action: onMyAgents)
        }
    }

    private func quickActionButton(_ title: String, icon: DeimosIcon, isPrimary: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                DeimosIconView(icon: icon, size: 15, color: isPrimary ? AtlasColors.lemonInk : AtlasColors.ink)
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(isPrimary ? AtlasColors.lemonInk : AtlasColors.ink)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(isPrimary ? AtlasColors.primaryAction : AtlasColors.surface)
            .overlay(
                Capsule(style: .continuous)
                    .stroke(isPrimary ? Color.clear : AtlasColors.border, lineWidth: 1)
            )
            .clipShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
    }
}
