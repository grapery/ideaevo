import SwiftUI
import UIKit

struct AtlasPressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.86 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

enum Haptics {
    static func light() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    static func medium() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    static func rigid() {
        UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
    }

    static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }

    static func success() {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }

    static func error() {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)
    }
}

struct AtlasPrimaryButton: View {
    let title: String
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .tint(AtlasColors.lemonInk)
                }
                Text(title)
                    .font(AtlasTypography.button())
            }
            .frame(maxWidth: .infinity)
            .frame(height: AtlasMetrics.primaryButtonHeight)
            .foregroundStyle(AtlasColors.lemonInk)
            .background(AtlasColors.primaryAction)
            .clipShape(Capsule())
        }
        .disabled(isLoading)
    }
}

// MARK: - Login (Ardot S01 `63:5`)

struct AtlasLoginTextField: View {
    let placeholder: String
    @Binding var text: String
    var isSecure = false
    var keyboardType: UIKeyboardType = .default
    var returnKeyType: UIReturnKeyType = .default
    var onSubmit: (() -> Void)? = nil

    var body: some View {
        ChineseFriendlyTextField(
            placeholder: placeholder,
            text: $text,
            isSecure: isSecure,
            keyboardType: keyboardType,
            returnKeyType: returnKeyType,
            onSubmit: onSubmit
        )
        .font(AtlasTypography.body())
        .padding(.horizontal, AtlasMetrics.pageX)
        .frame(height: AtlasMetrics.inputHeight)
        .background(AtlasColors.fill)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
    }
}

struct AtlasLoginPrimaryButton: View {
    let title: String
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView().tint(AtlasColors.lemonInk)
                }
                Text(title)
                    .font(AtlasTypography.button())
            }
            .frame(maxWidth: .infinity)
            .frame(height: AtlasMetrics.primaryButtonHeight)
            .foregroundStyle(AtlasColors.lemonInk)
            .background(AtlasColors.primaryAction)
            .clipShape(Capsule())
        }
        .disabled(isLoading)
    }
}

// MARK: - Settings (Ardot S11 `179:6` + sub-screens S36/S37/S38/S39/S14/S18)

/// ardot S11 group stroke `rgb(0.906,0.918,0.941)` = `#E7EBF0`.
private let settingsGroupStroke = Color(red: 0.906, green: 0.918, blue: 0.941)

/// ardot summary-card body color `rgb(0.384,0.455,0.020)` (olive) for S11 main card; sub-screens
/// use inkSoft. Kept private here so callers pass colors explicitly.
private let settingsCardBodyOlive = Color(red: 0.384, green: 0.455, blue: 0.020)
private let settingsCardBodyInkSoft = Color(red: 0.353, green: 0.392, blue: 0.447)
private let settingsRowBodyTertiary = Color(red: 0.541, green: 0.580, blue: 0.651)

/// iOS 26 Liquid Glass — group container radius. Slightly larger than radiusCard (20) for the
/// softer, more rounded silhouette of the new system style.
private let settingsGroupRadius: CGFloat = 22

/// ardot S11 (`179:6`) refined for iOS 26 Liquid Glass: group container is a translucent glass
/// surface (ultraThinMaterial) with a hairline border, a soft drop shadow, and a 22pt continuous
/// corner — NOT a flat white rectangle. Content rows render directly on the glass. NO section
/// header label (the row's two-line title carries the context).
struct AtlasSettingsGroup<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) { content() }
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: settingsGroupRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: settingsGroupRadius, style: .continuous)
                    .stroke(settingsGroupStroke, lineWidth: 1)
            )
            .shadow(color: AtlasColors.ink.opacity(0.04), radius: 10, x: 0, y: 4)
    }
}

/// ardot S11 row (`195:9`) refined: 56h, HORIZONTAL `SPACE_BETWEEN`, 14pt leading padding, no
/// leading icon. Title is **17pt Regular** ink (was Semi Bold — too heavy for the iOS 26 system
/// aesthetic which favors Regular-weight labels); subtitle is 13pt inkFaint for clear hierarchy.
/// Trailing slot is a chevron (default) or a status pill (notification row).
struct AtlasSettingsNavRow<Trailing: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder var trailing: () -> Trailing

    init(
        title: String,
        subtitle: String,
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }
    ) {
        self.title = title
        self.subtitle = subtitle
        self.trailing = trailing
    }

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 17, weight: .regular))
                    .foregroundStyle(AtlasColors.ink)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 13))
                        .foregroundStyle(AtlasColors.inkFaint)
                }
            }
            Spacer(minLength: 0)
            trailing()
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 56, alignment: .center)
        .contentShape(Rectangle())
    }
}

/// ardot S11 in-group divider (`195:12`) refined: 1px rule `#F0F2F5` **leading-inset by 14pt**
/// to align with the row text (Apple convention — in-group separators don't span the full card
/// width, they start at the text gutter). Trailing edge stays at the card padding edge.
struct AtlasSettingsGroupDivider: View {
    var body: some View {
        Rectangle()
            .fill(AtlasColors.rule)
            .frame(height: 1)
            .padding(.leading, 14)
    }
}

/// ardot S11 "已开启" pill (`195:19`): 56×28 lemon fill `#CBEA16`, radius 14, 12pt Bold
/// lemonInk text. Used as the trailing element on the Notification Preferences row.
struct AtlasSettingsStatusPill: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(AtlasColors.lemonInk)
            .padding(.horizontal, 10)
            .frame(height: 28)
            .background(
                Capsule(style: .continuous)
                    .fill(AtlasColors.lemonStrong)
            )
    }
}

/// ardot S11 logout button (`195:38`): 350×46, `#F1F3F7` fill, radius 25, 15pt Bold ink text,
/// centered, NOT destructive. (Destructive-red logout is reserved for Account & Security delete.)
struct AtlasSettingsLogoutButton: View {
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading { ProgressView().tint(AtlasColors.inkSoft) }
                Text("退出登录")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(AtlasColors.fill)
            .clipShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }
}

/// ardot S11 main summary card (`195:5`): 350×112 lemonSoft fill, radius 20, 14pt padding.
/// Title 17pt Bold lemonInk; body 13pt Regular olive, lineHeight 19.
/// Used at the top of Settings — its top edge intentionally scrolls under the floating toolbar.
struct AtlasSettingsSummaryCard: View {
    let title: String
    let message: String
    var bodyColor: Color = settingsCardBodyOlive

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(AtlasColors.lemonInk)
                .fixedSize(horizontal: false, vertical: true)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(bodyColor)
                .lineSpacing(19 - UIFont.systemFont(ofSize: 13).lineHeight)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .fill(AtlasColors.lemonSoft)
        )
    }
}

/// ardot sub-screen summary card (S36/S37/S38/S39/S14/S18): 350×132 lemonSoft fill + hairline
/// border, radius 20, 16pt padding. Title 16pt SemiBold ink-tertiary `#111218`; body 13pt Regular
/// `#5A6472`, lineHeight 19. Slightly smaller/darker than the S11 main card.
struct AtlasSettingsSubSummaryCard: View {
    let title: String
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color(red: 0.067, green: 0.075, blue: 0.094))
                .fixedSize(horizontal: false, vertical: true)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(settingsCardBodyInkSoft)
                .lineSpacing(19 - UIFont.systemFont(ofSize: 13).lineHeight)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .fill(AtlasColors.lemonSoft)
        )
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(settingsGroupStroke, lineWidth: 1)
        )
    }
}

/// ardot sub-screen data row (S36 `295:57` etc.): 350×72, `#F8FAFC` fill + hairline border,
/// radius 20, VERTICAL layout, 16pt padding, 6pt spacing. Title 15pt SemiBold ink-dark
/// `#111218`; body 12pt Regular tertiary `#8A94A6`.
struct AtlasSettingsDataRow: View {
    let title: String
    let message: String

    init(_ title: String, message: String) {
        self.title = title
        self.message = message
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color(red: 0.067, green: 0.075, blue: 0.094))
            Text(message)
                .font(.system(size: 12))
                .foregroundStyle(settingsRowBodyTertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .fill(Color(red: 0.973, green: 0.980, blue: 0.992))
        )
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(settingsGroupStroke, lineWidth: 1)
        )
    }
}

/// ardot sub-screen "Privacy Links" card (S36 `295:59` etc.): 350×112, same surface + border,
/// radius 20, 16pt padding, 12pt spacing. Title 15pt SemiBold; body 13pt Regular `#5A6472`.
/// Use for the last card that lists policy links / status summary.
struct AtlasSettingsLinksCard: View {
    let title: String
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color(red: 0.067, green: 0.075, blue: 0.094))
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(settingsCardBodyInkSoft)
                .lineSpacing(19 - UIFont.systemFont(ofSize: 13).lineHeight)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .fill(Color(red: 0.973, green: 0.980, blue: 0.992))
        )
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(settingsGroupStroke, lineWidth: 1)
        )
    }
}

struct AtlasNavBackButton: View {
    let action: () -> Void

    var body: some View {
        // v6 spec: back button is 40×40 circle (not the default 36pt toolbar size)
        AtlasToolbarFloatIconButton(icon: .chevronBack, size: AtlasMetrics.backButtonSize, iconSize: 17, action: action)
    }
}

enum AtlasToolbarMetrics {
    /// ardot C/Push Nav Bar (`237:94`): 48h. Was 44 — under spec by 4pt, mis-sized every push screen.
    static let barHeight: CGFloat = 48
    static let controlHeight: CGFloat = AtlasMetrics.toolbarVisualSize
    static let hitTarget: CGFloat = AtlasMetrics.touchTarget
    static let spacing: CGFloat = 8
}

/// `C/Push Nav Bar` (ardot `237:94`) — 48h, back (44×44 floating glass) + centered title
/// inside a glass capsule (182×44, white/30% fill + white/78% + ink/6% border, r22) + empty
/// trailing spacer. Title is 14pt SF Pro Display Semibold. Replaces the older 17pt bare-text bar.
struct AtlasPushNavBar<Trailing: View>: View {
    var title: String
    var onBack: (() -> Void)?
    @ViewBuilder var trailing: () -> Trailing

    init(
        title: String = "",
        onBack: (() -> Void)? = nil,
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }
    ) {
        self.title = title
        self.onBack = onBack
        self.trailing = trailing
    }

    var body: some View {
        ZStack {
            HStack(alignment: .center, spacing: 0) {
                leadingSlot
                Spacer(minLength: 0)
                trailingSlot
            }
            if !title.isEmpty {
                // Title Glass Capsule (ardot 296:265): scroll-edge material pill holding the
                // compact 14pt Semibold label, centered over content.
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink.opacity(0.92))
                    .lineLimit(1)
                    .padding(.horizontal, 16)
                    .frame(height: 44)
                    .frame(maxWidth: 220)
                    .background(
                        Capsule(style: .continuous)
                            .fill(Color.white.opacity(0.30))
                    )
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(Color.white.opacity(0.78), lineWidth: 1)
                    )
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(AtlasColors.ink.opacity(0.06), lineWidth: 1)
                    )
            }
        }
        .padding(.horizontal, AtlasMetrics.detailX)
        .frame(height: AtlasToolbarMetrics.barHeight)
        .background(AtlasColors.canvas)
    }

    @ViewBuilder
    private var leadingSlot: some View {
        if let onBack {
            AtlasNavBackButton(action: onBack)
        } else {
            Color.clear
                .frame(width: AtlasToolbarMetrics.hitTarget, height: AtlasToolbarMetrics.hitTarget)
        }
    }

    private var trailingSlot: some View {
        HStack(spacing: AtlasToolbarMetrics.spacing) {
            trailing()
        }
        .frame(minHeight: AtlasToolbarMetrics.hitTarget)
    }
}

/// A translucent push bar for detail covers. It preserves the cover beneath
/// the controls and takes on the correct blurred state while content scrolls.
/// Title (when present) sits in the same glass capsule as `AtlasPushNavBar`.
/// ardot C/Push Toolbar (`237:94`) — Apple Floating Glass Controls (scroll under).
/// The toolbar is **float-liquid**: two independent floating glass elements (back-button circle
/// + title capsule) sitting on a TRANSPARENT container — NO full-width material bar, NO bottom
/// hairline. Content scrolls underneath the floating glass. This matches the ardot spec exactly:
/// the component frame has no fills/strokes; only the back button (`237:95`, 44×44 circle:
/// white/36% + white/78% stroke + ink/8% stroke + drop shadow) and the title capsule
/// (`296:265`, 182×44 r22: white/30% + white/78% + ink/6% + drop shadow) carry glass treatment.
///
/// Previously this view wrongly added `.background(.ultraThinMaterial)` + a bottom hairline,
/// producing a solid bar that didn't match the design's floating-glass intent.
struct AtlasOverlayPushNavBar<Trailing: View>: View {
    var title: String
    let onBack: () -> Void
    @ViewBuilder var trailing: () -> Trailing

    init(
        title: String = "",
        onBack: @escaping () -> Void,
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }
    ) {
        self.title = title
        self.onBack = onBack
        self.trailing = trailing
    }

    var body: some View {
        ZStack {
            HStack(spacing: 0) {
                AtlasNavBackButton(action: onBack)
                Spacer(minLength: 0)
                HStack(spacing: AtlasToolbarMetrics.spacing) { trailing() }
                    .frame(minHeight: AtlasToolbarMetrics.hitTarget)
            }
            if !title.isEmpty {
                // ardot `296:265`: title glass capsule — independent floating element with its own
                // glass fill + dual strokes + drop shadow (NOT inherited from a bar background).
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink.opacity(0.92))
                    .lineLimit(1)
                    .padding(.horizontal, 16)
                    .frame(height: 44)
                    .frame(maxWidth: 220)
                    .background(Capsule(style: .continuous).fill(Color.white.opacity(0.30)))
                    .overlay(Capsule(style: .continuous).stroke(Color.white.opacity(0.78), lineWidth: 1))
                    .overlay(Capsule(style: .continuous).stroke(AtlasColors.ink.opacity(0.06), lineWidth: 1))
                    .shadow(color: AtlasColors.ink.opacity(0.08), radius: 18, x: 0, y: 8)
            }
        }
        .padding(.horizontal, AtlasMetrics.detailX)
        .frame(height: AtlasToolbarMetrics.barHeight)
        // NO background, NO bottom hairline — float-liquid per ardot `237:94`.
    }
}

/// Pattern C 内联导航：返回 + 中间内容 + 可选右侧占位。
struct AtlasInlineNavBar<Center: View, Trailing: View>: View {
    let onBack: () -> Void
    @ViewBuilder var center: () -> Center
    @ViewBuilder var trailing: () -> Trailing

    init(
        onBack: @escaping () -> Void,
        @ViewBuilder center: @escaping () -> Center,
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }
    ) {
        self.onBack = onBack
        self.center = center
        self.trailing = trailing
    }

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            AtlasNavBackButton(action: onBack)
            center()
                .frame(maxWidth: .infinity)
            trailing()
                .frame(width: AtlasToolbarMetrics.hitTarget, height: AtlasToolbarMetrics.hitTarget, alignment: .trailing)
        }
        .padding(.horizontal, 8)
        .frame(height: AtlasToolbarMetrics.barHeight)
        .background(AtlasColors.canvas)
    }
}

/// Icon-only toolbar control · visual 36 inside 44pt hit.
struct AtlasToolbarFloatIconButton: View {
    let icon: DeimosIcon
    var size: CGFloat = AtlasMetrics.toolbarVisualSize
    var iconSize: CGFloat = 17
    var color: Color = AtlasColors.ink
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            DeimosIconView(icon: icon, size: iconSize, color: color)
                .frame(width: size, height: size)
                .atlasToolbarFloat()
                .frame(width: AtlasMetrics.touchTarget, height: AtlasMetrics.touchTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// Detail pages keep their actions above the scroll content. The material surface
/// deliberately blurs whatever moves beneath it, matching the Ardot scrolled state.
/// Floating glass overlay controls for Idea Detail (ardot S04 `179:74` + `296:14`).
/// NOT a bar — these are independent 44×44 floating glass circles overlaid on the scroll content.
/// Back button on left, action cluster (Save/Fork/More) on right. No background blur, no divider.
struct AtlasDetailGlassToolbar: View {
    let onBack: () -> Void
    var onSave: () -> Void = {}
    var onForkLineage: () -> Void = {}
    var onMore: () -> Void = {}
    /// Scrolled-state title (ardot S04C `246:6` "想法详情" 18pt Bold).
    var navTitle: String? = nil
    var showTitle: Bool = false

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            // Left: back button (ardot 179:74)
            AtlasToolbarFloatIconButton(icon: .chevronBack, size: 44, iconSize: 18, action: onBack)

            Spacer(minLength: 0)

            // Center: scrolled-state title
            if showTitle, let navTitle {
                Text(navTitle)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)
                    .frame(maxWidth: 180)
                    .transition(.opacity)
                    .frame(height: 44)
            } else {
                Color.clear.frame(width: 0, height: 44)
            }

            Spacer(minLength: 0)

            // Right: action cluster (ardot 296:14 — Save Snapshot / Fork Lineage / More)
            HStack(spacing: 4) {
                AtlasToolbarFloatIconButton(icon: .bookmark, size: 44, iconSize: 18, action: onSave)
                AtlasToolbarFloatIconButton(icon: .fork, size: 44, iconSize: 18, action: onForkLineage)
                AtlasToolbarFloatIconButton(icon: .more, size: 44, iconSize: 18, action: onMore)
            }
        }
        .padding(.horizontal, AtlasMetrics.detailX)
        .frame(height: 48)
    }
}

/// Tab root breaking action (`+`) · 56×56 hit per Marvel V4.0.
struct AtlasToolbarCenterActionButton: View {
    let icon: DeimosIcon
    var iconSize: CGFloat = 18
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            DeimosIconView(icon: icon, size: iconSize, color: AtlasColors.ink)
                .frame(width: AtlasMetrics.toolbarVisualSize, height: AtlasMetrics.toolbarVisualSize)
                .atlasToolbarFloat()
                .frame(width: AtlasMetrics.centerActionSize, height: AtlasMetrics.centerActionSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// Text toolbar control · float pill (分享 / 设置 / 全部已读).
struct AtlasToolbarFloatTextButton: View {
    let title: String
    var fontSize: CGFloat = 14
    var fontWeight: Font.Weight = .medium
    var color: Color = AtlasColors.ink
    var horizontalPadding: CGFloat = 12
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: fontSize, weight: fontWeight))
                .foregroundStyle(color)
                .padding(.horizontal, horizontalPadding)
                .frame(minHeight: AtlasMetrics.touchTarget)
                .atlasToolbarFloat(cornerRadius: AtlasMetrics.radiusPill)
                .frame(minHeight: AtlasMetrics.touchTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct AtlasToolbarFloatTextLabel: View {
    let title: String
    var fontSize: CGFloat = 14
    var fontWeight: Font.Weight = .medium
    var color: Color = AtlasColors.ink
    var horizontalPadding: CGFloat = 12

    var body: some View {
        Text(title)
            .font(.system(size: fontSize, weight: fontWeight))
            .foregroundStyle(color)
            .padding(.horizontal, horizontalPadding)
            .frame(height: AtlasToolbarMetrics.controlHeight)
            .atlasToolbarFloat(cornerRadius: AtlasMetrics.radiusPill)
    }
}

/// Ardot `C/IdeaContextBar` · tint band + Idea avatar + slug / meta.
struct IdeaContextBar: View {
    let slug: String
    var subtitle: String = ""
    var iconURL: URL?
    var ideaID: String = ""

    var body: some View {
        HStack(spacing: 10) {
            EntityAvatar.idea(id: ideaID, url: iconURL, name: slug, size: 40)
            VStack(alignment: .leading, spacing: 4) {
                Text(slug)
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(AtlasTypography.mobileSubheadline())
                        .foregroundStyle(AtlasColors.inkFaint)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [AtlasColors.accentFork.opacity(0.12), AtlasColors.surface.opacity(0.05)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
    }
}

// MARK: - Idea identity (Ardot `129:18` / `129:41` / `129:25`)

struct IdeaMiniStatsRow: View {
    let forkCount: Int
    let flowerCount: Int
    let likeCount: Int
    let commentCount: Int
    var iconSize: CGFloat = 14
    var fontSize: CGFloat = 12
    var iconColor: Color? = nil
    var textColor: Color = AtlasColors.inkFaint

    private var resolvedIconColor: Color {
        iconColor ?? AtlasColors.aiStart
    }

    var body: some View {
        HStack(spacing: 14) {
            miniStat(.fork, forkCount, iconColor ?? AtlasColors.aiStart)
            miniStat(.flower, flowerCount, iconColor ?? AtlasColors.accentWarning)
            miniStat(.heart, likeCount, iconColor ?? AtlasColors.primary)
            miniStat(.comment, commentCount, iconColor ?? textColor)
        }
    }

    private func miniStat(_ icon: DeimosIcon, _ count: Int, _ color: Color) -> some View {
        HStack(spacing: 4) {
            DeimosIconView(icon: icon, size: iconSize, color: color)
            Text("\(count)")
                .font(.system(size: fontSize, weight: .medium))
                .foregroundStyle(textColor)
                .monospacedDigit()
        }
    }
}

/// Ardot `C/IdeaIdentityHero` · detail hero band · avatar 56.
struct IdeaIdentityHero: View {
    let idea: Idea
    var iconNamespace: Namespace.ID? = nil

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            heroAvatar

            VStack(alignment: .leading, spacing: 6) {
                Text(idea.displayTitle)
                    .font(AtlasTypography.button())
                    .foregroundStyle(AtlasColors.lemonInk)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    if let owner = idea.agent?.owner {
                        EntityAvatar.user(
                            id: owner.id,
                            url: owner.avatarLink,
                            name: owner.name,
                            size: 18
                        )
                    }
                    Text(idea.creatorLine)
                        .font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.85))
                        .lineLimit(1)
                }

                Text(idea.createdUpdatedLine)
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.7))
                    .lineLimit(2)

                IdeaMiniStatsRow(
                    forkCount: idea.forkCount,
                    flowerCount: idea.flowerCount,
                    likeCount: idea.likeCount,
                    commentCount: idea.commentCount,
                    iconColor: .white.opacity(0.8),
                    textColor: .white.opacity(0.9)
                )
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(minHeight: 100)
        .padding(.horizontal, AtlasMetrics.cardPadding)
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(minHeight: 110)
        .background(AtlasColors.aiGradient)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusHero, style: .continuous))
        .shadow(color: AtlasColors.aiStart.opacity(0.2), radius: 12, y: 4)
    }

    @ViewBuilder
    private var heroAvatar: some View {
        let avatar = EntityAvatar.idea(id: idea.id, url: idea.iconLink, name: idea.displaySlug, size: 56)
        if let iconNamespace {
            avatar.matchedGeometryEffect(id: "idea-icon-\(idea.id)", in: iconNamespace)
        } else {
            avatar
        }
    }
}

/// Ardot `C/IdeaCardHero` · feed card top band · h96 · avatar 48.
struct IdeaCardHero: View {
    let idea: Idea
    var iconNamespace: Namespace.ID? = nil

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            cardAvatar

            VStack(alignment: .leading, spacing: 5) {
                Text(idea.displayTitle)
                    .font(AtlasTypography.mobileSubheadline())
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    if let owner = idea.agent?.owner {
                        EntityAvatar.user(
                            id: owner.id,
                            url: owner.avatarLink,
                            name: owner.name,
                            size: 18
                        )
                    }
                    Text(idea.creatorLine)
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(1)
                }

                Text(idea.createdUpdatedLine)
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkFaint)
                    .lineLimit(1)

                IdeaMiniStatsRow(
                    forkCount: idea.forkCount,
                    flowerCount: idea.flowerCount,
                    likeCount: idea.likeCount,
                    commentCount: idea.commentCount,
                    iconSize: 13,
                    fontSize: 11
                )
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, AtlasMetrics.cardPadding)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: 96)
        .background(
            LinearGradient(
                colors: [AtlasColors.aiStart.opacity(0.12), AtlasColors.aiEnd.opacity(0.04)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }

    @ViewBuilder
    private var cardAvatar: some View {
        let avatar = EntityAvatar.idea(id: idea.id, url: idea.iconLink, name: idea.displaySlug, size: 48)
        if let iconNamespace {
            avatar.matchedGeometryEffect(id: "idea-icon-\(idea.id)", in: iconNamespace)
        } else {
            avatar
        }
    }
}

enum RepoTab: Int, CaseIterable {
    case readme = 0
    case forks = 1
    case activity = 2
    case discussion = 3

    func title(forkCount: Int, commentCount: Int) -> String {
        switch self {
        case .readme: return "README"
        case .forks: return forkCount > 0 ? "Forks \(forkCount)" : "Forks"
        case .activity: return "Activity"
        case .discussion: return commentCount > 0 ? "讨论 \(commentCount)" : "讨论"
        }
    }
}

/// Ardot `C/RepoTabs` · README · Forks · Activity · 讨论.
struct RepoTabs: View {
    @Binding var selection: Int
    let forkCount: Int
    let commentCount: Int

    var body: some View {
        HStack(spacing: 0) {
            ForEach(RepoTab.allCases, id: \.rawValue) { tab in
                let isSelected = selection == tab.rawValue
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selection = tab.rawValue
                    }
                } label: {
                    VStack(spacing: 8) {
                        Text(tab.title(forkCount: forkCount, commentCount: commentCount))
                            .font(.system(size: 15, weight: isSelected ? .semibold : .medium))
                            .foregroundStyle(isSelected ? AtlasColors.ink : AtlasColors.inkSoft)
                        Capsule()
                            .fill(isSelected ? AtlasColors.aiStart : Color.clear)
                            .frame(height: 3)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.vertical, 8)
        .background(AtlasColors.surface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color(hex: 0xEEF1F4))
                .frame(height: 1)
        }
    }
}

/// Detail README tab · compact flowers preview linking to grid.
/// v2 (ardot S04 `179:3` redesign): single-row flower card. Donor avatars stack on the
/// left, count sits in the middle, and a circular lemonStrong send-flower button anchors the
/// right edge. Replaces the old vertical card with a "收到的花" header, avatar grid, and a
/// full-width `AtlasOutlineButton("送一朵花")` — the user asked for the text button to go
/// away in favour of a compact circular action.
struct FlowersPreviewCard: View {
    let flowerCount: Int
    let donors: [FlowerDonor]
    let onOpen: () -> Void
    let onSendFlower: () -> Void

    private let avatarSize: CGFloat = 36
    private let avatarOverlap: CGFloat = -10
    private let buttonSize: CGFloat = 44

    var body: some View {
        HStack(spacing: 10) {
            // Tapping the avatar stack opens the full donor list.
            Button(action: onOpen) {
                donorStack
            }
            .buttonStyle(.plain)
            .disabled(donors.isEmpty)

            Text("\(flowerCount) 朵")
                .font(AtlasTypography.badge())
                .foregroundStyle(AtlasColors.accentFork)
                .lineLimit(1)

            Spacer(minLength: 0)

            sendFlowerButton
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
        .atlasElevatedCard()
    }

    private var donorStack: some View {
        Group {
            if donors.isEmpty {
                Text("还没有人送花")
                    .font(AtlasTypography.meta())
                    .foregroundStyle(AtlasColors.inkFaint)
            } else {
                HStack(spacing: avatarOverlap) {
                    ForEach(donors.prefix(5)) { donor in
                        flowerDonorAvatar(donor, size: avatarSize)
                            .overlay(Circle().stroke(AtlasColors.surface, lineWidth: 2))
                    }
                    if donors.count > 5 {
                        ZStack {
                            Circle()
                                .fill(AtlasColors.fill)
                                .frame(width: avatarSize, height: avatarSize)
                            Text("+\(donors.count - 5)")
                                .font(AtlasTypography.overline())
                                .foregroundStyle(AtlasColors.inkSoft)
                        }
                        .overlay(Circle().stroke(AtlasColors.surface, lineWidth: 2))
                    }
                }
            }
        }
    }

    private var sendFlowerButton: some View {
        Button(action: onSendFlower) {
            ZStack {
                Circle()
                    .fill(AtlasColors.lemonStrong)
                    .frame(width: buttonSize, height: buttonSize)
                DeimosIconView(icon: .flower, size: 20, color: AtlasColors.lemonInk)
            }
            .shadow(color: AtlasColors.lemonInk.opacity(0.18), radius: 10, x: 0, y: 6)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("送花")
    }

    @ViewBuilder
    private func flowerDonorAvatar(_ donor: FlowerDonor, size: CGFloat) -> some View {
        if donor.isAgent, let agentID = donor.agentID {
            EntityAvatar.agent(id: agentID, url: donor.avatarLink, name: donor.name, size: size)
        } else {
            EntityAvatar.user(
                id: donor.userID ?? donor.id,
                url: donor.avatarLink,
                name: donor.name,
                size: size
            )
        }
    }
}

/// Ardot `C/FlowerContributorRow` · donor list row on flowers grid.
struct FlowerContributorRow: View {
    let donor: FlowerDonor

    var body: some View {
        HStack(spacing: 12) {
            donorAvatar

            VStack(alignment: .leading, spacing: 4) {
                Text(donor.name)
                    .font(AtlasTypography.mobileSubheadline())
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)
                Text("送了一朵花 · \(donor.createdAt.absoluteShort)")
                    .font(.system(size: 12))
                    .foregroundStyle(AtlasColors.inkFaint)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            HStack(spacing: 4) {
                DeimosIconView(icon: .flower, size: 14, color: AtlasColors.accentFork)
                Text("1")
                    .font(AtlasTypography.badge())
                    .foregroundStyle(AtlasColors.accentFork)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
    }

    @ViewBuilder
    private var donorAvatar: some View {
        if donor.isAgent, let agentID = donor.agentID {
            EntityAvatar.agent(id: agentID, url: donor.avatarLink, name: donor.name, size: 36)
        } else {
            EntityAvatar.user(
                id: donor.userID ?? donor.id,
                url: donor.avatarLink,
                name: donor.name,
                size: 36
            )
        }
    }
}

/// Ardot `C/BottomInputBar` · h56 · field h44 + send 40.
struct BottomInputBar: View {
    @Binding var text: String
    let placeholder: String
    var isSending = false
    var canSend: Bool?
    let onSend: () -> Void

    private var sendEnabled: Bool {
        if isSending { return false }
        if let canSend { return canSend }
        return !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            AtlasMultilineTextField(
                placeholder: placeholder,
                text: $text,
                minHeight: 36,
                maxHeight: 120,
                onSubmit: onSend
            )
            .padding(.horizontal, 12)

            // Send button: 40×40 lemonChat circle r20, ardot S07 send SVG icon.
            // Uses lemonChat (#CBEA16) per ardot S07 `179:134`, distinct from the primary
            // button's lemonStrong (#BEE90D) so the chat composer reads as a softer surface.
            Button(action: onSend) {
                DeimosIconView(icon: .send, size: 20, color: AtlasColors.lemonInk)
                    .frame(width: 40, height: 40)
                    .background(sendEnabled ? AtlasColors.lemonChat : AtlasColors.inkDisabled)
                    .clipShape(Circle())
            }
            .disabled(!sendEnabled)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        // ardot S07 Message Composer: floating glass pill — white/34% + white/80% border + shadow.
        .background(Capsule(style: .continuous).fill(Color.white.opacity(0.34)))
        .overlay(Capsule(style: .continuous).stroke(Color.white.opacity(0.80), lineWidth: 1))
        .overlay(Capsule(style: .continuous).stroke(AtlasColors.ink.opacity(0.06), lineWidth: 1))
        .shadow(color: Color(hex: 0x0F1B2D, opacity: 0.11), radius: 28, x: 0, y: 12)
        .clipShape(Capsule(style: .continuous))
        .padding(.horizontal, AtlasMetrics.detailX)
        .padding(.bottom, 6)
    }
}

// MARK: - Chat Bubbles & States (Ardot S07 `179:5`)

/// Three bouncing lemon dots shown inside an assistant bubble while the agent is streaming
/// its first chunk. Ardot S07c (`311:107`). The dots use a staggered phase animation so they
/// look like the iMessage / Telegram typing indicator, but tinted lemonInk to match the app.
struct ChatTypingIndicator: View {
    @State private var phase: CGFloat = 0

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(AtlasColors.lemonInk.opacity(0.55 + 0.45 * bounceFactor(for: index)))
                    .frame(width: 8, height: 8)
                    .offset(y: bounceOffset(for: index))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .onAppear {
            withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                phase = 1
            }
        }
    }

    private func bounceFactor(for index: Int) -> CGFloat {
        let step: CGFloat = 0.33
        let offset = (phase + CGFloat(index) * step).truncatingRemainder(dividingBy: 1)
        return sin(offset * .pi)
    }

    private func bounceOffset(for index: Int) -> CGFloat {
        -3 * bounceFactor(for: index)
    }
}

/// Floating glass pill that surfaces tool/A2A activity during streaming. Replaces the old
/// solid green bar. Ardot S07d (`311:110`) — glass fill + spinner + activity text.
struct ChatToolActivityPill: View {
    let text: String
    @State private var rotation: Double = 0

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(AtlasColors.lemonInk)
                .rotationEffect(.degrees(rotation))
            Text(text)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AtlasColors.inkTertiary)
                .lineLimit(1)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Capsule(style: .continuous).fill(Color.white.opacity(0.50)))
        .overlay(Capsule(style: .continuous).stroke(Color.white.opacity(0.78), lineWidth: 1))
        .overlay(Capsule(style: .continuous).stroke(AtlasColors.ink.opacity(0.06), lineWidth: 1))
        .shadow(color: AtlasColors.ink.opacity(0.06), radius: 8, x: 0, y: 4)
        .onAppear {
            withAnimation(.linear(duration: 1.0).repeatForever(autoreverses: false)) {
                rotation = 360
            }
        }
    }
}

/// Centered date chip that separates message groups by day (今天 / 昨天 / 2026-07-15).
/// Ardot S07e (`311:114`). Sits inline in the message list, not sticky — matches Apple
/// Messages pattern where the chip scrolls with content.
struct ChatDateDivider: View {
    let date: Date

    private var label: String {
        let cal = Calendar.current
        if cal.isDateInToday(date) { return "今天" }
        if cal.isDateInYesterday(date) { return "昨天" }
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    var body: some View {
        HStack {
            Rectangle().fill(AtlasColors.rule).frame(height: 1)
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(AtlasColors.inkFaint)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Capsule(style: .continuous).fill(AtlasColors.fill))
            Rectangle().fill(AtlasColors.rule).frame(height: 1)
        }
        .padding(.vertical, 4)
    }
}

/// Starter prompt card shown when the conversation is empty (no messages yet).
/// Ardot S07b (`311:97`). lemonSoft fill, taps fill the draft (caller decides send vs edit).
struct ChatStarterPrompt: View {
    let text: String
    var icon: DeimosIcon = .sparkles
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(0.6))
                        .frame(width: 36, height: 36)
                    DeimosIconView(icon: icon, size: 16, color: AtlasColors.lemonInk)
                }
                Text(text)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.lemonInk.opacity(0.6))
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AtlasColors.lemonSoft)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

/// Pinned idea context banner. Ardot S07 `179:122` — light-blue card (#F1F5FF) sitting
/// between the toolbar and the message scroll. Tells the user which idea/version the agent
/// is reasoning about; tap navigates to the idea detail.
struct ChatIdeaContextBanner: View {
    let title: String
    let version: Int?
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color.white.opacity(0.6))
                        .frame(width: 36, height: 36)
                    DeimosIconView(icon: .document, size: 16, color: AtlasColors.accentActive)
                }
                // ardot S07 `179:123`: both lines 13pt Medium rgb(37,48,68) = #253044.
                // Unified weight + color (previously semibold + inkSoft subtitle).
                VStack(alignment: .leading, spacing: 2) {
                    Text(version.map { "当前上下文：\(title) · v\($0)" } ?? "当前上下文：\(title)")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color(hex: 0x253044))
                        .lineLimit(1)
                    Text("回复、建议和 Fork 都会引用这个版本")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color(hex: 0x253044))
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(hex: 0xF1F5FF))
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

/// Tab 根页 Header：Screen Title + 右侧 float 操作区（统一 44pt 行高）。
struct AtlasTabScreenHeader<Trailing: View>: View {
    let title: String
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(alignment: .center) {
            Text(title)
                .font(AtlasTypography.screenTitle())
                .foregroundStyle(AtlasColors.ink)
            Spacer(minLength: 0)
            HStack(spacing: AtlasToolbarMetrics.spacing) {
                trailing()
            }
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .frame(height: AtlasToolbarMetrics.barHeight)
    }
}

/// 通知铃铛 · 44pt hit, 36pt visual float.
struct AtlasToolbarBellButton: View {
    var unreadCount: Int = 0
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                DeimosIconView(icon: .bell, size: 17, color: AtlasColors.ink)
                    .frame(width: AtlasMetrics.toolbarVisualSize, height: AtlasMetrics.toolbarVisualSize)
                    .atlasToolbarFloat()
                if unreadCount > 0 {
                    Text("\(min(unreadCount, 99))")
                        .font(AtlasTypography.tabBarLabel())
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(AtlasColors.coral)
                        .clipShape(Capsule())
                        .offset(x: 4, y: -2)
                }
            }
            .frame(width: AtlasMetrics.touchTarget, height: AtlasMetrics.touchTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct AtlasOutlineButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(AtlasTypography.button())
                .frame(maxWidth: .infinity)
                .frame(height: AtlasMetrics.primaryButtonHeight)
                .foregroundStyle(AtlasColors.ink)
                .background(AtlasColors.surface)
                .overlay(
                    Capsule()
                        .stroke(AtlasColors.rule, lineWidth: 1)
                )
        }
    }
}

struct AtlasStatusPill: View {
    let text: String

    var body: some View {
        Text(text)
            .font(AtlasTypography.caption())
            .foregroundStyle(AtlasColors.accentActive)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(AtlasColors.accentActiveSoft)
            .clipShape(Capsule())
    }
}

struct WireframeAvatar: View {
    var size: CGFloat = 36
    var imageURL: URL?
    var name: String = ""

    private static let palettes: [[Color]] = [
        [Color(hex: 0xAF52DE), Color(hex: 0x007AFF)],
        [Color(hex: 0x34C759), Color(hex: 0x5AC8FA)],
        [Color(hex: 0xFF9500), Color(hex: 0xFF3B30)],
        [Color(hex: 0x5856D6), Color(hex: 0xAF52DE)],
    ]

    var body: some View {
        ZStack {
            if let imageURL {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        gradientBackground
                    }
                }
                .frame(width: size, height: size)
                .clipShape(Circle())
            } else {
                gradientBackground
            }
        }
        .frame(width: size, height: size)
    }

    private var gradientBackground: some View {
        let palette = Self.palettes[abs(name.hashValue) % Self.palettes.count]
        return ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: palette,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Text(String(name.prefix(1)).uppercased())
                .font(.system(size: size * 0.38, weight: .semibold))
                .foregroundStyle(.white)
        }
    }
}

// MARK: - Compact list row (Ardot `C/CompactListCard` `93:12`)

enum CompactListLayoutStyle {
    case card
    /// Marvel V4.0 flat row — V-Stack feed, no nested card chrome.
    case flat
}

struct CompactListCard<Leading: View, Trailing: View>: View {
    @ViewBuilder let leading: Leading
    let title: String
    var subtitle: String? = nil
    var timestamp: String? = nil
    var cardBackground: Color = AtlasColors.surface
    var showsBorder: Bool = false
    var layoutStyle: CompactListLayoutStyle = .card
    @ViewBuilder let trailing: Trailing

    init(
        @ViewBuilder leading: () -> Leading,
        title: String,
        subtitle: String? = nil,
        timestamp: String? = nil,
        cardBackground: Color = AtlasColors.surface,
        showsBorder: Bool = false,
        layoutStyle: CompactListLayoutStyle = .card,
        @ViewBuilder trailing: () -> Trailing = { EmptyView() }
    ) {
        self.leading = leading()
        self.title = title
        self.subtitle = subtitle
        self.timestamp = timestamp
        self.cardBackground = cardBackground
        self.showsBorder = showsBorder
        self.layoutStyle = layoutStyle
        self.trailing = trailing()
    }

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            leading

            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(title)
                        .font(titleFont)
                        .foregroundStyle(AtlasColors.ink)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    if let timestamp, !timestamp.isEmpty {
                        Text(timestamp)
                            .font(AtlasTypography.meta())
                            .foregroundStyle(AtlasColors.inkSoft)
                    }
                }

                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(subtitleFont)
                        .foregroundStyle(AtlasColors.inkSoft)
                        .multilineTextAlignment(.leading)
                        .lineLimit(2)
                }
            }

            trailing
        }
        .padding(.horizontal, layoutStyle == .flat ? 0 : 16)
        .padding(.vertical, layoutStyle == .flat ? 12 : 16)
        .frame(minHeight: layoutStyle == .flat ? 64 : nil, alignment: .leading)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(layoutStyle == .flat ? Color.clear : cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: layoutStyle == .flat ? 0 : AtlasMetrics.radiusCard, style: .continuous))
        .overlay {
            if showsBorder && layoutStyle == .card {
                RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                    .stroke(AtlasColors.border, lineWidth: 1)
            }
        }
        .modifier(CompactListCardChromeModifier(layoutStyle: layoutStyle))
    }

    private var titleFont: Font {
        layoutStyle == .flat
            ? AtlasTypography.mobileBody()
            : AtlasTypography.cardTitle()
    }

    private var subtitleFont: Font {
        layoutStyle == .flat
            ? AtlasTypography.mobileSubheadline()
            : AtlasTypography.feedBody()
    }
}

private struct CompactListCardChromeModifier: ViewModifier {
    let layoutStyle: CompactListLayoutStyle

    func body(content: Content) -> some View {
        if layoutStyle == .card {
            content.atlasProfileCard()
        } else {
            content
        }
    }
}

struct IdeaCell: View {
    let idea: Idea
    var iconNamespace: Namespace.ID? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            IdeaCardHero(idea: idea, iconNamespace: iconNamespace)

            VStack(alignment: .leading, spacing: 12) {
                Text(idea.title)
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(2)

                if let summary = idea.feedSummaryText {
                    Text(summary)
                        .font(AtlasTypography.mobileBody())
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(2)
                }

                if idea.showsFeedStatus || idea.feedCategoryLabel != nil || !idea.tags.isEmpty {
                    HStack(spacing: 6) {
                        if idea.showsFeedStatus {
                            Text(idea.statusLabel)
                                .font(AtlasTypography.caption())
                                .foregroundStyle(AtlasColors.inkSoft)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(AtlasColors.surfaceSecondary)
                                .clipShape(Capsule())
                        }
                        if let category = idea.feedCategoryLabel {
                            Text("#\(category)")
                                .font(AtlasTypography.caption())
                                .foregroundStyle(AtlasColors.primary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(AtlasColors.chipSelectedBg)
                                .clipShape(Capsule())
                        }
                        ForEach(idea.tags.prefix(idea.feedCategoryLabel == nil ? 3 : 2), id: \.self) { tag in
                            Text("#\(tag)")
                                .font(AtlasTypography.caption())
                                .foregroundStyle(AtlasColors.inkSoft)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(AtlasColors.surfaceSecondary)
                                .clipShape(Capsule())
                        }
                    }
                }

                Rectangle()
                    .fill(AtlasColors.rule)
                    .frame(height: 1)
                    .padding(.top, 2)

                HStack(spacing: 20) {
                    statItem(.heart, idea.likeCount, AtlasColors.primary)
                    statItem(.flower, idea.flowerCount, AtlasColors.accentWarning)
                    statItem(.comment, idea.commentCount, AtlasColors.inkFaint)
                    statItem(.fork, idea.forkCount, AtlasColors.aiStart)
                }
                .padding(.top, 4)
            }
            .padding(AtlasMetrics.cardPadding)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .atlasElevatedCard()
    }

    private func statItem(_ icon: DeimosIcon, _ count: Int, _ color: Color = AtlasColors.inkFaint) -> some View {
        HStack(spacing: 4) {
            DeimosIconView(icon: icon, size: 16, color: color)
            Text("\(count)")
                .font(AtlasTypography.meta())
                .foregroundStyle(AtlasColors.inkFaint)
                .monospacedDigit()
        }
    }
}

/// Twitter-style flat feed row — no card, no shadow, hairline divider between rows.
/// Layout: avatar | name(·slug ·time) / title / summary / action bar(fork flower heart comment)
struct IdeaFlatRow: View {
    let idea: Idea
    var iconNamespace: Namespace.ID? = nil

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ideaAvatar

            VStack(alignment: .leading, spacing: 4) {
                // Name · handle · time (Twitter-style inline header) + Fork / AI Agent badges.
                HStack(spacing: 4) {
                    Text(idea.authorDisplayName)
                        .font(AtlasTypography.feedName())
                        .foregroundStyle(AtlasColors.ink)
                        .lineLimit(1)
                    Text("@\(idea.displaySlug)")
                        .font(AtlasTypography.feedBody())
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(1)
                    Text("· \(idea.createdAt.relativeShort)")
                        .font(AtlasTypography.feedBody())
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(1)
                    if idea.showsAIAgentBadge {
                        Text("AI Agent")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(AtlasColors.lemonInk)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Capsule(style: .continuous).fill(AtlasColors.lemonSoft))
                    }
                    if idea.isFork {
                        Text("Fork")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(AtlasColors.inkSoft)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Capsule(style: .continuous).fill(AtlasColors.fill))
                    }
                }

                // Title (GitHub-style idea title)
                Text(idea.displayTitle)
                    .font(AtlasTypography.feedTitle())
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)

                // Summary body
                if let summary = idea.feedSummaryText {
                    Text(summary)
                        .font(AtlasTypography.feedBody())
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }

                // Action bar — evenly spaced, muted gray icons
                HStack {
                    flatStat(.fork, idea.forkCount, AtlasColors.aiStart)
                    Spacer(minLength: 0)
                    flatStat(.flower, idea.flowerCount, AtlasColors.accentWarning)
                    Spacer(minLength: 0)
                    flatStat(.heart, idea.likeCount, AtlasColors.primary)
                    Spacer(minLength: 0)
                    flatStat(.comment, idea.commentCount, AtlasColors.inkFaint)
                }
                .padding(.top, 6)
            }
        }
        .padding(.vertical, 14)
        .padding(.horizontal, AtlasMetrics.pageX)
    }

    @ViewBuilder
    private var ideaAvatar: some View {
        let avatar = EntityAvatar.idea(id: idea.id, url: idea.iconLink, name: idea.displaySlug, size: 40)
        if let iconNamespace {
            avatar.matchedGeometryEffect(id: "idea-icon-\(idea.id)", in: iconNamespace)
        } else {
            avatar
        }
    }

    private func flatStat(_ icon: DeimosIcon, _ count: Int, _ color: Color) -> some View {
        HStack(spacing: 4) {
            DeimosIconView(icon: icon, size: 16, color: color)
            Text("\(count)")
                .font(AtlasTypography.meta())
                .foregroundStyle(AtlasColors.inkFaint)
                .monospacedDigit()
        }
    }
}

/// A hairline divider for flat feed lists (Twitter-style row separators).
struct FeedRowDivider: View {
    var body: some View {
        Rectangle()
            .fill(Color(hex: 0xEEF1F4))
            .frame(height: 1)
            .padding(.leading, 64) // avatar(40) + spacing(12) + pageX(16) - 4
    }
}

struct FollowingIdeaCell: View {
    let activity: ActivityView

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                actorAvatar
                Text(activity.actorName ?? "用户")
                    .font(AtlasTypography.mobileSubheadline())
                    .foregroundStyle(AtlasColors.inkSoft)
                Spacer()
                Text(activity.createdAt.relativeShort)
                    .font(AtlasTypography.meta())
                    .foregroundStyle(AtlasColors.inkFaint)
            }

            Text(activity.targetTitle ?? "想法")
                .font(AtlasTypography.cardTitle())
                .foregroundStyle(AtlasColors.ink)
                .lineLimit(2)

            if let desc = activity.targetDesc, !desc.isEmpty {
                Text(desc.plainSummary)
                    .font(AtlasTypography.mobileBody())
                    .foregroundStyle(AtlasColors.inkSoft)
                    .lineLimit(2)
            }

            if let category = activity.targetCategory, !category.isEmpty {
                Text("#\(category)")
                    .font(AtlasTypography.caption())
                    .foregroundStyle(AtlasColors.inkSoft)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(AtlasColors.fill)
                    .clipShape(Capsule())
            }

            Text(activity.feedSummary)
                .font(AtlasTypography.meta())
                .foregroundStyle(AtlasColors.accentActive)
        }
        .padding(AtlasMetrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.entityIdea.opacity(0.35))
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
        .atlasElevatedCard()
    }

    @ViewBuilder
    private var actorAvatar: some View {
        let url = activity.actorAvatar.flatMap(URL.init(string:))
        if activity.actorType == "agent" {
            EntityAvatar.agent(id: activity.actorID, url: url, name: activity.actorName ?? "A", size: 32)
        } else {
            EntityAvatar.user(id: activity.actorID, url: url, name: activity.actorName ?? "U", size: 32)
        }
    }
}

struct HomeSearchAgentCell: View {
    let agent: Agent

    var body: some View {
        HStack(spacing: 12) {
            EntityAvatar.agent(id: agent.id, url: agent.avatarLink, name: agent.name, size: 40)
            VStack(alignment: .leading, spacing: 4) {
                Text(agent.name)
                    .font(AtlasTypography.subtitle())
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)
                Text((agent.description ?? agent.capabilities?.joined(separator: " · ") ?? "Agent").plainSummary)
                    .font(AtlasTypography.meta())
                    .foregroundStyle(AtlasColors.inkSoft)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
            DeimosIconView(icon: .chevronRight, size: 13, color: AtlasColors.inkFaint)
        }
        .padding(AtlasMetrics.cardPadding)
        .background(AtlasColors.entityAgent.opacity(0.35))
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
    }
}

/// `C/Glass Tab Bar · Floating Pill Material` (ardot `237:80`).
///
/// Floating glass pill (348×62, white/72% fill, #E8EAEC border, r36, ink shadow), containing
/// 4 tabs. Active tab = lemon capsule (lemonStrong @ 0.82, lemonInk text/icon). Inactive tabs
/// are plain (#8A94A6 text/icon, no fill). Label is ABOVE icon per ardot spec.
struct NativeTabBar: View {
    @Binding var selection: MainTab

    var body: some View {
        HStack(spacing: 4) {
            ForEach(MainTab.allCases, id: \.self) { tab in
                tabItem(tab)
            }
        }
        .padding(4)
        // ardot 237:81: Glass Pill — white/72% solid fill + #E8EAEC border + r36 + ink shadow.
        .background(Capsule().fill(Color.white.opacity(0.72)))
        .overlay(Capsule().stroke(AtlasColors.border, lineWidth: 1))
        .shadow(color: Color(hex: 0x0F1B2D, opacity: 0.14), radius: 18, x: 0, y: 8)
        // ardot 237:80: pill sits 21pt from the left/right edges and ~9pt above the true screen
        // bottom edge (overlapping the home indicator zone). `.ignoresSafeArea(edges: .bottom)`
        // on this floating view moves its bottom anchor from the safe-area inner edge to the
        // real screen edge, then `.padding(.bottom, 9)` lifts it just above the home indicator.
        // The overlay in MainTabView simply provides the alignment slot.
        .padding(.horizontal, 21)
        .padding(.bottom, 9)
        .ignoresSafeArea(edges: .bottom)
        .frame(maxWidth: .infinity)
    }

    private func tabItem(_ tab: MainTab) -> some View {
        let isSelected = selection == tab
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) {
                selection = tab
            }
        } label: {
            // ardot 237:82/85/88/91: label ABOVE icon (VStack spacing 4), not icon above label.
            VStack(spacing: 4) {
                Text(tab.title)
                    .font(isSelected ? AtlasTypography.tabBarLabel() : AtlasTypography.tabBarLabelInactive())
                DeimosIconView(icon: tab.icon, size: 18, color: isSelected ? AtlasColors.lemonInk : AtlasColors.inkSoft)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .foregroundStyle(isSelected ? AtlasColors.lemonInk : AtlasColors.inkSoft)
            .background(isSelected ? AtlasColors.lemonStrong.opacity(0.82) : .clear, in: Capsule())
        }
        .buttonStyle(.plain)
        .contentShape(Rectangle())
    }
}

struct AtlasEmbeddedSearchBar: View {
    let placeholder: String
    @Binding var text: String
    var onSubmit: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            DeimosIconView(icon: .search, size: 16, color: AtlasColors.inkFaint)
            ChineseFriendlyTextField(
                placeholder: placeholder,
                text: $text,
                keyboardType: .default,
                returnKeyType: .search,
                onSubmit: onSubmit
            )
            .frame(height: 24)
        }
        .padding(.horizontal, 12)
        .frame(height: AtlasMetrics.inputHeight)
        .background(AtlasColors.fill)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
    }
}

/// Home / 只读入口：左侧搜索图标 + 占位文案，点击进入搜索页。
struct AtlasSearchBarTrigger: View {
    let placeholder: String

    var body: some View {
        HStack(spacing: 8) {
            DeimosIconView(icon: .search, size: 16, color: AtlasColors.inkFaint)
            Text(placeholder)
                .font(AtlasTypography.bodyMedium())
                .foregroundStyle(AtlasColors.inkFaint)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 12)
        .frame(height: AtlasMetrics.inputHeight)
        .background(AtlasColors.fill)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
    }
}

struct DeimosHeader: View {
    var unreadCount: Int = 0
    var onNotifications: () -> Void

    var body: some View {
        HStack {
            Text("发现")
                .font(AtlasTypography.screenTitle())
                .foregroundStyle(AtlasColors.ink)

            Spacer()

            Button(action: onNotifications) {
                ZStack(alignment: .topTrailing) {
                    DeimosIconView(icon: .bell, size: 20, color: AtlasColors.ink)
                        .frame(width: 40, height: 40)
                        .background(AtlasColors.surface)
                        .clipShape(Circle())

                    if unreadCount > 0 {
                        Text("\(min(unreadCount, 99))")
                            .font(AtlasTypography.tabBarLabel())
                            .foregroundStyle(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(AtlasColors.coral)
                            .clipShape(Capsule())
                            .offset(x: 2, y: 0)
                    }
                }
            }
        }
        .padding(.horizontal, AtlasMetrics.pageX)
    }
}

struct SegmentControl: View {
    let items: [String]
    @Binding var selection: Int

    var body: some View {
        HStack(spacing: 20) {
            ForEach(items.indices, id: \.self) { index in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selection = index
                    }
                } label: {
                    VStack(spacing: 6) {
                        Text(items[index])
                            .font(.system(size: 15, weight: selection == index ? .semibold : .regular))
                            .foregroundStyle(selection == index ? AtlasColors.ink : AtlasColors.inkFaint)
                        Capsule()
                            .fill(selection == index ? AtlasColors.primary : .clear)
                            .frame(width: 32, height: 3)
                    }
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(.horizontal, AtlasMetrics.pageX)
    }
}

struct AtlasSegmentedPill: View {
    let items: [String]
    @Binding var selection: Int

    var body: some View {
        HStack(spacing: 4) {
            ForEach(items.indices, id: \.self) { index in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selection = index
                    }
                }                 label: {
                    Text(items[index])
                        .font(.system(size: 14, weight: selection == index ? .semibold : .medium))
                        .foregroundStyle(selection == index ? AtlasColors.lemonInk : AtlasColors.inkSoft)
                        .frame(maxWidth: .infinity)
                        .frame(height: 36)
                        .background(selection == index ? AtlasColors.primaryAction : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .frame(height: 44)
        .background(AtlasColors.bgInput)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct AtlasPageHeader: View {
    let eyebrow: String
    let title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if !eyebrow.isEmpty {
                Text(eyebrow)
                    .font(AtlasTypography.overline())
                    .foregroundStyle(AtlasColors.inkFaint)
            }
            Text(title)
                .font(AtlasTypography.largeTitle())
                .foregroundStyle(AtlasColors.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct AtlasFilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: isSelected ? .semibold : .medium))
                .foregroundStyle(isSelected ? Color.white : AtlasColors.inkSoft)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(isSelected ? AtlasColors.primary : AtlasColors.surfaceSecondary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct AtlasCard<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(AtlasMetrics.cardPadding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AtlasColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
            .atlasElevatedCard()
    }
}

// MARK: - v6 AI Hero Card (Ardot `149:260`)

/// Ardot C/AI Hero Card (237:74): dark lemon-ink surface, 22pt Bold white title,
/// 14pt Regular lemon subtitle, optional lemon pill CTA (S02 hides it, S06 shows it).
struct AIHeroCard: View {
    let title: String
    let subtitle: String
    var ctaTitle: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 12) {
                Text(title)
                    .font(AtlasTypography.heroTitle())
                    .foregroundStyle(.white)
                    .lineLimit(2)

                Text(subtitle)
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(AtlasColors.lemon)

                if let ctaTitle {
                    HStack(spacing: 6) {
                        Text(ctaTitle)
                            .font(AtlasTypography.cta())
                            .foregroundStyle(AtlasColors.lemonInk)
                        DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.lemonInk)
                    }
                    .padding(.horizontal, 20)
                    .frame(height: 40)
                    .background(AtlasColors.primaryAction)
                    .clipShape(Capsule())
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(AtlasColors.lemonInk)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusHero, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Product Idea Card (Ardot S02 / S04B)

/// A compact, text-first Idea surface. Media is intentionally handled inside
/// the detail document; discovery needs the status, provenance and Fork signal
/// to remain scan-friendly even when an Idea has no image.
struct IdeaCoverCard: View {
    let idea: Idea
    var coverImageURL: URL?
    var iconNamespace: Namespace.ID?
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 0) {
                identitySection
                provenanceSection
                actionSection
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AtlasColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                    .stroke(AtlasColors.borderProfile, lineWidth: 1)
            )
            .atlasProfileCard()
        }
        .buttonStyle(.plain)
    }

    private var identitySection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("IDEA · \(idea.category.uppercased())")
                        .font(AtlasTypography.overline())
                        .foregroundStyle(AtlasColors.oliveMeta)
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(AtlasColors.primaryAction)
                        .frame(width: 44, height: 3)
                }
                Spacer()
                Text(idea.statusLabel)
                    .font(AtlasTypography.overline())
                    .foregroundStyle(AtlasColors.lemonInk)
                    .padding(.horizontal, 14)
                    .frame(height: 26)
                    .background(AtlasColors.lemon)
                    .clipShape(Capsule())
            }
            Text(idea.displaySlug.uppercased())
                .font(AtlasTypography.overline())
                .foregroundStyle(AtlasColors.inkTertiary)
                .lineLimit(1)
                .padding(.top, 18)
            Text(idea.displayTitle)
                .font(AtlasTypography.sectionHeader())
                .foregroundStyle(AtlasColors.ink)
                .lineLimit(2)
                .padding(.top, 8)
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 142, alignment: .topLeading)
        .background(AtlasColors.lemonSoft)
    }

    private var provenanceSection: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(idea.coverCreatorLine)
                .lineLimit(1)
                .truncationMode(.tail)
            Text("公开 · 可 Fork · 更新于 \(idea.updatedAt.relativeShort)")
                .lineLimit(1)
        }
        .font(.system(size: 12, weight: .regular))
        .foregroundStyle(AtlasColors.inkSoft)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private var actionSection: some View {
        HStack(spacing: 8) {
            HStack(spacing: 4) {
                Text("送花 \(idea.flowerCount)")
                    .frame(maxWidth: .infinity)
                Rectangle().fill(Color(hex: 0xCBD1D8)).frame(width: 1, height: 16)
                Text("Fork \(idea.forkCount)")
                    .frame(maxWidth: .infinity)
            }
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(AtlasColors.inkTertiary)
            .frame(maxWidth: .infinity)
            .frame(height: 32)
            .background(Color(hex: 0xE9EDF1))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            Text("查看详情")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(AtlasColors.lemonInk)
                .padding(.horizontal, 19)
                .frame(height: 32)
                .background(AtlasColors.lemonCTA)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}

struct AtlasTealButton: View {
    let title: String
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView().tint(AtlasColors.lemonInk)
                }
                Text(title)
                    .font(AtlasTypography.button())
            }
            .frame(maxWidth: .infinity)
            .frame(height: AtlasMetrics.primaryButtonHeight)
            .foregroundStyle(.white)
            .background(AtlasColors.primaryAction)
            .clipShape(Capsule())
        }
        .disabled(isLoading)
    }
}

struct AtlasTealOutlineButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(AtlasTypography.pill())
                .frame(maxWidth: .infinity)
                .frame(height: AtlasMetrics.primaryButtonHeight)
                .foregroundStyle(AtlasColors.ink)
                .background(AtlasColors.surface)
                .overlay(
                    Capsule()
                        .stroke(AtlasColors.rule, lineWidth: 1)
                )
        }
    }
}

struct StatChip: View {
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .center, spacing: 4) {
            Text(value)
                .font(AtlasTypography.headline())
                .foregroundStyle(AtlasColors.ink)
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(AtlasColors.inkFaint)
                .multilineTextAlignment(.center)
        }
        .padding(10)
        .frame(maxWidth: .infinity)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous)
                .stroke(AtlasColors.rule, lineWidth: 1)
        )
    }
}

/// 圆圈线框统计（动态页等）。
struct WireframeStatCircle: View {
    let value: String
    let label: String
    var diameter: CGFloat = 72

    var body: some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
                .frame(width: diameter, height: diameter)
                .background(AtlasColors.canvas)
                .clipShape(Circle())
                .overlay(Circle().stroke(AtlasColors.rule, lineWidth: 1))
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(AtlasColors.inkFaint)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
    }
}

struct IdeaRoute: Identifiable, Hashable {
    let id: String
}

struct UserRoute: Identifiable, Hashable {
    let id: String
}

struct AgentRoute: Identifiable, Hashable {
    let id: String
}

struct ActivityCell: View {
    let activity: ActivityView

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            actorAvatar

            VStack(alignment: .leading, spacing: 5) {
                Text(activityLine)
                    .font(AtlasTypography.mobileBody())
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(1)

                Text(activitySubtitle ?? activity.createdAt.relativeShort)
                    .font(AtlasTypography.meta())
                    .foregroundStyle(AtlasColors.inkSoft)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(minHeight: 80)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        }
    }

    @ViewBuilder
    private var actorAvatar: some View {
        let url = activity.actorAvatar.flatMap(URL.init(string:))
        if activity.actorType == "agent" {
            EntityAvatar.agent(id: activity.actorID, url: url, name: activity.actorName ?? "A", size: 40)
        } else {
            EntityAvatar.user(id: activity.actorID, url: url, name: activity.actorName ?? "U", size: 40)
        }
    }

    private var activityLine: String {
        let actor = activity.actorName ?? "用户"
        switch activity.action {
        case "flower", "flowers":
            return "\(actor) 给你的想法送了一朵花"
        case "comment":
            return "\(actor) 评论了你的想法"
        case "fork":
            return "\(actor) Fork 了你的想法"
        case "follow":
            return "\(actor) 关注了你"
        case "register", "create":
            return "\(actor) 发布了新想法"
        case "share":
            return "\(actor) 分享了想法"
        default:
            return "\(actor) · \(activity.targetTitle ?? "想法")"
        }
    }

    private var activitySubtitle: String? {
        switch activity.action {
        case "comment":
            if let desc = activity.targetDesc, !desc.isEmpty {
                return "「\(desc.plainSummary)」"
            }
            return activity.targetTitle
        default:
            return activity.targetTitle
        }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    var onComplete: (() -> Void)?

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        controller.completionWithItemsHandler = { _, _, _, _ in
            onComplete?()
        }
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

struct AtlasOfflineBanner: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            DeimosIconView(icon: .wifiOff, size: 14, color: AtlasColors.inkSoft)
            Text(message.isEmpty ? "网络不可用，显示缓存内容" : message)
                .font(.system(size: 12))
                .foregroundStyle(AtlasColors.inkSoft)
                .lineLimit(2)
            Spacer()
            Button("重试", action: onRetry)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 44)
        .background(AtlasColors.entityUser)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
    }
}

extension String {
    var plainSummary: String {
        replacingOccurrences(of: "#", with: "")
            .replacingOccurrences(of: "*", with: "")
            .replacingOccurrences(of: "`", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

extension Date {
    var relativeShort: String {
        let interval = Date().timeIntervalSince(self)
        if interval < 0 {
            return absoluteShort
        }
        if interval < 60 {
            return "刚刚"
        }
        let minutes = Int(interval / 60)
        if minutes < 60 {
            return "\(minutes)分钟前"
        }
        let hours = Int(interval / 3600)
        if hours < 24 {
            return "\(hours)小时前"
        }
        let days = Int(interval / 86_400)
        if days < 7 {
            return "\(days)天前"
        }
        return absoluteShort
    }

    /// 年内 `M月d日`，跨年 `yyyy/M/d`。
    var absoluteShort: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        if Calendar.current.isDate(self, equalTo: Date(), toGranularity: .year) {
            formatter.dateFormat = "M月d日"
        } else {
            formatter.dateFormat = "yyyy/M/d"
        }
        return formatter.string(from: self)
    }

    /// Idea Feed 时间：本地绝对时间，避免批量创建时全部显示同一相对值。
    var feedTimestamp: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        let calendar = Calendar.current
        if calendar.isDateInToday(self) {
            formatter.dateFormat = "HH:mm"
            return "今天 \(formatter.string(from: self))"
        }
        if calendar.isDateInYesterday(self) {
            formatter.dateFormat = "HH:mm"
            return "昨天 \(formatter.string(from: self))"
        }
        if calendar.isDate(self, equalTo: Date(), toGranularity: .year) {
            formatter.dateFormat = "M月d日 HH:mm"
            return formatter.string(from: self)
        }
        formatter.dateFormat = "yyyy/M/d HH:mm"
        return formatter.string(from: self)
    }
}
