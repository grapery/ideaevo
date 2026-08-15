import SwiftUI

/// Typography for the Deimos · iOS 26 redesign.
///
/// The ardot board (page `237:1` "Deimos · iOS 26 Redesign") specifies
/// **SF Pro Display** for large/headline text and **SF Pro Text** for body/UI text — never Inter.
/// SwiftUI's `.system(...)` resolves to SF Pro, so the family is already correct; the
/// important detail is that the design uses **Bold (700)** and **Semibold (600)** — never
/// Heavy/Black. Earlier revisions read "ExtraBold" off the *legacy* Master Board
/// (page `47:1`, which used Inter) and over-weighted display copy. This file now maps the
/// authoritative iOS-native board.
///
/// Verified text-node evidence (fontName/size on page 237:1):
/// | Role | Family | Style | Size | ardot node |
/// |------|--------|-------|------|------------|
/// | Tab-root large title | SF Pro Display | Bold | 34 | 237:143 "探索" |
/// | Idea detail title | SF Pro Display | Bold | 25 | 246:20 "智能家居能源管理系统" |
/// | AI hero / agent name | SF Pro Display | Bold | 22 | 237:75, 246:110 |
/// | Nav / editor title | SF Pro Display | Bold | 18 | 246:16, 246:73 |
/// | Floating toolbar title | SF Pro Display | Semibold | 14 | 237:96 "设置" |
/// | Card / section title | SF Pro Text | Semibold | 16-17 | 246:31(16), 246:119(17) |
/// | Body | SF Pro Text | Regular | 14 | 246:32, 246:112 |
/// | Input body | SF Pro Text | Regular | 16 | 237:100, 246:82 |
/// | Meta / caption | SF Pro Text | Regular | 12-13 | 246:29(12), 246:40(13) |
/// | Helper / overline | SF Pro Text | Medium | 12-13 | 246:46(12), 246:61(13) |
/// | Primary button | SF Pro Text | Semibold | 17 | 237:41 "主操作" |
/// | Tab Bar label (active) | SF Pro Text | Semibold | 10 | 237:84 "探索" |
/// | Tab Bar label (inactive) | SF Pro Text | Medium | 10 | 237:87 "对话" |
/// | Kicker / status badge | SF Pro Text | Semibold | 11 | 246:19, 246:23 |
/// | Stat number | SF Pro Text | Semibold | 15 | 246:51 |
enum AtlasTypography {
    // MARK: - Display (SF Pro Display · Bold)

    /// 34pt Bold — tab-root large title (探索/对话/动态/我的, ardot 237:143/160/173/193).
    /// The My Agents push screen (246:47) uses 30pt; tab roots are 34pt.
    static func largeTitle() -> Font { .system(size: 34, weight: .bold) }
    /// 25pt Bold — idea detail title (ardot 246:20).
    static func titleLarge() -> Font { .system(size: 25, weight: .bold) }
    /// 22pt Bold — AI hero card title, agent profile name (ardot 237:75, 246:110).
    static func heroTitle() -> Font { .system(size: 22, weight: .bold) }
    /// 22pt Bold — profile name, idea detail hero title.
    static func titleMedium() -> Font { .system(size: 22, weight: .bold) }

    // MARK: - Headlines (SF Pro Display/Text · Bold/Semibold)

    /// 18pt Bold — nav/editor title, idea card title (ardot 246:16, 246:73, 237:72).
    static func sectionHeader() -> Font { .system(size: 18, weight: .bold) }
    /// 18pt Bold — section/headerline alias.
    static func headline() -> Font { .system(size: 18, weight: .bold) }

    // MARK: - Body (SF Pro Text · Regular)

    /// 17pt Regular — primary body text (ardot 246:220).
    static func mobileBody() -> Font { .system(size: 17, weight: .regular) }
    /// 16pt Regular — input body, subtitles (ardot 237:100, 246:82).
    static func subtitle() -> Font { .system(size: 16, weight: .regular) }
    /// 15pt Regular — secondary body, card summary, empty-state body (ardot 237:118).
    static func mobileSubheadline() -> Font { .system(size: 15, weight: .regular) }
    /// 17pt Regular — body large alias.
    static func bodyLarge() -> Font { .system(size: 17, weight: .regular) }
    /// 14pt Regular — description body, metadata (ardot 246:32, 246:112).
    static func bodyMedium() -> Font { .system(size: 14, weight: .regular) }

    // MARK: - Chat body

    /// 15pt Regular — user chat messages.
    static func chatBodyUser() -> Font { .system(size: 15, weight: .regular) }
    /// 15pt Regular — AI chat messages.
    static func chatBodyAI() -> Font { .system(size: 15, weight: .regular) }

    // MARK: - Meta (SF Pro Text · Regular/Medium)

    /// 13pt Regular — stats counts, timestamps (ardot 246:40, 237:125).
    static func meta() -> Font { .system(size: 13, weight: .regular) }
    /// 13pt Medium — captions, helper labels, capabilities (ardot 246:61, 246:120).
    static func caption() -> Font { .system(size: 13, weight: .medium) }
    /// 13pt Semibold — status badges, filter pills (ardot 246:124, 237:56).
    static func badge() -> Font { .system(size: 13, weight: .semibold) }
    /// 11pt Semibold — kickers, uppercase overlines (ardot 246:19, 237:662).
    static func overline() -> Font { .system(size: 11, weight: .semibold) }

    // MARK: - Interactive (SF Pro Text · Semibold)

    /// 17pt Semibold — primary buttons (ardot 237:41 "主操作").
    static func button() -> Font { .system(size: 17, weight: .semibold) }
    /// 15pt Semibold — pill CTA, stat numbers, list actions (ardot 237:133, 246:51, 246:197).
    static func cta() -> Font { .system(size: 15, weight: .semibold) }
    /// 14pt Semibold — card/section titles, link labels (ardot 246:31, 246:35, 246:164).
    static func pill() -> Font { .system(size: 14, weight: .semibold) }

    // MARK: - Tab Bar

    /// 10pt — active tab label (Semibold) / inactive (Medium). ardot 237:84 active uses Semibold, 237:87 inactive uses Medium.
    static func tabBarLabel() -> Font { .system(size: 10, weight: .semibold) }
    /// 10pt Medium — inactive tab label.
    static func tabBarLabelInactive() -> Font { .system(size: 10, weight: .medium) }

    // MARK: - Feed rows (legacy, kept for backward compat)

    /// 17pt Semibold — idea row title (GitHub-style, ardot 237:72).
    static func feedName() -> Font { .system(size: 17, weight: .semibold) }
    /// 17pt Semibold — idea row title.
    static func feedTitle() -> Font { .system(size: 17, weight: .semibold) }
    /// 14pt Regular — idea row body text.
    static func feedBody() -> Font { .system(size: 14, weight: .regular) }
    /// 15pt Semibold — profile/agent stat numbers (ardot 246:51, 246:186).
    static func statsNumber() -> Font { .system(size: 15, weight: .semibold) }

    // MARK: - Legacy aliases (kept for backward compat)

    static func screenTitle() -> Font { largeTitle() }
    static func navTitle() -> Font { .system(size: 18, weight: .bold) }
    static func pageTitle() -> Font { titleMedium() }
    static func cardTitle() -> Font { .system(size: 17, weight: .semibold) }
    static func body() -> Font { mobileBody() }
    static func bodySmall() -> Font { mobileSubheadline() }
    static func subheadline() -> Font { bodyMedium() }
    static func footnote() -> Font { caption() }
    static func display() -> Font { largeTitle() }
    static func eyebrow() -> Font { overline() }
}

// MARK: - Apple Design Typography Tracking

/// Per Apple WWDC 2020 "The Details of UI Typography":
/// Large display text needs negative tracking (-0.02em ≈ -2% of font size).
/// Apply via `.atlasTrackedTitle()` on display-sized titles.
extension View {
    /// Apply negative tracking for display titles (≥24pt).
    /// Tracking value: -0.02 × fontSize (Apple's standard for large text).
    func atlasTrackedTitle(_ fontSize: CGFloat) -> some View {
        self.tracking(fontSize >= 24 ? -fontSize * 0.02 : 0)
    }
}
