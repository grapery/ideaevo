import SwiftUI

/// Wanye iOS system, synchronized with the current Ardot mobile board (715405210175453).
///
/// Visual language: cream canvas, deep ink, violet interaction state, and restrained
/// translucent chrome for contextual toolbars. Colors stay semantic so the feature
/// layer does not need to know which surface it is rendering on.
///
/// Key changes v6→v7 (Cream Violet retheme, 2026-08-16):
/// - App background: `#FFFFFF` → `#FAF7F2` warm cream
/// - Brand family: lemon `#D9FF40`/`#BEE90D` → violet `#9D8FF7`(lemon) / `#8C7DF4`(lemonStrong)
/// - Soft accent: `#F5FFC7` → `#E9E7FF`; oliveMeta `#65703A` → `#5B4FE8` violet-ink
/// - lemonInk stays a deep ink (`#1A2403`-grade) so every "dark text on accent fill"
///   call site keeps ≥5:1 contrast on the new mid-tone violet fills.
enum AtlasColors {
    // MARK: - Neutral (v7: 奶油底基底)

    /// App background — `#FAF7F2` warm cream. Global page base (v7: was #FFFFFF).
    static let canvas = Color(hex: 0xFAF7F2)
    /// Muted background — `#F2F3F7` (Deimos iOS26 bg-muted). Back button base, steppers.
    static let surfaceSecondary = Color(hex: 0xF2F3F7)
    /// Input background — `#F2F3F5`. Input fields, clear buttons.
    static let bgInput = Color(hex: 0xF2F3F5)
    /// `#F2F2F7` — settings group container fill + logout pill background (ardot S11 `237:369`
    /// Agent & Device Settings container + Log Out pill). System-group-background equivalent.
    static let settingsGroupFill = Color(hex: 0xF2F2F7)
    /// `#E8EBF0` — settings row hairline border (ardot S11 `237:369` C/Settings Row stroke).
    static let settingsRowStroke = Color(hex: 0xE8EBF0)
    /// `#EDF0F2` — white card hairline stroke (ardot board 715405210175453 S06 Profile Card /
    /// S18 Agent Card / S19 API Key Card).
    static let cardStroke = Color(hex: 0xEDF0F2)
    /// `#F2F5F8` — secondary stat tile fill (ardot S08 `237:168` second Stats tile).
    /// Slightly cooler than #F5F6F7 (chatAssistantBubble).
    static let statTileSecondary = Color(hex: 0xF2F5F8)
    /// `#657080` — secondary stat tile label text (ardot S08 `237:168` "今日 Fork" label).
    static let statLabelSecondary = Color(hex: 0x657080)
    // MARK: - Privacy / Moderation surface tints (ardot S14/S16/S17/S19/S18)
    /// `#E9E7FF` — report reasons card fill + create-agent permissions card (v7: was
    /// lemon-tinted #F6FFD0; now violet-tinted, matches lemonSoft).
    static let noticeSoft = Color(hex: 0xE9E7FF)
    /// `#FFF7E8` — block-user info card fill (ardot S17 `237:479` Info). Warm cream.
    static let infoWarm = Color(hex: 0xFFF7E8)
    /// `#FFF1F1` — delete-account warning card fill (ardot S19 `237:492` Warning). Soft red.
    static let warningSoft = Color(hex: 0xFFF1F1)
    /// `#E5484D` — destructive action button fill (ardot S17 Block C/Primary, S19 Delete
    /// C/Destructive). System red, distinct from the older `coral`/`destructive` tokens.
    static let destructiveFill = Color(hex: 0xE5484D)
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

    // MARK: - Brand (品牌色 · v7: Cream Violet)

    /// Accent used for selected tabs, status pills and decorative surfaces — `#9D8FF7`
    /// soft violet (v7: was lemon #D9FF40). Pairs with white/ink text.
    static let lemon = Color(hex: 0x9D8FF7)
    /// `#E9E7FF` — violet-tinted soft fill for badges, chips, summary cards (v7: was #F5FFC7).
    static let lemonSoft = Color(hex: 0xE9E7FF)
    /// `#1A2403` deep olive-ink. Kept as the "dark text on accent fill" token so every
    /// v6 call site (selected chips, CTA labels, flower buttons) keeps its contrast on
    /// the new mid-tone violet fills (contrast vs #8C7DF4 ≈ 5:1, WCAG AA).
    static let lemonInk = Color(hex: 0x1A2403)
    /// `#8C7DF4` — violet-strong, primary interactive fill (v7: was #BEE90D).
    /// CTAs, send buttons, active tabs, user chat bubbles.
    static let lemonStrong = Color(hex: 0x8C7DF4)
    /// `#BEE90D` lemon-strong reused for chat user bubbles + the send button (ardot S07
    /// `237:289` user bubble + Glass Input Bar Send). The earlier `lemonChat` (#CBEA16)
    /// + `chatAssistantBubble` (#EAF1FF) tokens were aligned to an OBSOLETE design frame
    /// (`179:*`); the current authoritative chat design uses lemonStrong for the user
    /// bubble and a neutral grey for the assistant bubble. Aliases kept so existing call
    /// sites keep compiling while we migrate.
    static let lemonChat = lemonStrong
    /// `#F5F6F7` — assistant chat bubble fill (ardot S07 `237:289` AI Bubble). Neutral grey,
    /// NOT the previous blue (#EAF1FF) which was aligned to the obsolete `179:*` design.
    /// AI chat bubble — white per the current board (chatAI variable, `2:13`).
    static let chatAssistantBubble = Color.white
    /// `#F2FFC7` — tool-activity pill background (ardot 715405210175453 S03 Tool Activity).
    static let chatActivityFill = Color(hex: 0xF2FFC7)
    /// `#596472` — tool-activity pill label text (ardot S03 Tool Activity).
    static let chatActivityInk = Color(hex: 0x596472)
    /// `#D1F521` — lime CTA fill inside chat idea-suggestion cards (ardot S03 View CTA).
    static let limeCTA = Color(hex: 0xD1F521)
    /// `#F2F3F5` — chat toolbar back-circle fill (ardot S07 `237:289` C/Back Button instance).
    static let chatNavCircle = Color(hex: 0xF2F3F5)
    /// `#E8EBF0` — Glass Input Bar hairline stroke (ardot S07 `237:289` C/Glass Input Bar).
    static let chatInputStroke = Color(hex: 0xE8EBF0)
    /// Action-text accent — `#65703A` olive (ardot board 715405210175453: S17 去绑定,
    /// S27 保存/更换头像, S18 个人 Agent badge, S19 复制 button). Text-only accent on
    /// neutral surfaces; never used as a fill.
    static let olive = Color(hex: 0x65703A)
    /// Violet-ink meta text on violet-tinted surfaces — `#5B4FE8` (v7: was olive #65703A).
    /// Used for eyebrows, filter links, stat labels on lemonSoft fills.
    static let oliveMeta = Color(hex: 0x5B4FE8)
    /// Small CTA fill inside cards — `#8C7DF4` violet-strong (v7: was #D2F522).
    static let lemonCTA = Color(hex: 0x8C7DF4)
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
    /// Success soft fill — `#E8F5ED` (ardot board 715405210175453 S18 公开 badge). Pair with
    /// `success` text.
    static let successSoft = Color(hex: 0xE8F5ED)
    /// Danger soft fill — `#FFF2F2` (ardot board 715405210175453 S28 Warning Card, S16 埋没 pill).
    /// Pair with `destructive` text.
    static let dangerSoft = Color(hex: 0xFFF2F2)
    /// Tab bar active segment fill — `#BFE80D` lime (ardot board 715405210175453 C/Pill Tab Bar
    /// active tab). Label stays `lemonInk`.
    static let tabAccent = Color(hex: 0xBFE80D)
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

    /// Chip selected background — violet-strong (v7).
    static let chipSelectedBg = lemon
    /// Chip selected text — deep ink, keeps contrast on violet fills (v7).
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
        LinearGradient(colors: [lemonStrong, lemon], startPoint: .topLeading, endPoint: .bottomTrailing)
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
