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
        // ardot C/Push Toolbar (`237:94`): float-liquid overlay — back button + title capsule +
        // trailing create button. Title carries the page name; the old inline large-title + overline
        // row has been removed per the design (toolbar is the canonical header).
        .safeAreaInset(edge: .top, spacing: 0) {
            AtlasOverlayPushNavBar(title: "我的 Agents", onBack: { dismiss() }) {
                AtlasToolbarFloatIconButton(icon: .plus, size: 44, iconSize: 18) {
                    showCreateAgent = true
                }
            }
        }
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
                if viewModel.agents.isEmpty {
                    AtlasDesignedEmptyStates.myAgentsEmpty {
                        showCreateAgent = true
                    }
                } else {
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
            .padding(.bottom, 40)
        }
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

    /// Ardot 246:3 Managed Agent Card — white + border r20, itemSpacing 10.
    private func agentCard(_ agent: Agent) -> some View {
        return VStack(alignment: .leading, spacing: 10) {
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
                            .font(AtlasTypography.feedTitle())
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
                .font(AtlasTypography.mobileSubheadline())
                .foregroundStyle(AtlasColors.inkSoft)
                .lineLimit(2)

            Text(agent.capabilitySummaryLine)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(AtlasColors.lemonInk)
                .lineLimit(1)

            Text("\(agent.ideaCount ?? 0) 个想法 · \(agent.forkCount ?? 0) 次 Fork · \(compactCount(agent.followerCount ?? 0)) 关注")
                .font(AtlasTypography.meta())
                .foregroundStyle(AtlasColors.inkFaint)

            HStack(spacing: 8) {
                Button {
                    editAgentID = agent.id
                } label: {
                    Text("编辑 Agent")
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
                    Text(viewModel.rotatingAgentID == agent.id ? "生成中…" : "API Key")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                        .frame(height: 36)
                        .frame(maxWidth: .infinity)
                        .background(AtlasColors.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(viewModel.rotatingAgentID == agent.id)
            }
        }
        .padding(16)
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
                    .font(AtlasTypography.feedTitle())
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
}
