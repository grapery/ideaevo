import SwiftUI
import Observation

@MainActor
@Observable
final class ChatAgentPickerViewModel {
    var agents: [Agent] = []
    var query = ""
    var isLoading = false
    var errorMessage: String?

    var filteredAgents: [Agent] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return agents }
        return agents.filter {
            $0.name.localizedCaseInsensitiveContains(trimmed)
                || ($0.description?.localizedCaseInsensitiveContains(trimmed) ?? false)
        }
    }

    func load() async {
        isLoading = agents.isEmpty
        errorMessage = nil
        defer { isLoading = false }
        do {
            agents = try await APIClient.shared.listAgents().agents
        } catch {
            errorMessage = error.localizedDescription
            agents = []
        }
    }
}

struct ChatAgentPickerView: View {
    let ideaID: String?
    let ideaTitle: String?
    var onSelect: (Agent) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = ChatAgentPickerViewModel()

    var body: some View {
        VStack(spacing: 0) {
            AtlasSheetGrabber()
                .padding(.top, 8)

            AtlasSheetTitleRow(title: "选择 Agent", onClose: { dismiss() })
                .padding(.horizontal, AtlasMetrics.pageX)
                .padding(.bottom, 12)

            if let ideaTitle, !ideaTitle.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("携带想法上下文")
                        .font(AtlasTypography.overline())
                        .foregroundStyle(AtlasColors.inkFaint)
                    Text(ideaTitle)
                        .font(AtlasTypography.mobileSubheadline())
                        .foregroundStyle(AtlasColors.ink)
                        .lineLimit(2)
                }
                .padding(AtlasMetrics.cardPadding)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AtlasColors.entityIdea.opacity(0.55))
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                .padding(.horizontal, AtlasMetrics.pageX)
                .padding(.bottom, 12)
            }

            AtlasEmbeddedSearchBar(
                placeholder: "搜索 Agent",
                text: $viewModel.query,
                onSubmit: {}
            )
            .padding(.horizontal, AtlasMetrics.pageX)
            .padding(.bottom, 12)

            if viewModel.isLoading && viewModel.agents.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if let error = viewModel.errorMessage {
                AtlasDesignedEmptyStates.loadFailed(message: error) {
                    Task { await viewModel.load() }
                }
                .frame(maxHeight: .infinity)
            } else if viewModel.filteredAgents.isEmpty {
                AtlasDesignedEmptyStates.agentExploreEmpty()
                    .frame(maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(viewModel.filteredAgents) { agent in
                            Button {
                                onSelect(agent)
                                dismiss()
                            } label: {
                                CompactListCard(
                                    leading: {
                                        EntityAvatar.agent(id: agent.id, url: agent.avatarLink, name: agent.name, size: 44)
                                    },
                                    title: agent.name,
                                    subtitle: agent.description?.plainSummary ?? "点击进入对话",
                                    trailing: {
                                        DeimosIconView(icon: .chevronRight, size: 13, color: AtlasColors.inkFaint)
                                    }
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, AtlasMetrics.pageX)
                    .padding(.bottom, 24)
                }
            }
        }
        .background(AtlasColors.surface)
        .presentationDetents([.large])
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(AtlasMetrics.radiusSheet)
        .task { await viewModel.load() }
    }
}
