import SwiftUI

/// Layout metrics for zdesign — AI Tech × iOS Native Premium.
///
/// Key changes from Atlas v5: larger radii (16/24px standard), subtle shadows,
/// consistent spacing rhythm. Source: zdesign SKILL spec.
enum AtlasMetrics {
    // MARK: - Spacing
    static let pageX: CGFloat = 16
    static let sectionGap: CGFloat = 16
    /// Card inner padding — generous for "breathing room" (zdesign principle 6).
    static let cardPadding: CGFloat = 16
    static let inputHeight: CGFloat = 48
    /// Primary button height — taller for premium feel.
    static let primaryButtonHeight: CGFloat = 54
    /// Marvel V4.0 minimum touch target.
    static let touchTarget: CGFloat = 44
    /// Settings / list row minimum height.
    static let settingsRowMinHeight: CGFloat = 52
    /// Tab root breaking action (`+` on Home).
    static let centerActionSize: CGFloat = 56
    /// Toolbar float visual diameter (inside 44pt hit).
    static let toolbarVisualSize: CGFloat = 36
    static let sheetGrabberWidth: CGFloat = 40
    static let sheetGrabberHeight: CGFloat = 4

    // MARK: - Radii (zdesign: 12 / 16 / 24 / 999)
    /// Small inline buttons, pill CTAs inside cards — `rounded-xl` 12px.
    static let radiusInput: CGFloat = 12
    /// Default — cards, inputs, list rows — `rounded-2xl` 16px.
    static let radiusCard: CGFloat = 16
    /// Hero banners, modals, map containers — `rounded-3xl` 24px.
    static let radiusHero: CGFloat = 24
    static let radiusSheet: CGFloat = 24
    /// Chips — slightly larger than v5 for premium feel.
    static let radiusChip: CGFloat = 999
    static let radiusPill: CGFloat = 999

    // MARK: - Tab Bar (Glass Pill — signature zdesign element)
    static let tabBarHeight: CGFloat = 62
    static let tabBarRadius: CGFloat = 36
    /// Concentric with pill: R_inner = R_outer - D (36 - 4 = 32).
    static let tabBarActiveRadius: CGFloat = 32
    static let tabBarBottomPadding: CGFloat = 21

    // MARK: - Engagement / Input Bars
    static let engagementBarHeight: CGFloat = 64
    static let bottomInputBarHeight: CGFloat = 56

    // MARK: - Shadow presets (zdesign subtle shadows)
    /// Card shadow — very low opacity, gentle float.
    static let shadowCardColor: Color = .black.opacity(0.05)
    static let shadowCardRadius: CGFloat = 8
    static let shadowCardY: CGFloat = 1
    /// Floating shadow — modals, tab bar, FAB.
    static let shadowFloatColor: Color = .black.opacity(0.08)
    static let shadowFloatRadius: CGFloat = 16
    static let shadowFloatY: CGFloat = 4
}
