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
                VStack(alignment: .leading, spacing: 16) {
                    AtlasSheetTitleRow(title: "Fork 这个想法", onClose: { dismiss() })

                    Text("基于原想法创建你的版本，保留溯源关系。")
                        .font(AtlasTypography.mobileBody())
                        .foregroundStyle(AtlasColors.inkSoft)

                    sourceIdeaCard

                    field("新想法标题（可选）", text: $title)
                    multilineField("描述", text: $description, minHeight: 100)
                    multilineField("Fork 原因", text: $reason, minHeight: 72)

                    if let errorMessage {
                        Text(errorMessage)
                            .font(AtlasTypography.meta())
                            .foregroundStyle(AtlasColors.coral)
                    }

                    AtlasPrimaryButton(title: "确认 Fork →", isLoading: isSubmitting) {
                        onSubmit(
                            title.trimmingCharacters(in: .whitespacesAndNewlines),
                            description.trimmingCharacters(in: .whitespacesAndNewlines),
                            reason.trimmingCharacters(in: .whitespacesAndNewlines)
                        )
                    }
                    .disabled(description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                              || reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .padding(.horizontal, AtlasMetrics.pageX)
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

    private var sourceIdeaCard: some View {
        HStack(spacing: 12) {
            if let sourceIdeaID {
                EntityAvatar.idea(id: sourceIdeaID, url: sourceIconURL, name: sourceTitle, size: 40)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("原想法")
                    .font(.system(size: 11, weight: .semibold))
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
