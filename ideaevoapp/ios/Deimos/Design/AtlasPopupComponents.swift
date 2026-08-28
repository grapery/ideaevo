import SwiftUI

// MARK: - Toast (Ardot components 195:138 / 195:142 / 195:146)

/// Toast banner matching ardot design:
/// HORIZONTAL itemSpacing=10, padding=[12,16,12,16], r16.
/// Success: lemonSoft bg + lemonStrong icon circle + lemonInk text.
/// Error: #F8EDEF bg + destructive icon circle + destructive text.
/// Info: bg-muted + olive icon circle + ink text.
struct AtlasToastBanner: View {
    let item: AtlasToastItem
    var onRetry: (() -> Void)?

    var body: some View {
        HStack(spacing: 10) {
            // Icon circle — 20×20 r10
            ZStack {
                Circle()
                    .fill(iconCircleColor)
                    .frame(width: 20, height: 20)
                Text(iconGlyph)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(iconGlyphColor)
            }

            // Message — 14pt SemiBold
            Text(item.title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(messageColor)
                .lineLimit(1)

            Spacer(minLength: 8)

            if item.kind == .error, onRetry != nil {
                Button("重试", action: { onRetry?() })
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AtlasColors.destructive)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(minHeight: 44)
        .background(backgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: AtlasMetrics.shadowFloatColor, radius: 12, y: 8)
    }

    // MARK: - Per-kind styling

    private var backgroundColor: Color {
        switch item.kind {
        case .success: return AtlasColors.successSoft
        case .error: return Color(hex: 0xF8EDEF)
        }
    }

    private var iconCircleColor: Color {
        switch item.kind {
        case .success: return AtlasColors.success
        case .error: return AtlasColors.destructive
        }
    }

    private var iconGlyph: String {
        switch item.kind {
        case .success: return "✓"
        case .error: return "✕"
        }
    }

    private var iconGlyphColor: Color {
        switch item.kind {
        case .success: return AtlasColors.lemonInk
        case .error: return .white
        }
    }

    private var messageColor: Color {
        switch item.kind {
        case .success: return AtlasColors.success
        case .error: return AtlasColors.destructive
        }
    }
}

struct AtlasToastHost: ViewModifier {
    @Bindable private var toasts = ToastCenter.shared

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if let item = toasts.current {
                    AtlasToastBanner(item: item, onRetry: item.retryHandler)
                        .padding(.horizontal, AtlasMetrics.pageX)
                        .padding(.top, 60)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .zIndex(999)
                }
            }
            .animation(.easeInOut(duration: 0.2), value: toasts.current?.id)
    }
}

extension View {
    func atlasToastHost() -> some View {
        modifier(AtlasToastHost())
    }
}

// MARK: - Bottom sheet chrome

struct AtlasSheetGrabber: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 2, style: .continuous)
            .fill(Color(hex: 0xC7D1DE))
            .frame(width: 40, height: 4)
            .frame(maxWidth: .infinity)
    }
}

/// Marvel `C/SheetTitleRow` — Close 44 | Title 17 Bold | Check or Spacer 44.
struct AtlasSheetTitleRow: View {
    let title: String
    var showsCheck: Bool = false
    let onClose: () -> Void
    var onCheck: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 0) {
            Button(action: onClose) {
                Text("✕")
                    .font(AtlasTypography.bodyLarge())
                    .foregroundStyle(AtlasColors.ink)
                    .frame(width: AtlasMetrics.touchTarget, height: AtlasMetrics.touchTarget)
            }
            .buttonStyle(.plain)

            Text(title)
                .font(AtlasTypography.button())
                .foregroundStyle(AtlasColors.ink)
                .lineLimit(1)
                .frame(maxWidth: .infinity)

            if showsCheck, let onCheck {
                Button(action: onCheck) {
                    Text("✓")
                        .font(AtlasTypography.cardTitle())
                        .foregroundStyle(AtlasColors.ink)
                        .frame(width: AtlasMetrics.touchTarget, height: AtlasMetrics.touchTarget)
                }
                .buttonStyle(.plain)
            } else {
                Color.clear
                    .frame(width: AtlasMetrics.touchTarget, height: AtlasMetrics.touchTarget)
            }
        }
        .frame(height: AtlasMetrics.touchTarget)
    }
}

// MARK: - Sheet zoom background (Marvel V4.0)

private struct AtlasSheetZoomBackgroundModifier: ViewModifier {
    let isPresented: Bool

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPresented ? 0.95 : 1.0, anchor: .center)
            .overlay {
                if isPresented {
                    Color.black.opacity(0.4)
                        .ignoresSafeArea()
                        .allowsHitTesting(false)
                }
            }
            .animation(.easeInOut(duration: 0.25), value: isPresented)
    }
}

extension View {
    /// Scale presenting view to 0.95 and dim to 0.4 while a bottom sheet is open.
    func atlasSheetZoomBackground(isPresented: Bool) -> some View {
        modifier(AtlasSheetZoomBackgroundModifier(isPresented: isPresented))
    }
}

extension View {
    /// S12A Auth Required Sheet (ardot 237:565): 28pt corner radius, white bg, no outer stroke.
    /// Uses SwiftUI's native `presentationCornerRadius` so the system clips content to the
    /// rounded sheet shape — this avoids square-edge bleed where content overflowed a custom
    /// surface that was only rounding its own background fill.
    func atlasBottomSheetStyle() -> some View {
        modifier(AtlasBottomSheetStyleModifier())
    }
}

private struct AtlasBottomSheetStyleModifier: ViewModifier {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    func body(content: Content) -> some View {
        content
            .presentationDetents([.height(detentHeight)])
            .presentationDragIndicator(.hidden)
            .presentationCornerRadius(AtlasMetrics.radiusSheet)
            .presentationBackground(AtlasColors.surface)
    }

    private var detentHeight: CGFloat {
        switch dynamicTypeSize {
        case .accessibility5, .accessibility4, .accessibility3:
            return 372
        case .accessibility2, .accessibility1:
            return 340
        case .xxxLarge, .xxLarge, .xLarge:
            return 324
        default:
            return 304
        }
    }
}

private struct AtlasBottomSheetPrimaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(AtlasTypography.button())
                .frame(maxWidth: .infinity)
                .frame(height: AtlasMetrics.primaryButtonHeight)
                .foregroundStyle(AtlasColors.lemonInk)
                .background(AtlasColors.primaryAction)
                .clipShape(Capsule(style: .continuous))
        }
    }
}

private struct AtlasBottomSheetSecondaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(AtlasTypography.button())
                .frame(maxWidth: .infinity)
                .frame(height: AtlasMetrics.primaryButtonHeight)
                .foregroundStyle(AtlasColors.ink)
                .background(AtlasColors.surfaceSecondary)
                .clipShape(Capsule(style: .continuous))
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(AtlasColors.border, lineWidth: 1)
                )
        }
    }
}

struct AtlasBottomSheetChrome<Content: View>: View {
    let title: String
    let message: String
    let primaryTitle: String
    let secondaryTitle: String?
    var primaryAction: () -> Void
    var secondaryAction: (() -> Void)?
    @ViewBuilder var extra: () -> Content

    init(
        title: String,
        message: String,
        primaryTitle: String,
        secondaryTitle: String? = nil,
        primaryAction: @escaping () -> Void,
        secondaryAction: (() -> Void)? = nil,
        @ViewBuilder extra: @escaping () -> Content = { EmptyView() }
    ) {
        self.title = title
        self.message = message
        self.primaryTitle = primaryTitle
        self.secondaryTitle = secondaryTitle
        self.primaryAction = primaryAction
        self.secondaryAction = secondaryAction
        self.extra = extra
    }

    var body: some View {
        VStack(spacing: 16) {
            AtlasSheetGrabber()

            // Title (ardot 237:567): 22pt SF Pro Display Bold, ink — not the 17pt button weight.
            Text(title)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(message)
                .font(.system(size: 14, weight: .regular))
                .foregroundStyle(AtlasColors.inkSoft)
                .lineLimit(3)
                .frame(maxWidth: .infinity, alignment: .leading)

            extra()

            AtlasBottomSheetPrimaryButton(title: primaryTitle, action: primaryAction)

            if let secondaryTitle, let secondaryAction {
                AtlasBottomSheetSecondaryButton(title: secondaryTitle, action: secondaryAction)
            }
        }
        // ardot 237:565 sheet padding: top 12 / bottom 24 / horizontal 20.
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 24)
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

// MARK: - Center dialog

struct AtlasCenterDialog: View {
    let title: String
    let message: String
    let destructiveTitle: String
    let cancelTitle: String
    var isLoading = false
    let onConfirm: () -> Void
    let onCancel: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.4)
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 16) {
                Text(title)
                    .font(AtlasTypography.button())
                    .foregroundStyle(AtlasColors.ink)

                Text(message)
                    .font(AtlasTypography.mobileBody())
                    .foregroundStyle(AtlasColors.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)

                Button(action: onConfirm) {
                    HStack(spacing: 8) {
                        if isLoading {
                            ProgressView().tint(.white)
                        }
                        Text(destructiveTitle)
                            .font(AtlasTypography.button())
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: AtlasMetrics.primaryButtonHeight)
                    .foregroundStyle(.white)
                    .background(AtlasColors.destructive)
                    .clipShape(Capsule())
                }
                .disabled(isLoading)

                Button(cancelTitle, action: onCancel)
                    .font(AtlasTypography.feedBody())
                    .foregroundStyle(AtlasColors.inkSoft)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
            }
            .padding(20)
            .frame(maxWidth: 326)
            .background(AtlasColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusSheet, style: .continuous))
            .padding(.horizontal, 32)
        }
    }
}

struct AtlasDestructiveButton: View {
    let title: String
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView().tint(.white)
                }
                Text(title)
                    .font(AtlasTypography.pill())
            }
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .foregroundStyle(.white)
            .background(AtlasColors.coral)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard))
        }
        .disabled(isLoading)
    }
}

// MARK: - Legal links

enum LegalLinks {
    static var privacyURL: URL {
        AppConfig.webBaseURL.appending(path: "privacy")
    }

    /// Web `/terms` when available; falls back to in-app `LegalDocuments.terms` via Settings.
    static var termsURL: URL {
        AppConfig.webBaseURL.appending(path: "terms")
    }

    static var supportURL: URL {
        URL(string: "https://github.com/wanye/ideaevo/issues")!
    }
}

struct LegalAgreementFooter: View {
    var body: some View {
        VStack(spacing: 12) {
            Text("继续即表示同意《用户协议》和《隐私政策》。第三方登录遵循对应平台授权规则。")
                .font(.system(size: 11))
                .foregroundStyle(AtlasColors.inkFaint)
                .multilineTextAlignment(.center)

            HStack(spacing: 12) {
                legalChip("用户协议", url: LegalLinks.termsURL)
                legalChip("隐私政策", url: LegalLinks.privacyURL)
            }
        }
    }

    private func legalChip(_ title: String, url: URL) -> some View {
        Link(destination: url) {
            Text(title)
                .font(.system(size: 11))
                .foregroundStyle(AtlasColors.ink)
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(AtlasColors.surface)
                .overlay(Capsule().stroke(AtlasColors.rule, lineWidth: 1))
        }
    }
}
