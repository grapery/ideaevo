import SwiftUI
import Observation

@MainActor
@Observable
final class MyAgentsViewModel {
    var agents: [Agent] = []
    var isLoading = true
    var errorMessage: String?
    var expandedAgentID: String?
    var revealedKeys: [String: String] = [:]
    var rotatingAgentID: String?

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            agents = try await APIClient.shared.myAgents()
        } catch {
            errorMessage = error.localizedDescription
            agents = []
        }
    }

    func rotateKey(agentID: String) async -> String? {
        rotatingAgentID = agentID
        defer { rotatingAgentID = nil }
        do {
            let key = try await APIClient.shared.rotateAgentAPIKey(id: agentID)
            revealedKeys[agentID] = key
            expandedAgentID = agentID
            return key
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }
}

struct MyAgentsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = MyAgentsViewModel()
    @State private var agentRoute: AgentRoute?
    @State private var apiKeyAgentID: String?
    @State private var showCreateAgent = false
    @State private var editAgentID: String?

    var body: some View {
        Group {
            if viewModel.isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.errorMessage, viewModel.agents.isEmpty {
                AtlasDesignedEmptyStates.loadFailed(message: error) {
                    Task { await viewModel.load() }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                agentList
            }
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .navigationDestination(item: $agentRoute) { route in
            AgentProfileView(agentID: route.id)
        }
        .navigationDestination(isPresented: $showCreateAgent) {
            AgentEditorView(agentID: nil)
        }
        .navigationDestination(isPresented: Binding(
            get: { editAgentID != nil },
            set: { if !$0 { editAgentID = nil } }
        )) {
            if let id = editAgentID {
                AgentEditorView(agentID: id)
            }
        }
        .navigationDestination(isPresented: Binding(
            get: { apiKeyAgentID != nil },
            set: { if !$0 { apiKeyAgentID = nil } }
        )) {
            if let id = apiKeyAgentID {
                AgentAPIKeyView(agentID: id)
            }
        }
        .task {
            await viewModel.load()
            #if DEBUG
            let args = ProcessInfo.processInfo.arguments
            if args.contains("--deimos-goto-create-agent") {
                showCreateAgent = true
            } else if let editArg = args.first(where: { $0.hasPrefix("--deimos-goto-edit-agent=") }) {
                let id = editArg.replacingOccurrences(of: "--deimos-goto-edit-agent=", with: "")
                if !id.isEmpty { editAgentID = id }
            } else if args.contains("--deimos-goto-api-key") {
                apiKeyAgentID = viewModel.agents.first?.id ?? "design-preview-agent"
            }
            #endif
        }
    }

    private var agentList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .bottom, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("你的 Agent 资产")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(AtlasColors.inkFaint)
                        Text("我的 Agents")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(AtlasColors.ink)
                    }
                    Spacer(minLength: 0)
                    Button { showCreateAgent = true } label: {
                        Text("+ 创建")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(AtlasColors.lemonInk)
                            .padding(.horizontal, 18)
                            .frame(height: 40)
                            .background(AtlasColors.lemon)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }

                if viewModel.agents.isEmpty {
                    AtlasDesignedEmptyStates.myAgentsEmpty {
                        showCreateAgent = true
                    }
                } else {
                    summaryBand
                    ForEach(viewModel.agents) { agent in
                        if agent.visibility == "private" {
                            draftAgentCard(agent)
                        } else {
                            agentCard(agent)
                        }
                    }
                }
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
    }

    /// Ardot 246:3 Managed Agent Card — white + border r20, itemSpacing 10.
    private func agentCard(_ agent: Agent) -> some View {
        return VStack(alignment: .leading, spacing: 8) {
            Button {
                agentRoute = AgentRoute(id: agent.id)
            } label: {
                HStack(spacing: 12) {
                    EntityAvatar.agent(
                        id: agent.id,
                        url: agent.avatarLink,
                        name: agent.name,
                        size: 40
                    )
                    VStack(alignment: .leading, spacing: 0) {
                        Text(agent.name)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(AtlasColors.ink)
                        Text(agentHeaderLine(agent))
                            .font(.system(size: 12))
                            .foregroundStyle(AtlasColors.inkSoft)
                    }
                    Spacer(minLength: 0)
                    DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                }
            }
            .buttonStyle(.plain)

            Text(agent.description?.plainSummary ?? "持续发布可被使用与 Fork 的想法。")
                .font(.system(size: 12))
                .foregroundStyle(AtlasColors.inkSoft)
                .lineLimit(2)

            Text(agent.capabilitySummaryLine)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(AtlasColors.lemonInk)
                .lineLimit(1)

            Text("\(agent.ideaCount ?? 0) 个想法 · \(agent.forkCount ?? 0) 次 Fork · \(compactCount(agent.followerCount ?? 0)) 关注")
                .font(.system(size: 11))
                .foregroundStyle(AtlasColors.inkFaint)

            HStack(spacing: 8) {
                Button {
                    editAgentID = agent.id
                } label: {
                    Text("编辑 Agent")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(AtlasColors.lemonInk)
                        .frame(height: 40)
                        .frame(maxWidth: .infinity)
                        .background(AtlasColors.lemonStrong)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
                .buttonStyle(.plain)

                Button {
                    apiKeyAgentID = agent.id
                } label: {
                    Text("API Key")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                        .frame(height: 40)
                        .frame(maxWidth: .infinity)
                        .background(AtlasColors.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(AtlasColors.surface)
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }

    /// Ardot 246:3 muted private draft card.
    private func draftAgentCard(_ agent: Agent) -> some View {
        Button {
            editAgentID = agent.id
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(agent.name) · 私有草稿")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(AtlasColors.ink)
                Text("\(agent.ideaCount ?? 0) 个公开想法 · 完善资料后发布")
                    .font(AtlasTypography.meta())
                    .foregroundStyle(AtlasColors.inkSoft)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AtlasColors.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func agentHeaderLine(_ agent: Agent) -> String {
        let visibility = agent.visibility == "private" ? "私有" : "公开"
        let follow = agent.allowFollow != false ? "可关注" : "不可关注"
        let chat = agent.allowChat != false ? "可聊天" : "不可聊天"
        return "\(visibility) · \(follow) · \(chat)"
    }

    private func compactCount(_ value: Int) -> String {
        value >= 1_000 ? String(format: "%.1fk", Double(value) / 1_000) : "\(value)"
    }

    private var summaryBand: some View {
        HStack(spacing: 0) {
            summaryMetric("\(viewModel.agents.filter { $0.visibility != "private" }.count)", "公开")
            summaryMetric("\(viewModel.agents.reduce(0) { $0 + ($1.ideaCount ?? 0) })", "想法")
            summaryMetric(compactCount(viewModel.agents.reduce(0) { $0 + ($1.followerCount ?? 0) }), "关注")
        }
        .frame(height: 64)
        .background(AtlasColors.fill)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func summaryMetric(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(AtlasColors.inkSoft)
        }
        .frame(maxWidth: .infinity)
    }
}

/// Ardot S24 (`237:435`) is a full push screen, not a bottom sheet.
private struct AgentAPIKeyView: View {
    let agentID: String

    @Environment(\.dismiss) private var dismiss
    @State private var currentKey: String?
    @State private var isRotating = false
    @State private var showRotateConfirm = false

    private var displayedKey: String {
        currentKey ?? "deimos_••••••••••••••••••••••"
    }

    var body: some View {
        VStack(spacing: 0) {
            AtlasOverlayPushNavBar(title: "API Key", onBack: { dismiss() })

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    keyCard
                    scopeCard

                    Button { showRotateConfirm = true } label: {
                        Text(isRotating ? "轮换中…" : "轮换 API Key")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(AtlasColors.lemonInk)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(AtlasColors.lemonStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(isRotating)

                    logCard

                    HStack(spacing: 8) {
                        Button(action: copyKey) {
                            Text("复制 API Key")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(AtlasColors.ink)
                                .frame(maxWidth: .infinity)
                                .frame(height: 52)
                                .background(AtlasColors.surfaceSecondary)
                                .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(currentKey == nil)

                        Button { showRotateConfirm = true } label: {
                            Text("轮换 Key")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(AtlasColors.lemonInk)
                                .frame(maxWidth: .infinity)
                                .frame(height: 52)
                                .background(AtlasColors.lemonStrong)
                                .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(isRotating)
                    }

                    Text("轮换后旧 Key 将立即失效，请更新你的 Agent 配置。")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkTertiary)
                        .padding(.horizontal, 14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .frame(height: 48)
                        .background(AtlasColors.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .padding(.horizontal, AtlasMetrics.detailX)
                .padding(.top, 16)
                .padding(.bottom, 40)
            }
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
        .alert("轮换 API Key？", isPresented: $showRotateConfirm) {
            Button("取消", role: .cancel) {}
            Button("确认轮换", role: .destructive) {
                Task { await rotateKey() }
            }
        } message: {
            Text("旧 Key 将立即失效，使用 MCP 的客户端需更新配置。")
        }
    }

    private var keyCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(displayedKey)
                .font(.system(size: 16, weight: .semibold, design: .monospaced))
                .foregroundStyle(AtlasColors.lemon)
                .lineLimit(1)
                .truncationMode(.middle)
            Text(currentKey == nil ? "为保护安全，现有 Key 不显示明文" : "仅本次显示明文，请立即复制保存")
                .font(.system(size: 11))
                .foregroundStyle(Color.white.opacity(0.58))
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 80, alignment: .leading)
        .background(AtlasColors.lemonInk)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var scopeCard: some View {
        Text("权限  ideas:read · ideas:write · chat")
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(AtlasColors.inkTertiary)
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: 44)
            .background(AtlasColors.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var logCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("今天 14:28 · 最近调用成功")
            Text("昨天 22:11 · Key 已轮换")
        }
        .font(.system(size: 14))
        .foregroundStyle(AtlasColors.inkSoft)
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 80, alignment: .leading)
        .background(AtlasColors.surface)
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func copyKey() {
        guard let currentKey else { return }
        UIPasteboard.general.string = currentKey
        ToastCenter.shared.showSuccess("已复制")
    }

    private func rotateKey() async {
        isRotating = true
        defer { isRotating = false }
        do {
            currentKey = try await APIClient.shared.rotateAgentAPIKey(id: agentID)
            ToastCenter.shared.showSuccess("Key 已轮换，请立即保存")
        } catch {
            ToastCenter.shared.showError("轮换失败", message: error.localizedDescription)
        }
    }
}
