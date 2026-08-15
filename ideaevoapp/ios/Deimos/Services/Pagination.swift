import Foundation

/// 列表分页通用辅助：根据已加载条数与 total 判定是否还有更多。
enum Pagination {
    /// - Parameters:
    ///   - offset: 当前请求的起始偏移（即此前已加载条数）。
    ///   - loaded: 本次返回的条数。
    ///   - total: 服务端总数（可选；某些端点如语义搜索不返回 total）。
    static func hasMore(offset: Int, loaded: Int, total: Int?) -> Bool {
        if loaded == 0 { return false }
        if let total {
            return offset + loaded < total
        }
        // 无 total 时退化为「本次满页即可能还有更多」。
        return true
    }
}
