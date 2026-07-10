import SwiftUI

struct AuthRequiredSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthSession.self) private var session
    @State private var showLogin = false

    var body: some View {
        AtlasBottomSheetChrome(
            title: "登录后继续",
            message: "浏览不受影响。登录后可送花、评论、关注与对话。",
            primaryTitle: "登录",
            secondaryTitle: "先看看",
            primaryAction: { showLogin = true },
            secondaryAction: { dismiss() }
        )
        .atlasBottomSheetStyle()
        .atlasSheetZoomBackground(isPresented: showLogin)
        .sheet(isPresented: $showLogin) {
            NavigationStack {
                LoginView(initialRegister: false, onCancel: { showLogin = false })
            }
        }
        .onChange(of: session.isAuthenticated) { _, loggedIn in
            if loggedIn { dismiss() }
        }
    }
}

struct TagPill: View {
    let text: String

    var body: some View {
        Text(text)
            .font(AtlasTypography.meta())
            .foregroundStyle(AtlasColors.inkSoft)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(AtlasColors.fill)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusChip, style: .continuous))
    }
}

/// Ardot `C/EngagementBar` · h72 · 4 equal columns · ♥ ✿ ⑂ 💬 (share lives in push nav).
struct EngagementBar: View {
    let likeCount: Int
    let flowerCount: Int
    let forkCount: Int
    let commentCount: Int
    var isLiked = false
    /// Highlights ✿ column (e.g. Flowers grid); default emphasizes Fork with `accent-fork`.
    var highlightFlowers = false
    var onLike: () -> Void = {}
    var onFlower: () -> Void = {}
    var onFork: () -> Void = {}
    var onComment: () -> Void = {}

    var body: some View {
        HStack(spacing: 0) {
            column(icon: .heart, count: likeCount, iconColor: isLiked ? AtlasColors.primary : AtlasColors.inkFaint, countColor: isLiked ? AtlasColors.primary : AtlasColors.inkFaint, countWeight: isLiked ? .semibold : .medium, action: onLike)
            column(icon: .flower, count: flowerCount, iconColor: highlightFlowers ? AtlasColors.accentWarning : AtlasColors.inkFaint, countColor: highlightFlowers ? AtlasColors.accentWarning : AtlasColors.inkFaint, countWeight: highlightFlowers ? .semibold : .medium, action: onFlower)
            column(icon: .fork, count: forkCount, iconColor: AtlasColors.aiStart, countColor: AtlasColors.aiStart, countWeight: .semibold, action: onFork)
            column(icon: .comment, count: commentCount, iconColor: AtlasColors.inkFaint, countColor: AtlasColors.inkFaint, countWeight: .medium, action: onComment)
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.vertical, 10)
        .frame(height: AtlasMetrics.engagementBarHeight)
        .background(.ultraThinMaterial)
        .overlay(AtlasColors.glassOverlay)
        .shadow(color: .black.opacity(0.06), radius: 16, x: 0, y: -2)
    }

    private func column(
        icon: DeimosIcon,
        count: Int,
        iconColor: Color,
        countColor: Color,
        countWeight: Font.Weight,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 2) {
                DeimosIconView(icon: icon, size: 18, color: iconColor)
                Text("\(count)")
                    .font(.system(size: 11, weight: countWeight))
                    .foregroundStyle(countColor)
                    .monospacedDigit()
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}

struct ChatBubble: View {
    let text: String
    let isUser: Bool

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 48) }
            Text(text)
                .font(.system(size: 16))
                .foregroundStyle(isUser ? .white : AtlasColors.ink)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(isUser ? AtlasColors.primary : Color(hex: 0xF1F5F9))
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            if !isUser { Spacer(minLength: 48) }
        }
    }
}

struct SettingsMenuRow: View {
    let title: String
    var subtitle: String?
    var value: String?
    var destructive = false

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(AtlasTypography.mobileBody())
                    .foregroundStyle(destructive ? AtlasColors.coral : AtlasColors.ink)
                if let subtitle {
                    Text(subtitle)
                        .font(AtlasTypography.meta())
                        .foregroundStyle(AtlasColors.inkFaint)
                }
            }
            Spacer()
            if let value {
                Text(value)
                    .font(AtlasTypography.mobileSubheadline())
                    .foregroundStyle(AtlasColors.inkFaint)
            }
            DeimosIconView(icon: .chevronRight, size: 12, color: AtlasColors.inkFaint)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: AtlasMetrics.settingsRowMinHeight)
        .padding(.vertical, subtitle == nil ? 0 : 4)
    }
}
