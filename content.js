// Privacy Shield Pro - Simplified Content Script
class SimplePrivacyShield {
  constructor() {
    this.enabled = false;
    this.mode = "blur";
    this.blurIntensity = 8;
    this.maskSymbol = "*";
    this.protectedElements = new Map();
    this.originalContent = new Map();
    this.actionHistory = [];
    this.emergencyActive = false;
    this.init();
  }

  init() {
    this.loadSettings();
    this.initMessageListener();
    this.initKeyboardShortcuts();
    this.initSelectionHandling();
    this.injectStyles();
  }

  async loadSettings() {
    try {
      const data = await chrome.storage.sync.get([
        "enabled",
        "mode",
        "blurIntensity",
        "maskSymbol",
      ]);

      this.enabled = data.enabled || false;
      this.mode = data.mode || "blur";
      this.blurIntensity = Math.max(2, Math.min(30, data.blurIntensity || 8));
      this.maskSymbol = data.maskSymbol || "*";

      if (this.enabled) {
        this.activate();
      }
    } catch (error) {
      console.error("Privacy Shield: Settings load error:", error);
    }
  }

  initMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        this.handleMessage(message, sendResponse);
      } catch (error) {
        console.error("Privacy Shield: Message handling error:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    });
  }

  handleMessage(message, sendResponse) {
    const actions = {
      ping: () => ({ success: true }),
      toggle: () => this.toggleProtection(message.enabled),
      changeMode: () => this.changeMode(message),
      updateBlurIntensity: () => this.updateBlurIntensity(message.intensity),
      updateMaskSymbol: () => this.updateMaskSymbol(message.symbol),
      emergencyBlur: () => this.emergencyBlurAll(message.blurIntensity),
      removeAll: () => this.removeAllProtection(),
      getStats: () => this.getProtectionStats(),
      undoLastAction: () => this.undoLastAction(),
    };

    const action = actions[message.action];
    if (action) {
      const result = action();
      sendResponse(result || { success: true });
    } else {
      sendResponse({ success: false, error: "Unknown action" });
    }
  }

  initKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Global shortcut - Alt+P to toggle
      if (e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        this.quickToggle();
        return;
      }

      if (!this.enabled) return;

      // Emergency blur: Alt+E
      if (e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        this.emergencyBlurAll();
      }

      // Remove all: Alt+R
      if (e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        this.removeAllProtection();
      }

      // Undo: Ctrl+Z
      if (e.ctrlKey && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        this.undoLastAction();
      }
    });
  }

  initSelectionHandling() {
    let selectionTimeout;

    const handleSelection = (e) => {
      if (!this.enabled) return;

      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(() => {
        this.handleTextSelection(e);
      }, 150);
    };

    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("touchend", handleSelection);
  }

  injectStyles() {
    if (document.getElementById("privacy-shield-styles")) return;

    const styleSheet = document.createElement("style");
    styleSheet.id = "privacy-shield-styles";
    styleSheet.textContent = `
      .privacy-shield-active { cursor: crosshair !important; }
      .privacy-shield-active * { cursor: crosshair !important; }
      
      .privacy-shield-protected {
        position: relative !important;
        transition: all 0.3s ease !important;
        cursor: pointer !important;
        outline: 2px solid #4CAF50 !important;
        outline-offset: 2px !important;
        background: rgba(76, 175, 80, 0.1) !important;
        border-radius: 4px !important;
        padding: 2px 4px !important;
      }
      
      .privacy-shield-protected::before {
        content: "🛡️" !important;
        position: absolute !important;
        top: -12px !important;
        right: -12px !important;
        background: #4CAF50 !important;
        color: white !important;
        width: 24px !important;
        height: 24px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 10px !important;
        z-index: 999996 !important;
        border: 2px solid white !important;
        animation: pulse 2s infinite !important;
      }
      
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
      }
      
      .privacy-shield-active *:hover:not(.privacy-shield-protected) {
        outline: 2px dashed #2196F3 !important;
        outline-offset: 2px !important;
        transition: all 0.2s ease !important;
      }
      
      .privacy-notification {
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: white !important;
        color: #333 !important;
        padding: 12px 16px !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        z-index: 999998 !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        border-left: 4px solid #4CAF50 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        animation: slideIn 0.3s ease !important;
      }
      
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      .privacy-click-notification {
        position: fixed !important;
        background: #4CAF50 !important;
        color: white !important;
        padding: 8px 12px !important;
        border-radius: 16px !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        z-index: 999999 !important;
        pointer-events: none !important;
        animation: popIn 0.3s ease !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      }
      
      @keyframes popIn {
        0% { opacity: 0; transform: translateX(-50%) scale(0.8); }
        100% { opacity: 1; transform: translateX(-50%) scale(1); }
      }
    `;

    document.head.appendChild(styleSheet);
  }

  quickToggle() {
    this.enabled = !this.enabled;
    chrome.storage.sync.set({ enabled: this.enabled });

    if (this.enabled) {
      this.activate();
    } else {
      this.deactivate();
    }

    // Notify popup
    chrome.runtime
      .sendMessage({
        action: "statusUpdate",
        enabled: this.enabled,
      })
      .catch(() => {});
  }

  toggleProtection(enabled) {
    this.enabled = enabled;
    if (enabled) {
      this.activate();
    } else {
      this.deactivate();
    }
    return { enabled: this.enabled };
  }

  activate() {
    document.body.style.cursor = "crosshair";
    document.body.classList.add("privacy-shield-active");

    this.clickHandler = this.handleClick.bind(this);
    this.hoverHandler = this.handleHover.bind(this);
    this.hoverOutHandler = this.handleHoverOut.bind(this);

    document.addEventListener("click", this.clickHandler, true);
    document.addEventListener("mouseover", this.hoverHandler, true);
    document.addEventListener("mouseout", this.hoverOutHandler, true);

    this.showNotification("🛡️ Privacy Shield activated", "success");
  }

  deactivate() {
    document.body.style.cursor = "";
    document.body.classList.remove("privacy-shield-active");

    if (this.clickHandler) {
      document.removeEventListener("click", this.clickHandler, true);
      document.removeEventListener("mouseover", this.hoverHandler, true);
      document.removeEventListener("mouseout", this.hoverOutHandler, true);
    }

    this.showNotification("🔓 Privacy Shield deactivated", "info");
  }

  handleClick(e) {
    if (!this.enabled || this.isPrivacyShieldUI(e.target)) return;

    e.preventDefault();
    e.stopPropagation();

    const element = e.target;
    const elementId = this.getElementId(element);

    if (this.protectedElements.has(elementId)) {
      this.removeProtection(element, elementId);
      this.showClickNotification("🔓 Unprotected", element);
      this.addToHistory({ action: "unprotect", elementId, element });
    } else {
      this.addProtection(element, elementId);
      this.showClickNotification("🛡️ Protected", element);
      this.addToHistory({ action: "protect", elementId, element });
    }
  }

  handleHover(e) {
    if (!this.enabled || this.isPrivacyShieldUI(e.target)) return;

    const element = e.target;
    if (!this.protectedElements.has(this.getElementId(element))) {
      element.style.outline = "2px dashed #2196F3";
      element.style.outlineOffset = "2px";
    }
  }

  handleHoverOut(e) {
    if (!this.enabled) return;

    const element = e.target;
    if (!this.protectedElements.has(this.getElementId(element))) {
      element.style.outline = "";
      element.style.outlineOffset = "";
    }
  }

  handleTextSelection(e) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText.length > 5 && this.isSensitiveContent(selectedText)) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element =
        container.nodeType === Node.TEXT_NODE
          ? container.parentElement
          : container;

      setTimeout(() => {
        if (window.getSelection().toString().length > 0) {
          const elementId = this.getElementId(element);
          if (!this.protectedElements.has(elementId)) {
            this.addProtection(element, elementId);
            this.showClickNotification("🛡️ Auto-protected", element);
            this.addToHistory({ action: "auto-protect", elementId, element });
          }
        }
      }, 1000);
    }
  }

  addProtection(element, elementId) {
    // Store original content
    const originalData = {
      filter: element.style.filter || "",
      textContent: element.textContent,
      innerHTML: element.innerHTML,
      outline: element.style.outline || "",
      outlineOffset: element.style.outlineOffset || "",
      background: element.style.background || "",
      color: element.style.color || "",
    };

    this.originalContent.set(elementId, originalData);

    // Apply protection
    switch (this.mode) {
      case "blur":
        element.style.filter = `blur(${this.blurIntensity}px)`;
        break;
      case "mask":
        this.replaceTextContent(element, this.maskSymbol);
        break;
      case "blackout":
        element.style.background = "#000";
        element.style.color = "transparent";
        break;
    }

    // Apply styling
    element.classList.add("privacy-shield-protected");
    element.title = "Protected - Click to remove";

    this.protectedElements.set(elementId, {
      element,
      mode: this.mode,
      timestamp: Date.now(),
    });
  }

  removeProtection(element, elementId) {
    const originalData = this.originalContent.get(elementId);
    if (!originalData) return;

    // Restore original content
    Object.keys(originalData).forEach((property) => {
      if (property === "innerHTML") {
        element.innerHTML = originalData[property];
      } else if (property !== "textContent") {
        element.style[property] = originalData[property];
      }
    });

    element.classList.remove("privacy-shield-protected");
    element.title = "";

    this.protectedElements.delete(elementId);
    this.originalContent.delete(elementId);
  }

  replaceTextContent(element, char) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim().length > 0) {
        textNodes.push(node);
      }
    }

    textNodes.forEach((textNode) => {
      const text = textNode.textContent;
      const replacedText = text.replace(/\S/g, char);
      textNode.textContent = replacedText;
    });
  }

  changeMode(message) {
    this.mode = message.mode;
    this.blurIntensity = message.blurIntensity || this.blurIntensity;
    this.maskSymbol = message.maskSymbol || this.maskSymbol;

    this.showNotification(`Mode: ${this.mode}`, "info");
    return { mode: this.mode };
  }

  updateBlurIntensity(intensity) {
    this.blurIntensity = intensity;

    this.protectedElements.forEach((data, elementId) => {
      if (data.mode === "blur") {
        data.element.style.filter = `blur(${this.blurIntensity}px)`;
      }
    });

    return { blurIntensity: this.blurIntensity };
  }

  updateMaskSymbol(symbol) {
    this.maskSymbol = symbol;

    this.protectedElements.forEach((data, elementId) => {
      if (data.mode === "mask") {
        const originalData = this.originalContent.get(elementId);
        if (originalData) {
          data.element.innerHTML = originalData.innerHTML;
          this.replaceTextContent(data.element, this.maskSymbol);
        }
      }
    });

    return { maskSymbol: this.maskSymbol };
  }

  emergencyBlurAll(customIntensity = null) {
    const intensity = customIntensity || Math.max(this.blurIntensity, 20);

    document.body.style.filter = `blur(${intensity}px)`;
    document.body.style.transition = "filter 0.5s ease";

    this.showEmergencyOverlay();
    this.emergencyActive = true;

    this.showNotification("🚨 Emergency protection active", "warning");
    return { emergencyActive: true };
  }

  showEmergencyOverlay() {
    const existing = document.getElementById("emergency-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "emergency-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 64px; margin-bottom: 20px;">🛡️</div>
        <h1 style="font-size: 32px; margin-bottom: 16px;">PRIVACY PROTECTION ACTIVE</h1>
        <p style="font-size: 16px; margin-bottom: 24px; opacity: 0.9;">
          All content has been blurred for privacy
        </p>
        <button onclick="window.privacyShield.restoreFromEmergency()" 
                style="background: #4CAF50; color: white; border: none; 
                       padding: 16px 32px; font-size: 16px; border-radius: 8px; 
                       cursor: pointer; margin-right: 12px;">
          🔓 RESTORE
        </button>
        <button onclick="window.location.reload();" 
                style="background: #2196F3; color: white; border: none; 
                       padding: 16px 32px; font-size: 16px; border-radius: 8px; 
                       cursor: pointer;">
          🔄 REFRESH
        </button>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  restoreFromEmergency() {
    this.emergencyActive = false;
    document.body.style.filter = "";
    document.body.style.transition = "";

    const overlay = document.getElementById("emergency-overlay");
    if (overlay) overlay.remove();

    this.showNotification("🔓 Emergency protection removed", "success");
  }

  removeAllProtection() {
    this.restoreFromEmergency();

    const protectedElements = Array.from(this.protectedElements.entries());
    const totalElements = protectedElements.length;

    if (totalElements === 0) {
      this.showNotification("ℹ️ No protected elements found", "info");
      return { removed: 0 };
    }

    protectedElements.forEach(([elementId, data]) => {
      this.removeProtection(data.element, elementId);
    });

    this.showNotification(
      `🧹 Removed ${totalElements} protected elements`,
      "success"
    );
    return { removed: totalElements };
  }

  addToHistory(action) {
    this.actionHistory.push({ ...action, timestamp: Date.now() });
    if (this.actionHistory.length > 20) {
      this.actionHistory.shift();
    }
  }

  undoLastAction() {
    if (this.actionHistory.length === 0) {
      this.showNotification("⚠️ No actions to undo", "warning");
      return { success: false };
    }

    const lastAction = this.actionHistory.pop();
    const element = lastAction.element;
    const elementId = lastAction.elementId;

    if (!element || !element.isConnected) {
      this.showNotification("⚠️ Element no longer exists", "warning");
      return { success: false };
    }

    if (
      lastAction.action === "protect" ||
      lastAction.action === "auto-protect"
    ) {
      this.removeProtection(element, elementId);
      this.showClickNotification("↶ Undid protection", element);
    } else if (lastAction.action === "unprotect") {
      this.addProtection(element, elementId);
      this.showClickNotification("↶ Undid removal", element);
    }

    return { success: true };
  }

  // Utility methods
  isPrivacyShieldUI(element) {
    const uiSelectors = [
      ".privacy-notification",
      "#emergency-overlay",
      ".privacy-click-notification",
    ];

    return uiSelectors.some((selector) => element.closest(selector));
  }

  isSensitiveContent(text) {
    const sensitivePatterns = [
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/, // Phone
      /\b(?:password|pwd|pass)\b/i, // Password fields
    ];

    return sensitivePatterns.some((pattern) => pattern.test(text));
  }

  showNotification(message, type = "success") {
    // Remove existing notification to prevent duplicates
    const existing = document.querySelector(".privacy-notification");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.className = "privacy-notification";
    notification.textContent = message;

    // Set border color based on type
    const colors = {
      success: "#4CAF50",
      info: "#2196F3",
      warning: "#FF9800",
      error: "#F44336",
    };

    notification.style.borderLeftColor = colors[type] || colors.success;
    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = "slideOut 0.3s ease forwards";
        setTimeout(() => notification.remove(), 300);
      }
    }, 3000);
  }

  showClickNotification(message, element) {
    const notification = document.createElement("div");
    notification.className = "privacy-click-notification";
    notification.textContent = message;

    const rect = element.getBoundingClientRect();
    notification.style.cssText += `
      top: ${rect.top - 40}px;
      left: ${rect.left + rect.width / 2}px;
      transform: translateX(-50%);
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "fadeOut 0.3s ease forwards";
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  getProtectionStats() {
    return {
      totalProtected: this.protectedElements.size,
      emergencyActive: this.emergencyActive || false,
      actionHistory: this.actionHistory.length,
    };
  }

  getElementId(element) {
    if (!element.dataset.privacyShieldId) {
      element.dataset.privacyShieldId =
        "ps_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    }
    return element.dataset.privacyShieldId;
  }

  // Cleanup method
  destroy() {
    this.removeAllProtection();
    this.deactivate();

    const styleSheet = document.getElementById("privacy-shield-styles");
    if (styleSheet) {
      styleSheet.remove();
    }
  }
}

// Initialize and expose globally
if (!window.privacyShield) {
  window.privacyShield = new SimplePrivacyShield();
}

// Add missing CSS animations
const additionalStyles = `
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  
  @keyframes fadeOut {
    from { opacity: 1; transform: translateX(-50%) translateY(0); }
    to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  }
`;

const styleSheet = document.getElementById("privacy-shield-styles");
if (styleSheet) {
  styleSheet.textContent += additionalStyles;
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (window.privacyShield) {
    window.privacyShield.destroy();
  }
});
