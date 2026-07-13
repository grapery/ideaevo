import SwiftUI

/// Typography for Wanye v6 — Flat · Card · Clean.
///
/// Global font **Inter**, SF Pro as system fallback. Large titles use tracking-tight.
/// Source: Ardot v6 Design System `138:33` typography section.
///
/// | Token | Size/LH | Weight | Use |
/// |-------|---------|--------|-----|
/// | large-title | 36/40 | ExtraBold (800) | Tab root large title |
/// | hero-title | 26/32 | ExtraBold | Hero card title, cover overlay |
/// | section-header | 24/28 | ExtraBold | Section titles |
/// | card-title | 17/22 | SemiBold (600) | Card titles, conversation titles |
/// | body | 17/26 | Medium (500) | Body, settings row labels |
/// | subtitle | 16/24 | Medium | Subtitles, helper text |
/// | card-footer | 15/22 | Medium | Card footer, creator info |
/// | chat-body | 15/21 | Medium/Regular | Chat messages |
/// | caption | 14/20 | Medium | Captions, helper labels |
/// | badge | 13/16 | SemiBold | Status badges, tab labels |
/// | tab-label | 10/12 | Medium | Tab Bar labels |
enum AtlasTypography {
    // MARK: - Display

    /// 36pt ExtraBold — Tab root large title (探索/对话/动态/我的).
    static func largeTitle() -> Font { .system(size: 36, weight: .heavy) }
    /// 26pt ExtraBold — Hero card title, cover title overlay.
    static func titleLarge() -> Font { .system(size: 26, weight: .heavy) }
    /// 22pt ExtraBold — AI hero card inline title.
    static func heroTitle() -> Font { .system(size: 22, weight: .heavy) }
    /// 22pt Bold — profile name, idea detail hero title.
    static func titleMedium() -> Font { .system(size: 22, weight: .bold) }

    // MARK: - Headlines

    /// 24pt ExtraBold — section headers (热门想法, 最新动态).
    static func sectionHeader() -> Font { .system(size: 24, weight: .heavy) }
    /// 18pt Semibold — card section titles (legacy).
    static func headline() -> Font { .system(size: 18, weight: .semibold) }

    // MARK: - Body (v6: Medium weight)

    /// 17pt Medium — body, settings row labels (v6: Medium not Regular).
    static func mobileBody() -> Font { .system(size: 17, weight: .medium) }
    /// 16pt Medium — subtitles, helper text.
    static func subtitle() -> Font { .system(size: 16, weight: .medium) }
    /// 15pt Medium — card footer, creator info.
    static func mobileSubheadline() -> Font { .system(size: 15, weight: .medium) }
    /// 15pt Regular — secondary body, feed card summary.
    static func bodyLarge() -> Font { .system(size: 17, weight: .medium) }
    /// 14pt Regular — helper text, metadata body.
    static func bodyMedium() -> Font { .system(size: 14, weight: .regular) }

    // MARK: - Chat body

    /// 15pt Medium — user chat messages.
    static func chatBodyUser() -> Font { .system(size: 15, weight: .medium) }
    /// 15pt Regular — AI chat messages.
    static func chatBodyAI() -> Font { .system(size: 15, weight: .regular) }

    // MARK: - Meta

    /// 13pt Regular — stats counts, timestamps.
    static func meta() -> Font { .system(size: 13, weight: .regular) }
    /// 14pt Medium — captions, helper labels.
    static func caption() -> Font { .system(size: 14, weight: .medium) }
    /// 13pt SemiBold — status badges.
    static func badge() -> Font { .system(size: 13, weight: .semibold) }
    /// 11pt Semibold — uppercase badges, overlines.
    static func overline() -> Font { .system(size: 11, weight: .semibold) }

    // MARK: - Interactive

    /// 17pt Bold — primary buttons (v6: Bold, pill shape).
    static func button() -> Font { .system(size: 17, weight: .bold) }
    /// 15pt Bold — pill CTA text inside hero cards.
    static func cta() -> Font { .system(size: 15, weight: .bold) }
    /// 14pt Semibold — pill chip text.
    static func pill() -> Font { .system(size: 14, weight: .semibold) }

    // MARK: - Tab Bar

    /// 10pt Medium — Tab Bar labels.
    static func tabBarLabel() -> Font { .system(size: 10, weight: .medium) }

    // MARK: - Twitter-style feed rows (legacy, kept for backward compat)

    /// 15pt Bold — tweet/idea row author name.
    static func feedName() -> Font { .system(size: 15, weight: .bold) }
    /// 17pt SemiBold — idea row title (GitHub-style).
    static func feedTitle() -> Font { .system(size: 17, weight: .semibold) }
    /// 15pt Regular — tweet/idea row body text.
    static func feedBody() -> Font { .system(size: 15, weight: .regular) }
    /// 14pt Bold — profile stats numbers.
    static func statsNumber() -> Font { .system(size: 14, weight: .bold) }

    // MARK: - Legacy aliases (kept for backward compat)

    static func screenTitle() -> Font { largeTitle() }
    static func navTitle() -> Font { .system(size: 20, weight: .bold) }
    static func pageTitle() -> Font { titleMedium() }
    static func cardTitle() -> Font { .system(size: 17, weight: .semibold) }
    static func body() -> Font { mobileBody() }
    static func bodySmall() -> Font { mobileSubheadline() }
    static func subheadline() -> Font { bodyMedium() }
    static func footnote() -> Font { caption() }
    static func display() -> Font { largeTitle() }
    static func eyebrow() -> Font { overline() }
}
