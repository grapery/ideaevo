import SwiftUI

struct ForkSheet: View {
    let sourceTitle: String
    var sourceIdeaID: String? = nil
    var sourceIconURL: URL? = nil
    var isSubmitting = false
    var errorMessage: String?
    var onSubmit: (String, String, String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var description = ""
    @State private var reason = ""

    var body: some View {
        VStack(spacing: 0) {
            AtlasSheetGrabber()
                .padding(.top, 8)

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    // Sheet title — 24pt Bold (Ardot S33 189:119)
                    Text("Fork 这个版本")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(AtlasColors.ink)
                        .padding(.top, 4)

                    sourceIdeaCard

                    field("新想法标题（可选）", text: $title)
                    multilineField("描述", text: $description, minHeight: 100)
                    multilineField("Fork 原因", text: $reason, minHeight: 72)

                    if let errorMessage {
                        Text(errorMessage)
                            .font(AtlasTypography.meta())
                            .foregroundStyle(AtlasColors.coral)
                    }

                    // Confirm Fork button — lemon-strong, 48h, r12 (Ardot S33 189:121)
                    confirmForkButton

                    // Version attribution notice — lemon-soft card (Ardot S33 189:167)
                    versionAttributionNotice

                    // Close button
                    Button("取消") { dismiss() }
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 4)
                }
                .padding(.horizontal, AtlasMetrics.detailX)
                .padding(.bottom, 24)
            }
        }
        .background(AtlasColors.surface)
        .atlasScrollDismissesKeyboard()
        .presentationDetents([.large])
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(AtlasMetrics.radiusSheet)
        .onAppear {
            if title.isEmpty {
                title = "\(sourceTitle) (Fork)"
            }
        }
    }

    /// Lemon-soft notice card explaining version attribution (Ardot 189:167).
    private var versionAttributionNotice: some View {
        Text("Fork 会记录 source_version_id，后续统计归入当前版本。")
            .font(.system(size: 14))
            .foregroundStyle(AtlasColors.lemonInk)
            .lineSpacing(6)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(AtlasColors.lemonSoft)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    /// Confirm Fork button — lemon-strong bg, lemonInk text 15pt Bold, 48h r12 (Ardot 189:121).
    private var confirmForkButton: some View {
        Button {
            onSubmit(
                title.trimmingCharacters(in: .whitespacesAndNewlines),
                description.trimmingCharacters(in: .whitespacesAndNewlines),
                reason.trimmingCharacters(in: .whitespacesAndNewlines)
            )
        } label: {
            HStack(spacing: 8) {
                if isSubmitting {
                    ProgressView().tint(AtlasColors.lemonInk)
                }
                Text("创建 Fork")
                    .font(.system(size: 15, weight: .bold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .foregroundStyle(AtlasColors.lemonInk)
            .background(AtlasColors.lemonStrong)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(
            isSubmitting
            || description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        )
    }

    private var sourceIdeaCard: some View {
        HStack(spacing: 12) {
            if let sourceIdeaID {
                EntityAvatar.idea(id: sourceIdeaID, url: sourceIconURL, name: sourceTitle, size: 40)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("原想法")
                    .font(AtlasTypography.overline())
                    .foregroundStyle(AtlasColors.inkFaint)
                Text(sourceTitle)
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
        .padding(AtlasMetrics.cardPadding)
        .background(AtlasColors.entityIdea.opacity(0.55))
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }

    private func field(_ placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(placeholder)
                .font(AtlasTypography.overline())
                .foregroundStyle(AtlasColors.inkFaint)
            AtlasTextField(placeholder: placeholder, text: text, height: AtlasMetrics.inputHeight)
                .padding(.horizontal, 4)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
        }
    }

    private func multilineField(_ placeholder: String, text: Binding<String>, minHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(placeholder)
                .font(AtlasTypography.overline())
                .foregroundStyle(AtlasColors.inkFaint)
            ZStack(alignment: .topLeading) {
                if text.wrappedValue.isEmpty {
                    Text(placeholder)
                        .font(AtlasTypography.mobileSubheadline())
                        .foregroundStyle(AtlasColors.inkFaint)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 14)
                }
                AtlasTextEditor(text: text, minHeight: minHeight, fontSize: 17)
                    .padding(4)
            }
            .background(AtlasColors.fill)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
        }
    }
}
