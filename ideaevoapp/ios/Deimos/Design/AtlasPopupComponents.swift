import SwiftUI

// MARK: - Toast

struct AtlasToastBanner: View {
    let item: AtlasToastItem
    var onRetry: (() -> Void)?

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(dotColor)
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(foregroundColor)
                    .lineLimit(1)
                if let message = item.message, !message.isEmpty {
                    Text(message)
                        .font(.system(size: 12))
                        .foregroundStyle(secondaryForeground)
                        .lineLimit(2)
                }
            }

            Spacer(minLength: 8)

            if item.kind == .error, onRetry != nil {
                Button("重试", action: { onRetry?() })
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.95))
            }
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 48)
        .background(backgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .shadow(color: .black.opacity(0.16), radius: 12, y: 8)
    }

    private var backgroundColor: Color {
        item.kind == .success ? AtlasColors.ink : AtlasColors.coral
    }

    private var foregroundColor: Color {
        .white
    }

    private var secondaryForeground: Color {
        .white.opacity(0.82)
    }

    private var dotColor: Color {
        item.kind == .success ? AtlasColors.entityAgent : .white.opacity(0.9)
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
        Capsule()
            .fill(AtlasColors.rule)
            .frame(width: AtlasMetrics.sheetGrabberWidth, height: AtlasMetrics.sheetGrabberHeight)
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
                    .font(.system(size: 17))
                    .foregroundStyle(AtlasColors.ink)
                    .frame(width: AtlasMetrics.touchTarget, height: AtlasMetrics.touchTarget)
            }
            .buttonStyle(.plain)

            Text(title)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
                .lineLimit(1)
                .frame(maxWidth: .infinity)

            if showsCheck, let onCheck {
                Button(action: onCheck) {
                    Text("✓")
                        .font(.system(size: 17, weight: .semibold))
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

private struct AtlasBottomSheetSurface: View {
    var body: some View {
        UnevenRoundedRectangle(
            topLeadingRadius: AtlasMetrics.radiusSheet,
            bottomLeadingRadius: 0,
            bottomTrailingRadius: 0,
            topTrailingRadius: AtlasMetrics.radiusSheet
        )
        .fill(AtlasColors.surface)
        .ignoresSafeArea(edges: .bottom)
    }
}

extension View {
    /// Atlas page 34: flush bottom sheet, top-only corner radius, no outer stroke.
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
            .presentationCornerRadius(0)
            .presentationBackground {
                AtlasBottomSheetSurface()
            }
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
                .font(.system(size: 17, weight: .semibold))
                .frame(maxWidth: .infinity)
                .frame(height: AtlasMetrics.primaryButtonHeight)
                .foregroundStyle(.white)
                .background(AtlasColors.primary)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        }
    }
}

private struct AtlasBottomSheetSecondaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
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

            AtlasSheetTitleRow(
                title: title,
                onClose: { secondaryAction?() }
            )

            Text(message)
                .font(AtlasTypography.mobileBody())
                .foregroundStyle(AtlasColors.inkSoft)
                .lineLimit(3)
                .frame(maxWidth: .infinity, alignment: .leading)

            extra()

            AtlasBottomSheetPrimaryButton(title: primaryTitle, action: primaryAction)

            if let secondaryTitle, let secondaryAction {
                AtlasBottomSheetSecondaryButton(title: secondaryTitle, action: secondaryAction)
            }
        }
        .padding(20)
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
                    .font(.system(size: 17, weight: .bold))
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
                    .font(.system(size: 15))
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
                    .font(.system(size: 14, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .foregroundStyle(.white)
            .background(AtlasColors.coral)
            .clipShape(RoundedRectangle(cornerRadius: 14))
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
