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
        .atlasSheetZoomBackground(isPresented: showKeySheet)
        .navigationBarHidden(true)
        .suppressTabBar()
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
                // S13 — Back button row (36×36 r18 #F4F5F8)
                HStack(spacing: 12) {
                    AtlasNavBackButton(action: { dismiss() })
                    Spacer()
                }
                .padding(.top, 4)

                // S13 Page title — 32pt Bold ink (Ardot 179:296)
                Text("我的 Agent")
                    .font(.system(size: 36, weight: .heavy))
                    .foregroundStyle(AtlasColors.ink)

                // S13 Agent Owner Summary — bg #EEF4FF r20 + 1px border (Ardot 179:297)
                ownerSummaryCard

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
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.bottom, 40)
        }
    }

    /// S13 Agent Owner Summary — soft-blue card summarising API key & avatar management.
    private var ownerSummaryCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(viewModel.agents.count) 个 Agent 正在生成想法")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
            Text("API Key 以 wanye_ 前缀签发；可轮换、上传头像、调整可见性。")
                .font(.system(size: 12))
                .foregroundStyle(Color(hex: 0x687083))
                .lineSpacing(6)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: 0xEEF4FF))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color(hex: 0xE7EAF0), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var apiKeySheet: some View {
        VStack(alignment: .leading, spacing: 14) {
            AtlasSheetGrabber()
            AtlasSheetTitleRow(title: "API Key", onClose: { showKeySheet = false })

            // S24 Key Status Card — bg ink r16 itemSpacing 8 (Ardot 189:46)
            VStack(alignment: .leading, spacing: 8) {
                Text(sheetKey)
                    .font(.system(size: 14, design: .monospaced))
                    .foregroundStyle(Color.white)
                Text("仅在创建或轮换时显示明文")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.white.opacity(0.85))
                Text("最近调用：刚刚")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.white.opacity(0.7))
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AtlasColors.ink)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            // S24 Rotate Key button — lemonStrong bg, lemonInk text, 48h r12 (Ardot 189:48)
            Button {
                UIPasteboard.general.string = sheetKey
                ToastCenter.shared.showSuccess("已复制")
                showKeySheet = false
            } label: {
                Text("复制 Key")
                    .font(.system(size: 15, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .foregroundStyle(AtlasColors.lemonInk)
                    .background(AtlasColors.lemonStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)

            // S24 Key Audit List — white + 1px border r16 itemSpacing 8 (Ardot 189:149)
            VStack(alignment: .leading, spacing: 8) {
                Text("仅显示一次，请妥善保存")
                    .font(.system(size: 15))
                    .foregroundStyle(Color(hex: 0x3E4652))
                Text("失效状态：旧 Key 立即不可用")
                    .font(.system(size: 15))
                    .foregroundStyle(Color(hex: 0x3E4652))
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white)
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color(hex: 0xE7EAF0), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .padding(20)
        .background(AtlasColors.surface)
        .presentationDetents([.height(380)])
    }

    /// S13 Managed Agent Card — bg #F8FAFC r20 + 1px border, itemSpacing 10 (Ardot 179:300).
    private func agentCard(_ agent: Agent) -> some View {
        let expanded = viewModel.expandedAgentID == agent.id
        return VStack(alignment: .leading, spacing: 10) {
            // 179:301 Agent Header — 44 avatar + name 14pt SemiBold ink
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
                    VStack(alignment: .leading, spacing: 0) {
                        Text(agent.name)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(AtlasColors.ink)
                        Text(agentHeaderLine(agent))
                            .font(.system(size: 12))
                            .foregroundStyle(Color(hex: 0x687083))
                    }
                    Spacer(minLength: 0)
                    DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                }
            }
            .buttonStyle(.plain)

            // 179:304 Agent Metrics — 3 tiles r14, 12pt SemiBold labels, spacing 8
            HStack(spacing: 8) {
                metricTile(
                    text: "\(agent.followerCount ?? 0) 关注",
                    bg: Color.white,
                    textColor: AtlasColors.ink
                )
                metricTile(
                    text: "\(agent.followerCount ?? 0) 关注",
                    bg: Color(hex: 0xFFF5D8),
                    textColor: Color(hex: 0x6C5600)
                )
                metricTile(
                    text: "— 次调用",
                    bg: Color(hex: 0xF2FFC5),
                    textColor: AtlasColors.olive
                )
            }

            // 179:311 Agent Actions — Edit / Rotate Key / Upload buttons, 36h r18
            HStack(spacing: 8) {
                Button {
                    editAgentID = agent.id
                } label: {
                    Text("编辑")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(AtlasColors.lemonInk)
                        .frame(height: 36)
                        .frame(maxWidth: .infinity)
                        .background(AtlasColors.lemonStrong)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(.plain)

                Button {
                    pendingRotateID = agent.id
                    showRotateConfirm = true
                } label: {
                    Text(viewModel.rotatingAgentID == agent.id ? "生成中…" : "轮换 Key")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(AtlasColors.olive)
                        .frame(height: 36)
                        .frame(maxWidth: .infinity)
                        .background(Color(hex: 0xF2FFC5))
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(viewModel.rotatingAgentID == agent.id)

                Button {
                    withAnimation {
                        viewModel.expandedAgentID = expanded ? nil : agent.id
                    }
                } label: {
                    Text(expanded ? "收起 Key" : "API Key")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color(hex: 0x687083))
                        .frame(height: 36)
                        .frame(maxWidth: .infinity)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(.plain)
            }

            if expanded, let key = viewModel.revealedKeys[agent.id] {
                Button {
                    sheetKey = key
                    showKeySheet = true
                } label: {
                    Text("查看 Key")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(AtlasColors.accentActive)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(Color(hex: 0xF8FAFC))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color(hex: 0xE7EAF0), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func agentHeaderLine(_ agent: Agent) -> String {
        let visibility = agent.visibility == "private" ? "私有" : "公开"
        let follow = agent.allowFollow != false ? "可关注" : "不可关注"
        let chat = agent.allowChat != false ? "可聊天" : "不可聊天"
        return "\(visibility) · \(follow) · \(chat)"
    }

    private func metricTile(text: String, bg: Color, textColor: Color) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(textColor)
            .frame(maxWidth: .infinity)
            .frame(height: 38)
            .background(bg)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
