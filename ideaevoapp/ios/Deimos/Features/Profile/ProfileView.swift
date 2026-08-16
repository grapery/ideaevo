import SwiftUI

/// S06 我的 (ardot board 715405210175453, node `2:8`).
///
/// Board structure: 我的 Bold-22 header + gear button → profile card
/// (white r20 hairline, avatar 56 · name Bold-17 · @handle meta · 编辑 pill ·
/// 3-stat row) → 我的 Agent compact rows → 我的想法 compact rows →
/// menu rows (通知 / 账号与安全 / 关于火卫二).
struct ProfileView: View {
    @Environment(AuthSession.self) private var session
    @State private var profile: UserProfileData?
    @State private var ideas: [Idea] = []
    @State private var myAgents: [Agent] = []
    @State private var unreadCount = 0
    @State private var showNotifications = false
    @State private var showMyAgents = false
    @State private var showPublishIdea = false
    @State private var showMyIdeas = false
    @State private var showSettings = false
    @State private var showEditProfile = false
    @State private var showAccountSecurity = false
    @State private var showAbout = false
    @State private var showPrivacyPolicy = false
    @State private var showTerms = false
    @State private var showCommunity = false
    @State private var selectedRoute: IdeaRoute?
    @State private var selectedAgentRoute: AgentRoute?

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
        .navigationDestination(isPresented: $showEditProfile) {
            EditProfileView()
        }
        .navigationDestination(isPresented: $showAccountSecurity) {
            AccountSecurityView()
        }
        .navigationDestination(isPresented: $showAbout) {
            AboutView(
                onPrivacyPolicy: { showPrivacyPolicy = true },
                onTerms: { showTerms = true },
                onCommunity: { showCommunity = true },
                onReport: { showPrivacyPolicy = true }
            )
        }
        .navigationDestination(isPresented: $showPrivacyPolicy) {
            PrivacyPolicyView()
        }
        .navigationDestination(isPresented: $showTerms) {
            LegalDocumentView(title: "用户协议", sections: LegalDocuments.terms)
        }
        .navigationDestination(isPresented: $showCommunity) {
            LegalDocumentView(title: "社区规范", sections: LegalDocuments.community)
        }
        .navigationDestination(item: $selectedRoute) { route in
            IdeaDetailView(ideaID: route.id)
        }
        .navigationDestination(item: $selectedAgentRoute) { route in
            AgentProfileView(agentID: route.id)
        }
        .task(id: session.user?.id) {
            guard let userID = session.user?.id else { return }
            profile = try? await APIClient.shared.userProfile(id: userID)
            unreadCount = (try? await APIClient.shared.filteredUnreadNotificationCount()) ?? 0
            if let fetched = try? await APIClient.shared.getUserIdeas(userID: userID, limit: 3) {
                ideas = fetched
            }
            if let agents = try? await APIClient.shared.myAgents() {
                myAgents = Array(agents.prefix(2))
            }
        }
        #if DEBUG
        // Verify-only launch hooks for visual review against the ardot board.
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

    // MARK: - S06 logged-in profile

    private func loggedInProfile(_ user: User) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                // S06 Header — 我的 Bold 22 + gear circle button (40, surfaceSecondary).
                HStack {
                    Text("我的")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(AtlasColors.ink)
                    Spacer()
                    Button { showSettings = true } label: {
                        DeimosIconView(icon: .gear, size: 18, color: AtlasColors.ink)
                            .frame(width: 40, height: 40)
                            .background(Circle().fill(AtlasColors.surfaceSecondary))
                            .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("设置")
                }

                profileCard(user)

                if !myAgents.isEmpty {
                    myAgentsSection
                }

                if !ideas.isEmpty {
                    myIdeasSection
                }

                menuRows
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)
            .padding(.bottom, AtlasMetrics.bottomClear)
        }
    }

    /// S06 Profile Card — white r20 hairline card, avatar 56 + identity + 编辑 pill,
    /// then a three-stat row.
    private func profileCard(_ user: User) -> some View {
        VStack(spacing: 14) {
            HStack(spacing: 12) {
                EntityAvatar.user(
                    id: user.id,
                    url: user.avatarLink,
                    name: user.name,
                    size: 56
                )
                VStack(alignment: .leading, spacing: 3) {
                    Text(user.name)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(AtlasColors.ink)
                        .lineLimit(1)
                    Text(profileMetaLine(user))
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                Button { showEditProfile = true } label: {
                    Text("编辑")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                        .padding(.horizontal, 14)
                        .frame(height: 31)
                        .background(
                            Capsule(style: .continuous)
                                .fill(AtlasColors.surfaceSecondary)
                        )
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 0) {
                profileStat("\(profile?.ideaCount ?? 0)", "想法")
                profileStat("\(user.followerCount)", "粉丝")
                profileStat("\(user.followingCount)", "关注")
            }
        }
        .padding(16)
        .background(AtlasColors.surface)
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AtlasColors.cardStroke, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func profileStat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
                .monospacedDigit()
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(AtlasColors.inkSoft)
        }
        .frame(maxWidth: .infinity)
    }

    private func profileMetaLine(_ user: User) -> String {
        let handle: String
        if let email = user.email, let prefix = email.split(separator: "@").first, !prefix.isEmpty {
            handle = "@\(prefix)"
        } else {
            handle = "@\(user.name)"
        }
        let joined = " · 加入于 \(user.createdAt.formatted(.dateTime.year().month()))"
        return handle + joined
    }

    /// S06 我的 Agent — header with 查看全部 (→ S18) + compact 37pt rows.
    private var myAgentsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("我的 Agent")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                Spacer()
                Button { showMyAgents = true } label: {
                    Text("查看全部")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                .buttonStyle(.plain)
            }
            .padding(.bottom, 6)

            ForEach(myAgents) { agent in
                Button {
                    if agent.visibility == "private" {
                        showMyAgents = true
                    } else {
                        selectedAgentRoute = AgentRoute(id: agent.id)
                    }
                } label: {
                    HStack(spacing: 10) {
                        EntityAvatar.agent(
                            id: agent.id,
                            url: agent.avatarLink,
                            name: agent.name,
                            size: 36
                        )
                        VStack(alignment: .leading, spacing: 2) {
                            Text(agent.name)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(AtlasColors.ink)
                                .lineLimit(1)
                            Text(agent.isPersonal == true
                                  ? "个人 Agent · 运行中"
                                  : "独立 Agent · \(agent.ideaCount ?? 0) 个想法")
                                .font(.system(size: 11))
                                .foregroundStyle(agent.isPersonal == true ? AtlasColors.success : AtlasColors.inkSoft)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                        DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                    }
                    .frame(minHeight: 37)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// S06 我的想法 — compact rows with a 36pt r10 idea icon.
    private var myIdeasSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("我的想法")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
                .padding(.bottom, 6)

            ForEach(ideas.prefix(3)) { idea in
                Button {
                    selectedRoute = IdeaRoute(id: idea.id)
                } label: {
                    HStack(spacing: 10) {
                        EntityAvatar.idea(
                            id: idea.id,
                            url: idea.iconLink,
                            name: idea.title,
                            size: 36
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(idea.title)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(AtlasColors.ink)
                                .lineLimit(1)
                            Text("\(idea.statusLabel) · \(idea.flowerCount) 花 · \(idea.forkCount) Fork")
                                .font(.system(size: 11))
                                .foregroundStyle(AtlasColors.inkSoft)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                    .frame(minHeight: 37)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// S06 menu rows — 36pt Regular-14 label + inkFaint chevron.
    private var menuRows: some View {
        VStack(spacing: 0) {
            menuRow("通知", showsDot: unreadCount > 0) { showNotifications = true }
            menuRow("账号与安全") { showAccountSecurity = true }
            menuRow("关于火卫二") { showAbout = true }
        }
        .padding(.top, 6)
    }

    private func menuRow(_ label: String, showsDot: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(label)
                    .font(.system(size: 14))
                    .foregroundStyle(AtlasColors.ink)
                if showsDot {
                    Circle()
                        .fill(AtlasColors.destructive)
                        .frame(width: 7, height: 7)
                }
                Spacer(minLength: 0)
                DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
            }
            .frame(minHeight: 36)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
