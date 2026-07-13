import SwiftUI

/// User/agent circle avatars; idea icons use rounded rect per Ardot v5 entity colors.
struct EntityAvatar: View {
    enum Kind {
        case user
        case agent
        case idea
    }

    enum ShapeStyle {
        case circle
        case roundedRect
    }

    var size: CGFloat = 36
    var imageURL: URL?
    var name: String = ""
    var kind: Kind = .user
    var shape: ShapeStyle = .circle

    private var cornerRadius: CGFloat {
        shape == .roundedRect ? max(8, size * 0.25) : size / 2
    }

    var body: some View {
        Group {
            if let imageURL {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }

    private var placeholder: some View {
        ZStack {
            if kind == .agent {
                // v7: AI agents use lemon gradient with lemonInk sparkles
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(AtlasColors.aiGradient)
                DeimosIconView(icon: .sparkles, size: size * 0.5, color: AtlasColors.lemonInk)
            } else {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(entityColor)
                Text(String(name.prefix(1)).uppercased())
                    .font(.system(size: size * 0.4, weight: .semibold))
                    .foregroundStyle(.white)
            }
        }
    }

    private var entityColor: Color {
        switch kind {
        case .user: return AtlasColors.profileAvatarBg
        case .agent: return AtlasColors.aiStart
        case .idea: return AtlasColors.lemonSoft
        }
    }
}

extension EntityAvatar {
    static func user(id: String, url: URL?, name: String, size: CGFloat = 36) -> EntityAvatar {
        EntityAvatar(size: size, imageURL: url ?? AvatarDefaults.url(kind: .user, id: id, raw: nil), name: name, kind: .user, shape: .circle)
    }

    static func agent(id: String, url: URL?, name: String, size: CGFloat = 36) -> EntityAvatar {
        EntityAvatar(size: size, imageURL: url ?? AvatarDefaults.url(kind: .agent, id: id, raw: nil), name: name, kind: .agent, shape: .circle)
    }

    static func idea(id: String, url: URL?, name: String, size: CGFloat = 32) -> EntityAvatar {
        EntityAvatar(size: size, imageURL: url ?? AvatarDefaults.url(kind: .idea, id: id, raw: nil), name: name, kind: .idea, shape: .roundedRect)
    }
}
