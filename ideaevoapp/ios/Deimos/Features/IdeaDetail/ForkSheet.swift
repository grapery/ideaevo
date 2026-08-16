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

                    AtlasFormField(label: "新标题") {
                        AtlasFormTextField(placeholder: "为这个版本重新命名", text: $title)
                    }
                    AtlasFormField(label: "Fork 理由（必填）") {
                        AtlasFormTextEditor(text: $reason, minHeight: 84, placeholder: "你将如何推进或改变它？")
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.system(size: 12))
                            .foregroundStyle(AtlasColors.destructive)
                    }

                    AtlasFormCTA(title: "确认 Fork", isLoading: isSubmitting) {
                        onSubmit(
                            title.trimmingCharacters(in: .whitespacesAndNewlines),
                            description.trimmingCharacters(in: .whitespacesAndNewlines),
                            reason.trimmingCharacters(in: .whitespacesAndNewlines)
                        )
                    }
                    .disabled(reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    // S15 Cancel Row — inkSoft Medium-13, centered under the CTA.
                    Button {
                        dismiss()
                    } label: {
                        Text("取消")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(AtlasColors.inkSoft)
                            .frame(height: 24)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
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

    /// S15 Source Card (ardot 715405210175453 `2:772`): surfaceSecondary r14 with a 30pt
    /// lemon fork icon circle, 源想法 eyebrow (11 inkSoft) + 13pt SemiBold title.
    private var sourceIdeaCard: some View {
        HStack(spacing: 10) {
            DeimosIconView(icon: .fork, size: 14, color: AtlasColors.lemonInk)
                .frame(width: 30, height: 30)
                .background(Circle().fill(AtlasColors.lemon))

            VStack(alignment: .leading, spacing: 2) {
                Text("源想法")
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkSoft)
                Text(sourceTitle)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(AtlasColors.settingsGroupFill)
        )
    }
}
