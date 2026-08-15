import SwiftUI

/// Layout metrics for Wanye v6 — Flat · Card · Clean.
///
/// Key changes v5→v6:
/// - Tab root horizontal padding: 16 → **24** (content width 345px)
/// - Detail page horizontal padding: **20** (content width 353px)
/// - Card radius: 12/16 → **20** standard, **24** cover, **28** hero
/// - Buttons: rectangular → **pill** (full corner radius)
/// - Card gap: 16 → **20**
/// - Section gap: 16 → **32**
/// - Tab Bar: floating glass pill → native iOS (edge-to-edge, top border)
/// - Shadow color: black `rgba(0,0,0)` → ink `rgba(15,27,45)`
///
/// Source: Ardot v6 Design System `138:33` + design-tokens-v6.md.
enum AtlasMetrics {
    // MARK: - Spacing (4pt Grid)

    /// Tab root horizontal padding — **24px** (v6: was 16). Content width = 345px.
    static let pageX: CGFloat = 24
    /// Detail page horizontal padding — **20px**. Content width = 353px.
    static let detailX: CGFloat = 20
    /// Card inner padding — 16px.
    static let cardPadding: CGFloat = 16
    /// Card gap — **20px** (v6: was 16).
    static let cardGap: CGFloat = 20
    /// Large section gap — **32px** (v6: was 16).
    static let sectionGap: CGFloat = 32
    /// List item gap — 16px.
    static let itemGap: CGFloat = 16
    /// Chat message gap — 14px.
    static let chatGap: CGFloat = 14
    /// Content bottom padding — **120px** (clears tab bar + safe area).
    static let bottomClear: CGFloat = 120

    static let inputHeight: CGFloat = 48
    /// Primary button height — **52px** (Deimos iOS26 C/PrimaryButton 237:40).
    static let primaryButtonHeight: CGFloat = 52
    /// Minimum touch target — 44pt.
    static let touchTarget: CGFloat = 44
    /// Settings/list row minimum height.
    static let settingsRowMinHeight: CGFloat = 54
    /// Tab root action button size (`+` on Home) — 40×40 circle (v6).
    static let centerActionSize: CGFloat = 40
    /// Back button — **36×36** circle (v6: was 36, now bg #F1F3F7).
    static let backButtonSize: CGFloat = 40
    /// Send button FAB — **52×52** circle (v6).
    static let sendButtonSize: CGFloat = 52
    /// Cover-page float button — **44×44** white circle (v6: transparent overlay).
    static let coverButtonSize: CGFloat = 44
    /// Toolbar float visual diameter (inside 44pt hit).
    static let toolbarVisualSize: CGFloat = 36
    static let sheetGrabberWidth: CGFloat = 40
    static let sheetGrabberHeight: CGFloat = 4

    // MARK: - Radii (v6: 16 / 20 / 24 / 28 / 999)

    /// Input radius — 16px.
    static let radiusInput: CGFloat = 16
    /// Default card radius — **20px** (v6: was 16).
    static let radiusCard: CGFloat = 20
    /// Cover card radius — **24px** (v6: image cover cards).
    static let radiusCover: CGFloat = 24
    /// Hero card radius — **24px** (Deimos iOS26 Metrics radius-hero 237:35).
    static let radiusHero: CGFloat = 24
    /// Sheet corner radius — **24px** (project.manifest radiusSheet).
    static let radiusSheet: CGFloat = 24
    /// Pills/chips/buttons — full corner radius.
    static let radiusChip: CGFloat = 9999
    static let radiusPill: CGFloat = 9999

    // MARK: - Tab Bar (Native iOS · v6 core change)

    /// Tab bar total height — **83px** (49pt bar + 34pt safe area).
    static let tabBarHeight: CGFloat = 83
    /// Tab bar bar height — 49px (excludes safe area).
    static let tabBarBarHeight: CGFloat = 49
    /// Tab bar safe area bottom — 34px.
    static let tabBarSafeBottom: CGFloat = 34
    // Legacy floating pill metrics (kept for compat, unused in v6 layout).
    static let tabBarRadius: CGFloat = 999
    static let tabBarActiveRadius: CGFloat = 999
    static let tabBarBottomPadding: CGFloat = 0

    // MARK: - Engagement / Input Bars

    static let engagementBarHeight: CGFloat = 64
    static let bottomInputBarHeight: CGFloat = 56

    // MARK: - iOS26 Chrome Heights

    /// Status bar height — **62px** (Deimos iOS26 Metrics status-height).
    static let statusHeight: CGFloat = 62
    /// Push/floating nav toolbar height — **48px** (Deimos iOS26 Metrics nav-height).
    static let navHeight: CGFloat = 48

    // MARK: - Shadow presets (v6: ink-colored, subtle)

    /// Card shadow — `0 8px 16px rgba(15,27,45,0.10)`.
    static let shadowCardColor: Color = Color(hex: 0x0F1B2D, opacity: 0.10)
    static let shadowCardRadius: CGFloat = 16
    static let shadowCardY: CGFloat = 8
    /// Profile card shadow — `0 6px 12px rgba(15,27,45,0.05)`.
    static let shadowProfileColor: Color = Color(hex: 0x0F1B2D, opacity: 0.05)
    static let shadowProfileRadius: CGFloat = 12
    static let shadowProfileY: CGFloat = 6
    /// Floating shadow — Engagement Bar, Rate Modal `0 4px 16px rgba(15,27,45,0.15)`.
    static let shadowFloatColor: Color = Color(hex: 0x0F1B2D, opacity: 0.15)
    static let shadowFloatRadius: CGFloat = 16
    static let shadowFloatY: CGFloat = 4
}

// MARK: - Shadow View Modifiers
// Note: atlasElevatedCard, atlasSettingsGroupShadow, atlasToolbarFloat are defined in
// DeimosIcons.swift. atlasSheetZoomBackground is defined in AtlasPopupComponents.swift.
// These delegate to the v6 shadow token values defined above.
