import Foundation
import SwiftUI

struct ChatIdeaSuggestion: Identifiable, Hashable {
    let id: String
    let title: String
    var summary: String?
}

enum ChatIdeaSuggestionParser {
    static func suggestions(from message: ChatMessage) -> [ChatIdeaSuggestion] {
        guard message.isAssistant, !message.content.isEmpty else { return [] }

        if message.contentType == "json" {
            if let parsed = parseJSON(message.content), !parsed.isEmpty {
                return parsed
            }
        }

        return parseMarkdownLinks(message.content)
    }

    private static func parseJSON(_ raw: String) -> [ChatIdeaSuggestion]? {
        guard let data = raw.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) else {
            return nil
        }

        if let array = object as? [[String: Any]] {
            return array.compactMap(suggestion(from:))
        }
        if let dict = object as? [String: Any] {
            if let ideas = dict["ideas"] as? [[String: Any]] {
                return ideas.compactMap(suggestion(from:))
            }
            if let results = dict["results"] as? [[String: Any]] {
                return results.compactMap { item in
                    if let idea = item["idea"] as? [String: Any] {
                        return suggestion(from: idea)
                    }
                    return suggestion(from: item)
                }
            }
            if let idea = dict["idea"] as? [String: Any], let one = suggestion(from: idea) {
                return [one]
            }
            if let one = suggestion(from: dict) {
                return [one]
            }
        }
        return nil
    }

    private static func suggestion(from dict: [String: Any]) -> ChatIdeaSuggestion? {
        guard let id = dict["id"] as? String, !id.isEmpty else { return nil }
        let title = (dict["title"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let title, !title.isEmpty else { return nil }
        let summary = (dict["description"] as? String)?.plainSummary
        return ChatIdeaSuggestion(id: id, title: title, summary: summary)
    }

    private static func parseMarkdownLinks(_ content: String) -> [ChatIdeaSuggestion] {
        let pattern = #"(?:deimos://ideas/|/api/ideas/|/ideas/)([0-9a-fA-F-]{36})"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }

        let range = NSRange(content.startIndex..<content.endIndex, in: content)
        let matches = regex.matches(in: content, range: range)
        var seen = Set<String>()
        var results: [ChatIdeaSuggestion] = []

        for match in matches {
            guard match.numberOfRanges > 1,
                  let idRange = Range(match.range(at: 1), in: content) else { continue }
            let id = String(content[idRange])
            guard seen.insert(id).inserted else { continue }

            let title = markdownTitle(near: match.range, in: content) ?? "想法 \(id.prefix(8))"
            results.append(ChatIdeaSuggestion(id: id, title: title, summary: nil))
        }
        return results
    }

    private static func markdownTitle(near range: NSRange, in content: String) -> String? {
        guard let swiftRange = Range(range, in: content) else { return nil }
        let before = content[..<swiftRange.lowerBound]
        if let lineStart = before.lastIndex(of: "\n") {
            let line = content[lineStart...].prefix(120)
            if let linkMatch = line.range(of: #"\[([^\]]+)\]"#, options: .regularExpression) {
                let inner = line[linkMatch].dropFirst().dropLast()
                if inner.hasPrefix("[") {
                    return String(inner.dropFirst().dropLast())
                }
            }
        }
        return nil
    }
}

struct ChatIdeaSuggestionCard: View {
    let suggestion: ChatIdeaSuggestion
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                EntityAvatar.idea(
                    id: suggestion.id,
                    url: nil,
                    name: suggestion.title,
                    size: 40
                )
                VStack(alignment: .leading, spacing: 4) {
                    Text(suggestion.title)
                        .font(AtlasTypography.pill())
                        .foregroundStyle(AtlasColors.ink)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    if let summary = suggestion.summary, !summary.isEmpty {
                        Text(summary)
                            .font(.system(size: 12))
                            .foregroundStyle(AtlasColors.inkFaint)
                            .lineLimit(2)
                    }
                }
                Spacer(minLength: 0)
                Text("查看 Idea →")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AtlasColors.accentActive)
            }
            .padding(AtlasMetrics.cardPadding)
            .frame(maxWidth: 260, alignment: .leading)
            .background(AtlasColors.entityIdea.opacity(0.55))
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}
