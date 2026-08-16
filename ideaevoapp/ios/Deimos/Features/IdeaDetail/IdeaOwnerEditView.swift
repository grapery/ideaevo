import SwiftUI
import PhotosUI
import Observation

@MainActor
@Observable
final class IdeaOwnerEditViewModel {
    var idea: Idea?
    var titleText = ""
    var descriptionText = ""
    var categoryText = ""
    var tagsText = ""
    var changelog = ""
    var implStatus = "concept"
    var repoURL = ""
    var demoURL = ""
    var versions: [IdeaVersionSummary] = []
    var isLoading = true
    var isSaving = false
    var uploadProgress: Double?
    var uploadError: String?
    var message: String?

    let implStatuses = [
        ("concept", "概念"),
        ("in_progress", "进行中"),
        ("implemented", "已实现"),
        ("paused", "暂停"),
    ]

    func load(id: String) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let loaded = try await APIClient.shared.getIdea(id: id)
            idea = loaded
            titleText = loaded.title
            descriptionText = loaded.description
            categoryText = loaded.category
            tagsText = loaded.tags.joined(separator: "，")
            implStatus = loaded.implStatus ?? "concept"
            repoURL = loaded.repoURL ?? ""
            demoURL = loaded.demoURL ?? ""
            versions = try await APIClient.shared.getIdeaVersions(ideaID: id)
        } catch {
            message = error.localizedDescription
        }
    }

    func saveDescription(ideaID: String) async throws {
        let trimmed = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw APIError.server("描述不能为空") }
        let change = changelog.trimmingCharacters(in: .whitespacesAndNewlines)
        idea = try await APIClient.shared.updateIdeaDescription(
            ideaID: ideaID,
            description: trimmed,
            changelog: change.isEmpty ? nil : change
        )
        descriptionText = idea?.description ?? trimmed
        changelog = ""
        versions = try await APIClient.shared.getIdeaVersions(ideaID: ideaID)
    }

    func saveMeta(ideaID: String) async throws {
        let body = UpdateIdeaMetaBody(
            implStatus: implStatus,
            repoURL: repoURL.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            demoURL: demoURL.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            iconURL: nil
        )
        idea = try await APIClient.shared.updateIdeaMeta(ideaID: ideaID, body: body)
    }

    func publishVersion(ideaID: String) async throws {
        let title = titleText.trimmingCharacters(in: .whitespacesAndNewlines)
        let description = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
        let category = categoryText.trimmingCharacters(in: .whitespacesAndNewlines)
        let change = changelog.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { throw APIError.server("标题不能为空") }
        guard !description.isEmpty else { throw APIError.server("描述不能为空") }
        guard !category.isEmpty else { throw APIError.server("分类不能为空") }
        guard !change.isEmpty else { throw APIError.server("请说明这一版本改变了什么") }

        let tags = tagsText
            .components(separatedBy: CharacterSet(charactersIn: ",，"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        let body = PublishIdeaVersionBody(
            title: title,
            description: description,
            category: category,
            tags: tags,
            implStatus: implStatus,
            repoURL: repoURL.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            demoURL: demoURL.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            changelog: change
        )
        idea = try await APIClient.shared.publishIdeaVersion(ideaID: ideaID, body: body)
        changelog = ""
        versions = try await APIClient.shared.getIdeaVersions(ideaID: ideaID)
    }

    func uploadIcon(ideaID: String, data: Data) async throws {
        uploadProgress = 0.2
        uploadError = nil
        defer { uploadProgress = nil }
        uploadProgress = 0.55
        let url = try await APIClient.shared.uploadIdeaImage(ideaID: ideaID, kind: "icon", data: data)
        idea = try await APIClient.shared.updateIdeaMeta(
            ideaID: ideaID,
            body: UpdateIdeaMetaBody(implStatus: nil, repoURL: nil, demoURL: nil, iconURL: url)
        )
        uploadProgress = 1
    }

    func resetIcon(ideaID: String) async throws {
        idea = try await APIClient.shared.resetIdeaIcon(ideaID: ideaID)
    }

    func uploadContentImage(ideaID: String, data: Data) async throws -> String {
        uploadProgress = 0.2
        uploadError = nil
        defer { uploadProgress = nil }
        uploadProgress = 0.55
        let url = try await APIClient.shared.uploadIdeaImage(ideaID: ideaID, kind: "content", data: data)
        uploadProgress = 1
        return url
    }

    func bury(ideaID: String, reason: String) async throws {
        idea = try await APIClient.shared.buryIdea(id: ideaID, reason: reason)
    }

    func reactivate(ideaID: String) async throws {
        idea = try await APIClient.shared.reactivateIdea(id: ideaID)
    }

    func archive(ideaID: String) async throws {
        idea = try await APIClient.shared.archiveIdea(id: ideaID, reason: nil)
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}

/// S16 管理想法 (ardot board 715405210175453, node `2:773`).
///
/// Board structure: inline nav → 实现进度 segmented (r14 container, lemon selected)
/// → 想法状态 three state pills → 标题/描述/更新说明 fields (bgInput r12) →
/// 保存并发布新版本 CTA (r24 lemonStrong) → 版本历史 row. Extra publish metadata
/// (分类/标签/链接/插图/图标) keeps the same field paradigm below the board fields.
struct IdeaOwnerEditView: View {
    let ideaID: String

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = IdeaOwnerEditViewModel()
    @State private var imageItem: PhotosPickerItem?
    @State private var iconItem: PhotosPickerItem?
    @State private var versionRoute: VersionCompareRoute?
    @State private var buryReason = ""
    @State private var showBuryConfirm = false
    @State private var isBurying = false
    @State private var isSwitchingStatus = false

    var body: some View {
        Group {
            if viewModel.isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                editorContent
            }
        }
        .background(AtlasColors.canvas)
        .atlasSheetZoomBackground(isPresented: showBuryConfirm)
        .navigationBarHidden(true)
        .suppressTabBar()
        .navigationDestination(item: $versionRoute) { route in
            VersionCompareView(ideaID: route.ideaID, versionID: route.versionID, compareVersionID: route.compareVersionID)
        }
        .sheet(isPresented: $showBuryConfirm) {
            buryReasonSheet
        }
        .task { await viewModel.load(id: ideaID) }
        .atlasScrollDismissesKeyboard()
    }

    private var editorContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                AtlasSubPageNavBar(title: "管理想法", onBack: { dismiss() })

                AtlasFieldLabel(text: "实现进度（impl_status）")
                AtlasFormSegmentPicker(
                    options: viewModel.implStatuses.map { ($0.0, $0.1) },
                    selection: $viewModel.implStatus
                )

                AtlasFieldLabel(text: "想法状态（status）")
                statusPills

                AtlasFormField(label: "标题") {
                    AtlasFormTextField(placeholder: "标题", text: $viewModel.titleText)
                }

                AtlasFormField(label: "描述") {
                    AtlasFormTextEditor(text: $viewModel.descriptionText, minHeight: 72, placeholder: "描述")
                }

                AtlasFormField(label: "更新说明（这一版改变了什么）") {
                    AtlasFormTextField(placeholder: "例如：新增归档导出为 Markdown", text: $viewModel.changelog)
                }

                // Publish metadata — same field paradigm, required by the publish API.
                HStack(spacing: 12) {
                    AtlasFormField(label: "分类") {
                        AtlasFormTextField(placeholder: "分类", text: $viewModel.categoryText)
                    }
                    AtlasFormField(label: "标签") {
                        AtlasFormTextField(placeholder: "标签，逗号分隔", text: $viewModel.tagsText)
                    }
                }

                HStack(spacing: 12) {
                    AtlasFormField(label: "GitHub 仓库") {
                        AtlasFormTextField(placeholder: "GitHub 仓库", text: $viewModel.repoURL, keyboard: .URL)
                    }
                    AtlasFormField(label: "体验 Demo") {
                        AtlasFormTextField(placeholder: "体验 Demo", text: $viewModel.demoURL, keyboard: .URL)
                    }
                }

                uploadSection
                iconSection

                if let message = viewModel.message {
                    Text(message)
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.destructive)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                AtlasFormCTA(title: "保存并发布新版本", isLoading: viewModel.isSaving) {
                    Task { await saveAll() }
                }

                if !viewModel.versions.isEmpty {
                    Button { openVersionHistory() } label: {
                        HStack(spacing: 8) {
                            DeimosIconView(icon: .clock, size: 16, color: AtlasColors.inkTertiary)
                            Text("版本历史 · 共 \(viewModel.versions.count) 个版本")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(AtlasColors.ink)
                            Spacer(minLength: 0)
                            DeimosIconView(icon: .chevronRight, size: 14, color: AtlasColors.inkFaint)
                        }
                        .padding(.horizontal, 12)
                        .frame(height: 43)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(AtlasColors.settingsGroupFill)
                        )
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 6)
            .padding(.bottom, 32)
        }
    }

    // MARK: - 想法状态 pills (S16 Lifecycle Row)

    /// 保持活跃 (green outline when selected) · 归档 · 埋没（已证伪）— r12 38pt pills.
    private var statusPills: some View {
        let status = viewModel.idea?.status ?? "active"
        return HStack(spacing: 8) {
            statusPill(
                title: "保持活跃",
                matches: status == "active" || status == "implemented",
                text: AtlasColors.success
            ) {
                guard status != "active", status != "implemented" else { return }
                await switchStatus { try await viewModel.reactivate(ideaID: ideaID) }
            }
            statusPill(
                title: "归档",
                matches: status == "archived",
                text: AtlasColors.inkTertiary
            ) {
                guard status != "archived" else { return }
                await switchStatus { try await viewModel.archive(ideaID: ideaID) }
            }
            statusPill(
                title: "埋没（已证伪）",
                matches: status == "buried",
                text: AtlasColors.destructive,
                fill: AtlasColors.dangerSoft
            ) {
                guard status != "buried" else { return }
                showBuryConfirm = true
            }
        }
    }

    private func statusPill(
        title: String,
        matches: Bool,
        text: Color,
        fill: Color = AtlasColors.settingsGroupFill,
        action: @escaping () async -> Void
    ) -> some View {
        Button {
            Task { await action() }
        } label: {
            Text(title)
                .font(.system(size: 12, weight: matches ? .semibold : .medium))
                .foregroundStyle(text)
                .frame(maxWidth: .infinity)
                .frame(height: 38)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(matches ? .clear : fill)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(text, lineWidth: matches ? 1.5 : 0)
                )
        }
        .buttonStyle(.plain)
        .disabled(isSwitchingStatus)
    }

    private func switchStatus(_ work: @escaping () async throws -> Void) async {
        isSwitchingStatus = true
        defer { isSwitchingStatus = false }
        do {
            try await work()
            ToastCenter.shared.showSuccess("想法状态已更新")
        } catch {
            viewModel.message = error.localizedDescription
        }
    }

    // MARK: - Uploads (restyled to the board field paradigm)

    private var uploadSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            AtlasFieldLabel(text: "描述插图")
            PhotosPicker(selection: $imageItem, matching: .images) {
                HStack(spacing: 6) {
                    DeimosIconView(icon: .plus, size: 12, color: AtlasColors.olive)
                    Text("选择图片并插入 Markdown")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(AtlasColors.olive)
                }
                .frame(height: 40)
                .padding(.horizontal, 12)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(AtlasColors.lemonSoft)
                )
            }
            .buttonStyle(.plain)
            if let progress = viewModel.uploadProgress {
                ProgressView(value: progress)
                Text(progress >= 1 ? "上传完成，已插入描述" : "上传中…")
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkFaint)
            }
            if let uploadError = viewModel.uploadError {
                Text(uploadError)
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.destructive)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .onChange(of: imageItem) { _, item in
            guard let item else { return }
            Task { await insertImage(item) }
        }
    }

    private var iconSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            AtlasFieldLabel(text: "想法图标")
            HStack(spacing: 12) {
                if let idea = viewModel.idea {
                    EntityAvatar.idea(id: idea.id, url: idea.iconLink, name: idea.title, size: 44)
                }
                PhotosPicker(selection: $iconItem, matching: .images) {
                    Text("上传图标")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(AtlasColors.olive)
                        .frame(height: 36)
                        .padding(.horizontal, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(AtlasColors.lemonSoft)
                        )
                }
                .buttonStyle(.plain)
                Button("恢复默认") {
                    Task { await resetIcon() }
                }
                .font(.system(size: 13))
                .foregroundStyle(AtlasColors.inkFaint)
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .onChange(of: iconItem) { _, item in
            guard let item else { return }
            Task { await uploadIcon(item) }
        }
    }

    // MARK: - Actions

    private func openVersionHistory() {
        guard let current = viewModel.versions.first(where: \.isCurrent) ?? viewModel.versions.first else { return }
        versionRoute = VersionCompareRoute(ideaID: ideaID, versionID: current.id, compareVersionID: nil)
    }

    private func saveAll() async {
        viewModel.isSaving = true
        viewModel.message = nil
        defer { viewModel.isSaving = false }
        do {
            try await viewModel.publishVersion(ideaID: ideaID)
            ToastCenter.shared.showSuccess("新版本已发布")
            dismiss()
        } catch {
            viewModel.message = error.localizedDescription
        }
    }

    private func insertImage(_ item: PhotosPickerItem) async {
        viewModel.uploadError = nil
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw APIError.server("无法读取图片")
            }
            let url = try await viewModel.uploadContentImage(ideaID: ideaID, data: data)
            viewModel.descriptionText += "\n\n![image](\(url))\n"
            imageItem = nil
        } catch {
            viewModel.uploadError = error.localizedDescription
        }
    }

    private func uploadIcon(_ item: PhotosPickerItem) async {
        viewModel.uploadError = nil
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw APIError.server("无法读取图片")
            }
            try await viewModel.uploadIcon(ideaID: ideaID, data: data)
            iconItem = nil
            ToastCenter.shared.showSuccess("图标已更新")
        } catch {
            viewModel.uploadError = error.localizedDescription
        }
    }

    private func resetIcon() async {
        do {
            try await viewModel.resetIcon(ideaID: ideaID)
            ToastCenter.shared.showSuccess("已恢复默认图标")
        } catch {
            viewModel.message = error.localizedDescription
        }
    }

    private func buryIdea() async {
        let reason = buryReason.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !reason.isEmpty else {
            viewModel.message = "请填写埋葬原因"
            return
        }
        isBurying = true
        defer { isBurying = false }
        do {
            try await viewModel.bury(ideaID: ideaID, reason: reason)
            ToastCenter.shared.showSuccess("想法已埋没")
            showBuryConfirm = false
        } catch {
            viewModel.message = error.localizedDescription
        }
    }

    private var buryReasonSheet: some View {
        VStack(spacing: 16) {
            AtlasSheetGrabber()
                .padding(.top, 8)

            AtlasSheetTitleRow(title: "埋葬想法", onClose: { showBuryConfirm = false })

            Text("埋葬后该想法将从搜索与推荐中移除。")
                .font(AtlasTypography.mobileBody())
                .foregroundStyle(AtlasColors.inkSoft)
                .frame(maxWidth: .infinity, alignment: .leading)

            AtlasFormTextField(placeholder: "原因", text: $buryReason)

            AtlasPrimaryButton(title: "确认埋葬", isLoading: isBurying) {
                Task { await buryIdea() }
            }
            .disabled(buryReason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
        .background(AtlasColors.surface)
        .presentationDetents([.height(300)])
        .presentationDragIndicator(.hidden)
        .presentationCornerRadius(AtlasMetrics.radiusSheet)
    }
}

struct VersionCompareRoute: Identifiable, Hashable {
    let ideaID: String
    let versionID: String
    let compareVersionID: String?

    var id: String { "\(ideaID)-\(versionID)-\(compareVersionID ?? "")" }
}
