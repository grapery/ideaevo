import SwiftUI

/// Form & settings primitives for the current Ardot mobile board
/// (file 715405210175453, screens S16 管理想法 / S17 设置 / S18 我的 Agent /
/// S19 Agent 编辑器 / S27 编辑资料 / S28 注销账号).
///
/// Visual language on this board:
/// - Sub-page nav is **inline** (scrolls with content): 40×40 `surfaceSecondary`
///   circle back button + 16 SemiBold ink title, optional olive trailing action.
/// - Settings groups are borderless `#F2F2F7` cards (r16, pad-h14/pad-v4) with
///   44pt rows — label 14 Regular ink, trailing value 12 Regular inkSoft.
/// - Form fields: 13 SemiBold ink label, `bgInput` fill r12, 14pt text.

// MARK: - Inline sub-page nav (S16/S17/S18/S27/S28 Nav Bar)

struct AtlasSubPageNavBar<Trailing: View>: View {
    let title: String
    var onBack: () -> Void
    @ViewBuilder var trailing: () -> Trailing

    init(
        title: String,
        onBack: @escaping () -> Void,
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }
    ) {
        self.title = title
        self.onBack = onBack
        self.trailing = trailing
    }

    var body: some View {
        HStack(spacing: 0) {
            Button(action: onBack) {
                DeimosIconView(icon: .chevronBack, size: 18, color: AtlasColors.ink)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(AtlasColors.surfaceSecondary))
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("返回")

            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
                .padding(.leading, 12)

            Spacer(minLength: 0)
            trailing()
        }
    }
}

/// Olive text action for the nav trailing slot (S27 保存 / S19 取消·保存).
struct AtlasNavTextAction: View {
    let title: String
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Text(title)
                        .font(.system(size: 14, weight: .semibold))
                }
            }
            .foregroundStyle(AtlasColors.olive)
            .frame(height: 40)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }
}

// MARK: - Settings group card (S17 Bind Group / Prefs Group)

/// Borderless `#F2F2F7` group card: r16, horizontal padding 14, vertical padding 4.
struct AtlasFormGroupCard<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) { content() }
            .padding(.horizontal, 14)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(AtlasColors.settingsGroupFill)
            )
    }
}

/// 44pt group row: 14 Regular ink label on the left, trailing slot on the right.
/// Set `height` to 52 for rows carrying a toggle (S17 Row Notify).
struct AtlasFormGroupRow<Trailing: View>: View {
    let label: String
    var height: CGFloat = 44
    @ViewBuilder var trailing: () -> Trailing

    init(
        label: String,
        height: CGFloat = 44,
        @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }
    ) {
        self.label = label
        self.height = height
        self.trailing = trailing
    }

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14))
                .foregroundStyle(AtlasColors.ink)
            Spacer(minLength: 0)
            trailing()
        }
        .frame(minHeight: height, alignment: .center)
        .contentShape(Rectangle())
    }
}

/// 12 Regular `inkSoft` trailing value (S17 row values).
struct AtlasFormGroupValue: View {
    let text: String
    var color: Color = AtlasColors.inkSoft

    var body: some View {
        Text(text)
            .font(.system(size: 12))
            .foregroundStyle(color)
    }
}

/// 12 SemiBold group section label (S17 Group Label 账号绑定 / 偏好).
struct AtlasFormGroupLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(AtlasColors.inkSoft)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Violet toggle as drawn on the board (S17 Toggle: 46×28, r14, lemonStrong fill).
struct AtlasFormToggle: View {
    @Binding var isOn: Bool

    var body: some View {
        Toggle("", isOn: $isOn)
            .labelsHidden()
            .tint(AtlasColors.lemonStrong)
    }
}

// MARK: - Form fields (S16/S27/S28)

/// 13 SemiBold ink field label (S16 标题/描述, S27 昵称/简介, S28 确认输入).
struct AtlasFieldLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(AtlasColors.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Input field: `bgInput` fill, r12, 14pt text, 44–46pt tall.
struct AtlasFormTextField: View {
    var placeholder: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default
    var secure = false

    var body: some View {
        Group {
            if secure {
                SecureField(placeholder, text: $text)
            } else {
                TextField(placeholder, text: $text)
                    .keyboardType(keyboard)
            }
        }
        .font(.system(size: 14))
        .foregroundStyle(AtlasColors.ink)
        .padding(.horizontal, 14)
        .frame(height: 46, alignment: .center)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(AtlasColors.bgInput)
        )
    }
}

/// Multi-line field: `bgInput` fill, r12, 13pt text with 19–20pt line height.
struct AtlasFormTextEditor: View {
    @Binding var text: String
    var minHeight: CGFloat = 76
    var placeholder = "描述"
    var fontSize: CGFloat = 13

    var body: some View {
        TextEditor(text: $text)
            .font(.system(size: fontSize))
            .foregroundStyle(AtlasColors.ink)
            .lineSpacing(6)
            .scrollContentBackground(.hidden)
            .padding(.horizontal, 10)
            .padding(.vertical, 10)
            .frame(minHeight: minHeight, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(AtlasColors.bgInput)
            )
            .overlay(alignment: .topLeading) {
                if text.isEmpty {
                    Text(placeholder)
                        .font(.system(size: fontSize))
                        .foregroundStyle(AtlasColors.inkFaint)
                        .padding(.horizontal, 15)
                        .padding(.vertical, 16)
                        .allowsHitTesting(false)
                }
            }
    }
}

/// A labeled field block: label above input (8pt gap), per S16/S27/S28 field frames.
struct AtlasFormField<Field: View>: View {
    let label: String
    @ViewBuilder var field: () -> Field

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            AtlasFieldLabel(text: label)
            field()
        }
    }
}

// MARK: - Segmented picker (S16 Impl Segmented)

/// Board segmented control: `surfaceSecondary` r14 container (pad 4, gap 6);
/// selected segment lemon fill with lemonInk SemiBold 12 label, unselected
/// inkTertiary Medium 12.
struct AtlasFormSegmentPicker<Option: Hashable>: View {
    let options: [(value: Option, label: String)]
    @Binding var selection: Option

    var body: some View {
        HStack(spacing: 6) {
            ForEach(options, id: \.value) { option in
                let isSelected = option.value == selection
                Button {
                    withAnimation(.easeOut(duration: 0.15)) { selection = option.value }
                } label: {
                    Text(option.label)
                        .font(.system(size: 12, weight: isSelected ? .semibold : .medium))
                        .foregroundStyle(
                            isSelected ? AtlasColors.lemonInk : AtlasColors.inkTertiary
                        )
                        .frame(maxWidth: .infinity)
                        .frame(height: 32)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(isSelected ? AtlasColors.lemon : .clear)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(AtlasColors.settingsGroupFill)
        )
    }
}

// MARK: - Primary CTA (S16 保存并发布新版本 / S19 保存 Agent / S28 确认删除)

/// Full-width pill CTA: 48pt tall, r24. `fill` defaults to lemonStrong with
/// lemonInk label (brand CTA); pass `AtlasColors.destructive` for danger CTAs.
struct AtlasFormCTA: View {
    let title: String
    var fill: Color = AtlasColors.lemonStrong
    var textColor: Color = AtlasColors.lemonInk
    /// 48 (r24) for the standard CTA; S28 注销 uses 52 (r26) per the board.
    var height: CGFloat = 48
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .tint(textColor)
                        .controlSize(.small)
                }
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(textColor)
            }
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(Capsule(style: .continuous).fill(fill))
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }
}
