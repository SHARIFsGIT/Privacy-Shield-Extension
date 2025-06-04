// Privacy Shield - Professional Content Script
class PrivacyShield {
  constructor() {
    this.enabled = false;
    this.mode = "blur";
    this.blurIntensity = 8;
    this.maskSymbol = "*";
    this.protectedElements = new Map();
    this.originalContent = new Map();
    this.actionHistory = [];
    this.emergencyActive = false;
    this.isInitialized = false;

    this.init();
  }

  async init() {
    if (this.isInitialized) return;

    try {
      await this.loadSettings();
      this.initEventListeners();
      this.initKeyboardShortcuts();
      this.initSelectionHandling();
      this.injectStyles();
      this.isInitialized = true;
    } catch (error) {
      console.error("Privacy Shield initialization failed:", error);
    }
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
      this.blurIntensity = Math.max(2, Math.min(20, data.blurIntensity || 8));
      this.maskSymbol = data.maskSymbol || "*";

      if (this.enabled) {
        this.activate();
      }
    } catch (error) {
      console.error("Settings load failed:", error);
    }
  }

  initEventListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        this.handleMessage(message, sendResponse);
      } catch (error) {
        console.error("Message handling error:", error);
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
      emergencyBlur: () => this.emergencyBlurAll(),
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
      // Global toggle - Alt+P
      if (e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        this.quickToggle();
        return;
      }

      if (!this.enabled) return;

      // Emergency blur - Alt+E
      if (e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        this.emergencyBlurAll();
      }

      // Remove all - Alt+R
      if (e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        this.removeAllProtection();
      }

      // Undo - Ctrl+Z
      if (e.ctrlKey && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (this.actionHistory.length > 0) {
          e.preventDefault();
          this.undoLastAction();
        }
      }
    });
  }

  initSelectionHandling() {
    let selectionTimeout;

    const handleSelection = () => {
      if (!this.enabled) return;

      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(() => {
        this.checkSensitiveSelection();
      }, 200);
    };

    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("touchend", handleSelection);
  }

  injectStyles() {
    if (document.getElementById("privacy-shield-styles")) return;

    const styleSheet = document.createElement("style");
    styleSheet.id = "privacy-shield-styles";
    styleSheet.textContent = `
      .privacy-shield-active { 
        cursor: crosshair !important; 
      }
      .privacy-shield-active * { 
        cursor: crosshair !important; 
      }
      
      .privacy-shield-protected {
        position: relative !important;
        transition: all 0.3s ease !important;
        cursor: pointer !important;
        border: 2px solid #4CAF50 !important;
        border-radius: 6px !important;
        padding: 4px !important;
        background: rgba(76, 175, 80, 0.1) !important;
      }
      
      .privacy-shield-protected::before {
        content: "🛡️" !important;
        position: absolute !important;
        top: -15px !important;
        right: -15px !important;
        background: #4CAF50 !important;
        color: white !important;
        width: 30px !important;
        height: 30px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 14px !important;
        z-index: 999996 !important;
        border: 3px solid white !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
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
        padding: 16px 20px !important;
        border-radius: 10px !important;
        font-size: 14px !important;
        z-index: 999998 !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
        border-left: 4px solid #4CAF50 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        animation: slideIn 0.3s ease !important;
        min-width: 300px !important;
        max-width: 400px !important;
      }
      
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
      
      .privacy-click-notification {
        position: fixed !important;
        background: #4CAF50 !important;
        color: white !important;
        padding: 10px 16px !important;
        border-radius: 20px !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        z-index: 999999 !important;
        pointer-events: none !important;
        animation: popIn 0.3s ease !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3) !important;
        min-width: 120px !important;
        text-align: center !important;
      }
      
      @keyframes popIn {
        0% { opacity: 0; transform: translateX(-50%) scale(0.8); }
        100% { opacity: 1; transform: translateX(-50%) scale(1); }
      }
      
      @keyframes fadeOut {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      }
    `;

    document.head.appendChild(styleSheet);
  }

  // Core Functionality
  quickToggle() {
    this.enabled = !this.enabled;
    chrome.storage.sync.set({ enabled: this.enabled });

    if (this.enabled) {
      this.activate();
    } else {
      this.deactivate();
    }

    this.notifyPopup();
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
    document.body.classList.add("privacy-shield-active");

    this.clickHandler = this.handleClick.bind(this);
    this.hoverHandler = this.handleHover.bind(this);
    this.hoverOutHandler = this.handleHoverOut.bind(this);

    document.addEventListener("click", this.clickHandler, true);
    document.addEventListener("mouseover", this.hoverHandler, true);
    document.addEventListener("mouseout", this.hoverOutHandler, true);

    this.showNotification("🛡️ Privacy Shield activated", "success");
    this.updateBadge();
  }

  deactivate() {
    document.body.classList.remove("privacy-shield-active");

    if (this.clickHandler) {
      document.removeEventListener("click", this.clickHandler, true);
      document.removeEventListener("mouseover", this.hoverHandler, true);
      document.removeEventListener("mouseout", this.hoverOutHandler, true);
    }

    this.showNotification("🔓 Privacy Shield deactivated", "info");
    this.updateBadge();
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

    this.updateBadge();
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

  checkSensitiveSelection() {
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
            this.updateBadge();
          }
        }
      }, 1000);
    }
  }

  // Protection Methods
  addProtection(element, elementId) {
    const originalData = {
      filter: element.style.filter || "",
      textContent: element.textContent,
      innerHTML: element.innerHTML,
      background: element.style.background || "",
      color: element.style.color || "",
    };

    this.originalContent.set(elementId, originalData);

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

  // Mode and Settings Updates
  changeMode(message) {
    this.mode = message.mode;
    this.blurIntensity = message.blurIntensity || this.blurIntensity;
    this.maskSymbol = message.maskSymbol || this.maskSymbol;

    this.showNotification(`Mode changed to: ${this.mode}`, "info");
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

  // Emergency and Bulk Actions
  emergencyBlurAll() {
    const intensity = Math.max(this.blurIntensity, 20);
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
      <div style="text-align: center; padding: 50px; max-width: 500px;">
        <div style="font-size: 80px; margin-bottom: 30px;">🛡️</div>
        <h1 style="font-size: 36px; margin-bottom: 20px; font-weight: 700;">PRIVACY PROTECTION ACTIVE</h1>
        <p style="font-size: 18px; margin-bottom: 30px; opacity: 0.9; line-height: 1.5;">
          All content has been secured for privacy protection
        </p>
        <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">
          <button onclick="window.privacyShield.restoreFromEmergency()" 
                  style="background: #4CAF50; color: white; border: none; 
                         padding: 18px 36px; font-size: 16px; border-radius: 10px; 
                         cursor: pointer; font-weight: 600; min-width: 140px;">
            🔓 RESTORE
          </button>
          <button onclick="window.location.reload();" 
                  style="background: #2196F3; color: white; border: none; 
                         padding: 18px 36px; font-size: 16px; border-radius: 10px; 
                         cursor: pointer; font-weight: 600; min-width: 140px;">
            🔄 REFRESH
          </button>
        </div>
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
    this.updateBadge();
    return { removed: totalElements };
  }

  // History and Undo
  addToHistory(action) {
    this.actionHistory.push({ ...action, timestamp: Date.now() });
    if (this.actionHistory.length > 10) {
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

    this.updateBadge();
    return { success: true };
  }

  // Utility Methods
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
    const existing = document.querySelector(".privacy-notification");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.className = "privacy-notification";
    notification.textContent = message;

    const colors = {
      success: "#4CAF50",
      info: "#2196F3",
      warning: "#FF9800",
      error: "#F44336",
    };

    notification.style.borderLeftColor = colors[type] || colors.success;
    document.body.appendChild(notification);

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
      top: ${rect.top - 50}px;
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

  updateBadge() {
    chrome.runtime
      .sendMessage({
        action: "updateBadge",
        count: this.protectedElements.size,
      })
      .catch(() => {});
  }

  notifyPopup() {
    chrome.runtime
      .sendMessage({
        action: "statusUpdate",
        enabled: this.enabled,
      })
      .catch(() => {});
  }

  // Cleanup
  destroy() {
    this.removeAllProtection();
    this.deactivate();

    const styleSheet = document.getElementById("privacy-shield-styles");
    if (styleSheet) {
      styleSheet.remove();
    }
  }
}

// Initialize Privacy Shield
if (!window.privacyShield) {
  window.privacyShield = new PrivacyShield();
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (window.privacyShield) {
    window.privacyShield.destroy();
  }
});
