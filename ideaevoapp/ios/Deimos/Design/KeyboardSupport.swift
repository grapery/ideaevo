import SwiftUI
import UIKit

enum KeyboardSupport {
    static func dismiss() {
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder),
            to: nil,
            from: nil,
            for: nil
        )
    }
}

// MARK: - Global toolbar

private struct AtlasKeyboardToolbarModifier: ViewModifier {
    func body(content: Content) -> some View {
        content.toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("完成") { KeyboardSupport.dismiss() }
                    .font(AtlasTypography.subtitle())
            }
        }
    }
}

extension View {
    /// Adds a keyboard accessory bar with「完成」to dismiss the keyboard.
    func atlasKeyboardToolbar() -> some View {
        modifier(AtlasKeyboardToolbarModifier())
    }

    func atlasScrollDismissesKeyboard() -> some View {
        scrollDismissesKeyboard(.interactively)
    }
}

// MARK: - UIKit-backed single-line field (IME-safe)

struct ChineseFriendlyTextField: UIViewRepresentable {
    let placeholder: String
    @Binding var text: String
    var isSecure = false
    var keyboardType: UIKeyboardType = .default
    var returnKeyType: UIReturnKeyType = .default
    var autocapitalization: UITextAutocapitalizationType = .none
    var onSubmit: (() -> Void)?

    func makeUIView(context: Context) -> UITextField {
        let field = UITextField()
        field.delegate = context.coordinator
        field.placeholder = placeholder
        field.font = .systemFont(ofSize: 16)
        field.autocapitalizationType = autocapitalization
        field.autocorrectionType = .default
        field.keyboardType = keyboardType
        field.returnKeyType = returnKeyType
        field.isSecureTextEntry = isSecure
        field.borderStyle = .none
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        return field
    }

    func updateUIView(_ uiView: UITextField, context: Context) {
        context.coordinator.parent = self
        if uiView.placeholder != placeholder { uiView.placeholder = placeholder }
        if uiView.isSecureTextEntry != isSecure { uiView.isSecureTextEntry = isSecure }
        if uiView.keyboardType != keyboardType { uiView.keyboardType = keyboardType }
        if uiView.returnKeyType != returnKeyType { uiView.returnKeyType = returnKeyType }
        if uiView.autocapitalizationType != autocapitalization {
            uiView.autocapitalizationType = autocapitalization
        }
        guard !context.coordinator.isProgrammaticUpdate else { return }
        if uiView.markedTextRange == nil, uiView.text != text {
            uiView.text = text
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, UITextFieldDelegate {
        var parent: ChineseFriendlyTextField
        var isProgrammaticUpdate = false

        init(parent: ChineseFriendlyTextField) {
            self.parent = parent
        }

        func textFieldDidChangeSelection(_ textField: UITextField) {
            syncText(from: textField)
        }

        func textField(
            _ textField: UITextField,
            shouldChangeCharactersIn range: NSRange,
            replacementString string: String
        ) -> Bool {
            DispatchQueue.main.async { [weak self] in
                self?.syncText(from: textField)
            }
            return true
        }

        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            parent.onSubmit?()
            textField.resignFirstResponder()
            return true
        }

        private func syncText(from textField: UITextField) {
            guard textField.markedTextRange == nil else { return }
            let newValue = textField.text ?? ""
            guard newValue != parent.text else { return }
            isProgrammaticUpdate = true
            parent.text = newValue
            isProgrammaticUpdate = false
        }
    }
}

// MARK: - UIKit-backed multiline editor (IME-safe)

struct ChineseFriendlyTextEditor: UIViewRepresentable {
    @Binding var text: String
    var fontSize: CGFloat = 16
    var minHeight: CGFloat = 44
    var maxHeight: CGFloat?
    var returnKeyType: UIReturnKeyType = .default
    var onSubmit: (() -> Void)?

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.delegate = context.coordinator
        view.font = .systemFont(ofSize: fontSize)
        view.backgroundColor = .clear
        view.textContainerInset = UIEdgeInsets(top: 10, left: 8, bottom: 10, right: 8)
        view.textContainer.lineFragmentPadding = 0
        view.isScrollEnabled = false
        view.returnKeyType = returnKeyType
        view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        return view
    }

    func updateUIView(_ uiView: UITextView, context: Context) {
        context.coordinator.parent = self
        if uiView.returnKeyType != returnKeyType { uiView.returnKeyType = returnKeyType }
        guard !context.coordinator.isProgrammaticUpdate else { return }
        if uiView.markedTextRange == nil, uiView.text != text {
            uiView.text = text
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: ChineseFriendlyTextEditor
        var isProgrammaticUpdate = false

        init(parent: ChineseFriendlyTextEditor) {
            self.parent = parent
        }

        func textViewDidChange(_ textView: UITextView) {
            guard textView.markedTextRange == nil else { return }
            let newValue = textView.text ?? ""
            guard newValue != parent.text else { return }
            isProgrammaticUpdate = true
            parent.text = newValue
            isProgrammaticUpdate = false
        }

        func textView(
            _ textView: UITextView,
            shouldChangeTextIn range: NSRange,
            replacementText replacement: String
        ) -> Bool {
            if replacement == "\n", let onSubmit = parent.onSubmit {
                onSubmit()
                textView.resignFirstResponder()
                return false
            }
            return true
        }
    }
}

// MARK: - Styled SwiftUI wrappers

struct AtlasTextField: View {
    let placeholder: String
    @Binding var text: String
    var isSecure = false
    var keyboardType: UIKeyboardType = .default
    var returnKeyType: UIReturnKeyType = .default
    var height: CGFloat = 52
    var onSubmit: (() -> Void)? = nil

    var body: some View {
        ChineseFriendlyTextField(
            placeholder: placeholder,
            text: $text,
            isSecure: isSecure,
            keyboardType: keyboardType,
            returnKeyType: returnKeyType,
            onSubmit: onSubmit
        )
        .frame(height: height)
    }
}

struct AtlasMultilineTextField: View {
    let placeholder: String
    @Binding var text: String
    var minHeight: CGFloat = 44
    var maxHeight: CGFloat = 120
    var onSubmit: (() -> Void)? = nil

    var body: some View {
        ZStack(alignment: .topLeading) {
            if text.isEmpty {
                Text(placeholder)
                    .font(.system(size: 16))
                    .foregroundStyle(AtlasColors.inkFaint)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .allowsHitTesting(false)
            }
            ChineseFriendlyTextEditor(
                text: $text,
                minHeight: minHeight,
                maxHeight: maxHeight,
                returnKeyType: onSubmit == nil ? .default : .send,
                onSubmit: onSubmit
            )
            .frame(minHeight: minHeight, maxHeight: maxHeight)
        }
    }
}

struct AtlasTextEditor: View {
    @Binding var text: String
    var minHeight: CGFloat = 96
    var fontSize: CGFloat = 14

    var body: some View {
        ChineseFriendlyTextEditor(text: $text, fontSize: fontSize, minHeight: minHeight)
    }
}
