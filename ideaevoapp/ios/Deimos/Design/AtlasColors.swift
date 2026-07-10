import SwiftUI

/// zdesign design tokens — AI Tech × iOS Native Premium.
///
/// Visual language: 科技蓝主色 + AI 紫色渐变 + 磨砂玻璃 + 微阴影 + 大圆角.
/// Source: zdesign SKILL spec (AI Tech × iOS Native Design System).
enum AtlasColors {
    // MARK: - Primary (Tech Blue)
    /// Primary action color — blue-600 `#2563EB`. CTAs, active tab, selected states.
    static let primary = Color(hex: 0x2563EB)
    /// Primary light — sky-500 `#0EA5E9`. Gradient partner, secondary highlights.
    static let primaryLight = Color(hex: 0x0EA5E9)

    // MARK: - AI Accent (Purple→Indigo gradient)
    /// AI gradient start — purple-500 `#8B5CF6`. AI avatars, AI action chips.
    static let aiStart = Color(hex: 0x8B5CF6)
    /// AI gradient end — indigo-600 `#4F46E5`.
    static let aiEnd = Color(hex: 0x4F46E5)

    // MARK: - Backgrounds
    /// Page background — gray-50 `#F9FAFB`. Global page base.
    static let canvas = Color(hex: 0xF9FAFB)
    /// Card background — pure white. Content cards sit on canvas for depth.
    static let surface = Color.white
    /// Secondary surface — slightly off-white for inputs/sub-sections.
    static let surfaceSecondary = Color(hex: 0xF3F4F6)
    static let fill = Color(hex: 0xF9FAFB)
    /// Hairline rule / divider — `#EBEBEB`.
    static let rule = Color(hex: 0xEBEBEB)

    // MARK: - Ink (Text Hierarchy)
    /// Primary text — slate-900 `#0F172A`. Titles, key paragraphs.
    static let ink = Color(hex: 0x0F172A)
    /// Secondary text — gray-500 `#6B7280`. Subtitles, helper text.
    static let inkSoft = Color(hex: 0x6B7280)
    /// Faint text — slate-400 `#94A3B8`. Placeholders, tertiary info.
    static let inkFaint = Color(hex: 0x94A3B8)
    static let inkDisabled = Color(hex: 0xC7C7CC)

    // MARK: - Semantic
    /// Destructive — red-500 `#EF4444`. Delete actions, destructive confirms.
    static let destructive = Color(hex: 0xEF4444)

    // MARK: - Status Accents (used for engagement actions)
    /// Like / heart — blue-600 (same as primary, for consistency).
    static let accentActive = primary
    static let accentActiveSoft = Color(hex: 0xEFF6FF)
    /// Fork — purple (AI accent, since forking evolves ideas with AI).
    static let accentFork = aiStart
    static let accentForkSoft = Color(hex: 0xF3E8FF)
    /// Flower / appreciation — amber-500 `#F59E0B`.
    static let accentWarning = Color(hex: 0xF59E0B)
    static let accentWarningSoft = Color(hex: 0xFEF3C7)

    // MARK: - Selected / Chip tints
    /// Selected chip background — blue-50 `#EFF6FF`.
    static let chipSelectedBg = Color(hex: 0xEFF6FF)
    static let chipSelectedText = primary

    // MARK: - Glass overlay
    /// Frosted glass — white at 80% opacity (use with `.ultraThinMaterial`).
    static let glassOverlay = Color.white.opacity(0.8)

    // MARK: - Entity (Bento) — kept for avatar identity colors
    static let entityUser = Color(hex: 0xFFF4A8)
    static let notificationUnread = Color(hex: 0xEFF6FF)
    static let entityAgent = Color(hex: 0xD4F56A)
    static let entityIdea = Color(hex: 0xB8F5EC)

    // MARK: - Convenience gradient presets
    /// AI purple→indigo gradient. Apply to AI avatars, AI buttons.
    static var aiGradient: LinearGradient {
        LinearGradient(colors: [aiStart, aiEnd], startPoint: .topLeading, endPoint: .bottomTrailing)
    }
    /// Tech blue→sky gradient. Apply to primary hero banners, profile covers.
    static var primaryGradient: LinearGradient {
        LinearGradient(colors: [primary, primaryLight], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    // MARK: - Legacy aliases (kept for backward compat; delegate to new tokens)
    static let teal = primary
    static let coral = destructive
    static let amber = accentWarning
    static let purple = aiStart
    static let primarySoft = chipSelectedBg
    static let tealSoft = accentActiveSoft
    static let coralSoft = destructive.opacity(0.08)
    static let purpleSoft = aiStart.opacity(0.08)
    static let subtle = surfaceSecondary
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}
