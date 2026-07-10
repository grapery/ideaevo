import SwiftUI

struct MarkdownBody: View {
    let markdown: String

    var body: some View {
        Group {
            if let attributed = try? AttributedString(
                markdown: markdown,
                options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .full)
            ) {
                Text(attributed)
            } else {
                Text(markdown)
            }
        }
        .font(AtlasTypography.body())
        .foregroundStyle(AtlasColors.inkSoft)
        .frame(maxWidth: .infinity, alignment: .leading)
        .textSelection(.enabled)
    }
}
