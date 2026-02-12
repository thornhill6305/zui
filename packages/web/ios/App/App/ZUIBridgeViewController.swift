import UIKit
import WebKit
import Capacitor

/// Extends the WKWebView edge-to-edge (behind the status bar) and uses
/// the keyboard layout guide so the webview automatically shrinks when
/// the keyboard opens.  Injects safe-area values as CSS custom properties
/// (--safe-top, --safe-bottom, --safe-left, --safe-right).
class ZUIBridgeViewController: CAPBridgeViewController {

    private var loadingObservation: NSKeyValueObservation?

    override func viewDidLoad() {
        super.viewDidLoad()

        guard let webView = webView else { return }

        // 1. Remove Capacitor's safe-area-pinned constraints and replace
        //    them with edge-to-edge + keyboard-aware layout.
        let existing = view.constraints.filter {
            $0.firstItem === webView || $0.secondItem === webView
        }
        NSLayoutConstraint.deactivate(existing)

        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            // Use keyboardLayoutGuide so the webview automatically
            // shrinks above the keyboard when it opens.
            webView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
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

        // 5. Re-inject safe area when keyboard opens/closes, because
        //    --safe-bottom should be 0 when the keyboard is visible
        //    (the webview's bottom edge is at the keyboard top).
        NotificationCenter.default.addObserver(
            self, selector: #selector(keyboardStateChanged),
            name: UIResponder.keyboardWillShowNotification, object: nil)
        NotificationCenter.default.addObserver(
            self, selector: #selector(keyboardStateChanged),
            name: UIResponder.keyboardWillHideNotification, object: nil)
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        injectSafeAreaProperties()
    }

    @objc private func keyboardStateChanged() {
        // Small delay so the keyboard layout guide has updated the frame.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
            self?.injectSafeAreaProperties()
        }
    }

    private func injectSafeAreaProperties() {
        let i = view.safeAreaInsets
        // When the keyboard is open the webview doesn't extend to the
        // screen bottom, so the effective bottom safe area is 0.
        let webViewReachesBottom = (webView?.frame.maxY ?? 0) >= view.bounds.maxY - 1
        let effectiveBottom = webViewReachesBottom ? i.bottom : 0.0

        let js = """
        (function(){
            var s=document.documentElement.style;
            s.setProperty('--safe-top','\(i.top)px');
            s.setProperty('--safe-bottom','\(effectiveBottom)px');
            s.setProperty('--safe-left','\(i.left)px');
            s.setProperty('--safe-right','\(i.right)px');
        })();
        """
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    deinit {
        loadingObservation?.invalidate()
        NotificationCenter.default.removeObserver(self)
    }
}
