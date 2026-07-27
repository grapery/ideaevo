import SwiftUI

struct ForkSheet: View {
    let sourceTitle: String
    var sourceDescription: String = ""
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
                    Text("Fork 这个想法")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(AtlasColors.ink)
                        .padding(.top, 12)

                    sourceIdeaCard

                    field("新标题", placeholder: "为这个版本重新命名", text: $title)
                    multilineField("Fork 理由", placeholder: "你将如何推进或改变它？", text: $reason, minHeight: 96)

                    if let errorMessage {
                        Text(errorMessage)
                            .font(AtlasTypography.meta())
                            .foregroundStyle(AtlasColors.coral)
                    }

                    AtlasPrimaryButton(title: "确认 Fork", isLoading: isSubmitting) {
                        onSubmit(
                            title.trimmingCharacters(in: .whitespacesAndNewlines),
                            description.trimmingCharacters(in: .whitespacesAndNewlines),
                            reason.trimmingCharacters(in: .whitespacesAndNewlines)
                        )
                    }
                    .disabled(reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .padding(.horizontal, AtlasMetrics.pageX)
                .padding(.bottom, 24)
            }
        }
        .background(AtlasColors.surface)
        .atlasScrollDismissesKeyboard()
        // Ardot S06 opens as a focused bottom sheet; the keyboard can still
        // scroll its fields without turning the initial decision into a page.
        .presentationDetents([.height(520)])
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(AtlasMetrics.radiusSheet)
        .onAppear {
            // Default the new fork title to the source title verbatim — the fork status is shown
            // separately via the Fork badge on the idea card (forkedFromID != nil), NOT encoded in
            // the title. Appending " (Fork)" here caused "title (Fork) (Fork) (Fork)" when an
            // already-forked idea was forked again.
            if title.isEmpty {
                title = sourceTitle
            }
            if description.isEmpty {
                description = sourceDescription
            }
        }
    }

    private var sourceIdeaCard: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("源想法：\(sourceTitle)")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(2)
                Text("保留谱系与版本历史")
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkFaint)
            }
            Spacer(minLength: 0)
        }
        .padding(AtlasMetrics.cardPadding)
        .background(AtlasColors.lemonSoft)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }

    private func field(_ label: String, placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AtlasColors.inkFaint)
            AtlasTextField(placeholder: placeholder, text: text, height: 48)
                .padding(.horizontal, 4)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }

    private func multilineField(_ label: String, placeholder: String, text: Binding<String>, minHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AtlasColors.inkFaint)
            ZStack(alignment: .topLeading) {
                if text.wrappedValue.isEmpty {
                    Text(placeholder)
                        .font(.system(size: 15))
                        .foregroundStyle(AtlasColors.inkFaint)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 14)
                }
                AtlasTextEditor(text: text, minHeight: minHeight, fontSize: 15)
                    .padding(4)
            }
            .background(AtlasColors.fill)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }
}
