#if canImport(SwiftUI)
import SwiftUI
import WebKit

/// TipOff on the phone: the live site, full screen, in its own app. Opens on the
/// crew board, like the installed web app (manifest start_url).
/// ponytail: no offline copy. The site needs the network for the map anyway;
/// bundle a static export if the demo has to run without signal.
let site = URL(string: "https://tipoff-stl.vercel.app")!
/// The old address redirects here; keep its links in the app too.
let ownHosts: Set<String?> = [site.host, "summithack-blond.vercel.app"]
let home = site.appending(path: "crew")

@main
struct TipOffApp: App {
    var body: some Scene {
        WindowGroup { Site().ignoresSafeArea(edges: .bottom) }
    }
}

struct Site: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let web = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        web.navigationDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.reload(_:)), for: .valueChanged)
        web.scrollView.refreshControl = refresh
        context.coordinator.web = web
        web.load(URLRequest(url: home))
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        weak var web: WKWebView?

        @objc func reload(_ sender: UIRefreshControl) {
            web?.reload()
            sender.endRefreshing()
        }

        // TipOff pages stay in the app; anything else (sources, Google Maps,
        // the video) opens in Safari so the reader can always get back.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url, action.navigationType == .linkActivated,
                  !ownHosts.contains(url.host) else { return decisionHandler(.allow) }
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }

        // No signal: say so instead of a blank white page.
        func webView(_ webView: WKWebView, didFailProvisionalNavigation _: WKNavigation!, withError error: Error) {
            webView.loadHTMLString("""
            <meta name=viewport content="width=device-width">
            <body style="font:17px -apple-system;padding:40px 24px;color:#222">
            <h2>TipOff can't reach the internet</h2>
            <p>\(error.localizedDescription)</p><p>Pull down to try again.</p>
            """, baseURL: site)
        }
    }
}
#endif
