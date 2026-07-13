import SwiftUI

struct ProfileBanner: View {
    let backgroundURL: String?
    let avatarURL: String?
    var avatarEntityID: String?
    var avatarKind: AvatarDefaults.Kind = .agent
    var avatarSize: CGFloat = 72
    var avatarFallbackName: String = ""
    var showsAvatar = true

    private var resolvedAvatarURL: URL? {
        if let avatarEntityID {
            return AvatarDefaults.url(kind: avatarKind, id: avatarEntityID, raw: avatarURL)
        }
        guard let avatarURL, !avatarURL.isEmpty else { return nil }
        return URL(string: avatarURL)
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            bannerBackground
                .frame(height: 132)
                .frame(maxWidth: .infinity)
                .clipped()

            if showsAvatar {
                avatarView
                    .overlay(Circle().stroke(AtlasColors.surface, lineWidth: 4))
                    .atlasSettingsGroupShadow()
                    .offset(x: 20, y: avatarSize / 2)
            }
        }
        .padding(.bottom, showsAvatar ? avatarSize / 2 : 0)
    }

    @ViewBuilder
    private var bannerBackground: some View {
        if let backgroundURL, let url = URL(string: backgroundURL), !backgroundURL.isEmpty {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    defaultBannerGradient
                }
            }
        } else {
            defaultBannerGradient
        }
    }

    private var defaultBannerGradient: some View {
        LinearGradient(
            colors: bannerGradientColors,
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var bannerGradientColors: [Color] {
        switch avatarKind {
        case .user:
            return [AtlasColors.primary, AtlasColors.primaryLight]
        case .agent:
            return [AtlasColors.aiStart, AtlasColors.aiEnd]
        case .idea:
            return [AtlasColors.aiStart, AtlasColors.aiEnd]
        }
    }

    private var entityBannerColor: Color {
        switch avatarKind {
        case .user: return AtlasColors.primary
        case .agent: return AtlasColors.aiStart
        case .idea: return AtlasColors.aiStart
        }
    }

    @ViewBuilder
    private var avatarView: some View {
        if let avatarEntityID {
            switch avatarKind {
            case .agent:
                EntityAvatar.agent(
                    id: avatarEntityID,
                    url: resolvedAvatarURL,
                    name: "",
                    size: avatarSize
                )
            case .user:
                EntityAvatar.user(
                    id: avatarEntityID,
                    url: resolvedAvatarURL,
                    name: "",
                    size: avatarSize
                )
            case .idea:
                EntityAvatar.idea(
                    id: avatarEntityID,
                    url: resolvedAvatarURL,
                    name: "",
                    size: avatarSize
                )
            }
        } else {
            WireframeAvatar(size: avatarSize, imageURL: resolvedAvatarURL, name: avatarFallbackName)
        }
    }
}

// MARK: - Agent profile float hero (Ardot S10)

struct AgentProfileFloatHero: View {
    let agent: Agent
    let stats: AgentStats?
    let isFollowing: Bool
    let onFollow: () -> Void
    let onChat: () -> Void
    var onOwnerTap: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: -36) {
            ProfileBanner(
                backgroundURL: agent.backgroundURL,
                avatarURL: agent.avatarURL,
                avatarEntityID: agent.id,
                avatarKind: .agent,
                avatarSize: 72,
                showsAvatar: false
            )
            .frame(maxWidth: .infinity)

            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 14) {
                    EntityAvatar.agent(
                        id: agent.id,
                        url: agent.avatarLink,
                        name: agent.name,
                        size: 72
                    )
                    .overlay(Circle().stroke(AtlasColors.surface, lineWidth: 4))
                    .atlasSettingsGroupShadow()

                    VStack(alignment: .leading, spacing: 6) {
                        Text(agent.name)
                            .font(AtlasTypography.titleMedium())
                            .foregroundStyle(AtlasColors.ink)
                            .lineLimit(2)

                        HStack(spacing: 8) {
                            AtlasStatusPill(text: "Agent")
                            if let count = agent.followerCount, count > 0 {
                                Text("\(count) 关注者")
                                    .font(AtlasTypography.caption())
                                    .foregroundStyle(AtlasColors.inkFaint)
                            }
                        }

                        metaRow

                        if let owner = agent.owner {
                            ownerRow(owner)
                        } else if let ownerID = agent.ownerUserID, !ownerID.isEmpty {
                            ownerPlaceholderRow(ownerID)
                        }

                        HStack(spacing: 6) {
                            DeimosIconView(icon: .lock, size: 11, color: AtlasColors.inkFaint)
                            Text("User 与 Agent 的对话内容不可见")
                                .font(.system(size: 12))
                                .foregroundStyle(AtlasColors.inkFaint)
                        }

                        permissionsRow

                        if let description = agent.description, !description.isEmpty {
                            Text(description)
                                .font(AtlasTypography.bodyMedium())
                                .foregroundStyle(AtlasColors.inkSoft)
                                .lineLimit(3)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 4)
                }

                if let stats {
                    statsStrip(stats)
                }

                HStack(spacing: 10) {
                    if agent.allowFollow != false {
                        Button(action: onFollow) {
                            HStack(spacing: 4) {
                                if isFollowing {
                                    DeimosIconView(icon: .check, size: 12, color: AtlasColors.primary)
                                }
                                Text(isFollowing ? "已关注" : "关注")
                            }
                            .font(AtlasTypography.subtitle())
                            .frame(maxWidth: .infinity)
                            .frame(height: AtlasMetrics.primaryButtonHeight)
                            .foregroundStyle(isFollowing ? AtlasColors.primary : AtlasColors.ink)
                            .background(isFollowing ? AtlasColors.chipSelectedBg : AtlasColors.surfaceSecondary)
                            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                                    .stroke(AtlasColors.rule, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    if agent.allowChat != false {
                        Button(action: onChat) {
                            HStack(spacing: 6) {
                                Text("发起对话")
                                    .font(AtlasTypography.button())
                                DeimosIconView(icon: .chevronRight, size: 12, color: AtlasColors.lemonInk)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: AtlasMetrics.primaryButtonHeight)
                            .foregroundStyle(AtlasColors.lemonInk)
                            .background(AtlasColors.aiGradient)
                            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                            .shadow(color: AtlasColors.lemonStrong.opacity(0.3), radius: 12, y: 4)
                        }
                        .buttonStyle(.plain)
                    }
                }

                if !agent.capabilityLabels.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(agent.capabilityLabels.prefix(8), id: \.self) { cap in
                                Text(cap)
                                    .font(AtlasTypography.caption())
                                    .foregroundStyle(AtlasColors.inkSoft)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(AtlasColors.fill)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }
            }
            .padding(20)
            .background(AtlasColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard))
            .atlasElevatedCard()
            .padding(.horizontal, 16)
        }
    }

    @ViewBuilder
    private var metaRow: some View {
        HStack(spacing: 6) {
            if let visibility = agent.visibilityLabel {
                metaPill(visibility)
            }
            if let model = agent.llmModel, !model.isEmpty {
                metaPill(model)
            }
            if let createdAt = agent.createdAt {
                metaPill("注册 \(createdAt.relativeShort)")
            }
        }
    }

    private func metaPill(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(AtlasColors.inkFaint)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(AtlasColors.fill)
            .clipShape(Capsule())
    }

    private func ownerRow(_ owner: AgentOwner) -> some View {
        Button {
            onOwnerTap?()
        } label: {
            HStack(spacing: 8) {
                EntityAvatar.user(id: owner.id, url: owner.avatarLink, name: owner.name, size: 20)
                Text("由 \(owner.name) 创建")
                    .font(AtlasTypography.meta())
                    .foregroundStyle(AtlasColors.inkSoft)
                Spacer(minLength: 0)
                DeimosIconView(icon: .chevronRight, size: 12, color: AtlasColors.inkFaint)
            }
        }
        .buttonStyle(.plain)
        .disabled(onOwnerTap == nil)
    }

    private func ownerPlaceholderRow(_ ownerID: String) -> some View {
        Button {
            onOwnerTap?()
        } label: {
            HStack(spacing: 8) {
                EntityAvatar.user(id: ownerID, url: nil, name: "用户", size: 20)
                Text("查看创建者")
                    .font(AtlasTypography.meta())
                    .foregroundStyle(AtlasColors.inkSoft)
                Spacer(minLength: 0)
                DeimosIconView(icon: .chevronRight, size: 12, color: AtlasColors.inkFaint)
            }
        }
        .buttonStyle(.plain)
        .disabled(onOwnerTap == nil)
    }

    @ViewBuilder
    private var permissionsRow: some View {
        let followAllowed = agent.allowFollow != false
        let chatAllowed = agent.allowChat != false
        if followAllowed || chatAllowed {
            HStack(spacing: 12) {
                if followAllowed {
                    permissionItem(icon: .users, text: "允许关注")
                }
                if chatAllowed {
                    permissionItem(icon: .chat, text: "允许对话")
                }
            }
            .font(.system(size: 12))
            .foregroundStyle(AtlasColors.inkFaint)
        }
    }

    private func permissionItem(icon: DeimosIcon, text: String) -> some View {
        HStack(spacing: 4) {
            DeimosIconView(icon: icon, size: 11, color: AtlasColors.inkFaint)
            Text(text)
        }
    }

    private func statsStrip(_ stats: AgentStats) -> some View {
        HStack(spacing: 0) {
            profileStat(value: "\(stats.ideaCount)", label: "想法", icon: .document)
            profileStatDivider
            profileStat(value: "\(stats.totalFlowers)", label: "鲜花", icon: .flower)
            profileStatDivider
            profileStat(value: "\(stats.totalLikes)", label: "赞", icon: .heart)
            profileStatDivider
            profileStat(value: "\(stats.totalForks)", label: "Fork", icon: .fork)
        }
        .padding(.vertical, 12)
        .background(AtlasColors.fill.opacity(0.65))
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard))
    }

    private var profileStatDivider: some View {
        Rectangle()
            .fill(AtlasColors.rule)
            .frame(width: 1, height: 28)
    }

    private func profileStat(value: String, label: String, icon: DeimosIcon) -> some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                DeimosIconView(icon: icon, size: 13, color: AtlasColors.inkFaint)
                Text(value)
                    .font(AtlasTypography.button())
                    .foregroundStyle(AtlasColors.ink)
            }
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(AtlasColors.inkFaint)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - User profile float hero (Ardot S09B v3)

struct UserProfileFloatHero: View {
    let user: User
    let stats: UserProfileData
    let isFollowing: Bool
    let isSelf: Bool
    let onFollow: () -> Void
    var onIdeas: (() -> Void)?
    var onAgents: (() -> Void)?
    var onFollowers: (() -> Void)?
    var onFollowing: (() -> Void)?

    var body: some View {
        VStack(spacing: -36) {
            ProfileBanner(
                backgroundURL: user.backgroundURL,
                avatarURL: user.avatarURL,
                avatarEntityID: user.id,
                avatarKind: .user,
                avatarSize: 72,
                showsAvatar: false
            )
            .frame(maxWidth: .infinity)

            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 14) {
                    EntityAvatar.user(
                        id: user.id,
                        url: user.avatarLink,
                        name: user.name,
                        size: 72
                    )
                    .overlay(Circle().stroke(AtlasColors.surface, lineWidth: 4))
                    .atlasSettingsGroupShadow()

                    VStack(alignment: .leading, spacing: 6) {
                        Text(user.name)
                            .font(AtlasTypography.titleMedium())
                            .foregroundStyle(AtlasColors.ink)
                            .lineLimit(2)

                        if let bio = user.bio, !bio.isEmpty {
                            Text(bio)
                                .font(AtlasTypography.bodyMedium())
                                .foregroundStyle(AtlasColors.inkSoft)
                                .lineLimit(3)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        Text("加入于 \(user.createdAt.formatted(.dateTime.year().month()))")
                            .font(.system(size: 12))
                            .foregroundStyle(AtlasColors.inkFaint)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 4)
                }

                statsStrip

                if !isSelf {
                    Button(action: onFollow) {
                        HStack(spacing: 4) {
                            if isFollowing {
                                DeimosIconView(icon: .check, size: 12, color: AtlasColors.primary)
                            }
                            Text(isFollowing ? "已关注" : "关注")
                        }
                        .font(AtlasTypography.subtitle())
                        .frame(maxWidth: .infinity)
                        .frame(height: AtlasMetrics.primaryButtonHeight)
                        .foregroundStyle(isFollowing ? AtlasColors.primary : .white)
                        .background(isFollowing ? AtlasColors.chipSelectedBg : AtlasColors.ink)
                        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(20)
            .background(AtlasColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard))
            .atlasElevatedCard()
            .padding(.horizontal, 16)
        }
    }

    private var statsStrip: some View {
        HStack(spacing: 0) {
            statButton(value: "\(stats.ideaCount)", label: "想法", action: onIdeas)
            profileStatDivider
            statButton(value: "\(stats.agentCount)", label: "Agent", action: onAgents)
            profileStatDivider
            statButton(value: "\(stats.followerCount)", label: "粉丝", action: onFollowers)
            profileStatDivider
            statButton(value: "\(stats.followingCount)", label: "关注", action: onFollowing)
        }
        .padding(.vertical, 12)
        .background(AtlasColors.fill.opacity(0.65))
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard))
    }

    @ViewBuilder
    private func statButton(value: String, label: String, action: (() -> Void)?) -> some View {
        if let action {
            Button(action: action) {
                profileStat(value: value, label: label, icon: label == "想法" ? .document : .users)
            }
            .buttonStyle(.plain)
        } else {
            profileStat(value: value, label: label, icon: label == "想法" ? .document : .users)
        }
    }

    private var profileStatDivider: some View {
        Rectangle()
            .fill(AtlasColors.rule)
            .frame(width: 1, height: 28)
    }

    private func profileStat(value: String, label: String, icon: DeimosIcon) -> some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                DeimosIconView(icon: icon, size: 13, color: AtlasColors.inkFaint)
                Text(value)
                    .font(AtlasTypography.button())
                    .foregroundStyle(AtlasColors.ink)
            }
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(AtlasColors.inkFaint)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - My profile float hero (Ardot S09 v5)

struct MyProfileFloatHero: View {
    let user: User
    let profile: UserProfileData?
    let onPublish: () -> Void
    let onMyAgents: () -> Void
    var onFollowers: (() -> Void)?
    var onFollowing: (() -> Void)?
    var onMyIdeas: (() -> Void)?

    var body: some View {
        VStack(spacing: -36) {
            ProfileBanner(
                backgroundURL: user.backgroundURL,
                avatarURL: user.avatarURL,
                avatarEntityID: user.id,
                avatarKind: .user,
                avatarSize: 72,
                showsAvatar: false
            )
            .frame(maxWidth: .infinity)

            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 14) {
                    EntityAvatar.user(
                        id: user.id,
                        url: user.avatarLink,
                        name: user.name,
                        size: 72
                    )
                    .overlay(Circle().stroke(AtlasColors.surface, lineWidth: 4))
                    .atlasSettingsGroupShadow()

                    VStack(alignment: .leading, spacing: 6) {
                        Text(user.name)
                            .font(AtlasTypography.titleMedium())
                            .foregroundStyle(AtlasColors.ink)
                            .lineLimit(2)

                        if let bio = user.bio, !bio.isEmpty {
                            Text(bio)
                                .font(AtlasTypography.bodyMedium())
                                .foregroundStyle(AtlasColors.inkSoft)
                                .lineLimit(3)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 4)
                }

                statsStrip

                HStack(spacing: 10) {
                    Button(action: onPublish) {
                        Text("发布想法")
                            .font(AtlasTypography.mobileSubheadline())
                            .foregroundStyle(AtlasColors.lemonInk)
                            .frame(maxWidth: .infinity)
                            .frame(height: AtlasMetrics.primaryButtonHeight)
                            .background(AtlasColors.primary)
                            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                            .shadow(color: AtlasColors.lemonStrong.opacity(0.3), radius: 8, y: 2)
                    }
                    Button(action: onMyAgents) {
                        Text("我的 Agent")
                            .font(AtlasTypography.mobileSubheadline())
                            .foregroundStyle(AtlasColors.ink)
                            .frame(maxWidth: .infinity)
                            .frame(height: AtlasMetrics.primaryButtonHeight)
                            .background(AtlasColors.surface)
                            .overlay(
                                RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                                    .stroke(AtlasColors.rule, lineWidth: 1)
                            )
                    }
                }
            }
            .padding(20)
            .background(AtlasColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard))
            .atlasElevatedCard()
            .padding(.horizontal, AtlasMetrics.pageX)
        }
    }

    private var statsStrip: some View {
        HStack(spacing: 0) {
            statButton(
                value: "\(profile?.ideaCount ?? 0)",
                label: "想法",
                action: onMyIdeas
            )
            profileStatDivider
            statButton(
                value: "\(user.followerCount)",
                label: "粉丝",
                action: onFollowers
            )
            profileStatDivider
            statButton(
                value: "\(user.followingCount)",
                label: "关注",
                action: onFollowing
            )
        }
        .padding(.vertical, 12)
        .background(AtlasColors.fill.opacity(0.65))
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard))
    }

    private var profileStatDivider: some View {
        Rectangle()
            .fill(AtlasColors.rule)
            .frame(width: 1, height: 28)
    }

    @ViewBuilder
    private func statButton(value: String, label: String, action: (() -> Void)?) -> some View {
        if let action {
            Button(action: action) {
                statContent(value: value, label: label)
            }
            .buttonStyle(.plain)
        } else {
            statContent(value: value, label: label)
        }
    }

    private func statContent(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(AtlasTypography.button())
                .foregroundStyle(AtlasColors.ink)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(AtlasColors.inkFaint)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Idea provenance card (Ardot S04 v3)

struct IdeaProvenanceCard: View {
    let idea: Idea
    var onOwnerTap: (() -> Void)? = nil
    var onAgentTap: (() -> Void)? = nil

    private var agentName: String {
        idea.agent?.name ?? String(idea.agentID.prefix(8))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let owner = idea.agent?.owner {
                Button {
                    onOwnerTap?()
                } label: {
                    HStack(spacing: 10) {
                        EntityAvatar.user(id: owner.id, url: owner.avatarLink, name: owner.name, size: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("拥有者")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(AtlasColors.inkFaint)
                                .textCase(.uppercase)
                            Text(owner.name)
                                .font(AtlasTypography.caption())
                                .foregroundStyle(AtlasColors.ink)
                        }
                        Spacer(minLength: 0)
                    }
                }
                .buttonStyle(.plain)
                .disabled(onOwnerTap == nil)

                HStack(spacing: 8) {
                    Rectangle().fill(AtlasColors.rule).frame(height: 1)
                    Text("通过 Agent 发布")
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkFaint)
                    Rectangle().fill(AtlasColors.rule).frame(height: 1)
                }
            }

            Button {
                onAgentTap?()
            } label: {
                HStack(spacing: 10) {
                    EntityAvatar.agent(
                        id: idea.agentID,
                        url: idea.agent?.avatarLink,
                        name: agentName,
                        size: 36
                    )
                    VStack(alignment: .leading, spacing: 2) {
                        Text(agentName)
                            .font(AtlasTypography.caption())
                            .foregroundStyle(AtlasColors.ink)
                        Text("\(idea.createdAt.relativeShort) · \(idea.category)")
                            .font(.system(size: 12))
                            .foregroundStyle(AtlasColors.inkFaint)
                    }
                    Spacer(minLength: 0)
                    DeimosIconView(icon: .chevronRight, size: 12, color: AtlasColors.inkFaint)
                }
            }
            .buttonStyle(.plain)
            .disabled(onAgentTap == nil)
        }
        .padding(16)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard))
        .atlasElevatedCard()
    }
}
