import UIKit
import WebKit
import Capacitor

/// Extends the WKWebView edge-to-edge and manually resizes it when the
/// keyboard opens/closes.  Injects --safe-top/--safe-bottom CSS custom
/// properties and dispatches keyboard events to JavaScript.
class ZUIBridgeViewController: CAPBridgeViewController {

    private var loadingObservation: NSKeyValueObservation?

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let webView = webView else { return }

        // -- Layout: frame-based, no Auto Layout conflicts. --------
        for c in view.constraints where c.firstItem === webView || c.secondItem === webView {
            c.isActive = false
        }
        webView.translatesAutoresizingMaskIntoConstraints = true
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.frame = view.bounds

        webView.scrollView.contentInsetAdjustmentBehavior = .never

        // Background matches --bg-primary to prevent white flash.
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor

        // Hide the default iOS keyboard accessory bar.
        webView.hack_removeInputAccessoryView()

        // -- JS→Native bridge for keyboard dismiss ----------------
        let handler = KeyboardDismissHandler(viewController: self)
        webView.configuration.userContentController.add(handler, name: "keyboard")

        // -- Keyboard observers ------------------------------------
        NotificationCenter.default.addObserver(
            self, selector: #selector(keyboardWillShow(_:)),
            name: UIResponder.keyboardWillShowNotification, object: nil)
        NotificationCenter.default.addObserver(
            self, selector: #selector(keyboardWillHide(_:)),
            name: UIResponder.keyboardWillHideNotification, object: nil)

        // -- Re-inject safe area on page load ----------------------
        loadingObservation = webView.observe(\.isLoading, options: .new) {
            [weak self] _, change in
            if change.newValue == false { self?.injectSafeArea() }
        }
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        injectSafeArea()
    }

    // MARK: - Keyboard

    @objc private func keyboardWillShow(_ n: Notification) {
        guard let webView = webView,
              let endFrame = n.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect
        else { return }

        let kbHeight = endFrame.height
        let duration = n.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
        let curveRaw = n.userInfo?[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt ?? 7
        let opts = UIView.AnimationOptions(rawValue: curveRaw << 16)
        UIView.animate(withDuration: duration, delay: 0, options: opts, animations: {
            webView.frame = CGRect(x: 0, y: 0,
                                   width: self.view.bounds.width,
                                   height: self.view.bounds.height - kbHeight)
        })

        webView.evaluateJavaScript(
            "window.dispatchEvent(new Event('native:keyboard-show'))",
            completionHandler: nil)
        injectSafeArea(keyboardVisible: true)
    }

    @objc private func keyboardWillHide(_ n: Notification) {
        guard let webView = webView else { return }

        let duration = n.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
        let curveRaw = n.userInfo?[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt ?? 7
        let opts = UIView.AnimationOptions(rawValue: curveRaw << 16)
        UIView.animate(withDuration: duration, delay: 0, options: opts, animations: {
            webView.frame = self.view.bounds
        })

        webView.evaluateJavaScript(
            "window.dispatchEvent(new Event('native:keyboard-hide'))",
            completionHandler: nil)
        injectSafeArea(keyboardVisible: false)
    }

    /// Called from JS via window.webkit.messageHandlers.keyboard.postMessage('hide')
    func dismissKeyboard() {
        view.endEditing(true)
        // Explicitly restore the frame in case the notification doesn't.
        UIView.animate(withDuration: 0.25) {
            self.webView?.frame = self.view.bounds
        }
        webView?.evaluateJavaScript(
            "window.dispatchEvent(new Event('native:keyboard-hide'))",
            completionHandler: nil)
        injectSafeArea(keyboardVisible: false)
    }

    // MARK: - CSS injection

    private func injectSafeArea(keyboardVisible: Bool? = nil) {
        let i = view.safeAreaInsets
        let bottom = (keyboardVisible == true) ? 0.0 : i.bottom
        let js = """
        (function(){
            var s=document.documentElement.style;
            s.setProperty('--safe-top','\(i.top)px');
            s.setProperty('--safe-bottom','\(bottom)px');
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

// MARK: - JS→Native keyboard dismiss bridge

private class KeyboardDismissHandler: NSObject, WKScriptMessageHandler {
    weak var viewController: ZUIBridgeViewController?

    init(viewController: ZUIBridgeViewController) {
        self.viewController = viewController
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        if (message.body as? String) == "hide" {
            viewController?.dismissKeyboard()
        }
    }
}

// MARK: - Hide input accessory view

private final class NoInputAccessoryView: NSObject {
    @objc var inputAccessoryView: AnyObject? { return nil }
}

extension WKWebView {
    func hack_removeInputAccessoryView() {
        guard let target = scrollView.subviews.first(where: {
            String(describing: type(of: $0)).hasPrefix("WKContent")
        }) else { return }

        let noAccessoryClass: AnyClass = NoInputAccessoryView.self
        let original = class_getInstanceMethod(type(of: target), #selector(getter: UIResponder.inputAccessoryView))!
        let replacement = class_getInstanceMethod(noAccessoryClass, #selector(getter: NoInputAccessoryView.inputAccessoryView))!
        method_exchangeImplementations(original, replacement)
    }
}
