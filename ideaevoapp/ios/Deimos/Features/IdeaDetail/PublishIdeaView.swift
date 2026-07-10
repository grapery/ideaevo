import SwiftUI
import Observation

@MainActor
@Observable
final class PublishIdeaViewModel {
    var title = ""
    var descriptionText = ""
    var category = "other"
    var selectedAgentID = ""
    var agents: [Agent] = []
    var similarIdeas: [SimilarIdeaMatch] = []
    var isLoadingAgents = false
    var isSubmitting = false
    var errorMessage: String?

    let categories: [(id: String, label: String)] = [
        ("tool", "工具"),
        ("service", "服务"),
        ("integration", "集成"),
        ("automation", "自动化"),
        ("creative", "创意"),
        ("data", "数据"),
        ("other", "其他"),
    ]

    var selectedAgent: Agent? {
        agents.first { $0.id == selectedAgentID }
    }

    func loadAgents() async {
        isLoadingAgents = true
        defer { isLoadingAgents = false }
        do {
            let loaded = try await APIClient.shared.myAgents()
            agents = loaded
            if selectedAgentID.isEmpty, let first = loaded.first {
                selectedAgentID = first.id
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func submit() async throws -> Idea {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDesc = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else { throw APIError.server("请填写标题") }
        guard !trimmedDesc.isEmpty else { throw APIError.server("请填写描述") }
        guard !selectedAgentID.isEmpty else { throw APIError.server("请选择发布 Agent") }
        isSubmitting = true
        errorMessage = nil
        similarIdeas = []
        defer { isSubmitting = false }
        return try await APIClient.shared.createIdea(
            title: trimmedTitle,
            description: trimmedDesc,
            category: category,
            agentID: selectedAgentID
        )
    }
}

struct PublishIdeaView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = PublishIdeaViewModel()
    @State private var publishedRoute: IdeaRoute?
    @State private var similarRoute: IdeaRoute?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                settingsBackHeader(title: "发布想法", dismiss: dismiss)

                Text("选择代表你发布的 Agent，也可通过万叶助手对话间接创建。")
                    .font(AtlasTypography.mobileSubheadline())
                    .foregroundStyle(AtlasColors.inkFaint)

                agentPicker

                editorField("标题", text: $viewModel.title)
                editorMultiline("描述", text: $viewModel.descriptionText, minHeight: 160)

                VStack(alignment: .leading, spacing: 6) {
                    Text("分类")
                        .font(.system(size: 11))
                        .foregroundStyle(AtlasColors.inkFaint)
                    Picker("分类", selection: $viewModel.category) {
                        ForEach(viewModel.categories, id: \.id) { item in
                            Text(item.label).tag(item.id)
                        }
                    }
                    .pickerStyle(.menu)
                }

                if !viewModel.similarIdeas.isEmpty {
                    similarIdeasSection
                }

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(AtlasTypography.meta())
                        .foregroundStyle(AtlasColors.coral)
                }

                AtlasPrimaryButton(
                    title: "发布想法",
                    isLoading: viewModel.isSubmitting
                ) {
                    Task { await publish() }
                }
                .disabled(viewModel.agents.isEmpty)
            }
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.bottom, 40)
        }
        .background(AtlasColors.canvas)
        .navigationBarHidden(true)
        .suppressTabBar()
        .atlasScrollDismissesKeyboard()
        .navigationDestination(item: $publishedRoute) { route in
            IdeaDetailView(ideaID: route.id)
        }
        .navigationDestination(item: $similarRoute) { route in
            IdeaDetailView(ideaID: route.id)
        }
        .task {
            await viewModel.loadAgents()
        }
    }

    @ViewBuilder
    private var agentPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("发布 Agent")
                .font(AtlasTypography.overline())
                .foregroundStyle(AtlasColors.inkFaint)
            if viewModel.isLoadingAgents {
                ProgressView()
            } else if viewModel.agents.isEmpty {
                Text("暂无 Agent，请先在「我的 Agent」中创建。")
                    .font(AtlasTypography.mobileSubheadline())
                    .foregroundStyle(AtlasColors.inkFaint)
            } else {
                if let agent = viewModel.selectedAgent {
                    HStack(spacing: 12) {
                        EntityAvatar.agent(id: agent.id, url: agent.avatarLink, name: agent.name, size: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(agent.name)
                                .font(AtlasTypography.cardTitle())
                                .foregroundStyle(AtlasColors.ink)
                            Text("将以该 Agent 名义发布")
                                .font(AtlasTypography.mobileSubheadline())
                                .foregroundStyle(AtlasColors.inkFaint)
                        }
                        Spacer()
                        Picker("Agent", selection: $viewModel.selectedAgentID) {
                            ForEach(viewModel.agents) { item in
                                Text(item.name).tag(item.id)
                            }
                        }
                        .labelsHidden()
                        .tint(AtlasColors.ink)
                    }
                    .padding(AtlasMetrics.cardPadding)
                    .background(AtlasColors.entityAgent.opacity(0.35))
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                }
            }
        }
    }

    private var similarIdeasSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                DeimosIconView(icon: .sparkles, size: 14, color: AtlasColors.accentWarning)
                Text("发现相似想法")
                    .font(AtlasTypography.cardTitle())
                    .foregroundStyle(AtlasColors.ink)
            }
            Text("建议先查看已有想法，或调整标题/描述后再发布。")
                .font(AtlasTypography.mobileSubheadline())
                .foregroundStyle(AtlasColors.inkSoft)

            ForEach(viewModel.similarIdeas) { match in
                Button {
                    similarRoute = IdeaRoute(id: match.idea.id)
                } label: {
                    HStack(spacing: 12) {
                        EntityAvatar.idea(id: match.idea.id, url: match.idea.iconLink, name: match.idea.title, size: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(match.idea.title)
                                .font(AtlasTypography.mobileBody())
                                .foregroundStyle(AtlasColors.ink)
                                .lineLimit(1)
                            Text("\(Int(match.similarity * 100))% 相似")
                                .font(AtlasTypography.meta())
                                .foregroundStyle(AtlasColors.inkFaint)
                        }
                        Spacer()
                        DeimosIconView(icon: .chevronRight, size: 12, color: AtlasColors.inkFaint)
                    }
                    .padding(12)
                    .background(AtlasColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(AtlasMetrics.cardPadding)
        .background(AtlasColors.accentWarningSoft)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.accentWarning.opacity(0.45), lineWidth: 1)
        )
    }

    private func editorField(_ title: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(AtlasTypography.overline())
                .foregroundStyle(AtlasColors.inkFaint)
            AtlasTextField(placeholder: title, text: text, height: AtlasMetrics.inputHeight)
                .padding(.horizontal, 4)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
        }
    }

    private func editorMultiline(_ title: String, text: Binding<String>, minHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(AtlasTypography.overline())
                .foregroundStyle(AtlasColors.inkFaint)
            AtlasTextEditor(text: text, minHeight: minHeight, fontSize: 17)
                .padding(8)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
        }
    }

    private func publish() async {
        do {
            let idea = try await viewModel.submit()
            ToastCenter.shared.showSuccess("想法已发布")
            publishedRoute = IdeaRoute(id: idea.id)
        } catch let error as APIError {
            if case .similarIdeas(let message, let matches) = error {
                viewModel.similarIdeas = matches
                viewModel.errorMessage = message
            } else {
                viewModel.errorMessage = error.localizedDescription
            }
        } catch {
            viewModel.errorMessage = error.localizedDescription
        }
    }
}
