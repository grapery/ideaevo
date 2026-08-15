import SwiftUI

struct ReactionStrip: View {
    let counts: [String: Int]
    let mine: String
    var isLoading = false
    var onPick: (String) -> Void
    var onRemove: () -> Void

    @State private var showPicker = false

    var body: some View {
        HStack(spacing: 8) {
            Button {
                showPicker.toggle()
            } label: {
                Text(showPicker ? "✕" : "😀")
                    .font(.system(size: 16))
                    .frame(width: 32, height: 32)
                    .background(AtlasColors.fill)
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusChip, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(isLoading)

            if showPicker {
                ForEach(ReactionEmoji.all, id: \.self) { emoji in
                    Button {
                        showPicker = false
                        if mine == emoji {
                            onRemove()
                        } else {
                            onPick(emoji)
                        }
                    } label: {
                        Text(emoji)
                            .font(.system(size: 16))
                            .frame(width: 32, height: 32)
                            .background(mine == emoji ? AtlasColors.accentActiveSoft : AtlasColors.surface)
                            .overlay(
                                RoundedRectangle(cornerRadius: AtlasMetrics.radiusChip, style: .continuous)
                                    .stroke(AtlasColors.rule, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            } else {
                ForEach(sortedEmojis, id: \.0) { emoji, count in
                    Button {
                        if mine == emoji {
                            onRemove()
                        } else {
                            onPick(emoji)
                        }
                    } label: {
                        Text("\(emoji)\(count)")
                            .font(.system(size: 13, weight: mine == emoji ? .semibold : .regular))
                            .foregroundStyle(mine == emoji ? AtlasColors.accentActive : AtlasColors.inkSoft)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(mine == emoji ? AtlasColors.accentActiveSoft : AtlasColors.fill)
                            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusChip, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(isLoading)
                }
            }

            Spacer()
        }
        .padding(.horizontal, AtlasMetrics.pageX)
        .padding(.vertical, 8)
        .background(AtlasColors.canvas)
    }

    private var sortedEmojis: [(String, Int)] {
        counts
            .filter { $0.value > 0 }
            .sorted { $0.value > $1.value }
            .map { ($0.key, $0.value) }
    }
}
