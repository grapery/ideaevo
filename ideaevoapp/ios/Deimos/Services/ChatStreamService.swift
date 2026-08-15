import Foundation

enum ChatStreamEvent: Sendable {
    case chunk(String)
    case activity(String)
    case done(String)
    case error(String)
}

@MainActor
final class ChatStreamService {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func stream(sessionID: String, content: String, token: String) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    guard let streamURL = AppConfig.apiURL(path: "sessions/\(sessionID)/stream"),
                          var components = URLComponents(url: streamURL, resolvingAgainstBaseURL: false) else {
                        continuation.finish(throwing: APIError.invalidURL)
                        return
                    }
                    components.queryItems = [URLQueryItem(name: "content", value: content)]
                    guard let url = components.url else {
                        continuation.finish(throwing: APIError.invalidURL)
                        return
                    }

                    var request = URLRequest(url: url)
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    request.setValue("text/event-stream", forHTTPHeaderField: "Accept")

                    let (bytes, response) = try await session.bytes(for: request)
                    guard let http = response as? HTTPURLResponse else {
                        continuation.finish(throwing: APIError.server("无效的服务器响应"))
                        return
                    }
                    guard (200..<300).contains(http.statusCode) else {
                        continuation.finish(throwing: APIError.server("消息发送失败 (\(http.statusCode))"))
                        return
                    }

                    var buffer = ""
                    var fullContent = ""
                    var decoder = UTF8()

                    for try await byte in bytes {
                        guard let scalar = decoder.decode(byte) else { continue }
                        buffer.append(scalar)

                        while let range = buffer.range(of: "\n\n") {
                            let frame = String(buffer[..<range.lowerBound])
                            buffer = String(buffer[range.upperBound...])
                            if processFrame(frame, fullContent: &fullContent, continuation: continuation) {
                                continuation.finish()
                                return
                            }
                        }
                    }

                    if !fullContent.isEmpty {
                        continuation.yield(.done(fullContent))
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    private func processFrame(
        _ frame: String,
        fullContent: inout String,
        continuation: AsyncThrowingStream<ChatStreamEvent, Error>.Continuation
    ) -> Bool {
        var eventType = ""
        var dataLines: [String] = []
        for line in frame.split(separator: "\n", omittingEmptySubsequences: false) {
            let s = String(line)
            if s.hasPrefix("event:") {
                eventType = String(s.dropFirst(6)).trimmingCharacters(in: .whitespaces)
            } else if s.hasPrefix("data:") {
                dataLines.append(String(s.dropFirst(5)).trimmingCharacters(in: .whitespaces))
            }
        }
        let dataStr = dataLines.joined(separator: "\n")

        if eventType == "done" {
            continuation.yield(.done(fullContent))
            return true
        }
        if eventType == "error" {
            continuation.yield(.error(dataStr.isEmpty ? "stream error" : dataStr))
            return true
        }
        if eventType == "tool_call" || eventType == "tool_result", let tool = parseToolLabel(dataStr, eventType: eventType) {
            continuation.yield(.activity(tool))
        }
        if eventType == "a2a", let label = parseA2ALabel(dataStr) {
            continuation.yield(.activity(label))
        }
        if eventType == "assistant_message", let content = parseAssistantContent(dataStr) {
            fullContent = content
            continuation.yield(.chunk(content))
        }
        if eventType.isEmpty, !dataStr.isEmpty, dataStr != "[DONE]" {
            fullContent += dataStr
            continuation.yield(.chunk(fullContent))
        }
        return false
    }

    private func parseToolLabel(_ data: String, eventType: String) -> String? {
        guard let jsonData = data.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
            return nil
        }
        let tool = obj["tool"] as? String ?? obj["name"] as? String
        let isA2A = (obj["is_a2a"] as? Bool == true) || (obj["a2a_completed"] as? Bool == true)

        // A2A（delegate_to_agent）：后端把进度塞在 tool_call/tool_result 事件里，
        // 用 target_agent_name 字段标识目标 Agent。
        if let target = obj["target_agent_name"] as? String, !target.isEmpty {
            if eventType == "tool_result" {
                let ok = obj["ok"] as? Bool ?? true
                return ok ? "\(target) 已回复" : "\(target) 通信失败"
            }
            return "正在与 \(target) 通信…"
        }
        if isA2A {
            return eventType == "tool_result" ? "Agent 已回复" : "正在与 Agent 通信…"
        }
        if let tool {
            if eventType == "tool_result" {
                let ok = obj["ok"] as? Bool ?? true
                return ok ? "\(tool) · 已完成" : "\(tool) · 失败"
            }
            return "\(tool) · 进行中"
        }
        return nil
    }

    private func parseA2ALabel(_ data: String) -> String? {
        guard let jsonData = data.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
            return "正在与 Agent 通信…"
        }
        // 兼容独立 a2a 事件（后端目前不发，但保留）；优先读后端实际字段 target_agent_name。
        if let agent = obj["target_agent_name"] as? String ?? obj["agent"] as? String ?? obj["target"] as? String {
            return "正在与 \(agent) 通信…"
        }
        return "正在与 Agent 通信…"
    }

    private func parseAssistantContent(_ data: String) -> String? {
        guard let jsonData = data.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
              let content = obj["content"] as? String else {
            return nil
        }
        return content
    }
}

private struct UTF8 {
    private var pending: [UInt8] = []

    mutating func decode(_ byte: UInt8) -> String? {
        pending.append(byte)
        if let s = String(bytes: pending, encoding: .utf8) {
            pending.removeAll()
            return s
        }
        if pending.count >= 4 {
            pending.removeAll()
        }
        return nil
    }
}
