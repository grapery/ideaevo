import SwiftUI

/// Ardot Master Board icon mapping (`Ic/*` components exported via MCP).
enum DeimosIcon: String {
    case heart
    case flower
    case comment
    case fork
    case home
    case chat
    case activity
    case profile
    case search
    case bell
    case share
    case send
    case sparkles
    case chevronBack
    case chevronRight
    case gear
    case lock
    case edit
    case sliders
    case info
    case shield
    case plus
    case phone
    case trash
    case globe
    case close
    case check
    case users
    case document
    case bookmark
    case externalLink
    case more
    case devices
    case logout
    case user
    case mail
    case eye
    case eyeOff
    case wifiOff
    case refresh
    case download
    case wrench
    case clock
    case star
    case archive

    /// Vector assets exported from Ardot (`35:*` / `88:*` icon components).
    var assetName: String {
        switch self {
        case .heart: return "deimos-heart"
        case .flower: return "deimos-flower"
        case .comment: return "deimos-comment"
        case .fork: return "deimos-fork"
        case .home: return "deimos-home"
        case .chat: return "deimos-chat"
        case .activity: return "deimos-activity"
        case .profile: return "deimos-profile"
        case .search: return "deimos-search"
        case .bell: return "deimos-bell"
        case .send: return "deimos-send"
        case .share: return "deimos-share"
        case .chevronBack: return "deimos-chevron-back"
        case .chevronRight: return "deimos-chevron-right"
        case .gear: return "deimos-gear"
        case .lock: return "deimos-lock"
        case .edit: return "deimos-edit"
        case .sparkles: return "deimos-sparkles"
        case .sliders: return "deimos-sliders"
        case .info: return "deimos-info"
        case .shield: return "deimos-shield"
        case .plus: return "deimos-plus"
        case .phone: return "deimos-phone"
        case .trash: return "deimos-trash"
        case .globe: return "deimos-globe"
        case .close: return "deimos-close"
        case .check: return "deimos-check"
        case .users: return "deimos-users"
        case .document: return "deimos-document"
        case .bookmark: return "deimos-bookmark"
        case .externalLink: return "deimos-external-link"
        case .more: return "deimos-more"
        case .devices: return "deimos-devices"
        case .logout: return "deimos-logout"
        case .user: return "deimos-user"
        case .mail: return "deimos-mail"
        case .eye: return "deimos-eye"
        case .eyeOff: return "deimos-eye-off"
        case .wifiOff: return "deimos-wifi-off"
        case .refresh: return "deimos-refresh"
        case .download: return "deimos-download"
        case .wrench: return "deimos-wrench"
        case .clock: return "deimos-clock"
        case .star: return "deimos-star"
        case .archive: return "deimos-archive"
        }
    }

}

struct DeimosIconView: View {
    let icon: DeimosIcon
    var size: CGFloat = 16
    var color: Color = AtlasColors.inkFaint

    var body: some View {
        Image(icon.assetName)
            .renderingMode(.template)
            .resizable()
            .scaledToFit()
        .frame(width: size, height: size)
        .foregroundStyle(color)
    }
}

extension View {
    /// v6 card elevation — `0 8px 16px rgba(15,27,45,0.10)`. Ink-colored shadow.
    func atlasElevatedCard() -> some View {
        shadow(color: AtlasMetrics.shadowCardColor, radius: AtlasMetrics.shadowCardRadius, y: AtlasMetrics.shadowCardY)
    }

    /// v6 profile card elevation — `0 6px 12px rgba(15,27,45,0.05)`. Gentler than content cards.
    func atlasProfileCard() -> some View {
        shadow(color: AtlasMetrics.shadowProfileColor, radius: AtlasMetrics.shadowProfileRadius, y: AtlasMetrics.shadowProfileY)
    }

    /// Settings / list group card — same elevation as content cards.
    func atlasSettingsGroupShadow() -> some View {
        shadow(color: AtlasMetrics.shadowCardColor, radius: AtlasMetrics.shadowCardRadius, y: AtlasMetrics.shadowCardY)
    }

    /// Contextual controls intentionally use material so scrolling content remains
    /// visible, softened and visually separated below the toolbar.
    ///
    /// Apple floating-glass spec (ardot iOS26): white/72% fill + #E8EAEC/65% border + soft ink
    /// shadow. Earlier 0.38 overlay read as flat grey with no edge — the border + higher opacity
    /// restore the glass-pill silhouette used across idea detail / chat / profile toolbars.
    @ViewBuilder
    func atlasToolbarFloat(cornerRadius: CGFloat = 999) -> some View {
        if cornerRadius >= 999 {
            background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().fill(Color.white.opacity(0.72)))
                .overlay(Circle().stroke(AtlasColors.border.opacity(0.65), lineWidth: 1))
                .shadow(color: AtlasColors.ink.opacity(0.10), radius: 7, y: 3)
        } else {
            background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous).fill(Color.white.opacity(0.72)))
                .overlay(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous).stroke(AtlasColors.border.opacity(0.65), lineWidth: 1))
                .shadow(color: AtlasColors.ink.opacity(0.10), radius: 7, y: 3)
        }
    }

    func atlasPagePadding() -> some View {
        padding(.horizontal, AtlasMetrics.pageX)
    }
}
