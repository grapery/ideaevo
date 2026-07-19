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
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}

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

    var body: some View {
        Group {
            if viewModel.isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                editorContent
            }
        }
        .background(AtlasColors.canvas)
        .safeAreaInset(edge: .top, spacing: 0) {
            settingsBackHeader(title: "编辑 Idea", dismiss: dismiss)
        }
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
            VStack(alignment: .leading, spacing: 14) {
                if let idea = viewModel.idea {
                    // S27 Idea core identity — #F8FAFC card r16 (Ardot 189:70)
                    HStack(spacing: 12) {
                        EntityAvatar.idea(id: idea.id, url: idea.iconLink, name: idea.title, size: 44)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("OWNER EDIT")
                                .font(AtlasTypography.overline())
                                .foregroundStyle(AtlasColors.inkFaint)
                            Text(idea.title)
                                .font(.system(size: 20, weight: .bold))
                                .foregroundStyle(AtlasColors.ink)
                                .lineLimit(2)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .background(Color(hex: 0xF8FAFC))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }

                settingsGroupedCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("版本身份")
                            .font(AtlasTypography.cardTitle())
                            .foregroundStyle(AtlasColors.ink)
                        metaField("标题", text: $viewModel.titleText)
                        HStack(alignment: .top, spacing: 10) {
                            metaField("分类", text: $viewModel.categoryText)
                            metaField("标签（逗号分隔）", text: $viewModel.tagsText)
                        }
                    }
                    .padding(AtlasMetrics.cardPadding)
                }

                settingsGroupedCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("描述")
                            .font(AtlasTypography.cardTitle())
                            .foregroundStyle(AtlasColors.ink)
                            .padding(.horizontal, AtlasMetrics.cardPadding)
                            .padding(.top, AtlasMetrics.cardPadding)
                        AtlasTextEditor(text: $viewModel.descriptionText, minHeight: 120, fontSize: 17)
                            .padding(8)
                            .background(AtlasColors.fill)
                            .padding(.horizontal, AtlasMetrics.cardPadding)
                        AtlasTextField(placeholder: "这一版本改变了什么（必填）", text: $viewModel.changelog, height: AtlasMetrics.inputHeight)
                            .padding(.horizontal, 4)
                            .background(AtlasColors.fill)
                            .padding(.horizontal, AtlasMetrics.cardPadding)
                            .padding(.bottom, AtlasMetrics.cardPadding)
                    }
                }

                uploadSection
                iconSection

                settingsGroupedCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("实现信息")
                            .font(AtlasTypography.cardTitle())
                            .foregroundStyle(AtlasColors.ink)
                            .padding(.horizontal, AtlasMetrics.cardPadding)
                            .padding(.top, AtlasMetrics.cardPadding)
                        Picker("实现状态", selection: $viewModel.implStatus) {
                            ForEach(viewModel.implStatuses, id: \.0) { value, label in
                                Text(label).tag(value)
                            }
                        }
                        .pickerStyle(.menu)
                        .padding(.horizontal, AtlasMetrics.cardPadding)
                        VStack(spacing: 8) {
                            metaField("仓库 URL", text: $viewModel.repoURL)
                            metaField("演示 URL", text: $viewModel.demoURL)
                        }
                        .padding(.horizontal, AtlasMetrics.cardPadding)
                        .padding(.bottom, AtlasMetrics.cardPadding)
                    }
                }

                if !viewModel.versions.isEmpty {
                    settingsGroupedCard {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("版本预览")
                                .font(AtlasTypography.cardTitle())
                                .foregroundStyle(AtlasColors.ink)
                                .padding(.horizontal, AtlasMetrics.cardPadding)
                                .padding(.top, AtlasMetrics.cardPadding)
                            ForEach(viewModel.versions.prefix(3)) { version in
                                Button {
                                    if let current = viewModel.versions.first(where: \.isCurrent), current.id != version.id {
                                        versionRoute = VersionCompareRoute(ideaID: ideaID, versionID: version.id, compareVersionID: current.id)
                                    } else {
                                        versionRoute = VersionCompareRoute(ideaID: ideaID, versionID: version.id, compareVersionID: nil)
                                    }
                                } label: {
                                    HStack {
                                        Text("v\(version.version)")
                                            .font(AtlasTypography.badge())
                                            .foregroundStyle(version.isCurrent ? AtlasColors.olive : AtlasColors.ink)
                                        Text(version.changelog)
                                            .font(.system(size: 12))
                                            .foregroundStyle(AtlasColors.inkSoft)
                                            .lineLimit(1)
                                        Spacer()
                                        Text("对比 ›")
                                            .font(.system(size: 11))
                                            .foregroundStyle(AtlasColors.olive)
                                    }
                                    .padding(.horizontal, AtlasMetrics.cardPadding)
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.bottom, AtlasMetrics.cardPadding)
                        }
                    }
                }

                if let message = viewModel.message {
                    Text(message)
                        .font(.system(size: 12))
                        .foregroundStyle(AtlasColors.coral)
                }

                // S27 Save button — lemonInk bg, white text, 48h, r12 (Ardot 189:72)
                Button {
                    Task { await saveAll() }
                } label: {
                    HStack(spacing: 8) {
                        if viewModel.isSaving {
                            ProgressView().tint(.white)
                        }
                        Text("保存并写入新版本")
                            .font(.system(size: 15, weight: .bold))
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .foregroundStyle(.white)
                    .background(AtlasColors.lemonInk)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(viewModel.isSaving)

                if viewModel.idea?.status == "active" {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("危险操作")
                            .font(AtlasTypography.cardTitle())
                            .foregroundStyle(AtlasColors.coral)
                        Text("埋葬后想法将从搜索与推荐中移除。")
                            .font(.system(size: 12))
                            .foregroundStyle(AtlasColors.inkFaint)
                        Button("埋葬此想法") {
                            buryReason = ""
                            showBuryConfirm = true
                        }
                        .font(AtlasTypography.caption())
                        .foregroundStyle(AtlasColors.coral)
                    }
                    .padding(AtlasMetrics.cardPadding)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AtlasColors.surface)
                    .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous)
                            .stroke(AtlasColors.coral.opacity(0.35), lineWidth: 1)
                    )
                }
            }
            .padding(.horizontal, AtlasMetrics.detailX)
            .padding(.bottom, 40)
        }
    }

    private var uploadSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("描述插图")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AtlasColors.inkSoft)
            PhotosPicker(selection: $imageItem, matching: .images) {
                Text("选择图片并插入 Markdown")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(AtlasColors.olive)
            }
            if let progress = viewModel.uploadProgress {
                ProgressView(value: progress)
                Text(progress >= 1 ? "上传完成，已插入描述" : "上传中…")
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.inkFaint)
            }
            if let uploadError = viewModel.uploadError {
                Text(uploadError)
                    .font(.system(size: 11))
                    .foregroundStyle(AtlasColors.coral)
            }
        }
        .padding(AtlasMetrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .onChange(of: imageItem) { _, item in
            guard let item else { return }
            Task { await insertImage(item) }
        }
    }

    private var iconSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("想法图标")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AtlasColors.inkSoft)
            HStack(spacing: 12) {
                if let idea = viewModel.idea {
                    EntityAvatar.idea(id: idea.id, url: idea.iconLink, name: idea.title, size: 48)
                }
                PhotosPicker(selection: $iconItem, matching: .images) {
                    Text("上传图标")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(AtlasColors.olive)
                }
                Button("恢复默认") {
                    Task { await resetIcon() }
                }
                .font(.system(size: 13))
                .foregroundStyle(AtlasColors.inkFaint)
            }
        }
        .padding(AtlasMetrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(AtlasColors.border, lineWidth: 1)
        )
        .onChange(of: iconItem) { _, item in
            guard let item else { return }
            Task { await uploadIcon(item) }
        }
    }

    private func metaField(_ title: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AtlasColors.inkSoft)
            AtlasTextField(
                placeholder: title,
                text: text,
                keyboardType: title.contains("URL") ? .URL : .default,
                height: 44
            )
            .padding(.horizontal, 4)
            .background(AtlasColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous)
                    .stroke(AtlasColors.border, lineWidth: 1)
            )
        }
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
            ToastCenter.shared.showSuccess("想法已埋葬")
            showBuryConfirm = false
            dismiss()
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

            AtlasTextField(placeholder: "原因", text: $buryReason, height: AtlasMetrics.inputHeight)
                .padding(.horizontal, 4)
                .background(AtlasColors.fill)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))

            AtlasPrimaryButton(title: "确认埋葬", isLoading: isBurying) {
                Task { await buryIdea() }
            }
            .disabled(buryReason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, AtlasMetrics.pageX)
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
