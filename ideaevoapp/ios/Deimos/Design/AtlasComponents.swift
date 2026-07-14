import SwiftUI
import UIKit

struct AtlasPrimaryButton: View {
    let title: String
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .tint(AtlasColors.lemonInk)
                }
                Text(title)
                    .font(.system(size: 15, weight: .bold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .foregroundStyle(AtlasColors.lemonInk)
            .background(AtlasColors.primaryAction)
            .clipShape(RoundedRectangle(cornerRadius: 25, style: .continuous))
        }
        .buttonStyle(AtlasPressableStyle())
        .disabled(isLoading)
    }
}

/// Scale(0.97) press feedback — from ardot Motion variable `scale-press: 0.97`.
/// Emil Kowalski principle: "Buttons must feel responsive — scale(0.97) on :active."
struct AtlasPressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.85 : 1.0)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

// MARK: - Login (Ardot S01 `63:5`)

struct AtlasLoginTextField: View {
    let placeholder: String
    @Binding var text: String
    var isSecure = false
    var keyboardType: UIKeyboardType = .default
    var returnKeyType: UIReturnKeyType = .default
    var onSubmit: (() -> Void)? = nil

    var body: some View {
        ChineseFriendlyTextField(
            placeholder: placeholder,
            text: $text,
            isSecure: isSecure,
            keyboardType: keyboardType,
            returnKeyType: returnKeyType,
            onSubmit: onSubmit
        )
        .font(AtlasTypography.body())
        .padding(.horizontal, AtlasMetrics.pageX)
        .frame(height: AtlasMetrics.inputHeight)
        .background(AtlasColors.fill)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
    }
}

struct AtlasLoginPrimaryButton: View {
    let title: String
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView().tint(AtlasColors.lemonInk)
                }
                Text(title)
                    .font(.system(size: 15, weight: .bold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .foregroundStyle(AtlasColors.lemonInk)
            .background(AtlasColors.primaryAction)
            .clipShape(RoundedRectangle(cornerRadius: 25, style: .continuous))
        }
        .buttonStyle(AtlasPressableStyle())
        .disabled(isLoading)
    }
}

// MARK: - Settings (Ardot S11 `27:124`)

struct AtlasSettingsSection<Content: View>: View {
    let title: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(AtlasColors.inkSoft)
                .padding(.leading, 4)

            VStack(spacing: 0) {
                content()
            }
            .background(AtlasColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                    .stroke(AtlasColors.borderProfile, lineWidth: 1)
            )
            .atlasProfileCard()
        }
    }
}

struct AtlasSettingsDivider: View {
    var body: some View {
        Divider()
            .overlay(AtlasColors.rule)
            .padding(.leading, 58)
    }
}

struct AtlasSettingsRow: View {
    let icon: DeimosIcon
    let iconColor: Color
    let title: String
    var subtitle: String = ""
    var value: String?

    var body: some View {
        HStack(spacing: 14) {
            // v6: flat icon, no colored rounded rect background. SF Symbol style 22pt.
            DeimosIconView(icon: icon, size: 22, color: iconColor)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(AtlasTypography.mobileBody())
                    .foregroundStyle(AtlasColors.ink)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(AtlasTypography.mobileSubheadline())
                        .foregroundStyle(AtlasColors.inkFaint)
                }
            }

            Spacer()

            if let value {
                Text(value)
                    .font(AtlasTypography.mobileSubheadline())
                    .foregroundStyle(AtlasColors.inkFaint)
            }

            DeimosIconView(icon: .chevronRight, size: 15, color: AtlasColors.inkFaint.opacity(0.5))
        }
        .frame(minHeight: AtlasMetrics.settingsRowMinHeight)
        .padding(.horizontal, 16)
        .contentShape(Rectangle())
    }
}

struct AtlasSettingsLogoutButton: View {
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView().tint(AtlasColors.destructive)
                }
                Image(systemName: "rectangle.portrait.and.arrow.right")
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(AtlasColors.destructive)
                Text("退出登录")
                    .font(AtlasTypography.cardTitle())
            }
            .frame(maxWidth: .infinity)
            .frame(height: 53)
            .foregroundStyle(AtlasColors.destructive)
            .background(AtlasColors.surface)
            .overlay(
                RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                    .stroke(AtlasColors.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
            .atlasProfileCard()
        }
        .disabled(isLoading)
    }
}

struct AtlasNavBackButton: View {
    let action: () -> Void

    var body: some View {
        // v6 spec: back button is 40×40 circle (not the default 36pt toolbar size)
        AtlasToolbarFloatIconButton(icon: .chevronBack, size: AtlasMetrics.backButtonSize, iconSize: 17, action: action)
    }
}

enum AtlasToolbarMetrics {
    static let barHeight: CGFloat = 44
    static let controlHeight: CGFloat = AtlasMetrics.toolbarVisualSize
    static let hitTarget: CGFloat = AtlasMetrics.touchTarget
    static let spacing: CGFloat = 8
}

/// Pattern A Push 页导航栏：居中标题 + 左右 float 控件（替代系统 `.toolbar`，避免大小不一）。
struct AtlasPushNavBar<Trailing: View>: View {
    var title: String
    var onBack: (() -> Void)?
    @ViewBuilder var trailing: () -> Trailing

    init(
        title: String = "",
        onBack: (() -> Void)? = nil,
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }
    ) {
        self.title = title
        self.onBack = onBack
        self.trailing = trailing
    }

    var body: some View {
        ZStack {
            HStack(alignment: .center, spacing: 0) {
                leadingSlot
                Spacer(minLength: 0)
                trailingSlot
            }
            if !title.isEmpty {
                Text(title)
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 96)
            }
        }
        .padding(.horizontal, AtlasMetrics.detailX)
        .frame(height: AtlasToolbarMetrics.barHeight)
        .background(AtlasColors.canvas)
    }

    @ViewBuilder
    private var leadingSlot: some View {
        if let onBack {
            AtlasNavBackButton(action: onBack)
        } else {
            Color.clear
                .frame(width: AtlasToolbarMetrics.hitTarget, height: AtlasToolbarMetrics.hitTarget)
        }
    }

    private var trailingSlot: some View {
        HStack(spacing: AtlasToolbarMetrics.spacing) {
            trailing()
        }
        .frame(minHeight: AtlasToolbarMetrics.hitTarget)
    }
}

/// Pattern C 内联导航：返回 + 中间内容 + 可选右侧占位。
struct AtlasInlineNavBar<Center: View, Trailing: View>: View {
    let onBack: () -> Void
    @ViewBuilder var center: () -> Center
    @ViewBuilder var trailing: () -> Trailing

    init(
        onBack: @escaping () -> Void,
        @ViewBuilder center: @escaping () -> Center,
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }
    ) {
        self.onBack = onBack
        self.center = center
        self.trailing = trailing
    }

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            AtlasNavBackButton(action: onBack)
            center()
                .frame(maxWidth: .infinity)
            trailing()
                .frame(width: AtlasToolbarMetrics.hitTarget, height: AtlasToolbarMetrics.hitTarget, alignment: .trailing)
        }
        .padding(.horizontal, 8)
        .frame(height: AtlasToolbarMetrics.barHeight)
        .background(AtlasColors.canvas)
    }
}

/// Icon-only toolbar control · visual 36 inside 44pt hit.
struct AtlasToolbarFloatIconButton: View {
    let icon: DeimosIcon
    var size: CGFloat = AtlasMetrics.toolbarVisualSize
    var iconSize: CGFloat = 17
    var color: Color = AtlasColors.ink
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            DeimosIconView(icon: icon, size: iconSize, color: color)
                .frame(width: size, height: size)
                .atlasToolbarFloat()
                .frame(width: AtlasMetrics.touchTarget, height: AtlasMetrics.touchTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// Tab root breaking action (`+`) · 56×56 hit per Marvel V4.0.
struct AtlasToolbarCenterActionButton: View {
    let icon: DeimosIcon
    var iconSize: CGFloat = 18
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            DeimosIconView(icon: icon, size: iconSize, color: AtlasColors.ink)
                .frame(width: AtlasMetrics.toolbarVisualSize, height: AtlasMetrics.toolbarVisualSize)
                .atlasToolbarFloat()
                .frame(width: AtlasMetrics.centerActionSize, height: AtlasMetrics.centerActionSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// Text toolbar control · float pill (分享 / 设置 / 全部已读).
struct AtlasToolbarFloatTextButton: View {
    let title: String
    var fontSize: CGFloat = 14
    var fontWeight: Font.Weight = .medium
    var color: Color = AtlasColors.ink
    var horizontalPadding: CGFloat = 12
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: fontSize, weight: fontWeight))
                .foregroundStyle(color)
                .padding(.horizontal, horizontalPadding)
                .frame(minHeight: AtlasMetrics.touchTarget)
                .atlasToolbarFloat(cornerRadius: AtlasMetrics.radiusPill)
                .frame(minHeight: AtlasMetrics.touchTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct AtlasToolbarFloatTextLabel: View {
    let title: String
    var fontSize: CGFloat = 14
    var fontWeight: Font.Weight = .medium
    var color: Color = AtlasColors.ink
    var horizontalPadding: CGFloat = 12

    var body: some View {
        Text(title)
            .font(.system(size: fontSize, weight: fontWeight))
            .foregroundStyle(color)
            .padding(.horizontal, horizontalPadding)
            .frame(height: AtlasToolbarMetrics.controlHeight)
            .atlasToolbarFloat(cornerRadius: AtlasMetrics.radiusPill)
    }
}

/// Ardot `C/IdeaContextBar` · tint band + Idea avatar + slug / meta.
struct IdeaContextBar: View {
    let slug: String
    var subtitle: String = ""
    var iconURL: URL?
    var ideaID: String = ""

    var body: some View {
        HStack(spacing: 10) {
            EntityAvatar.idea(id: ideaID, url: iconURL, name: slug, size: 40)
            VStack(alignment: .leading, spacing: 4) {
                Text(slug)
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(AtlasTypography.mobileSubheadline())
                        .foregroundStyle(AtlasColors.inkFaint)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [AtlasColors.accentFork.opacity(0.12), AtlasColors.surface.opacity(0.05)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
    }
}

// MARK: - Idea identity (Ardot `129:18` / `129:41` / `129:25`)

struct IdeaMiniStatsRow: View {
    let forkCount: Int
    let flowerCount: Int
    let likeCount: Int
    let commentCount: Int
    var iconSize: CGFloat = 10
    var fontSize: CGFloat = 11
    var iconColor: Color? = nil
    var textColor: Color = AtlasColors.inkFaint

    private var resolvedIconColor: Color {
        iconColor ?? AtlasColors.aiStart
    }

    var body: some View {
        HStack(spacing: 8) {
            miniStat(.fork, forkCount, iconColor ?? AtlasColors.olive)
            miniStat(.flower, flowerCount, iconColor ?? AtlasColors.star)
            miniStat(.heart, likeCount, iconColor ?? AtlasColors.lemonStrong)
            miniStat(.comment, commentCount, iconColor ?? textColor)
        }
    }

    private func miniStat(_ icon: DeimosIcon, _ count: Int, _ color: Color) -> some View {
        HStack(spacing: 3) {
            DeimosIconView(icon: icon, size: iconSize, color: color)
            Text("\(count)")
                .font(.system(size: fontSize, weight: .semibold))
                .foregroundStyle(textColor)
                .monospacedDigit()
        }
    }
}

/// Ardot `C/IdeaIdentityHero` · detail hero band · avatar 56.
struct IdeaIdentityHero: View {
    let idea: Idea
    var iconNamespace: Namespace.ID? = nil

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            heroAvatar

            VStack(alignment: .leading, spacing: 6) {
                Text(idea.displayTitle)
                    .font(AtlasTypography.button())
                    .foregroundStyle(AtlasColors.lemonInk)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    if let owner = idea.agent?.owner {
                        EntityAvatar.user(
                            id: owner.id,
                            url: owner.avatarLink,
                            name: owner.name,
                            size: 18
                        )
                    }
                    Text(idea.creatorLine)
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.olive)
                        .lineLimit(1)
                }

                Text(idea.createdUpdatedLine)
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.olive.opacity(0.8))
                    .lineLimit(2)

                IdeaMiniStatsRow(
                    forkCount: idea.forkCount,
                    flowerCount: idea.flowerCount,
                    likeCount: idea.likeCount,
                    commentCount: idea.commentCount,
                    iconColor: AtlasColors.lemonInk.opacity(0.7),
                    textColor: AtlasColors.olive
                )
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(minHeight: 100)
        .padding(.horizontal, AtlasMetrics.cardPadding)
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(minHeight: 110)
        .background(AtlasColors.aiGradient)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusHero, style: .continuous))
        .shadow(color: AtlasColors.lemonStrong.opacity(0.2), radius: 12, y: 4)
    }

    @ViewBuilder
    private var heroAvatar: some View {
        let avatar = EntityAvatar.idea(id: idea.id, url: idea.iconLink, name: idea.displaySlug, size: 56)
        if let iconNamespace {
            avatar.matchedGeometryEffect(id: "idea-icon-\(idea.id)", in: iconNamespace)
        } else {
            avatar
        }
    }
}

/// Ardot `C/IdeaCardHero` · feed card top band · h96 · avatar 48.
struct IdeaCardHero: View {
    let idea: Idea
    var iconNamespace: Namespace.ID? = nil

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            cardAvatar

            VStack(alignment: .leading, spacing: 5) {
                Text(idea.displayTitle)
                    .font(AtlasTypography.mobileSubheadline())
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    if let owner = idea.agent?.owner {
                        EntityAvatar.user(
                            id: owner.id,
                            url: owner.avatarLink,
                            name: owner.name,
                            size: 18
                        )
                    }
                    Text(idea.creatorLine)
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(1)
                }

                Text(idea.createdUpdatedLine)
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkFaint)
                    .lineLimit(1)

                IdeaMiniStatsRow(
                    forkCount: idea.forkCount,
                    flowerCount: idea.flowerCount,
                    likeCount: idea.likeCount,
                    commentCount: idea.commentCount,
                    iconSize: 13,
                    fontSize: 11
                )
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, AtlasMetrics.cardPadding)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: 96)
        .background(
            LinearGradient(
                colors: [AtlasColors.aiStart.opacity(0.12), AtlasColors.aiEnd.opacity(0.04)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }

    @ViewBuilder
    private var cardAvatar: some View {
        let avatar = EntityAvatar.idea(id: idea.id, url: idea.iconLink, name: idea.displaySlug, size: 48)
        if let iconNamespace {
            avatar.matchedGeometryEffect(id: "idea-icon-\(idea.id)", in: iconNamespace)
        } else {
            avatar
        }
    }
}

enum RepoTab: Int, CaseIterable {
    case readme = 0
    case forks = 1
    case activity = 2
    case discussion = 3

    func title(forkCount: Int, commentCount: Int) -> String {
        switch self {
        case .readme: return "README"
        case .forks: return forkCount > 0 ? "Forks \(forkCount)" : "Forks"
        case .activity: return "Activity"
        case .discussion: return commentCount > 0 ? "讨论 \(commentCount)" : "讨论"
        }
    }
}

/// Ardot `C/RepoTabs` · README · Forks · Activity · 讨论.
struct RepoTabs: View {
    @Binding var selection: Int
    let forkCount: Int
    let commentCount: Int

    var body: some View {
        HStack(spacing: 0) {
            ForEach(RepoTab.allCases, id: \.rawValue) { tab in
                let isSelected = selection == tab.rawValue
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selection = tab.rawValue
                    }
                } label: {
                    VStack(spacing: 8) {
                        Text(tab.title(forkCount: forkCount, commentCount: commentCount))
                            .font(.system(size: 15, weight: isSelected ? .semibold : .medium))
                            .foregroundStyle(isSelected ? AtlasColors.ink : AtlasColors.inkSoft)
                        Capsule()
                            .fill(isSelected ? AtlasColors.aiStart : Color.clear)
                            .frame(height: 3)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.vertical, 8)
        .background(AtlasColors.surface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color(hex: 0xEEF1F4))
                .frame(height: 1)
        }
    }
}

/// Detail README tab · compact flowers preview linking to grid.
struct FlowersPreviewCard: View {
    let flowerCount: Int
    let donors: [FlowerDonor]
    let onOpen: () -> Void
    let onSendFlower: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Button(action: onOpen) {
                HStack(spacing: 8) {
                    Circle()
                        .fill(AtlasColors.accentFork)
                        .frame(width: 8, height: 8)
                    Text("收到的花")
                        .font(AtlasTypography.cardTitle())
                        .foregroundStyle(AtlasColors.ink)
                    Spacer()
                    Text("\(flowerCount) 朵")
                        .font(AtlasTypography.badge())
                        .foregroundStyle(AtlasColors.accentFork)
                    Text("→")
                        .font(AtlasTypography.bodyMedium())
                        .foregroundStyle(AtlasColors.inkFaint)
                }
            }
            .buttonStyle(.plain)

            if donors.isEmpty {
                Text("还没有人送花")
                    .font(AtlasTypography.meta())
                    .foregroundStyle(AtlasColors.inkFaint)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: -8) {
                        ForEach(donors.prefix(8)) { donor in
                            flowerDonorAvatar(donor, size: 36)
                                .overlay(Circle().stroke(AtlasColors.surface, lineWidth: 2))
                        }
                        if donors.count > 8 {
                            ZStack {
                                Circle()
                                    .fill(AtlasColors.fill)
                                    .frame(width: 36, height: 36)
                                Text("+\(donors.count - 8)")
                                    .font(AtlasTypography.overline())
                                    .foregroundStyle(AtlasColors.inkSoft)
                            }
                            .overlay(Circle().stroke(AtlasColors.surface, lineWidth: 2))
                        }
                    }
                }
            }

            AtlasOutlineButton(title: "送一朵花", action: onSendFlower)
        }
        .padding(AtlasMetrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
        .atlasElevatedCard()
    }

    @ViewBuilder
    private func flowerDonorAvatar(_ donor: FlowerDonor, size: CGFloat) -> some View {
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
}

/// Ardot `C/FlowerContributorRow` · donor list row on flowers grid.
struct FlowerContributorRow: View {
    let donor: FlowerDonor

    var body: some View {
        HStack(spacing: 12) {
            donorAvatar

            VStack(alignment: .leading, spacing: 4) {
                Text(donor.name)
                    .font(AtlasTypography.mobileSubheadline())
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)
                Text("送了一朵花 · \(donor.createdAt.absoluteShort)")
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.inkFaint)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            HStack(spacing: 4) {
                DeimosIconView(icon: .flower, size: 14, color: AtlasColors.accentFork)
                Text("1")
                    .font(AtlasTypography.badge())
                    .foregroundStyle(AtlasColors.accentFork)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
    }

    @ViewBuilder
    private var donorAvatar: some View {
        if donor.isAgent, let agentID = donor.agentID {
            EntityAvatar.agent(id: agentID, url: donor.avatarLink, name: donor.name, size: 36)
        } else {
            EntityAvatar.user(
                id: donor.userID ?? donor.id,
                url: donor.avatarLink,
                name: donor.name,
                size: 36
            )
        }
    }
}

/// S07 Message Input Bar (Ardot 179:132): #F4F5F8 r28 + border, 56h,
/// text field + send button 40h r20 lemonStrong inside single container.
/// S07 Message Input Bar (Ardot 179:132): 350×56, r28, bg=#F4F5F8 + border.
/// Text field hugs content (min 36h when empty) + send button 40×40 r20 lemonStrong.
struct BottomInputBar: View {
    @Binding var text: String
    let placeholder: String
    var isSending = false
    var canSend: Bool?
    let onSend: () -> Void

    private var sendEnabled: Bool {
        if isSending { return false }
        if let canSend { return canSend }
        return !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            // Text field — minimal height when empty, expands with content
            TextField(placeholder, text: $text, axis: .vertical)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(AtlasColors.ink)
                .lineLimit(1...4)
                .textFieldStyle(.plain)
                .padding(.horizontal, 14)
                .frame(minHeight: 36, alignment: .center)

            // Send button (S07 179:134): 40×40 r20 lemonStrong, paperplane icon
            Button(action: onSend) {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(sendEnabled ? AtlasColors.lemonInk : .white)
                    .frame(width: 40, height: 40)
                    .background(sendEnabled ? AtlasColors.lemonStrong : AtlasColors.inkDisabled)
                    .clipShape(Circle())
            }
            .disabled(!sendEnabled)
            .buttonStyle(AtlasPressableStyle())
            .padding(.trailing, 4)
        }
        .frame(minHeight: 56)
        .background(Color(hex: 0xF4F5F8))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
    }
}

/// Tab 根页 Header：Screen Title + 右侧 float 操作区（统一 44pt 行高）。
struct AtlasTabScreenHeader<Trailing: View>: View {
    let title: String
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(alignment: .center) {
            Text(title)
                .font(AtlasTypography.screenTitle())
                .foregroundStyle(AtlasColors.ink)
            Spacer(minLength: 0)
            HStack(spacing: AtlasToolbarMetrics.spacing) {
                trailing()
            }
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .frame(height: AtlasToolbarMetrics.barHeight)
    }
}

/// 通知铃铛 · 44pt hit, 36pt visual float.
struct AtlasToolbarBellButton: View {
    var unreadCount: Int = 0
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                DeimosIconView(icon: .bell, size: 17, color: AtlasColors.ink)
                    .frame(width: AtlasMetrics.toolbarVisualSize, height: AtlasMetrics.toolbarVisualSize)
                    .atlasToolbarFloat()
                if unreadCount > 0 {
                    Text("\(min(unreadCount, 99))")
                        .font(AtlasTypography.tabBarLabel())
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(AtlasColors.coral)
                        .clipShape(Capsule())
                        .offset(x: 4, y: -2)
                }
            }
            .frame(width: AtlasMetrics.touchTarget, height: AtlasMetrics.touchTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct AtlasOutlineButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .foregroundStyle(AtlasColors.ink)
                .background(AtlasColors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 25, style: .continuous)
                        .stroke(AtlasColors.border, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 25, style: .continuous))
        }
        .buttonStyle(AtlasPressableStyle())
    }
}

struct AtlasStatusPill: View {
    let text: String

    var body: some View {
        Text(text)
            .font(AtlasTypography.caption())
            .foregroundStyle(AtlasColors.accentActive)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(AtlasColors.accentActiveSoft)
            .clipShape(Capsule())
    }
}

struct WireframeAvatar: View {
    var size: CGFloat = 36
    var imageURL: URL?
    var name: String = ""

    private static let palettes: [[Color]] = [
        [Color(hex: 0xAF52DE), Color(hex: 0x007AFF)],
        [Color(hex: 0x34C759), Color(hex: 0x5AC8FA)],
        [Color(hex: 0xFF9500), Color(hex: 0xFF3B30)],
        [Color(hex: 0x5856D6), Color(hex: 0xAF52DE)],
    ]

    var body: some View {
        ZStack {
            if let imageURL {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        gradientBackground
                    }
                }
                .frame(width: size, height: size)
                .clipShape(Circle())
            } else {
                gradientBackground
            }
        }
        .frame(width: size, height: size)
    }

    private var gradientBackground: some View {
        let palette = Self.palettes[abs(name.hashValue) % Self.palettes.count]
        return ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: palette,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Text(String(name.prefix(1)).uppercased())
                .font(.system(size: size * 0.38, weight: .semibold))
                .foregroundStyle(.white)
        }
    }
}

// MARK: - Compact list row (Ardot `C/CompactListCard` `93:12`)

enum CompactListLayoutStyle {
    case card
    /// Marvel V4.0 flat row — V-Stack feed, no nested card chrome.
    case flat
}

struct CompactListCard<Leading: View, Trailing: View>: View {
    @ViewBuilder let leading: Leading
    let title: String
    var subtitle: String? = nil
    var timestamp: String? = nil
    var cardBackground: Color = AtlasColors.surface
    var showsBorder: Bool = false
    var layoutStyle: CompactListLayoutStyle = .card
    @ViewBuilder let trailing: Trailing

    init(
        @ViewBuilder leading: () -> Leading,
        title: String,
        subtitle: String? = nil,
        timestamp: String? = nil,
        cardBackground: Color = AtlasColors.surface,
        showsBorder: Bool = false,
        layoutStyle: CompactListLayoutStyle = .card,
        @ViewBuilder trailing: () -> Trailing = { EmptyView() }
    ) {
        self.leading = leading()
        self.title = title
        self.subtitle = subtitle
        self.timestamp = timestamp
        self.cardBackground = cardBackground
        self.showsBorder = showsBorder
        self.layoutStyle = layoutStyle
        self.trailing = trailing()
    }

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            leading

            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(title)
                        .font(titleFont)
                        .foregroundStyle(AtlasColors.ink)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    if let timestamp, !timestamp.isEmpty {
                        Text(timestamp)
                            .font(AtlasTypography.meta())
                            .foregroundStyle(AtlasColors.inkSoft)
                    }
                }

                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(subtitleFont)
                        .foregroundStyle(AtlasColors.inkSoft)
                        .multilineTextAlignment(.leading)
                        .lineLimit(2)
                }
            }

            trailing
        }
        .padding(.horizontal, layoutStyle == .flat ? 0 : 16)
        .padding(.vertical, layoutStyle == .flat ? 12 : 16)
        .frame(minHeight: layoutStyle == .flat ? 64 : nil, alignment: .leading)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(layoutStyle == .flat ? Color.clear : cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: layoutStyle == .flat ? 0 : AtlasMetrics.radiusCard, style: .continuous))
        .overlay {
            if showsBorder && layoutStyle == .card {
                RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                    .stroke(AtlasColors.border, lineWidth: 1)
            }
        }
        .modifier(CompactListCardChromeModifier(layoutStyle: layoutStyle))
    }

    private var titleFont: Font {
        layoutStyle == .flat
            ? AtlasTypography.mobileBody()
            : AtlasTypography.cardTitle()
    }

    private var subtitleFont: Font {
        layoutStyle == .flat
            ? AtlasTypography.mobileSubheadline()
            : AtlasTypography.feedBody()
    }
}

private struct CompactListCardChromeModifier: ViewModifier {
    let layoutStyle: CompactListLayoutStyle

    func body(content: Content) -> some View {
        if layoutStyle == .card {
            content.atlasProfileCard()
        } else {
            content
        }
    }
}

struct IdeaCell: View {
    let idea: Idea
    var iconNamespace: Namespace.ID? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            IdeaCardHero(idea: idea, iconNamespace: iconNamespace)

            VStack(alignment: .leading, spacing: 12) {
                Text(idea.title)
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(2)

                if let summary = idea.feedSummaryText {
                    Text(summary)
                        .font(AtlasTypography.mobileBody())
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(2)
                }

                if idea.showsFeedStatus || idea.feedCategoryLabel != nil || !idea.tags.isEmpty {
                    HStack(spacing: 6) {
                        if idea.showsFeedStatus {
                            Text(idea.statusLabel)
                                .font(AtlasTypography.caption())
                                .foregroundStyle(AtlasColors.inkSoft)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(AtlasColors.surfaceSecondary)
                                .clipShape(Capsule())
                        }
                        if let category = idea.feedCategoryLabel {
                            Text("#\(category)")
                                .font(AtlasTypography.caption())
                                .foregroundStyle(AtlasColors.primary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(AtlasColors.chipSelectedBg)
                                .clipShape(Capsule())
                        }
                        ForEach(idea.tags.prefix(idea.feedCategoryLabel == nil ? 3 : 2), id: \.self) { tag in
                            Text("#\(tag)")
                                .font(AtlasTypography.caption())
                                .foregroundStyle(AtlasColors.inkSoft)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(AtlasColors.surfaceSecondary)
                                .clipShape(Capsule())
                        }
                    }
                }

                Rectangle()
                    .fill(AtlasColors.rule)
                    .frame(height: 1)
                    .padding(.top, 2)

                HStack(spacing: 8) {
                    statItem(.heart, idea.likeCount, AtlasColors.lemonStrong)
                    statItem(.flower, idea.flowerCount, AtlasColors.star)
                    statItem(.comment, idea.commentCount, AtlasColors.inkFaint)
                    statItem(.fork, idea.forkCount, AtlasColors.olive)
                }
                .padding(.top, 4)
            }
            .padding(AtlasMetrics.cardPadding)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .atlasElevatedCard()
    }

    private func statItem(_ icon: DeimosIcon, _ count: Int, _ color: Color = AtlasColors.inkFaint) -> some View {
        HStack(spacing: 3) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
            Text("\(count)")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(AtlasColors.inkSoft)
                .monospacedDigit()
        }
    }
}

/// Twitter-style flat feed row — no card, no shadow, hairline divider between rows.
/// Layout: avatar | name(·slug ·time) / title / summary / action bar(fork flower heart comment)
struct IdeaFlatRow: View {
    let idea: Idea
    var iconNamespace: Namespace.ID? = nil

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ideaAvatar

            VStack(alignment: .leading, spacing: 4) {
                // Name · handle · time (Twitter-style inline header)
                HStack(spacing: 4) {
                    Text(idea.agent?.owner?.name ?? "用户")
                        .font(AtlasTypography.feedName())
                        .foregroundStyle(AtlasColors.ink)
                        .lineLimit(1)
                    Text("@\(idea.displaySlug)")
                        .font(AtlasTypography.feedBody())
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(1)
                    Text("· \(idea.createdAt.relativeShort)")
                        .font(AtlasTypography.feedBody())
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(1)
                }

                // Title (GitHub-style idea title)
                Text(idea.displayTitle)
                    .font(AtlasTypography.feedTitle())
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)

                // Summary body
                if let summary = idea.feedSummaryText {
                    Text(summary)
                        .font(AtlasTypography.feedBody())
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }

                // Action bar — evenly spaced, muted gray icons
                HStack {
                    flatStat(.fork, idea.forkCount, AtlasColors.aiStart)
                    Spacer(minLength: 0)
                    flatStat(.flower, idea.flowerCount, AtlasColors.accentWarning)
                    Spacer(minLength: 0)
                    flatStat(.heart, idea.likeCount, AtlasColors.primary)
                    Spacer(minLength: 0)
                    flatStat(.comment, idea.commentCount, AtlasColors.inkFaint)
                }
                .padding(.top, 6)
            }
        }
        .padding(.vertical, 14)
        .padding(.horizontal, AtlasMetrics.pageX)
    }

    @ViewBuilder
    private var ideaAvatar: some View {
        let avatar = EntityAvatar.idea(id: idea.id, url: idea.iconLink, name: idea.displaySlug, size: 40)
        if let iconNamespace {
            avatar.matchedGeometryEffect(id: "idea-icon-\(idea.id)", in: iconNamespace)
        } else {
            avatar
        }
    }

    private func flatStat(_ icon: DeimosIcon, _ count: Int, _ color: Color) -> some View {
        HStack(spacing: 3) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
            Text("\(count)")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(AtlasColors.inkSoft)
                .monospacedDigit()
        }
    }
}

/// A hairline divider for flat feed lists (Twitter-style row separators).
struct FeedRowDivider: View {
    var body: some View {
        Rectangle()
            .fill(Color(hex: 0xEEF1F4))
            .frame(height: 1)
            .padding(.leading, 64) // avatar(40) + spacing(12) + pageX(16) - 4
    }
}

struct FollowingIdeaCell: View {
    let activity: ActivityView

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                actorAvatar
                Text(activity.actorName ?? "用户")
                    .font(AtlasTypography.mobileSubheadline())
                    .foregroundStyle(AtlasColors.inkSoft)
                Spacer()
                Text(activity.createdAt.relativeShort)
                    .font(AtlasTypography.meta())
                    .foregroundStyle(AtlasColors.inkFaint)
            }

            Text(activity.targetTitle ?? "想法")
                .font(AtlasTypography.cardTitle())
                .foregroundStyle(AtlasColors.ink)
                .lineLimit(2)

            if let desc = activity.targetDesc, !desc.isEmpty {
                Text(desc.plainSummary)
                    .font(AtlasTypography.mobileBody())
                    .foregroundStyle(AtlasColors.inkSoft)
                    .lineLimit(2)
            }

            if let category = activity.targetCategory, !category.isEmpty {
                Text("#\(category)")
                    .font(AtlasTypography.caption())
                    .foregroundStyle(AtlasColors.inkSoft)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(AtlasColors.fill)
                    .clipShape(Capsule())
            }

            Text(activity.feedSummary)
                .font(AtlasTypography.meta())
                .foregroundStyle(AtlasColors.accentActive)
        }
        .padding(AtlasMetrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.entityIdea.opacity(0.35))
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
        .atlasElevatedCard()
    }

    @ViewBuilder
    private var actorAvatar: some View {
        let url = activity.actorAvatar.flatMap(URL.init(string:))
        if activity.actorType == "agent" {
            EntityAvatar.agent(id: activity.actorID, url: url, name: activity.actorName ?? "A", size: 32)
        } else {
            EntityAvatar.user(id: activity.actorID, url: url, name: activity.actorName ?? "U", size: 32)
        }
    }
}

struct HomeSearchAgentCell: View {
    let agent: Agent

    var body: some View {
        HStack(spacing: 12) {
            EntityAvatar.agent(id: agent.id, url: agent.avatarLink, name: agent.name, size: 40)
            VStack(alignment: .leading, spacing: 4) {
                Text(agent.name)
                    .font(AtlasTypography.subtitle())
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)
                Text((agent.description ?? agent.capabilities?.joined(separator: " · ") ?? "Agent").plainSummary)
                    .font(AtlasTypography.meta())
                    .foregroundStyle(AtlasColors.inkSoft)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
            DeimosIconView(icon: .chevronRight, size: 13, color: AtlasColors.inkFaint)
        }
        .padding(AtlasMetrics.cardPadding)
        .background(AtlasColors.entityAgent.opacity(0.35))
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
    }
}

/// v6 NativeTabBar — native iOS Tab Bar (replaces floating glass PillTabBar).
///
/// Per Ardot v6 spec (`149:182` / `149:272`):
/// - 393×83px (49pt bar + 34pt safe area), edge-to-edge
/// - White 95% opacity bg, 1px top border `#E7EAF0`
/// - 4 tabs SPACE_EVENLY, icon 26×26 + label 10pt Medium
/// - Active: SF Symbol `.fill` + `#2F6BE4` blue tint
/// - Inactive: `#8A94A6` gray
struct NativeTabBar: View {
    @Binding var selection: MainTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(MainTab.allCases, id: \.self) { tab in
                tabItem(tab)
            }
        }
        // Bar is 49pt — translucent material, no hard border (Apple Design: scroll-edge effect)
        .frame(height: AtlasMetrics.tabBarBarHeight)
        .frame(maxWidth: .infinity)
        .background(.regularMaterial)
    }

    private func tabItem(_ tab: MainTab) -> some View {
        let isSelected = selection == tab
        return Button {
            Haptics.light()
            withAnimation(.spring(response: 0.3, dampingFraction: 1.0)) {
                selection = tab
            }
        } label: {
            VStack(spacing: 4) {
                // Per design node tree: icon 16×16 within 26×26 frame
                Image(systemName: isSelected ? tab.sfSymbolActive : tab.sfSymbol)
                    .font(.system(size: 16, weight: .regular))
                    .frame(width: 26, height: 26)
                Text(tab.title)
                    .font(AtlasTypography.tabBarLabel())
            }
            .frame(maxWidth: .infinity)
            .frame(height: AtlasMetrics.tabBarBarHeight)
            .foregroundStyle(isSelected ? AtlasColors.lemonStrong : AtlasColors.inkSoft)
        }
        .buttonStyle(.plain)
        .contentShape(Rectangle())
    }
}

struct AtlasEmbeddedSearchBar: View {
    let placeholder: String
    @Binding var text: String
    var onSubmit: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            DeimosIconView(icon: .search, size: 16, color: AtlasColors.inkFaint)
            ChineseFriendlyTextField(
                placeholder: placeholder,
                text: $text,
                keyboardType: .default,
                returnKeyType: .search,
                onSubmit: onSubmit
            )
            .frame(height: 24)
        }
        .padding(.horizontal, 12)
        .frame(height: AtlasMetrics.inputHeight)
        .background(AtlasColors.fill)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
    }
}

/// Home / 只读入口：左侧搜索图标 + 占位文案，点击进入搜索页。
struct AtlasSearchBarTrigger: View {
    let placeholder: String

    var body: some View {
        HStack(spacing: 8) {
            DeimosIconView(icon: .search, size: 16, color: AtlasColors.inkFaint)
            Text(placeholder)
                .font(AtlasTypography.bodyMedium())
                .foregroundStyle(AtlasColors.inkFaint)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 12)
        .frame(height: AtlasMetrics.inputHeight)
        .background(AtlasColors.fill)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
    }
}

struct DeimosHeader: View {
    var unreadCount: Int = 0
    var onNotifications: () -> Void

    var body: some View {
        HStack {
            Text("发现")
                .font(AtlasTypography.screenTitle())
                .foregroundStyle(AtlasColors.ink)

            Spacer()

            Button(action: onNotifications) {
                ZStack(alignment: .topTrailing) {
                    DeimosIconView(icon: .bell, size: 20, color: AtlasColors.ink)
                        .frame(width: 40, height: 40)
                        .background(AtlasColors.surface)
                        .clipShape(Circle())

                    if unreadCount > 0 {
                        Text("\(min(unreadCount, 99))")
                            .font(AtlasTypography.tabBarLabel())
                            .foregroundStyle(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(AtlasColors.coral)
                            .clipShape(Capsule())
                            .offset(x: 2, y: 0)
                    }
                }
            }
        }
        .padding(.horizontal, AtlasMetrics.pageX)
    }
}

struct SegmentControl: View {
    let items: [String]
    @Binding var selection: Int

    var body: some View {
        HStack(spacing: 20) {
            ForEach(items.indices, id: \.self) { index in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selection = index
                    }
                } label: {
                    VStack(spacing: 6) {
                        Text(items[index])
                            .font(.system(size: 15, weight: selection == index ? .semibold : .regular))
                            .foregroundStyle(selection == index ? AtlasColors.ink : AtlasColors.inkFaint)
                        Capsule()
                            .fill(selection == index ? AtlasColors.primary : .clear)
                            .frame(width: 32, height: 3)
                    }
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(.horizontal, AtlasMetrics.pageX)
    }
}

struct AtlasSegmentedPill: View {
    let items: [String]
    @Binding var selection: Int

    var body: some View {
        HStack(spacing: 4) {
            ForEach(items.indices, id: \.self) { index in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selection = index
                    }
                } label: {
                    Text(items[index])
                        .font(.system(size: 15, weight: selection == index ? .semibold : .medium))
                        .foregroundStyle(selection == index ? AtlasColors.primary : AtlasColors.inkSoft)
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background(selection == index ? AtlasColors.surface : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
                        .shadow(color: selection == index ? AtlasMetrics.shadowProfileColor : .clear, radius: 3, y: 1)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .frame(height: 48)
        .background(AtlasColors.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }
}

struct AtlasPageHeader: View {
    let eyebrow: String
    let title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if !eyebrow.isEmpty {
                Text(eyebrow)
                    .font(AtlasTypography.overline())
                    .foregroundStyle(AtlasColors.inkFaint)
            }
            Text(title)
                .font(AtlasTypography.largeTitle())
                .foregroundStyle(AtlasColors.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct AtlasFilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: isSelected ? .semibold : .medium))
                .foregroundStyle(isSelected ? Color.white : AtlasColors.inkSoft)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(isSelected ? AtlasColors.primary : AtlasColors.surfaceSecondary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct AtlasCard<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(AtlasMetrics.cardPadding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AtlasColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
            .atlasElevatedCard()
    }
}

// MARK: - v7 AI Hero Card (Ardot S02 `179:27`)

/// v7 AIHeroCard — lemon solid hero card with title, subtitle, and pill CTA.
/// Per Ardot node tree: VERTICAL itemSpacing=10, padding=[22,22,0,18], r24, lemon bg, 350×132.
struct AIHeroCard: View {
    let title: String
    let subtitle: String
    let ctaTitle: String
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(AtlasTypography.heroTitle())
                .foregroundStyle(AtlasColors.lemonInk)
                .lineLimit(2)

            Text(subtitle)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(AtlasColors.olive)

            Button(action: action) {
                HStack(spacing: 4) {
                    Text("\(ctaTitle) →")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(AtlasColors.olive)
                }
                .padding(.horizontal, 22)
                .frame(height: 38)
                .background(Color.white)
                .clipShape(Capsule())
            }
            .buttonStyle(AtlasPressableStyle())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 22)
        .padding(.top, 0)
        .padding(.bottom, 18)
        .frame(height: 132)
        .background(AtlasColors.lemon)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

// MARK: - v7 Idea Cover Card (Ardot S02 `179:40`)

/// v7 IdeaCoverCard — per S02 node tree.
/// Card: white bg + 1px border #E7EAF0, r24, VERTICAL itemSpacing=0.
/// Cover: 132h lemonSoft bg, absolute layout — status badge (olive pill top-left) + title (lemonInk 20pt).
/// Footer: single-line meta text "作者 · 时间 · 送花 N · 喜欢 N · 评论 N · Fork N" 13pt Medium.
struct IdeaCoverCard: View {
    let idea: Idea
    var coverImageURL: URL?
    var iconNamespace: Namespace.ID?
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 0) {
                coverSection
                metaSection
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AtlasColors.surface)
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(AtlasColors.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    // Cover area — 132h lemonSoft bg, absolute positioned children (Ardot 179:41)
    private var coverSection: some View {
        ZStack(alignment: .topLeading) {
            // Background — lemonSoft #F2FFC5
            Rectangle()
                .fill(AtlasColors.lemonSoft)
                .frame(maxWidth: .infinity)

            // Status badge — top-left, olive #5F7400 bg, white text (Ardot 179:42)
            if idea.showsFeedStatus {
                Text(idea.statusLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .frame(height: 24)
                    .background(AtlasColors.olive)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .padding(.leading, 16)
                    .padding(.top, 16)
            }

            // Cover title — lemonInk 20pt ExtraBold (Ardot 179:44)
            // Positioned at bottom of cover area
            Text(idea.displayTitle)
                .font(.system(size: 20, weight: .heavy))
                .foregroundStyle(AtlasColors.lemonInk)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                .frame(maxHeight: .infinity, alignment: .bottom)
        }
        .frame(height: 132)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    // Footer — single-line meta text (Ardot 179:45)
    /// Footer — single-line meta text (Ardot S02 179:45).
    /// "作者 · 时间 · 送花 N · 喜欢 N · 评论 N · Fork N" 13pt Medium #6B7280.
    private var metaSection: some View {
        Text(idea.coverMetaLine)
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(Color(hex: 0x6B7280))
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
    }
}

struct AtlasTealButton: View {
    let title: String
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView().tint(AtlasColors.lemonInk)
                }
                Text(title)
                    .font(.system(size: 15, weight: .bold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .foregroundStyle(AtlasColors.lemonInk)
            .background(AtlasColors.primaryAction)
            .clipShape(RoundedRectangle(cornerRadius: 25, style: .continuous))
        }
        .buttonStyle(AtlasPressableStyle())
        .disabled(isLoading)
    }
}

struct AtlasTealOutlineButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .foregroundStyle(AtlasColors.ink)
                .background(AtlasColors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 25, style: .continuous)
                        .stroke(AtlasColors.border, lineWidth: 1)
                )
        }
    }
}

struct StatChip: View {
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .center, spacing: 4) {
            Text(value)
                .font(AtlasTypography.headline())
                .foregroundStyle(AtlasColors.ink)
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(AtlasColors.inkFaint)
                .multilineTextAlignment(.center)
        }
        .padding(10)
        .frame(maxWidth: .infinity)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
    }
}

/// 圆圈线框统计（动态页等）。
struct WireframeStatCircle: View {
    let value: String
    let label: String
    var diameter: CGFloat = 72

    var body: some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
                .frame(width: diameter, height: diameter)
                .background(AtlasColors.canvas)
                .clipShape(Circle())
                .overlay(Circle().stroke(AtlasColors.rule, lineWidth: 1))
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(AtlasColors.inkFaint)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
    }
}

struct IdeaRoute: Identifiable, Hashable {
    let id: String
}

struct UserRoute: Identifiable, Hashable {
    let id: String
}

struct AgentRoute: Identifiable, Hashable {
    let id: String
}

struct ActivityCell: View {
    let activity: ActivityView

    var body: some View {
        CompactListCard(
            leading: { actorAvatar },
            title: activityLine,
            subtitle: activitySubtitle,
            timestamp: activity.createdAt.relativeShort,
            layoutStyle: .flat
        )
    }

    @ViewBuilder
    private var actorAvatar: some View {
        let url = activity.actorAvatar.flatMap(URL.init(string:))
        if activity.actorType == "agent" {
            EntityAvatar.agent(id: activity.actorID, url: url, name: activity.actorName ?? "A", size: 40)
        } else {
            EntityAvatar.user(id: activity.actorID, url: url, name: activity.actorName ?? "U", size: 40)
        }
    }

    private var activityLine: String {
        let actor = activity.actorName ?? "用户"
        switch activity.action {
        case "flower", "flowers":
            return "\(actor) 给你的想法送了一朵花"
        case "comment":
            return "\(actor) 评论了你的想法"
        case "fork":
            return "\(actor) Fork 了你的想法"
        case "follow":
            return "\(actor) 关注了你"
        case "register", "create":
            return "\(actor) 发布了新想法"
        case "share":
            return "\(actor) 分享了想法"
        default:
            return "\(actor) · \(activity.targetTitle ?? "想法")"
        }
    }

    private var activitySubtitle: String? {
        switch activity.action {
        case "comment":
            if let desc = activity.targetDesc, !desc.isEmpty {
                return "「\(desc.plainSummary)」"
            }
            return activity.targetTitle
        default:
            return activity.targetTitle
        }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    var onComplete: (() -> Void)?

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        controller.completionWithItemsHandler = { _, _, _, _ in
            onComplete?()
        }
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

struct AtlasOfflineBanner: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            DeimosIconView(icon: .wifiOff, size: 14, color: AtlasColors.inkSoft)
            Text(message.isEmpty ? "网络不可用，显示缓存内容" : message)
                .font(.system(size: 12))
                .foregroundStyle(AtlasColors.inkSoft)
                .lineLimit(2)
            Spacer()
            Button("重试", action: onRetry)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 44)
        .background(AtlasColors.entityUser)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
    }
}

extension String {
    var plainSummary: String {
        replacingOccurrences(of: "#", with: "")
            .replacingOccurrences(of: "*", with: "")
            .replacingOccurrences(of: "`", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

extension Date {
    var relativeShort: String {
        let interval = Date().timeIntervalSince(self)
        if interval < 0 {
            return absoluteShort
        }
        if interval < 60 {
            return "刚刚"
        }
        let minutes = Int(interval / 60)
        if minutes < 60 {
            return "\(minutes)分钟前"
        }
        let hours = Int(interval / 3600)
        if hours < 24 {
            return "\(hours)小时前"
        }
        let days = Int(interval / 86_400)
        if days < 7 {
            return "\(days)天前"
        }
        return absoluteShort
    }

    /// 年内 `M月d日`，跨年 `yyyy/M/d`。
    var absoluteShort: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        if Calendar.current.isDate(self, equalTo: Date(), toGranularity: .year) {
            formatter.dateFormat = "M月d日"
        } else {
            formatter.dateFormat = "yyyy/M/d"
        }
        return formatter.string(from: self)
    }

    /// Idea Feed 时间：本地绝对时间，避免批量创建时全部显示同一相对值。
    var feedTimestamp: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        let calendar = Calendar.current
        if calendar.isDateInToday(self) {
            formatter.dateFormat = "HH:mm"
            return "今天 \(formatter.string(from: self))"
        }
        if calendar.isDateInYesterday(self) {
            formatter.dateFormat = "HH:mm"
            return "昨天 \(formatter.string(from: self))"
        }
        if calendar.isDate(self, equalTo: Date(), toGranularity: .year) {
            formatter.dateFormat = "M月d日 HH:mm"
            return formatter.string(from: self)
        }
        formatter.dateFormat = "yyyy/M/d HH:mm"
        return formatter.string(from: self)
    }
}

// MARK: - Haptics (Apple Design: Multimodal feedback)

/// Centralized haptic feedback — per Apple Design "Multimodal feedback" principle.
enum Haptics {
    static func light() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func medium() { UIImpactFeedbackGenerator(style: .medium).impactOccurred() }
    static func rigid() { UIImpactFeedbackGenerator(style: .rigid).impactOccurred() }
    static func selection() { UISelectionFeedbackGenerator().selectionChanged() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    static func error() { UINotificationFeedbackGenerator().notificationOccurred(.error) }
}
