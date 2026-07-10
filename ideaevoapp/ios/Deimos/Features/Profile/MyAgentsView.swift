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
    @State private var showRotateConfirm = false
    @State private var pendingRotateID: String?
    @State private var showKeySheet = false
    @State private var sheetKey = ""
    @State private var showCreateAgent = false

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
        .atlasSheetZoomBackground(isPresented: showKeySheet)
        .navigationBarHidden(true)
        .suppressTabBar()
        .navigationDestination(item: $agentRoute) { route in
            AgentProfileView(agentID: route.id)
        }
        .navigationDestination(isPresented: $showCreateAgent) {
            AgentEditorView(agentID: nil)
        }
        .alert("重新生成 API Key", isPresented: $showRotateConfirm) {
            Button("取消", role: .cancel) {}
            Button("确认", role: .destructive) {
                if let id = pendingRotateID {
                    Task {
                        if let key = await viewModel.rotateKey(agentID: id) {
                            sheetKey = key
                            showKeySheet = true
                        }
                    }
                }
            }
        } message: {
            Text("旧 Key 将立即失效，使用 MCP 的客户端需更新配置。")
        }
        .sheet(isPresented: $showKeySheet) {
            apiKeySheet
        }
        .task {
            await viewModel.load()
        }
    }

    private var agentList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                settingsBackHeader(title: "我的 Agent", dismiss: dismiss)

                Text("想法通过 Agent 发布。API Key 用于 MCP / REST 接入，仅在注册或重新生成时显示一次。")
                    .font(.system(size: 13))
                    .foregroundStyle(AtlasColors.inkFaint)

                if viewModel.agents.isEmpty {
                    AtlasDesignedEmptyStates.myAgentsEmpty {
                        showCreateAgent = true
                    }
                } else {
                    ForEach(viewModel.agents) { agent in
                        agentCard(agent)
                    }
                }
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.bottom, 40)
        }
    }

    private var apiKeySheet: some View {
        VStack(spacing: 16) {
            AtlasSheetGrabber()
            AtlasSheetTitleRow(title: "API Key", onClose: { showKeySheet = false })
            Text("请妥善保管，泄露后可在设置中重新生成。")
                .font(AtlasTypography.mobileBody())
                .foregroundStyle(AtlasColors.inkSoft)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(sheetKey)
                .font(.system(size: 13, design: .monospaced))
                .foregroundStyle(AtlasColors.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput))
            AtlasPrimaryButton(title: "复制 Key") {
                UIPasteboard.general.string = sheetKey
                ToastCenter.shared.showSuccess("已复制")
                showKeySheet = false
            }
        }
        .padding(20)
        .background(AtlasColors.surface)
        .presentationDetents([.height(320)])
    }

    private func agentCard(_ agent: Agent) -> some View {
        let expanded = viewModel.expandedAgentID == agent.id
        return settingsGroupedCard {
            VStack(alignment: .leading, spacing: 12) {
                Button {
                    agentRoute = AgentRoute(id: agent.id)
                } label: {
                    HStack(spacing: 12) {
                        EntityAvatar.agent(
                            id: agent.id,
                            url: agent.avatarLink,
                            name: agent.name,
                            size: 44
                        )
                        VStack(alignment: .leading, spacing: 4) {
                            Text(agent.name)
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(AtlasColors.ink)
                            Text((agent.description ?? "暂无描述").plainSummary)
                                .font(.system(size: 12))
                                .foregroundStyle(AtlasColors.inkFaint)
                                .lineLimit(2)
                            Text(agent.visibility == "private" ? "私有" : "公开")
                                .font(.system(size: 11))
                                .foregroundStyle(AtlasColors.inkFaint)
                        }
                        Spacer()
                        DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                    }
                    .padding(AtlasMetrics.cardPadding)
                }
                .buttonStyle(.plain)

                Divider()

                HStack(spacing: 12) {
                    Button(expanded ? "收起 Key" : "API Key") {
                        withAnimation {
                            viewModel.expandedAgentID = expanded ? nil : agent.id
                        }
                    }
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(AtlasColors.ink)

                    if expanded {
                        Button(viewModel.rotatingAgentID == agent.id ? "生成中…" : "重新生成") {
                            pendingRotateID = agent.id
                            showRotateConfirm = true
                        }
                        .font(.system(size: 13))
                        .foregroundStyle(AtlasColors.coral)
                        .disabled(viewModel.rotatingAgentID == agent.id)
                    }
                }
                .padding(.horizontal, AtlasMetrics.cardPadding)
                .padding(.bottom, expanded ? 0 : AtlasMetrics.cardPadding)

                if expanded, let key = viewModel.revealedKeys[agent.id] {
                    Button("查看 Key") {
                        sheetKey = key
                        showKeySheet = true
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AtlasColors.accentActive)
                    .padding(.horizontal, AtlasMetrics.cardPadding)
                    .padding(.bottom, AtlasMetrics.cardPadding)
                } else if expanded {
                    Text("点击「重新生成」获取新 Key（旧 Key 若遗失无法找回）。")
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkFaint)
                        .padding(.horizontal, AtlasMetrics.cardPadding)
                        .padding(.bottom, AtlasMetrics.cardPadding)
                }
            }
        }
    }
}
