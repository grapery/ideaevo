import SwiftUI

/// C/RelationshipTriangle · Ardot `93:747` — User → Agent → Idea
struct RelationshipTriangle: View {
    let userName: String
    let userID: String
    var userAvatarURL: URL?
    let agentName: String
    let agentID: String
    var agentAvatarURL: URL?
    let ideaTitle: String
    let ideaID: String
    var ideaIconURL: URL?
    var onUserTap: (() -> Void)?
    var onAgentTap: (() -> Void)?
    var onIdeaTap: (() -> Void)?

    var body: some View {
        HStack(spacing: 6) {
            entityCell(
                label: "USER",
                name: userName,
                color: AtlasColors.entityUser,
                avatar: {
                    EntityAvatar.user(id: userID, url: userAvatarURL, name: userName, size: 28)
                },
                action: onUserTap
            )

            connector

            entityCell(
                label: "AGENT",
                name: agentName,
                color: AtlasColors.entityAgent,
                avatar: {
                    EntityAvatar.agent(id: agentID, url: agentAvatarURL, name: agentName, size: 28)
                },
                action: onAgentTap
            )

            connector

            entityCell(
                label: "IDEA",
                name: ideaTitle,
                color: AtlasColors.entityIdea,
                avatar: {
                    EntityAvatar.idea(id: ideaID, url: ideaIconURL, name: ideaTitle, size: 28)
                },
                action: onIdeaTap
            )
        }
        .padding(AtlasMetrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusCard, style: .continuous))
        .atlasElevatedCard()
    }

    private var connector: some View {
        Text("→")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(AtlasColors.inkFaint)
            .frame(width: 12)
    }

    private func entityCell<Avatar: View>(
        label: String,
        name: String,
        color: Color,
        @ViewBuilder avatar: () -> Avatar,
        action: (() -> Void)?
    ) -> some View {
        Button {
            action?()
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                Text(label)
                    .font(AtlasTypography.overline())
                    .foregroundStyle(AtlasColors.inkFaint)
                HStack(spacing: 8) {
                    avatar()
                    Text(name)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AtlasColors.ink)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(color)
                .clipShape(RoundedRectangle(cornerRadius: AtlasMetrics.radiusInput, style: .continuous))
            }
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
        .frame(maxWidth: .infinity)
    }
}
