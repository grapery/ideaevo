import SwiftUI

/// Wanye iOS system, synchronized with the current Ardot mobile board.
///
/// Visual language: white canvas, deep ink, lime interaction state, and restrained
/// translucent chrome for contextual toolbars. Colors stay semantic so the feature
/// layer does not need to know which surface it is rendering on.
///
/// Key changes v5→v6:
/// - App background: `#FAFAFA` → `#FFFFFF` pure white
/// - Ink: `#0F172A` → `#0F1B2D` deep navy
/// - Primary: `#2563EB` → `#2F6BE4`; action `#3E7BF0`
/// - AI gradient: purple→indigo → `#6BA5F8→#3A6EDA` blue
/// - Tab Bar: floating glass pill → native iOS edge-to-edge
enum AtlasColors {
    // MARK: - Neutral (白底基底)

    /// App background — `#FFFFFF` pure white. Global page base (v6: was #FAFAFA).
    static let canvas = Color.white
    /// Muted background — `#F2F3F7` (Deimos iOS26 bg-muted). Back button base, steppers.
    static let surfaceSecondary = Color(hex: 0xF2F3F7)
    /// Input background — `#F2F3F5`. Input fields, clear buttons.
    static let bgInput = Color(hex: 0xF2F3F5)
    /// AI message bubble background — `#F1F2F4`.
    static let bgBubbleAI = Color(hex: 0xF1F2F4)
    /// Fill — aliased to surfaceSecondary for input/secondary fills.
    static let fill = Color(hex: 0xF2F3F7)
    /// Card background — pure white. Content cards sit on canvas.
    static let surface = Color.white
    /// Hairline rule / divider — `#F0F2F5` (v6: extra-light divider).
    static let rule = Color(hex: 0xF0F2F5)
    /// Form/detail card border — `#E8EAEC` (Deimos iOS26 border token).
    static let border = Color(hex: 0xE8EAEC)
    /// Profile card border — `#EDEFF3`.
    static let borderProfile = Color(hex: 0xEDEFF3)

    // MARK: - Ink (Text Hierarchy · v6: #0F1B2D base)

    /// Primary text — `#0F1B2D` deep navy. Titles, card titles, body.
    static let ink = Color(hex: 0x0F1B2D)
    /// Secondary text — `#8A94A6`. Subtitles, placeholders, card footers.
    static let inkSoft = Color(hex: 0x8A94A6)
    /// Tertiary text — `#596472` (Deimos iOS26 text-tertiary). Summaries, tertiary info.
    static let inkTertiary = Color(hex: 0x596472)
    /// Faint text — `#A9B2C0` (Deimos iOS26 text-faint). Input placeholders, disabled text.
    static let inkFaint = Color(hex: 0xA9B2C0)
    static let inkDisabled = Color(hex: 0xC7C7CC)

    // MARK: - Brand (品牌色)

    /// Accent used for selected tabs, status pills and the primary action — `#D9FF40` (Deimos iOS26 lemon).
    static let lemon = Color(hex: 0xD9FF40)
    static let lemonSoft = Color(hex: 0xF5FFC7)
    static let lemonInk = Color(hex: 0x1A2403)
    /// `#BEE90D` — lemon-strong, a distinct token from `lemon` (Deimos iOS26 lemon-strong).
    static let lemonStrong = Color(hex: 0xBEE90D)
    /// `#CBEA16` — chat-specific lemon fill used by user bubbles + the send button in the
    /// chat composer (ardot S07 `179:124` user bubble + `179:134` send button). Slightly less
    /// saturated than `lemonStrong` (#BEE90D) to read as a softer chat surface rather than a
    /// primary action button. Kept as a separate token so existing `lemonStrong` callers
    /// (primary buttons, active tabs) are unaffected.
    static let lemonChat = Color(hex: 0xCBEA16)
    /// `#EAF1FF` — assistant chat bubble fill (ardot S07 `179:126`). A more saturated blue
    /// than the older `#F1F5FF` placeholder used previously.
    static let chatAssistantBubble = Color(hex: 0xEAF1FF)
    static let olive = Color(hex: 0x627405)
    /// Olive meta text on lemon-tinted surfaces — `#65703A` (ardot 237:662 eyebrow, 237:666 筛选, 237:179 stat label).
    static let oliveMeta = Color(hex: 0x65703A)
    /// Small CTA fill inside cards — `#D2F522` (ardot 237:691 查看详情, Design Rules "lemon #D2F522").
    static let lemonCTA = Color(hex: 0xD2F522)
    /// Legacy semantic names are kept while the feature layer is migrated.
    /// `primaryAction`/`chatBlue`/`heroBlue` resolve to lemon-strong (#BEE90D),
    /// the interactive lemon fill used by primary buttons, send buttons, and active
    /// tabs (Ardot iOS26 components C/PrimaryButton 237:40, Glass Input Bar Send 237:101,
    /// Glass Tab Bar active 237:82). `lemon` (#D9FF40) is reserved for decorative lemon surfaces.
    static let primary = lemonInk
    static let primaryAction = lemonStrong
    static let chatBlue = lemonStrong
    static let heroBlue = lemonStrong
    /// Profile avatar placeholder background — `#22488F` deep navy (Ardot 149:393).
    static let profileAvatarBg = Color(hex: 0x22488F)
    /// Badge background — `#E7F0FE`. Stat icon circle base, badge base.
    static let badgeBg = Color(hex: 0xE7F0FE)

    // MARK: - AI Gradient (AI 品牌渐变 · v6: blue)

    /// Kept for API compatibility. Current Ardot cards use flat ink instead of a
    /// decorative blue gradient.
    static let aiStart = lemon
    static let aiEnd = lemon

    // MARK: - Semantic

    /// Destructive — `#E5484D`. Delete, deactivate, danger actions.
    static let destructive = Color(hex: 0xE5484D)
    /// Star / flower — `#F5BA43` (Deimos iOS26 star). Rating stars, flowers (appreciation).
    static let star = Color(hex: 0xF5BA43)
    /// Success / online — `#2EA36B` (Deimos iOS26 success). Success states, online indicator.
    static let success = Color(hex: 0x2EA36B)
    /// Warning — `#F5A524` (Deimos iOS26 warning). Warning states, caution.
    static let warning = Color(hex: 0xF5A524)

    // MARK: - Status Accents (engagement actions)

    /// Like / heart — primary blue (consistency).
    static let accentActive = lemon
    static let accentActiveSoft = lemonSoft
    /// Fork is a first-class lime action across the idea graph.
    static let accentFork = lemon
    static let accentForkSoft = lemon.opacity(0.14)
    /// Flower / appreciation — `#F5A524` (Deimos iOS26 warning).
    static let accentWarning = warning
    static let accentWarningSoft = Color(hex: 0xFEF3C7)

    // MARK: - Selected / Chip tints

    /// Selected chip background — `#E7F0FE` badge blue.
    static let chipSelectedBg = lemon
    static let chipSelectedText = lemonInk

    // MARK: - Entity identity colors (v6: retained for avatar identity)

    static let entityUser = Color(hex: 0xF5F7FA)
    static let entityAgent = lemon
    static let entityIdea = lemonSoft
    static let notificationUnread = lemonSoft

    // MARK: - Convenience gradient presets

    /// Compatibility gradient for legacy consumers. New surfaces should use `ink`.
    static var aiGradient: LinearGradient {
        LinearGradient(colors: [aiStart, aiEnd], startPoint: .topLeading, endPoint: .bottomTrailing)
    }
    /// Compatibility gradient for legacy consumers.
    static var primaryGradient: LinearGradient {
        LinearGradient(colors: [ink, Color(hex: 0x1C2D12)], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    // MARK: - Legacy aliases (kept for backward compat; delegate to v6 tokens)

    static let teal = primary
    static let coral = destructive
    static let amber = accentWarning
    static let purple = aiStart
    static let primaryLight = heroBlue
    static let primarySoft = chipSelectedBg
    static let tealSoft = accentActiveSoft
    static let coralSoft = destructive.opacity(0.08)
    static let purpleSoft = aiStart.opacity(0.08)
    static let subtle = surfaceSecondary
    static let glassOverlay = Color.white.opacity(0.72)
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}
