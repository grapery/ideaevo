import SwiftUI

/// Typography for zdesign — AI Tech × iOS Native Premium.
/// All fonts use SF Pro (system). Sizes align with the 28-screen ardot spec.
enum AtlasTypography {
    // MARK: - Display
    /// 32pt Bold — onboarding headline, hero headlines.
    static func display() -> Font { .system(size: 32, weight: .heavy) }
    /// 26pt ExtraBold — marketing / splash titles.
    static func titleLarge() -> Font { .system(size: 26, weight: .heavy) }
    /// 22pt Bold — profile name, idea detail hero title.
    static func titleMedium() -> Font { .system(size: 22, weight: .bold) }
    /// Tab root / screen title — 22pt Bold.
    static func screenTitle() -> Font { titleMedium() }

    // MARK: - Headlines
    /// 18pt Semibold — section headers, card section titles.
    static func headline() -> Font { .system(size: 18, weight: .semibold) }

    // MARK: - Body
    /// 17pt Regular — idea README body, primary content text.
    static func mobileBody() -> Font { .system(size: 17, weight: .regular) }
    /// 15pt Regular — feed card summary, secondary body.
    static func mobileSubheadline() -> Font { .system(size: 15, weight: .regular) }
    static func bodyLarge() -> Font { mobileBody() }
    /// 14pt Regular — helper text, metadata body.
    static func bodyMedium() -> Font { .system(size: 14, weight: .regular) }

    // MARK: - Meta
    /// 13pt Regular — stats counts, timestamps.
    static func meta() -> Font { .system(size: 13, weight: .regular) }
    /// 12pt Medium — chip labels, small captions.
    static func caption() -> Font { .system(size: 12, weight: .medium) }
    /// 11pt Semibold — uppercase badges, overlines.
    static func overline() -> Font { .system(size: 11, weight: .semibold) }

    // MARK: - Interactive
    /// 17pt Semibold — primary buttons.
    static func button() -> Font { .system(size: 17, weight: .semibold) }
    /// 14pt Semibold — pill chip text.
    static func pill() -> Font { .system(size: 14, weight: .semibold) }

    // MARK: - Twitter-style feed rows
    /// 15pt Bold — tweet/idea row author name.
    static func feedName() -> Font { .system(size: 15, weight: .bold) }
    /// 17pt Semibold — idea row title (GitHub-style).
    static func feedTitle() -> Font { .system(size: 17, weight: .semibold) }
    /// 15pt Regular — tweet/idea row body text.
    static func feedBody() -> Font { .system(size: 15, weight: .regular) }
    /// 14pt Bold — profile stats numbers (Twitter-style inline).
    static func statsNumber() -> Font { .system(size: 14, weight: .bold) }

    // MARK: - Legacy aliases (kept for backward compat)
    static func largeTitle() -> Font { screenTitle() }
    static func navTitle() -> Font { .system(size: 17, weight: .semibold) }
    static func pageTitle() -> Font { titleMedium() }
    static func cardTitle() -> Font { .system(size: 17, weight: .semibold) }
    static func body() -> Font { mobileBody() }
    static func bodySmall() -> Font { mobileSubheadline() }
    static func subheadline() -> Font { bodyMedium() }
    static func footnote() -> Font { caption() }
    static func tabBarLabel() -> Font { .system(size: 10, weight: .semibold) }
    static func eyebrow() -> Font { overline() }
}
