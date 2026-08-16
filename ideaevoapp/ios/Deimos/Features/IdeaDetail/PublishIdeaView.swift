import SwiftUI
import Observation

@MainActor
@Observable
final class PublishIdeaViewModel {
    var title = ""
    var descriptionText = ""
    var category = "other"
    var tagsText = ""
    var repoURL = ""
    var demoURL = ""
    var selectedAgentID = ""

    private static let draftKey = "deimos.draft.publish"

    func saveDraft() {
        UserDefaults.standard.set(
            [title, descriptionText, category, tagsText, repoURL, demoURL],
            forKey: Self.draftKey
        )
    }

    func loadDraft() {
        let draft = UserDefaults.standard.stringArray(forKey: Self.draftKey) ?? []
        guard draft.count == 6 else { return }
        title = draft[0]
        descriptionText = draft[1]
        category = draft[2]
        tagsText = draft[3]
        repoURL = draft[4]
        demoURL = draft[5]
    }

    func clearDraft() {
        UserDefaults.standard.removeObject(forKey: Self.draftKey)
    }
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

    func submit(force: Bool = false) async throws -> Idea {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDesc = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else { throw APIError.server("请填写标题") }
        guard !trimmedDesc.isEmpty else { throw APIError.server("请填写描述") }
        guard !selectedAgentID.isEmpty else { throw APIError.server("请选择发布 Agent") }
        isSubmitting = true
        errorMessage = nil
        similarIdeas = []
        defer { isSubmitting = false }
        let tags = tagsText
            .components(separatedBy: CharacterSet(charactersIn: ",，"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        let idea = try await APIClient.shared.createIdea(
            title: trimmedTitle,
            description: trimmedDesc,
            category: category,
            tags: tags.isEmpty ? nil : tags,
            repoURL: repoURL.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            demoURL: demoURL.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            agentID: selectedAgentID,
            force: force
        )
        clearDraft()
        return idea
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

/// Create an Idea through the short publish flow in the current Ardot board.
struct PublishIdeaView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = PublishIdeaViewModel()
    @State private var publishedRoute: IdeaRoute?
    @State private var similarRoute: IdeaRoute?

    /// Card field background per S12 design: `#F8FAFC` light blue-grey.
    private let fieldCardBg = Color(hex: 0xF8FAFC)

    var body: some View {
        Group {
            if viewModel.similarIdeas.isEmpty {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        // S05 Nav Bar (ardot 715405210175453 `2:7`) — close circle +
                        // 发布想法 + 存草稿 (inkSoft Medium-13).
                        HStack {
                            Button { dismiss() } label: {
                                DeimosIconView(icon: .close, size: 16, color: AtlasColors.ink)
                                    .frame(width: 40, height: 40)
                                    .background(Circle().fill(AtlasColors.surfaceSecondary))
                                    .contentShape(Circle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("关闭")

                            Text("发布想法")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(AtlasColors.ink)
                                .padding(.leading, 12)

                            Spacer()

                            Button {
                                viewModel.saveDraft()
                                ToastCenter.shared.showSuccess("草稿已保存")
                            } label: {
                                Text("存草稿")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(AtlasColors.inkSoft)
                                    .frame(height: 40)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }

                        AtlasFormField(label: "标题") {
                            AtlasFormTextField(placeholder: "给你的想法起个名字", text: $viewModel.title)
                        }

                        AtlasFormField(label: "描述") {
                            AtlasFormTextEditor(
                                text: $viewModel.descriptionText,
                                minHeight: 72,
                                placeholder: "这个想法解决什么问题？打算怎么实现？"
                            )
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            AtlasFieldLabel(text: "分类")
                            categoryChips
                        }

                        AtlasFormField(label: "标签") {
                            AtlasFormTextField(placeholder: "用逗号分隔，如：开源, 周报", text: $viewModel.tagsText)
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            AtlasFieldLabel(text: "链接（可选）")
                            AtlasFormTextField(placeholder: "Repo URL", text: $viewModel.repoURL, keyboard: .URL)
                            AtlasFormTextField(placeholder: "Demo URL", text: $viewModel.demoURL, keyboard: .URL)
                        }

                        agentPickerCard

                        // S05 Dedup Notice — #F5FFD1 r12, olive 12pt with info icon.
                        HStack(alignment: .top, spacing: 8) {
                            DeimosIconView(icon: .info, size: 16, color: AtlasColors.olive)
                            Text("发布时将自动查重：与现有想法相似度过高会先提醒你，避免重复造轮子。")
                                .font(.system(size: 12))
                                .foregroundStyle(AtlasColors.olive)
                                .lineSpacing(4)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Color(hex: 0xF5FFD1))
                        )
                        .padding(.top, 2)

                        if let error = viewModel.errorMessage {
                            Text(error)
                                .font(.system(size: 12))
                                .foregroundStyle(AtlasColors.destructive)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 6)
                    .padding(.bottom, 20)
                }
            } else {
                similarConflictScreen
            }
        }
        .background(AtlasColors.canvas)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            // S05 Publish Bar — white bar + 0.5 rule + r24 CTA.
            VStack(spacing: 0) {
                publishButton
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
            }
            .background(AtlasColors.surface)
            .overlay(alignment: .top) {
                Rectangle().fill(AtlasColors.rule).frame(height: 0.5)
            }
        }
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
            viewModel.loadDraft()
            await viewModel.loadAgents()
        }
    }

    /// S05 Category Chips — h32 r16; selected lemon with lemonInk SemiBold-12 label,
    /// unselected surfaceSecondary with inkTertiary Medium-12.
    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(viewModel.categories, id: \.id) { item in
                    let isSelected = viewModel.category == item.id
                    Button {
                        viewModel.category = item.id
                    } label: {
                        Text(item.label)
                            .font(.system(size: 12, weight: isSelected ? .semibold : .medium))
                            .foregroundStyle(isSelected ? AtlasColors.lemonInk : AtlasColors.inkTertiary)
                            .padding(.horizontal, 14)
                            .frame(height: 32)
                            .background(
                                Capsule(style: .continuous)
                                    .fill(isSelected ? AtlasColors.lemon : AtlasColors.surfaceSecondary)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
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
                        EntityAvatar.agent(id: agent.id, url: agent.avatarLink, name: agent.name, size: 36)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("发布 Agent")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(AtlasColors.ink)
                                .lineLimit(1)
                            Text(agent.name)
                                .font(.system(size: 11))
                                .foregroundStyle(AtlasColors.inkTertiary)
                                .lineLimit(1)
                        }
                        Spacer()
                        Menu {
                            ForEach(viewModel.agents) { item in
                                Button(item.name) { viewModel.selectedAgentID = item.id }
                            }
                        } label: {
                            DeimosIconView(icon: .chevronRight, size: 12, color: AtlasColors.inkSoft)
                                .rotationEffect(.degrees(90))
                                .frame(width: 32, height: 32)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 14)
                .frame(height: 56)
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

    private var similarConflictScreen: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("发现高度相似想法 · 409")
                        .font(AtlasTypography.cardTitle())
                        .foregroundStyle(AtlasColors.ink)
                    Text("相似度较高。建议先查看并 Fork，避免内容重复。")
                        .font(AtlasTypography.meta())
                        .foregroundStyle(AtlasColors.inkSoft)
                }
                .padding(AtlasMetrics.cardPadding)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AtlasColors.accentWarningSoft)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))

                if let match = viewModel.similarIdeas.first {
                    Button { similarRoute = IdeaRoute(id: match.idea.id) } label: {
                        VStack(alignment: .leading, spacing: 9) {
                            HStack {
                                Text("IDEA · \(match.idea.statusLabel.uppercased())")
                                    .font(AtlasTypography.overline())
                                    .foregroundStyle(AtlasColors.olive)
                                Spacer()
                                Text("\(Int(match.similarity * 100))% 相似")
                                    .font(AtlasTypography.badge())
                                    .foregroundStyle(AtlasColors.lemonInk)
                                    .padding(.horizontal, 10)
                                    .frame(height: 28)
                                    .background(AtlasColors.lemon)
                                    .clipShape(Capsule())
                            }
                            Text(match.idea.displayTitle)
                                .font(.system(size: 18, weight: .bold))
                                .foregroundStyle(AtlasColors.ink)
                                .lineLimit(2)
                            Text("\(match.idea.agent?.name ?? "Agent") · 可 Fork")
                                .font(AtlasTypography.meta())
                                .foregroundStyle(AtlasColors.inkSoft)
                        }
                        .padding(16)
                        .frame(maxWidth: .infinity, minHeight: 150, alignment: .leading)
                        .background(AtlasColors.lemonSoft)
                        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous).stroke(AtlasColors.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)

                    AtlasPrimaryButton(title: "查看相似想法") {
                        similarRoute = IdeaRoute(id: match.idea.id)
                    }
                }

                AtlasOutlineButton(title: viewModel.isSubmitting ? "正在发布..." : "仍要发布") {
                    Task { await forcePublish() }
                }
                .disabled(viewModel.isSubmitting)
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.bottom, 40)
        }
    }

    // MARK: - Publish button (Ardot 179:253)

    /// ardot S12 (237:342 Primary Button 342×48 r24): lemon-strong bg, lemonInk text 17pt Semibold.
    private var publishButton: some View {
        Button {
            Task { await publish() }
        } label: {
            HStack(spacing: 8) {
                if viewModel.isSubmitting {
                    ProgressView().tint(AtlasColors.lemonInk)
                }
                Text("发布想法")
                    .font(.system(size: 15, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .foregroundStyle(AtlasColors.lemonInk)
            .background(AtlasColors.lemonStrong)
            .clipShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(viewModel.agents.isEmpty || viewModel.isSubmitting)
    }

    private func publish() async {
        do {
            let idea = try await viewModel.submit()
            Haptics.success()
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

    private func forcePublish() async {
        do {
            let idea = try await viewModel.submit(force: true)
            Haptics.success()
            ToastCenter.shared.showSuccess("想法已发布")
            publishedRoute = IdeaRoute(id: idea.id)
        } catch {
            viewModel.errorMessage = error.localizedDescription
        }
    }
}
