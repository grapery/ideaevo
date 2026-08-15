import AuthenticationServices
import SwiftUI

struct SignInWithAppleButtonView: UIViewRepresentable {
    var cornerRadius: CGFloat = 2
    var onCompletion: (Result<(ASAuthorization, String), Error>) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onCompletion: onCompletion)
    }

    func makeUIView(context: Context) -> ASAuthorizationAppleIDButton {
        let button = ASAuthorizationAppleIDButton(type: .signIn, style: .black)
        button.cornerRadius = cornerRadius
        button.addTarget(context.coordinator, action: #selector(Coordinator.didTap), for: .touchUpInside)
        return button
    }

    func updateUIView(_ uiView: ASAuthorizationAppleIDButton, context: Context) {}

    final class Coordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
        private let onCompletion: (Result<(ASAuthorization, String), Error>) -> Void
        private var controller: ASAuthorizationController?
        private var rawNonce = ""

        init(onCompletion: @escaping (Result<(ASAuthorization, String), Error>) -> Void) {
            self.onCompletion = onCompletion
        }

        @objc func didTap() {
            let nonce = AppleSignInNonce.randomNonceString()
            rawNonce = nonce

            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = AppleSignInNonce.sha256(nonce)

            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.controller = controller
            controller.performRequests()
        }

        func authorizationController(
            controller: ASAuthorizationController,
            didCompleteWithAuthorization authorization: ASAuthorization
        ) {
            onCompletion(.success((authorization, rawNonce)))
        }

        func authorizationController(
            controller: ASAuthorizationController,
            didCompleteWithError error: Error
        ) {
            onCompletion(.failure(error))
        }

        func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows)
                .first { $0.isKeyWindow } ?? ASPresentationAnchor()
        }
    }
}

@MainActor
enum AppleSignInHelper {
    static func handle(
        _ result: Result<(ASAuthorization, String), Error>,
        session: AuthSession
    ) async throws {
        switch result {
        case .failure(let error as NSError):
            if error.domain == ASAuthorizationError.errorDomain,
               error.code == ASAuthorizationError.canceled.rawValue {
                return
            }
            throw error
        case .success(let (authorization, rawNonce)):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let token = String(data: tokenData, encoding: .utf8) else {
                throw APIError.server("无法读取 Apple 登录凭证")
            }
            var name: String?
            if let fullName = credential.fullName {
                let parts = [fullName.familyName, fullName.givenName].compactMap { $0 }.filter { !$0.isEmpty }
                if !parts.isEmpty {
                    name = parts.joined()
                }
            }
            let user = try await APIClient.shared.signInWithApple(
                identityToken: token,
                email: credential.email,
                name: name,
                nonce: rawNonce
            )
            session.user = user
        }
    }
}
