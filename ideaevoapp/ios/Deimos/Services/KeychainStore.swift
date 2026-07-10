import Foundation
import Security

enum KeychainStore {
    private static let service = "com.wanye.deimos"
    private static let tokenAccount = "jwt"
    private static let pendingAccount = "pending_jwt"

    static func saveToken(_ token: String) throws {
        try save(token, account: tokenAccount)
    }

    static func loadToken() -> String? {
        load(account: tokenAccount)
    }

    static func deleteToken() {
        delete(account: tokenAccount)
    }

    static func savePendingToken(_ token: String) throws {
        try save(token, account: pendingAccount)
    }

    static func loadPendingToken() -> String? {
        load(account: pendingAccount)
    }

    static func deletePendingToken() {
        delete(account: pendingAccount)
    }

    private static func save(_ token: String, account: String) throws {
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]

        SecItemDelete(query as CFDictionary)

        var insert = query
        insert[kSecValueData as String] = data
        insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock

        let status = SecItemAdd(insert as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw APIError.server("无法保存登录状态")
        }
    }

    private static func load(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess,
              let data = item as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return nil
        }
        return token
    }

    private static func delete(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
