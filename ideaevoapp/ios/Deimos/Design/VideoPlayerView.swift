import SwiftUI
import AVKit

/// 封装 AVPlayer 的视频播放视图。
/// 用于 Idea 详情页的宣传视频展示(封面占位 + 点击全屏播放)。
struct VideoPlayerView: View {
    let url: URL
    @State private var player: AVPlayer?

    var body: some View {
        VideoPlayer(player: player)
            .onAppear {
                if player == nil {
                    let p = AVPlayer(url: url)
                    p.actionAtItemEnd = .pause
                    player = p
                }
            }
            .onDisappear {
                player?.pause()
            }
    }
}

/// 视频封面占位:显示首帧缩略图 + 播放按钮,点击进入全屏播放。
/// 用于画廊和封面区,避免列表中预加载多个视频占用内存。
struct VideoCoverButton: View {
    let url: URL
    @State private var showPlayer = false

    var body: some View {
        Button {
            showPlayer = true
        } label: {
            ZStack {
                Rectangle()
                    .fill(AtlasColors.ink.opacity(0.08))
                Image(systemName: "play.circle.fill")
                    .font(.system(size: 40))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.3), radius: 4, y: 2)
            }
        }
        .buttonStyle(.plain)
        .fullScreenCover(isPresented: $showPlayer) {
            VideoPlayerView(url: url)
                .ignoresSafeArea()
        }
    }
}
