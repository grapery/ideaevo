import Foundation
import Observation

enum DeepLinkDestination: Equatable, Identifiable {
    case verifyEmail(token: String)
    case resetPassword(token: String)
    case idea(id: String)

    var id: String {
        switch self {
        case .verifyEmail(let token): return "verify-\(token)"
        case .resetPassword(let token): return "reset-\(token)"
        case .idea(let id): return "idea-\(id)"
        }
    }
}

@MainActor
@Observable
final class DeepLinkRouter {
    var pending: DeepLinkDestination?

    func handle(url: URL) {
        if url.scheme == "deimos" {
            handleDeimosURL(url)
            return
        }
        if let host = url.host, host.contains("deimos") || host.contains("ideaevo") {
            handleWebURL(url)
        }
    }

    private func handleDeimosURL(_ url: URL) {
        let path = url.host ?? url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        let token = query.first(where: { $0.name == "token" })?.value

        switch path {
        case "verify-email":
            if let token, !token.isEmpty {
                pending = .verifyEmail(token: token)
            }
        case "reset-password":
            if let token, !token.isEmpty {
                pending = .resetPassword(token: token)
            }
        case "ideas":
            let id = url.pathComponents.last(where: { $0 != "/" && !$0.isEmpty })
            if let id, !id.isEmpty {
                pending = .idea(id: id)
            }
        default:
            break
        }
    }

    private func handleWebURL(_ url: URL) {
        let parts = url.pathComponents.filter { $0 != "/" }
        guard let token = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == "token" })?
            .value else { return }

        if parts.contains("verify-email") {
            pending = .verifyEmail(token: token)
        } else if parts.contains("reset-password") {
            pending = .resetPassword(token: token)
        } else if let ideasIndex = parts.firstIndex(of: "ideas"), ideasIndex + 1 < parts.count {
            pending = .idea(id: parts[ideasIndex + 1])
        }
    }

    func consume() -> DeepLinkDestination? {
        defer { pending = nil }
        return pending
    }
}
