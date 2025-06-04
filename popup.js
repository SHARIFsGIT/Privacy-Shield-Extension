// Privacy Shield Pro - Professional Popup Controller
class PopupController {
  constructor() {
    this.settings = {
      enabled: false,
      mode: "blur",
      blurIntensity: 8,
      maskSymbol: "*",
      theme: "light",
    };
    this.notificationQueue = [];
    this.isShowingNotification = false;
    this.isInitialized = false;

    this.init();
  }

  async init() {
    if (this.isInitialized) return;

    try {
      this.initElements();
      await this.loadSettings();
      this.initEventListeners();
      await this.checkContentScript();
      this.isInitialized = true;
    } catch (error) {
      console.error("Popup initialization failed:", error);
      this.showToast("Initialization failed", "error");
    }
  }

  initElements() {
    // Main controls
    this.mainToggle = document.getElementById("main-toggle");
    this.status = document.getElementById("status");
    this.statsSection = document.getElementById("stats-section");
    this.protectedCount = document.getElementById("protected-count");

    // Theme
    this.themeToggle = document.getElementById("theme-toggle");
    this.themeIcon = this.themeToggle.querySelector(".theme-icon");

    // Modes
    this.modeCards = document.querySelectorAll(".mode-card");
    this.modeRadios = document.querySelectorAll('input[name="mode"]');

    // Controls
    this.intensityControl = document.getElementById("intensity-control");
    this.maskControl = document.getElementById("mask-control");
    this.blurIntensity = document.getElementById("blur-intensity");
    this.intensityValue = document.getElementById("intensity-value");
    this.symbolBtns = document.querySelectorAll(".symbol-btn");

    // Actions
    this.takeScreenshot = document.getElementById("take-screenshot");
    this.emergencyBlur = document.getElementById("emergency-blur");
    this.removeAll = document.getElementById("remove-all");
    this.undoAction = document.getElementById("undo-action");

    // Toast container
    this.toastContainer = document.getElementById("toast-container");
  }

  async loadSettings() {
    try {
      const data = await chrome.storage.sync.get([
        "enabled",
        "mode",
        "blurIntensity",
        "maskSymbol",
        "theme",
      ]);

      this.settings = { ...this.settings, ...data };
      this.applySettings();
      this.updateStats();
    } catch (error) {
      console.error("Failed to load settings:", error);
      this.showToast("Failed to load settings", "warning");
    }
  }

  applySettings() {
    // Apply theme
    document.body.setAttribute("data-theme", this.settings.theme);
    this.themeIcon.textContent = this.settings.theme === "dark" ? "☀️" : "🌑";

    // Apply main toggle
    this.mainToggle.checked = this.settings.enabled;
    this.updateStatus();

    // Apply mode selection
    const modeRadio = document.querySelector(
      `input[value="${this.settings.mode}"]`
    );
    if (modeRadio) {
      modeRadio.checked = true;
      this.updateModeSelection();
      this.updateModeControls();
    }

    // Apply blur intensity
    this.blurIntensity.value = this.settings.blurIntensity;
    this.intensityValue.textContent = this.settings.blurIntensity;

    // Apply mask symbol
    this.updateSymbolSelection();

    // Show stats if enabled
    if (this.settings.enabled) {
      this.statsSection.style.display = "block";
    }
  }

  initEventListeners() {
    // Theme toggle
    this.themeToggle.addEventListener("click", () => {
      this.toggleTheme();
    });

    // Main toggle
    this.mainToggle.addEventListener("change", (e) => {
      this.handleToggleChange(e.target.checked);
    });

    // Mode selection - both click and keyboard
    this.modeCards.forEach((card) => {
      const handleModeSelect = () => {
        const radio = card.querySelector('input[type="radio"]');
        if (radio && !radio.checked) {
          radio.checked = true;
          this.handleModeChange(radio.value);
        }
      };

      card.addEventListener("click", handleModeSelect);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleModeSelect();
        }
      });
    });

    // Blur intensity
    this.blurIntensity.addEventListener("input", (e) => {
      const value = parseInt(e.target.value);
      this.intensityValue.textContent = value;
      this.handleIntensityChange(value);
    });

    // Symbol buttons
    this.symbolBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const symbol = btn.dataset.symbol;
        this.handleSymbolChange(symbol);
      });
    });

    // Action buttons
    this.takeScreenshot.addEventListener("click", () => {
      this.handleScreenshot();
    });

    this.emergencyBlur.addEventListener("click", () => {
      this.handleEmergencyBlur();
    });

    this.removeAll.addEventListener("click", () => {
      this.handleRemoveAll();
    });

    this.undoAction.addEventListener("click", () => {
      this.handleUndo();
    });

    // Listen for content script messages
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === "statusUpdate") {
        this.settings.enabled = message.enabled;
        this.mainToggle.checked = message.enabled;
        this.updateStatus();
        this.updateStats();
      }
    });

    // Keyboard navigation
    document.addEventListener("keydown", (e) => {
      this.handleKeyboardNavigation(e);
    });
  }

  handleKeyboardNavigation(e) {
    // Quick actions via keyboard
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case "p":
          e.preventDefault();
          this.mainToggle.click();
          break;
        case "e":
          e.preventDefault();
          this.emergencyBlur.click();
          break;
        case "r":
          e.preventDefault();
          this.removeAll.click();
          break;
      }
    }
  }

  toggleTheme() {
    this.settings.theme = this.settings.theme === "light" ? "dark" : "light";
    document.body.setAttribute("data-theme", this.settings.theme);
    this.themeIcon.textContent = this.settings.theme === "dark" ? "☀️" : "🌑";

    chrome.storage.sync.set({ theme: this.settings.theme });
    this.showToast(
      `${this.settings.theme === "dark" ? "Dark" : "Light"} theme applied`,
      "info"
    );
  }

  async handleToggleChange(enabled) {
    this.settings.enabled = enabled;

    try {
      await chrome.storage.sync.set({ enabled });
      await this.sendMessageToTab({ action: "toggle", enabled });

      this.updateStatus();

      if (enabled) {
        this.showToast("Protection activated", "success");
        this.statsSection.style.display = "block";
        this.updateStats();
      } else {
        this.showToast("Protection deactivated", "info");
        this.statsSection.style.display = "none";
      }
    } catch (error) {
      console.error("Toggle error:", error);
      this.showToast("Failed to toggle protection", "error");
      this.mainToggle.checked = !enabled;
      this.settings.enabled = !enabled;
    }
  }

  async handleModeChange(mode) {
    this.settings.mode = mode;

    try {
      await chrome.storage.sync.set({ mode });
      await this.sendMessageToTab({
        action: "changeMode",
        mode,
        blurIntensity: this.settings.blurIntensity,
        maskSymbol: this.settings.maskSymbol,
      });

      this.updateModeSelection();
      this.updateModeControls();

      const modeNames = {
        blur: "🌫️ Blur mode activated",
        mask: "✱ Mask mode activated",
        blackout: "⚫ Hide mode activated",
      };

      this.showToast(modeNames[mode], "info");
    } catch (error) {
      console.error("Mode change error:", error);
      this.showToast("Failed to change mode", "error");
    }
  }

  async handleIntensityChange(intensity) {
    this.settings.blurIntensity = intensity;

    try {
      await chrome.storage.sync.set({ blurIntensity: intensity });
      await this.sendMessageToTab({
        action: "updateBlurIntensity",
        intensity,
      });
    } catch (error) {
      console.error("Intensity change error:", error);
    }
  }

  async handleSymbolChange(symbol) {
    this.settings.maskSymbol = symbol;

    try {
      await chrome.storage.sync.set({ maskSymbol: symbol });
      await this.sendMessageToTab({
        action: "updateMaskSymbol",
        symbol,
      });

      this.updateSymbolSelection();
      this.showToast(`Symbol changed to: ${symbol}`, "info");
    } catch (error) {
      console.error("Symbol change error:", error);
      this.showToast("Failed to change symbol", "error");
    }
  }

  async handleScreenshot() {
    this.setButtonLoading(this.takeScreenshot, true);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: "screen",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.style.position = "absolute";
      video.style.top = "-9999px";
      document.body.appendChild(video);

      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
        video.play();
      });

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);

      // Cleanup
      document.body.removeChild(video);
      stream.getTracks().forEach((track) => track.stop());

      // Download screenshot
      canvas.toBlob(
        (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `privacy-shield-${new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/:/g, "-")}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          this.showToast("Screenshot saved successfully", "success");
        },
        "image/png",
        0.95
      );
    } catch (error) {
      console.error("Screenshot error:", error);
      if (error.name === "NotAllowedError") {
        this.showToast("Screen capture permission denied", "error");
      } else {
        this.showToast("Screenshot failed", "error");
      }
    } finally {
      this.setButtonLoading(this.takeScreenshot, false);
    }
  }

  async handleEmergencyBlur() {
    this.setButtonLoading(this.emergencyBlur, true);

    try {
      await this.sendMessageToTab({
        action: "emergencyBlur",
        blurIntensity: Math.max(this.settings.blurIntensity, 20),
      });

      this.showToast("Emergency protection activated", "warning");
    } catch (error) {
      console.error("Emergency blur error:", error);
      this.showToast("Emergency protection failed", "error");
    } finally {
      setTimeout(() => {
        this.setButtonLoading(this.emergencyBlur, false);
      }, 1000);
    }
  }

  async handleRemoveAll() {
    this.setButtonLoading(this.removeAll, true);

    try {
      const result = await this.sendMessageToTab({ action: "removeAll" });

      if (result && result.removed !== undefined) {
        if (result.removed > 0) {
          this.showToast(
            `Removed ${result.removed} protected elements`,
            "success"
          );
        } else {
          this.showToast("No protected elements found", "info");
        }
      } else {
        this.showToast("All protection removed", "success");
      }

      this.updateStats();
    } catch (error) {
      console.error("Remove all error:", error);
      this.showToast("Failed to remove protection", "error");
    } finally {
      setTimeout(() => {
        this.setButtonLoading(this.removeAll, false);
      }, 500);
    }
  }

  async handleUndo() {
    this.setButtonLoading(this.undoAction, true);

    try {
      const result = await this.sendMessageToTab({ action: "undoLastAction" });

      if (result && result.success) {
        this.showToast("↶ Last action undone", "info");
        this.updateStats();
      } else {
        this.showToast("No actions to undo", "warning");
      }
    } catch (error) {
      console.error("Undo error:", error);
      this.showToast("Undo failed", "error");
    } finally {
      setTimeout(() => {
        this.setButtonLoading(this.undoAction, false);
      }, 500);
    }
  }

  // UI Update Methods
  updateStatus() {
    if (this.settings.enabled) {
      this.status.textContent = "Active 🛡️";
      this.status.className = "status active";
    } else {
      this.status.textContent = "Click to activate";
      this.status.className = "status";
    }
  }

  updateModeSelection() {
    this.modeCards.forEach((card) => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio && radio.checked) {
        card.classList.add("active");
        card.setAttribute("aria-pressed", "true");
      } else {
        card.classList.remove("active");
        card.setAttribute("aria-pressed", "false");
      }
    });
  }

  updateModeControls() {
    // Hide all controls
    this.intensityControl.style.display = "none";
    this.maskControl.style.display = "none";

    // Show relevant control
    if (this.settings.mode === "blur") {
      this.intensityControl.style.display = "block";
    } else if (this.settings.mode === "mask") {
      this.maskControl.style.display = "block";
    }
  }

  updateSymbolSelection() {
    this.symbolBtns.forEach((btn) => {
      if (btn.dataset.symbol === this.settings.maskSymbol) {
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
      } else {
        btn.classList.remove("active");
        btn.setAttribute("aria-pressed", "false");
      }
    });
  }

  async updateStats() {
    if (!this.settings.enabled) return;

    try {
      const stats = await this.sendMessageToTab({ action: "getStats" });
      if (stats && stats.totalProtected !== undefined) {
        this.protectedCount.textContent = stats.totalProtected;
      }
    } catch (error) {
      console.error("Stats update error:", error);
      this.protectedCount.textContent = "0";
    }
  }

  async checkContentScript() {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs[0]) {
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
          action: "ping",
        });
        if (!response) {
          this.showRefreshWarning();
        }
      }
    } catch (error) {
      this.showRefreshWarning();
    }
  }

  showRefreshWarning() {
    this.showToast(
      "Please refresh the page to activate Privacy Shield",
      "warning",
      5000
    );
  }

  // Notification System
  showToast(message, type = "info", duration = 3000) {
    if (this.isShowingNotification) {
      this.notificationQueue.push({ message, type, duration });
      return;
    }

    this.isShowingNotification = true;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icons = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️",
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
    `;

    this.toastContainer.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    // Auto remove
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
        this.isShowingNotification = false;

        // Show next notification
        if (this.notificationQueue.length > 0) {
          const next = this.notificationQueue.shift();
          this.showToast(next.message, next.type, next.duration);
        }
      }, 300);
    }, duration);
  }

  setButtonLoading(button, loading) {
    if (loading) {
      button.classList.add("loading");
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    } else {
      button.classList.remove("loading");
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
    }
  }

  async sendMessageToTab(message) {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs[0]) {
        return await chrome.tabs.sendMessage(tabs[0].id, message);
      }
      throw new Error("No active tab found");
    } catch (error) {
      console.error("Message send error:", error);
      throw error;
    }
  }
}

// Initialize popup when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new PopupController();
});
