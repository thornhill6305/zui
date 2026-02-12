import UIKit
import WebKit
import Capacitor

/// Extends the WKWebView edge-to-edge (behind the status bar and home
/// indicator) and injects safe-area values as CSS custom properties
/// (--safe-top, --safe-bottom, --safe-left, --safe-right).
class ZUIBridgeViewController: CAPBridgeViewController {

    private var loadingObservation: NSKeyValueObservation?

    override func viewDidLoad() {
        super.viewDidLoad()

        guard let webView = webView else { return }

        // 1. Remove Capacitor's safe-area-pinned constraints and pin
        //    the webview to the superview edges instead.
        let existing = view.constraints.filter {
            $0.firstItem === webView || $0.secondItem === webView
        }
        NSLayoutConstraint.deactivate(existing)

        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        // 2. Don't let the scroll view adjust content insets automatically.
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        // 3. Match the app background so the status bar area doesn't flash
        //    white during load.
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor

        // 4. Re-inject safe area whenever the page finishes loading
        //    (remote URLs may load after viewSafeAreaInsetsDidChange).
        loadingObservation = webView.observe(\.isLoading, options: [.new]) {
            [weak self] _, change in
            if change.newValue == false {
                self?.injectSafeAreaProperties()
            }
        }
    }

    // Called whenever the safe area changes (initial layout, rotation, etc.)
    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        injectSafeAreaProperties()
    }

    private func injectSafeAreaProperties() {
        let i = view.safeAreaInsets
        let js = """
        (function(){
            var s=document.documentElement.style;
            s.setProperty('--safe-top','\(i.top)px');
            s.setProperty('--safe-bottom','\(i.bottom)px');
            s.setProperty('--safe-left','\(i.left)px');
            s.setProperty('--safe-right','\(i.right)px');
        })();
        """
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    deinit {
        loadingObservation?.invalidate()
    }
}
