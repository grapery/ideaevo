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
        // `--deimos-goto-myagents` deep-links to the My Agents list.
        // `--deimos-goto-publish-idea` deep-links to the Create Idea screen (S12).
        .onAppear {
            if ProcessInfo.processInfo.arguments.contains("--deimos-goto-settings") {
                showSettings = true
            } else if ProcessInfo.processInfo.arguments.contains("--deimos-goto-notifications") {
                showNotifications = true
            } else if ProcessInfo.processInfo.arguments.contains("--deimos-goto-myagents") {
                showMyAgents = true
            } else if ProcessInfo.processInfo.arguments.contains("--deimos-goto-publish-idea") {
                showPublishIdea = true
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
            // ardot S09 (`237:187` Header 342×61): large-title "DEIMOS" + "我的" 34pt Bold
            // on the left + trailing 44×44 grey icon buttons (Bell + Settings) on the right.
            // The previous S35 design omitted the large title; the new design brings it back.
            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("DEIMOS")
                        .font(AtlasTypography.overline())
                        .foregroundStyle(AtlasColors.inkSoft)
                    Text("我的")
                        .font(AtlasTypography.largeTitle())
                        .foregroundStyle(AtlasColors.ink)
                        .atlasTrackedTitle(30)
                }
                Spacer()
                Button { showNotifications = true } label: {
                    ZStack(alignment: .topTrailing) {
                        DeimosIconView(icon: .bell, size: 18, color: AtlasColors.ink)
                            .frame(width: 44, height: 44)
                            .background(AtlasColors.chatNavCircle)
                            .clipShape(Circle())
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

            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.top, 8)
            .padding(.bottom, 16)

            ScrollView {
            VStack(spacing: 16) {
                // ardot S09 (`237:187` Profile Card 342×104): #FBFCFD fill + #EDF0F2 stroke, cr22,
                // 72×72 lemon avatar (cr36) + name/bio stack. Previously the identity rendered
                // bare on the canvas (S35 pattern); the new design wraps it in a soft card.
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

// MARK: - Creator Identity Card (Ardot S09 · 237:187)

/// ardot S09 (`237:187` Profile Card 342×104): #FBFCFD fill + #EDF0F2 stroke, cr22.
/// 72×72 lemon avatar (cr36) + name (20pt Bold) + bio (13pt Regular) stack.
/// Previously the S35 design rendered identity bare on canvas — the new design wraps it in a
/// soft, slightly off-white card so it reads as a distinct identity surface.
struct OwnerIdentityCard: View {
    let user: User
    let profile: UserProfileData?

    var body: some View {
        HStack(spacing: 16) {
            EntityAvatar.user(
                id: user.id,
                url: user.avatarLink,
                name: user.name,
                size: 64
            )

            VStack(alignment: .leading, spacing: 4) {
                Text(user.name)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(2)

                Text(user.bio?.isEmpty == false ? (user.bio ?? "") : "AI 想法探索者")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(AtlasColors.inkSoft)
                    .lineLimit(2)

                // ardot S09 (237:187 Creator Badge): "DEIMOS CREATOR" 10pt Semibold lemonInk.
                Text("DEIMOS CREATOR")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(AtlasColors.oliveMeta)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 96, maxHeight: 96, alignment: .leading)
        .background(Color(hex: 0xF8F9FB))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color(hex: 0xEEF1F3), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct OwnerStatsBand: View {
    let ideaCount: Int
    let followerCount: Int
    let followingCount: Int
    let onMyIdeas: () -> Void

    var body: some View {
        // ardot S09 (`237:187` Stats 342×64): container cr16, itemSpacing 3, padding 4.
        // Each tile 106×56 cr13 with padding 8. Value 20pt Bold + Label 10pt Medium.
        HStack(spacing: 3) {
            statTile(value: ideaCount, label: "公开想法", highlight: true, action: onMyIdeas)
            statTile(value: followerCount, label: "粉丝", highlight: false, action: nil)
            statTile(value: followingCount, label: "关注", highlight: false, action: nil)
        }
        .padding(4)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(AtlasColors.chatAssistantBubble)
        )
    }

    private func statTile(value: Int, label: String, highlight: Bool, action: (() -> Void)?) -> some View {
        let content = VStack(spacing: 2) {
            Text("\(value)")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
                .monospacedDigit()
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(AtlasColors.inkSoft)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 56)
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 13, style: .continuous)
                .fill(highlight ? AtlasColors.chatActivityFill : AtlasColors.chatAssistantBubble)
        )

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
        // ardot S09 (`237:187` Actions 342×48): #F5F6F7 container cr24 holding two 163×40 pills.
        // Primary (发布想法) #BEE90D lemon + lemonInk text; Secondary (我的 Agent) white + stroke.
        HStack(spacing: 8) {
            quickActionButton("发布想法", icon: .plus, isPrimary: true, action: onPublish)
            quickActionButton("我的 Agent", icon: .sliders, isPrimary: false, action: onMyAgents)
        }
        .padding(4)
        .background(
            Capsule(style: .continuous)
                .fill(AtlasColors.chatAssistantBubble)
        )
    }

    private func quickActionButton(_ title: String, icon: DeimosIcon, isPrimary: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                DeimosIconView(icon: icon, size: 15, color: isPrimary ? AtlasColors.lemonInk : AtlasColors.ink)
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(isPrimary ? AtlasColors.lemonInk : AtlasColors.ink)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(isPrimary ? AtlasColors.lemonStrong : AtlasColors.surface)
            .overlay(
                Capsule(style: .continuous)
                    .stroke(isPrimary ? Color.clear : AtlasColors.settingsRowStroke, lineWidth: 1)
            )
            .clipShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
    }
}
