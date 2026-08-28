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

}

struct MyAgentsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = MyAgentsViewModel()
    @State private var agentRoute: AgentRoute?
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
        .task {
            await viewModel.load()
            #if DEBUG
            let args = ProcessInfo.processInfo.arguments
            if args.contains("--deimos-goto-create-agent") {
                showCreateAgent = true
            } else if let editArg = args.first(where: { $0.hasPrefix("--deimos-goto-edit-agent=") }) {
                let id = editArg.replacingOccurrences(of: "--deimos-goto-edit-agent=", with: "")
                if !id.isEmpty { editAgentID = id }
            }
            #endif
        }
    }

    // MARK: - S18 我的 Agent (ardot board 715405210175453, node `4:1`)
    //
    // Inline nav with a lemonStrong circular create button; agents are compact
    // white r20 cards (avatar 48 · name + type badge · status line · stats line);
    // a lemonSoft capsule CTA closes the list.

    private var agentList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                AtlasSubPageNavBar(title: "我的 Agent", onBack: { dismiss() }) {
                    Button { showCreateAgent = true } label: {
                        DeimosIconView(icon: .plus, size: 18, color: AtlasColors.lemonInk)
                            .frame(width: 40, height: 40)
                            .background(Circle().fill(AtlasColors.lemonStrong))
                            .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("创建 Agent")
                }

                if viewModel.agents.isEmpty {
                    AtlasDesignedEmptyStates.myAgentsEmpty {
                        showCreateAgent = true
                    }
                } else {
                    ForEach(viewModel.agents) { agent in
                        agentCard(agent)
                    }

                    Button { showCreateAgent = true } label: {
                        HStack(spacing: 6) {
                            DeimosIconView(icon: .plus, size: 14, color: AtlasColors.lemonInk)
                            Text("创建新 Agent")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(AtlasColors.lemonInk)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Capsule(style: .continuous).fill(AtlasColors.action))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)
            .padding(.bottom, 40)
        }
    }

    /// S18 Agent Card — 90pt white r20 hairline card. Tap opens the agent profile
    /// (drafts open the editor); the trailing lock button keeps API Key management
    /// one tap away.
    private func agentCard(_ agent: Agent) -> some View {
        let isPrivate = agent.visibility == "private"
        return Button {
            if isPrivate {
                editAgentID = agent.id
            } else {
                agentRoute = AgentRoute(id: agent.id)
            }
        } label: {
            HStack(spacing: 12) {
                EntityAvatar.agent(
                    id: agent.id,
                    url: agent.avatarLink,
                    name: agent.name,
                    size: 48
                )

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(agent.name)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(AtlasColors.ink)
                            .lineLimit(1)
                        typeBadge(agent)
                    }
                    Text(statusLine(agent))
                        .font(.system(size: 11))
                        .foregroundStyle(isPrivate ? AtlasColors.inkSoft : AtlasColors.success)
                        .lineLimit(1)
                    Text("\(agent.ideaCount ?? 0) 想法 · \(compactCount(agent.followerCount ?? 0)) 关注 · \(agent.forkCount ?? 0) Fork")
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkSoft)
                        .lineLimit(1)
                }

                Spacer(minLength: 0)

                DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
            }
            .padding(14)
            .background(AtlasColors.surface)
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(AtlasColors.cardStroke, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    /// 个人 Agent → lemonSoft/olive · 公开 → successSoft/success · 私有 → gray.
    private func typeBadge(_ agent: Agent) -> some View {
        let text: String
        let background: Color
        let foreground: Color
        if agent.isPersonal == true {
            text = "个人 Agent"; background = AtlasColors.lemonSoft; foreground = AtlasColors.olive
        } else if agent.visibility == "private" {
            text = "私有"; background = AtlasColors.settingsGroupFill; foreground = AtlasColors.inkSoft
        } else {
            text = "公开"; background = AtlasColors.successSoft; foreground = AtlasColors.success
        }
        return Text(text)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(foreground)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(background))
    }

    private func statusLine(_ agent: Agent) -> String {
        let state = agent.visibility == "private" ? "仅自己可用" : "运行中"
        if let model = agent.llmModel, !model.isEmpty {
            return "\(state) · \(model)"
        }
        return state
    }

    private func compactCount(_ value: Int) -> String {
        value >= 1_000 ? String(format: "%.1fk", Double(value) / 1_000) : "\(value)"
    }
}

