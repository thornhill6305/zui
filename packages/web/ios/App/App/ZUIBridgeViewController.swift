import UIKit
import WebKit
import Capacitor

/// Extends the WKWebView edge-to-edge and manually resizes it when the
/// keyboard opens/closes.  Injects --safe-top/--safe-bottom CSS custom
/// properties and dispatches keyboard events to JavaScript.
class ZUIBridgeViewController: CAPBridgeViewController {

    private var loadingObservation: NSKeyValueObservation?
    private var currentKeyboardHeight: CGFloat = 0

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let webView = webView else { return }

        // -- Layout: frame-based, no Auto Layout conflicts. --------
        for c in view.constraints where c.firstItem === webView || c.secondItem === webView {
            c.isActive = false
        }
        webView.translatesAutoresizingMaskIntoConstraints = true
        webView.autoresizingMask = []
        webView.frame = view.bounds

        webView.scrollView.contentInsetAdjustmentBehavior = .never

        // Background matches --bg-primary to prevent white flash.
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor

        // Hide the default iOS keyboard accessory bar.
        webView.hack_removeInputAccessoryView()

        // Allow programmatic focus to show keyboard (for xterm.js).
        webView.hack_setKeyboardRequiresUserAction(false)

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

    // MARK: - Layout

    // Re-apply our frame after every layout pass so Capacitor's parent
    // class (CAPBridgeViewController) can never override it.
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        applyWebViewFrame(animated: false)
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        injectSafeArea()
    }

    private func applyWebViewFrame(animated: Bool) {
        guard let webView = webView else { return }
        let target = CGRect(
            x: 0, y: 0,
            width: view.bounds.width,
            height: view.bounds.height - currentKeyboardHeight
        )
        if animated {
            webView.frame = target   // inside an existing animation block
        } else {
            webView.frame = target
        }
    }

    // MARK: - Keyboard

    @objc private func keyboardWillShow(_ n: Notification) {
        guard let endFrame = n.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect
        else { return }

        currentKeyboardHeight = endFrame.height

        let duration = n.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
        let curveRaw = n.userInfo?[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt ?? 7
        let opts = UIView.AnimationOptions(rawValue: curveRaw << 16)
        UIView.animate(withDuration: duration, delay: 0, options: opts, animations: {
            self.applyWebViewFrame(animated: true)
        })

        webView?.evaluateJavaScript(
            "window.dispatchEvent(new Event('native:keyboard-show'))",
            completionHandler: nil)
        injectSafeArea(keyboardVisible: true)
    }

    @objc private func keyboardWillHide(_ n: Notification) {
        currentKeyboardHeight = 0

        let duration = n.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
        let curveRaw = n.userInfo?[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt ?? 7
        let opts = UIView.AnimationOptions(rawValue: curveRaw << 16)
        UIView.animate(withDuration: duration, delay: 0, options: opts, animations: {
            self.applyWebViewFrame(animated: true)
        })

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

// MARK: - Hide input accessory view (replaces @capacitor/keyboard plugin)

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

    /// Allow programmatic .focus() to open the keyboard without a user tap.
    func hack_setKeyboardRequiresUserAction(_ requires: Bool) {
        guard let contentView = scrollView.subviews.first(where: {
            String(describing: type(of: $0)).hasPrefix("WKContent")
        }) else { return }

        typealias FocusIMP = @convention(c) (AnyObject, Selector, AnyObject, Bool, Bool, AnyObject) -> Void
        let sel = sel_getUid("_elementDidFocus:userIsInteracting:blurPreviousNode:activityStateChanges:")
        guard let method = class_getInstanceMethod(type(of: contentView), sel) else { return }
        let original = method_getImplementation(method)
        let block: @convention(block) (AnyObject, AnyObject, Bool, Bool, AnyObject) -> Void = {
            me, info, _, blur, changes in
            let fn = unsafeBitCast(original, to: FocusIMP.self)
            fn(me, sel, info, true, blur, changes)
        }
        method_setImplementation(method, imp_implementationWithBlock(block))
    }
}
