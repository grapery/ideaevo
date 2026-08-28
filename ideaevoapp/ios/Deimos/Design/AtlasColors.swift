import SwiftUI

/// Deimos iOS design tokens — v8 (Zinc Ink retheme, 2026-08-28).
///
/// Aligned with the web app's design language (`frontend/app/globals.css` v2):
/// light zinc canvas, deep ink, single dark CTA, link-blue for interactive text,
/// brand orange reserved for wish/flower emphasis.
///
/// Key changes v7→v8 (Cream Violet → Zinc Ink):
/// - Canvas: `#FAF7F2` warm cream → `#FAFAFA` zinc-50
/// - Brand: violet `#8C7DF4`/`#9D8FF7` → ink action `#18181B` + link blue `#3370FF`
/// - Accent: wish/flower/like emphasis moves to brand orange `#FF8A00`
/// - Selected chips / active tab pill: accent fill → ink `#18181B` with white label
/// - All legacy alias names (lemon*, olive*, chip*, tabAccent, limeCTA…) are kept and
///   remapped so the feature layer compiles unchanged.
enum AtlasColors {
    // MARK: - Neutral (v8: zinc 基线, 对齐 web --bg-* / --rule-*)

    /// App background — `#FAFAFA` zinc-50. Global page base.
    static let canvas = Color(hex: 0xFAFAFA)
    /// Muted background — `#F4F4F5` zinc-100. Back button base, steppers, chips.
    static let surfaceSecondary = Color(hex: 0xF4F4F5)
    /// Input background — `#F4F4F5`. Input fields, clear buttons.
    static let bgInput = Color(hex: 0xF4F4F5)
    /// `#F2F2F7` — settings group container fill (iOS system grouped background).
    static let settingsGroupFill = Color(hex: 0xF2F2F7)
    /// `#E8EBF0` — settings row hairline border.
    static let settingsRowStroke = Color(hex: 0xE8EBF0)
    /// `#F1F1F4` — white card hairline stroke (web --rule-light).
    static let cardStroke = Color(hex: 0xF1F1F4)
    /// `#F4F4F5` — secondary stat tile fill.
    static let statTileSecondary = Color(hex: 0xF4F4F5)
    /// `#52525B` — secondary stat tile label text (zinc-600).
    static let statLabelSecondary = Color(hex: 0x52525B)
    // MARK: - Privacy / Moderation surface tints
    /// `#F4F4F5` — report reasons card fill + create-agent permissions card.
    static let noticeSoft = Color(hex: 0xF4F4F5)
    /// `#FFF7E8` — block-user info card fill. Warm cream.
    static let infoWarm = Color(hex: 0xFFF7E8)
    /// `#FFF1F1` — delete-account warning card fill. Soft red.
    static let warningSoft = Color(hex: 0xFFF1F1)
    /// `#E5484D` — destructive action button fill.
    static let destructiveFill = Color(hex: 0xE5484D)
    /// AI message bubble background — `#F1F2F4`.
    static let bgBubbleAI = Color(hex: 0xF1F2F4)
    /// Fill — aliased to surfaceSecondary for input/secondary fills.
    static let fill = Color(hex: 0xF4F4F5)
    /// Card background — pure white. Content cards sit on canvas.
    static let surface = Color.white
    /// Hairline rule / divider — `#E4E4E7` zinc-200 (web --rule).
    static let rule = Color(hex: 0xE4E4E7)
    /// Form/detail card border — `#E4E4E7`.
    static let border = Color(hex: 0xE4E4E7)
    /// Profile card border — `#F1F1F4`.
    static let borderProfile = Color(hex: 0xF1F1F4)

    // MARK: - Ink (Text Hierarchy · v8: zinc)

    /// Primary text — `#09090B` zinc-950. Titles, card titles, body.
    static let ink = Color(hex: 0x09090B)
    /// Secondary text — `#71717A` zinc-500. Subtitles, placeholders, card footers.
    static let inkSoft = Color(hex: 0x71717A)
    /// Tertiary text — `#52525B` zinc-600. Summaries, tertiary info.
    static let inkTertiary = Color(hex: 0x52525B)
    /// Faint text — `#A1A1AA` zinc-400. Input placeholders, disabled text.
    static let inkFaint = Color(hex: 0xA1A1AA)
    static let inkDisabled = Color(hex: 0xD4D4D8)

    // MARK: - Interactive system (v8: 单一强调体系)

    /// Link / interactive text — `#3370FF` (web --accent-link). Object names, deep links,
    /// selected tint states on neutral surfaces.
    static let linkBlue = Color(hex: 0x3370FF)
    /// `#E8F0FF` — link-tinted soft fill (web --accent-link-light).
    static let linkBlueSoft = Color(hex: 0xE8F0FF)
    /// Brand orange — `#FF8A00` (web --primary). Wish / flower / like emphasis only.
    static let brandOrange = Color(hex: 0xFF8A00)
    /// `#FFF3E0` — orange-tinted soft fill (web --primary-soft).
    static let brandOrangeSoft = Color(hex: 0xFFF3E0)
    /// Primary action fill — `#18181B` zinc-900 (web --action). Buttons, send, active tabs.
    static let action = Color(hex: 0x18181B)
    /// Action fill hover — `#27272A` zinc-800.
    static let actionHover = Color(hex: 0x27272A)

    // MARK: - Brand (legacy aliases · v8 remapped)

    /// Selected chip / accent fill — `#18181B` ink (was violet). Pair with `lemonInk` label.
    static let lemon = action
    /// Soft fill for badges, chips, icon circles — `#F4F4F5` neutral (was violet tint).
    static let lemonSoft = Color(hex: 0xF4F4F5)
    /// Label on accent/selected fills — white (was deep olive-ink). Every "dark text on
    /// accent fill" call site keeps contrast on the ink fills.
    static let lemonInk = Color.white
    /// Primary interactive fill — `#18181B` ink. CTAs, send buttons, active tabs.
    static let lemonStrong = action
    /// User chat bubble — `#3370FF` link blue (web --chat-user-bg). Detached from
    /// lemonStrong so chat stays blue while CTAs go ink.
    static let lemonChat = linkBlue
    /// Assistant chat bubble — white.
    static let chatAssistantBubble = Color.white
    /// Tool-activity pill background — `#F4F4F5` neutral.
    static let chatActivityFill = Color(hex: 0xF4F4F5)
    /// Tool-activity pill label text — `#52525B`.
    static let chatActivityInk = Color(hex: 0x52525B)
    /// Chat idea-suggestion card CTA fill — `#18181B` ink (was lime).
    static let limeCTA = action
    /// Chat toolbar back-circle fill — `#F4F4F5`.
    static let chatNavCircle = Color(hex: 0xF4F4F5)
    /// Glass Input Bar hairline stroke — `#E4E4E7`.
    static let chatInputStroke = Color(hex: 0xE4E4E7)
    /// Legacy alias — text-only accent (was olive #65703A). Resolves to link blue.
    static let olive = linkBlue
    /// Violet-ink meta text — `#3370FF` link blue (was violet). Filter links, stat labels.
    static let oliveMeta = linkBlue
    /// Small CTA fill inside cards — `#18181B` ink.
    static let lemonCTA = action
    /// Legacy semantic names kept while the feature layer is migrated.
    static let primary = lemonInk
    static let primaryAction = lemonStrong
    static let chatBlue = lemonChat
    static let heroBlue = lemonStrong
    /// Profile avatar placeholder background — `#22488F` deep navy.
    static let profileAvatarBg = Color(hex: 0x22488F)
    /// Badge background — `#E8F0FF` link-tinted. Stat icon circle base, badge base.
    static let badgeBg = Color(hex: 0xE8F0FF)

    // MARK: - AI Gradient (decorative)

    /// Flat brand-orange accent for legacy gradient consumers.
    static let aiStart = brandOrange
    static let aiEnd = brandOrange

    // MARK: - Semantic

    /// Destructive — `#E5484D`. Delete, deactivate, danger actions.
    static let destructive = Color(hex: 0xE5484D)
    /// Star / flower — `#FF8A00` brand orange. Rating stars, flowers (appreciation).
    static let star = brandOrange
    /// Success / online — `#2EA36B`. Success states, online indicator.
    static let success = Color(hex: 0x2EA36B)
    /// Success soft fill — `#E8F5ED`. Pair with `success` text.
    static let successSoft = Color(hex: 0xE8F5ED)
    /// Danger soft fill — `#FFF2F2`. Pair with `destructive` text.
    static let dangerSoft = Color(hex: 0xFFF2F2)
    /// Tab bar active segment fill — `#18181B` ink pill. Label stays `lemonInk` (white).
    static let tabAccent = action
    /// Warning — `#F5A524`. Warning states, caution.
    static let warning = Color(hex: 0xF5A524)

    // MARK: - Status Accents (engagement actions)

    /// Like / heart / wish active — brand orange (web --primary).
    static let accentActive = brandOrange
    static let accentActiveSoft = brandOrangeSoft
    /// Fork is a link-blue action across the idea graph (web fork badge).
    static let accentFork = linkBlue
    static let accentForkSoft = linkBlueSoft
    /// Flower / appreciation — brand orange.
    static let accentWarning = brandOrange
    static let accentWarningSoft = brandOrangeSoft

    // MARK: - Selected / Chip tints

    /// Chip selected background — `#18181B` ink (web filter-chip active).
    static let chipSelectedBg = action
    /// Chip selected text — white on ink fill.
    static let chipSelectedText = Color.white

    // MARK: - Entity identity colors

    static let entityUser = Color(hex: 0xF5F7FA)
    static let entityAgent = linkBlueSoft
    static let entityIdea = Color(hex: 0xF4F4F5)
    static let notificationUnread = brandOrangeSoft

    // MARK: - Convenience gradient presets

    /// Compatibility gradient for legacy consumers. New surfaces should use `ink`.
    static var aiGradient: LinearGradient {
        LinearGradient(colors: [aiStart, aiEnd], startPoint: .topLeading, endPoint: .bottomTrailing)
    }
    /// Compatibility gradient for legacy consumers.
    static var primaryGradient: LinearGradient {
        LinearGradient(colors: [action, actionHover], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    // MARK: - Legacy aliases (kept for backward compat; delegate to v8 tokens)

    static let teal = linkBlue
    static let coral = destructive
    static let amber = accentWarning
    static let purple = aiStart
    static let primaryLight = linkBlueSoft
    static let primarySoft = brandOrangeSoft
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
