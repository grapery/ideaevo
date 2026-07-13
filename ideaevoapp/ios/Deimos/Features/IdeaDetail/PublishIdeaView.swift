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

/// S12 Create Idea (Ardot `179:209`) — 登记想法页.
///
/// Layout per design: toolbar (back + title) → Wanye Draft Assist card →
/// Title field card → Description field card → Meta chips row → Agent picker card → Publish button.
/// All field cards use `bg-card` (#F8FAFC) r20 + border, labels 12pt Medium, values 16/14pt.
struct PublishIdeaView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = PublishIdeaViewModel()
    @State private var publishedRoute: IdeaRoute?
    @State private var similarRoute: IdeaRoute?
    @State private var showCategoryPicker = false

    /// Card field background per S12 design: `#F8FAFC` light blue-grey.
    private let fieldCardBg = Color(hex: 0xF8FAFC)
    /// Label / tertiary text per S12 design: `#687083` cool grey.
    private let labelGrey = Color(hex: 0x687083)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Toolbar — back button + "登记想法" title
                toolbar

                // Wanye Draft Assist card
                draftAssistCard

                // Title field card
                cardField(label: "标题") {
                    AtlasTextField(
                        placeholder: "一句话标题",
                        text: $viewModel.title,
                        height: 24
                    )
                    .padding(.horizontal, 4)
                }

                // Description field card
                cardField(label: "描述") {
                    AtlasTextEditor(
                        text: $viewModel.descriptionText,
                        minHeight: 88,
                        fontSize: 14
                    )
                    .padding(.horizontal, 4)
                }

                // Meta chips — category + status
                metaChipsRow

                // Agent picker card
                agentPickerCard

                // Similar ideas (conditional)
                if !viewModel.similarIdeas.isEmpty {
                    similarIdeasSection
                }

                // Error message
                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(AtlasTypography.meta())
                        .foregroundStyle(AtlasColors.coral)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                // Publish button — lemon-strong r26, 52h
                publishButton
            }
            .padding(.horizontal, AtlasMetrics.detailX)
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
        .confirmationDialog("选择分类", isPresented: $showCategoryPicker, titleVisibility: .visible) {
            ForEach(viewModel.categories, id: \.id) { item in
                Button(item.label) { viewModel.category = item.id }
            }
        }
        .task {
            await viewModel.loadAgents()
        }
    }

    // MARK: - Toolbar (Ardot 179:213)

    private var toolbar: some View {
        HStack(spacing: 12) {
            AtlasNavBackButton(action: { dismiss() })
            Text("登记想法")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(AtlasColors.ink)
            Spacer()
        }
        .frame(height: 44)
    }

    // MARK: - Wanye Draft Assist card (Ardot 179:234)

    /// 350×96 r20, light blue bg `#EEF4FF` + border, title 15pt SemiBold + body 12pt Regular.
    private var draftAssistCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("让万叶帮你整理成可搜索的想法")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(AtlasColors.ink)
            Text("输入一句话，系统会生成标题、描述、分类、标签和初始版本。")
                .font(.system(size: 12))
                .foregroundStyle(Color(hex: 0x687083))
                .lineSpacing(4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color(hex: 0xEEF4FF))
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }

    // MARK: - Card field container (Ardot 179:237 / 179:240)

    /// Card-style field: bg #F8FAFC, r20, border, label 12pt Medium + content.
    @ViewBuilder
    private func cardField<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(labelGrey)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(fieldCardBg)
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }

    // MARK: - Meta chips row (Ardot 179:243)

    /// Category chip (gold) + status display. Tapping category opens picker.
    private var metaChipsRow: some View {
        HStack(spacing: 8) {
            // Category chip — gold bg #FFF6CB, brown text
            Button { showCategoryPicker = true } label: {
                HStack(spacing: 4) {
                    Text(currentCategoryLabel)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .medium))
                }
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color(hex: 0x6C5600))
                .padding(.horizontal, 16)
                .frame(height: 34)
                .background(Color(hex: 0xFFF6CB))
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)

            // Status chip — green bg, green text (default "新想法")
            Text("新想法")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color(hex: 0x247A45))
                .padding(.horizontal, 16)
                .frame(height: 34)
                .background(Color(hex: 0xEAF8D1))
                .clipShape(Capsule())

            Spacer()
        }
    }

    private var currentCategoryLabel: String {
        viewModel.categories.first { $0.id == viewModel.category }?.label ?? "其他"
    }

    // MARK: - Agent picker card (Ardot 179:250)

    /// 350×74 r20, bg-card + border, 44px lemon avatar + agent name 15pt SemiBold.
    private var agentPickerCard: some View {
        VStack(spacing: 0) {
            if viewModel.isLoadingAgents {
                HStack {
                    ProgressView()
                    Text("加载 Agent…")
                        .font(AtlasTypography.mobileSubheadline())
                        .foregroundStyle(AtlasColors.inkFaint)
                    Spacer()
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 20)
            } else if viewModel.agents.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("暂无 Agent")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AtlasColors.ink)
                    Text("请先在「我的 Agent」中创建。")
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.inkTertiary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14)
                .padding(.vertical, 20)
            } else {
                HStack(spacing: 12) {
                    if let agent = viewModel.selectedAgent {
                        EntityAvatar.agent(id: agent.id, url: agent.avatarLink, name: agent.name, size: 44)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("由 \(agent.name) 发布")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(AtlasColors.ink)
                                .lineLimit(1)
                            Text("点击切换发布 Agent")
                                .font(.system(size: 12))
                                .foregroundStyle(AtlasColors.inkTertiary)
                        }
                        Spacer()
                        Picker("Agent", selection: $viewModel.selectedAgentID) {
                            ForEach(viewModel.agents) { item in
                                Text(item.name).tag(item.id)
                            }
                        }
                        .labelsHidden()
                        .tint(AtlasColors.ink)
                        .frame(width: 40)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 15)
            }
        }
        .background(fieldCardBg)
        .overlay(
            RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
    }

    // MARK: - Similar ideas section

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

    // MARK: - Publish button (Ardot 179:253)

    /// 350×52 r26, lemon-strong bg, lemonInk text 14pt SemiBold.
    private var publishButton: some View {
        Button {
            Task { await publish() }
        } label: {
            HStack(spacing: 8) {
                if viewModel.isSubmitting {
                    ProgressView().tint(AtlasColors.lemonInk)
                }
                Text("发布想法")
                    .font(.system(size: 14, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .foregroundStyle(AtlasColors.lemonInk)
            .background(AtlasColors.lemonStrong)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(viewModel.agents.isEmpty || viewModel.isSubmitting)
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
