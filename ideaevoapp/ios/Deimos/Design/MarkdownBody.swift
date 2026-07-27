import SwiftUI

struct MarkdownBody: View {
    let markdown: String
    var textColor: Color = AtlasColors.inkSoft
    /// 行数限制:nil=不限制,数字=截断(用于卡片摘要场景)。
    var lineLimit: Int? = nil

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
        .foregroundStyle(textColor)
        .frame(maxWidth: .infinity, alignment: .leading)
        .lineLimit(lineLimit)
        .textSelection(.enabled)
    }
}
