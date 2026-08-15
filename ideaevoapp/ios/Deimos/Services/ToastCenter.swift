import Foundation
import Observation

struct AtlasToastItem: Identifiable, Equatable {
    enum Kind: Equatable {
        case success
        case error
    }

    let id = UUID()
    let title: String
    let message: String?
    let kind: Kind
    /// Not compared in `Equatable`; a new toast always gets a new id.
    let retryHandler: (@MainActor () -> Void)?

    static func == (lhs: AtlasToastItem, rhs: AtlasToastItem) -> Bool {
        lhs.id == rhs.id
    }
}

@MainActor
@Observable
final class ToastCenter {
    static let shared = ToastCenter()

    private(set) var current: AtlasToastItem?
    private var dismissTask: Task<Void, Never>?

    func showSuccess(_ title: String, message: String? = nil) {
        show(AtlasToastItem(title: title, message: message, kind: .success, retryHandler: nil))
    }

    func showError(_ title: String, message: String? = nil, retry: (@MainActor () -> Void)? = nil) {
        show(AtlasToastItem(title: title, message: message, kind: .error, retryHandler: retry))
    }

    func show(_ item: AtlasToastItem, duration: TimeInterval = 2.5) {
        dismissTask?.cancel()
        current = item
        dismissTask = Task {
            try? await Task.sleep(for: .seconds(duration))
            guard !Task.isCancelled else { return }
            if current?.id == item.id {
                current = nil
            }
        }
    }

    func dismiss() {
        dismissTask?.cancel()
        current = nil
    }
}
