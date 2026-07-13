import SwiftUI

/// Wanye v7 Design System — Lemon · Flat · Card · Clean.
///
/// Visual language: 扁平化设计 + 卡片式布局 + 纯白背景 + **柠檬绿品牌** + AI 柠檬强调.
/// Source: Ardot `Wanye Lemon Theme` (179:446) + Master Board screens S00–S34.
///
/// Key changes v6→v7 (blue → lemon):
/// - Brand primary: `#2F6BE4` blue → `#CBEA16` lemon-strong
/// - AI accent: blue gradient `#6BA5F8→#3A6EDA` → lemon `#D8FF3F` solid / lemon→lemon-strong
/// - Hero cards: blue gradient → lemon solid with `lemonInk`/`olive` text
/// - Selected chips / CTAs / Tab active → lemon-strong
/// - Neutral tokens (canvas, ink, borders) unchanged from v6
enum AtlasColors {
    // MARK: - Neutral (白底基底)

    /// App background — `#FFFFFF` pure white. Global page base (v6: was #FAFAFA).
    static let canvas = Color.white
    /// Muted background — `#F1F3F7`. Back button base, steppers, minor controls.
    static let surfaceSecondary = Color(hex: 0xF1F3F7)
    /// Input background — `#F2F3F5`. Input fields, clear buttons.
    static let bgInput = Color(hex: 0xF2F3F5)
    /// AI message bubble background — `#F1F2F4`.
    static let bgBubbleAI = Color(hex: 0xF1F2F4)
    /// Fill — aliased to surfaceSecondary for input/secondary fills.
    static let fill = Color(hex: 0xF1F3F7)
    /// Card background — pure white. Content cards sit on canvas.
    static let surface = Color.white
    /// Hairline rule / divider — `#F0F2F5` (v6: extra-light divider).
    static let rule = Color(hex: 0xF0F2F5)
    /// Form/detail card border — `#E7EAF0` (v6: new border token).
    static let border = Color(hex: 0xE7EAF0)
    /// Profile card border — `#EDEFF3`.
    static let borderProfile = Color(hex: 0xEDEFF3)

    // MARK: - Ink (Text Hierarchy · v6: #0F1B2D base)

    /// Primary text — `#0F1B2D` deep navy. Titles, card titles, body.
    static let ink = Color(hex: 0x0F1B2D)
    /// Secondary text — `#8A94A6`. Subtitles, placeholders, card footers.
    static let inkSoft = Color(hex: 0x8A94A6)
    /// Tertiary text — `#5A6472`. Itinerary summaries, tertiary info.
    static let inkTertiary = Color(hex: 0x5A6472)
    /// Faint text — `#9AA2AF`. Input placeholders, disabled text.
    static let inkFaint = Color(hex: 0x9AA2AF)
    static let inkDisabled = Color(hex: 0xC7C7CC)

    // MARK: - Brand (品牌色 · v7 Lemon)

    /// Primary — `#CBEA16` lemon-strong. Main link color, active tab tint, selected chip fill.
    static let primary = Color(hex: 0xCBEA16)
    /// Primary action — `#CBEA16` lemon-strong. Primary button fill, active chip, publish CTA.
    static let primaryAction = Color(hex: 0xCBEA16)
    /// Chat send / user bubble — `#CBEA16` lemon-strong (v7: was chat-blue).
    static let chatBlue = Color(hex: 0xCBEA16)
    /// Hero / cover fallback — `#D8FF3F` lemon (v7: was hero-blue).
    static let heroBlue = Color(hex: 0xD8FF3F)
    /// Profile avatar placeholder background — `#627405` olive (v7: was deep navy).
    static let profileAvatarBg = Color(hex: 0x627405)
    /// Badge background — `#F6FFC7` lemon-soft. Stat icon circle base, badge base, selected chip bg.
    static let badgeBg = Color(hex: 0xF6FFC7)

    // MARK: - Lemon Tokens (v7 核心品牌色)

    /// Lemon — `#D8FF3F`. AI Hero background, logo block, email-login button, agent avatar placeholder.
    static let lemon = Color(hex: 0xD8FF3F)
    /// Lemon-strong — `#CBEA16`. Selected chip, publish button, tab active icon, active accent.
    static let lemonStrong = Color(hex: 0xCBEA16)
    /// Lemon-soft — `#F6FFC7`. Idea card cover gradient, light lemon backgrounds.
    static let lemonSoft = Color(hex: 0xF6FFC7)
    /// Lemon-ink — `#1A2303`. Primary text on lemon backgrounds (hero titles, button labels).
    static let lemonInk = Color(hex: 0x1A2303)
    /// Olive — `#627405`. Secondary text on lemon backgrounds (hero subtitles, CTA labels, tab active label).
    static let olive = Color(hex: 0x627405)

    // MARK: - AI Gradient (AI 品牌渐变 · v7: lemon)

    /// AI gradient start — `#D8FF3F` lemon (v7: was blue #6BA5F8).
    static let aiStart = Color(hex: 0xD8FF3F)
    /// AI gradient end — `#CBEA16` lemon-strong (v7: was blue #3A6EDA).
    static let aiEnd = Color(hex: 0xCBEA16)

    // MARK: - Semantic

    /// Destructive — `#E5484D`. Delete, deactivate, danger actions.
    static let destructive = Color(hex: 0xE5484D)
    /// Star / flower — `#F5B942`. Rating stars, flowers (appreciation).
    static let star = Color(hex: 0xF5B942)
    /// Success / online — `#2FA36B`. Success states, online indicator.
    static let success = Color(hex: 0x2FA36B)

    // MARK: - Status Accents (engagement actions)

    /// Like / heart — primary blue (consistency).
    static let accentActive = primary
    static let accentActiveSoft = badgeBg
    /// Fork — AI blue gradient start.
    static let accentFork = aiStart
    static let accentForkSoft = aiStart.opacity(0.08)
    /// Flower / appreciation — `#F5B942` star gold.
    static let accentWarning = star
    static let accentWarningSoft = Color(hex: 0xFEF3C7)

    // MARK: - Selected / Chip tints

    /// Selected chip background — `#E7F0FE` badge blue.
    static let chipSelectedBg = badgeBg
    static let chipSelectedText = primary

    // MARK: - Entity identity colors (v6: retained for avatar identity)

    static let entityUser = Color(hex: 0xFFF4A8)
    static let entityAgent = Color(hex: 0xD4F56A)
    static let entityIdea = Color(hex: 0xB8F5EC)
    static let notificationUnread = badgeBg

    // MARK: - Convenience gradient presets (v7: lemon)

    /// AI lemon gradient `#D8FF3F → #CBEA16`. Apply to AI avatars, AI buttons, AI hero cards.
    static var aiGradient: LinearGradient {
        LinearGradient(colors: [aiStart, aiEnd], startPoint: .topLeading, endPoint: .bottomTrailing)
    }
    /// Primary lemon gradient `#D8FF3F → #CBEA16` (v7: was blue; now same direction as AI gradient).
    static var primaryGradient: LinearGradient {
        LinearGradient(colors: [lemon, lemonStrong], startPoint: .topLeading, endPoint: .bottomTrailing)
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
    static let glassOverlay = Color.white.opacity(0.8)
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}
