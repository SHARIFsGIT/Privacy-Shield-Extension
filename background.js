// Privacy Shield - Professional Background Service Worker
class PrivacyShieldService {
  constructor() {
    this.isInitialized = false;
    this.init();
  }

  async init() {
    if (this.isInitialized) return;

    try {
      this.setupInstallationHandler();
      this.setupCommands();
      this.setupMessageHandling();
      this.setupStorageSync();
      this.setupTabHandling();
      this.isInitialized = true;
    } catch (error) {
      console.error("Privacy Shield initialization failed:", error);
    }
  }

  setupInstallationHandler() {
    chrome.runtime.onInstalled.addListener(async (details) => {
      try {
        // Initialize default settings
        const defaultSettings = {
          enabled: false,
          mode: "blur",
          blurIntensity: 8,
          maskSymbol: "*",
          theme: "light",
          shortcuts: {
            toggle: "Alt+P",
            emergency: "Alt+E",
            removeAll: "Alt+R",
          },
        };

        await chrome.storage.sync.set(defaultSettings);

        if (details.reason === "install") {
          this.showWelcomeNotification();
        }
      } catch (error) {
        console.error("Installation setup failed:", error);
      }
    });
  }

  setupCommands() {
    chrome.commands.onCommand.addListener(async (command) => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab) return;

        const commands = {
          "toggle-protection": () => this.toggleProtection(tab.id),
          "emergency-blur": () => this.emergencyBlur(tab.id),
          "remove-all": () => this.removeAllProtection(tab.id),
        };

        const action = commands[command];
        if (action) {
          await action();
        }
      } catch (error) {
        console.error("Command execution failed:", error);
      }
    });
  }

  setupMessageHandling() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      const handlers = {
        updateBadge: async () => {
          await this.updateBadge(sender.tab?.id, message.count);
          return { success: true };
        },
        showNotification: async () => {
          await this.showNotification(
            message.title,
            message.message,
            message.type
          );
          return { success: true };
        },
        getTabInfo: async () => {
          const tabInfo = await this.getTabInfo(sender.tab?.id);
          return { success: true, data: tabInfo };
        },
      };

      const handler = handlers[message.action];
      if (handler) {
        const result = await handler();
        sendResponse(result);
      } else {
        sendResponse({ success: false, error: "Unknown action" });
      }
    } catch (error) {
      console.error("Message handling error:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  setupStorageSync() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "sync") {
        this.handleStorageChanges(changes);
      }
    });
  }

  handleStorageChanges(changes) {
    this.broadcastSettingsUpdate(changes);
  }

  async broadcastSettingsUpdate(changes) {
    try {
      const tabs = await chrome.tabs.query({});
      tabs.forEach((tab) => {
        chrome.tabs
          .sendMessage(tab.id, {
            action: "settingsUpdated",
            changes,
          })
          .catch(() => {
            // Ignore errors for tabs without content script
          });
      });
    } catch (error) {
      console.error("Settings broadcast failed:", error);
    }
  }

  setupTabHandling() {
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.cleanupTab(tabId);
    });

    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.refreshTabBadge(activeInfo.tabId);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === "complete") {
        this.refreshTabBadge(tabId);
      }
    });
  }

  // Action Methods
  async toggleProtection(tabId) {
    try {
      const { enabled } = await chrome.storage.sync.get(["enabled"]);
      const newState = !enabled;

      await chrome.storage.sync.set({ enabled: newState });
      await chrome.tabs.sendMessage(tabId, {
        action: "toggle",
        enabled: newState,
      });

      this.showNotification(
        "Privacy Shield",
        newState ? "🛡️ Protection activated" : "🔓 Protection deactivated",
        newState ? "success" : "info"
      );
    } catch (error) {
      console.error("Toggle protection failed:", error);
    }
  }

  async emergencyBlur(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: "emergencyBlur" });
      this.showNotification(
        "Privacy Shield",
        "🚨 Emergency protection activated",
        "warning"
      );
    } catch (error) {
      console.error("Emergency blur failed:", error);
    }
  }

  async removeAllProtection(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: "removeAll" });
      this.showNotification(
        "Privacy Shield",
        "🧹 All protection removed",
        "success"
      );
    } catch (error) {
      console.error("Remove all protection failed:", error);
    }
  }

  // Utility Methods
  async getTabInfo(tabId) {
    if (!tabId) return null;

    try {
      const tab = await chrome.tabs.get(tabId);
      return {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        active: tab.active,
      };
    } catch (error) {
      return null;
    }
  }

  async updateBadge(tabId, count) {
    if (!tabId) return;

    const text = count > 0 ? count.toString() : "";
    const color = count > 0 ? "#4CAF50" : "#666666";

    await chrome.action.setBadgeText({ text, tabId });
    await chrome.action.setBadgeBackgroundColor({ color, tabId });
  }

  async refreshTabBadge(tabId) {
    try {
      const stats = await chrome.tabs.sendMessage(tabId, {
        action: "getStats",
      });

      if (stats && stats.totalProtected !== undefined) {
        await this.updateBadge(tabId, stats.totalProtected);
      }
    } catch (error) {
      await this.updateBadge(tabId, 0);
    }
  }

  async showNotification(title, message, type = "info") {
    const icons = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️",
    };

    try {
      await chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: `${icons[type]} ${title}`,
        message: message,
      });
    } catch (error) {
      console.log("Notification not available:", error);
    }
  }

  cleanupTab(tabId) {
    chrome.action.setBadgeText({ text: "", tabId }).catch(() => {});
  }

  showWelcomeNotification() {
    this.showNotification(
      "Privacy Shield Installed",
      "Click the extension icon to start protecting your content",
      "success"
    );
  }

  // Health check for extension
  async performHealthCheck() {
    try {
      const tabs = await chrome.tabs.query({
        url: ["http://*/*", "https://*/*"],
      });

      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: "ping" });
        } catch (error) {
          console.log(`Health check failed for tab ${tab.id}`);
        }
      }
    } catch (error) {
      console.error("Health check failed:", error);
    }
  }

  // Initialize service
  static init() {
    if (!globalThis.privacyShieldService) {
      globalThis.privacyShieldService = new PrivacyShieldService();

      // Perform health check every 5 minutes
      setInterval(() => {
        globalThis.privacyShieldService.performHealthCheck();
      }, 300000);
    }
    return globalThis.privacyShieldService;
  }
}

// Initialize the service
PrivacyShieldService.init();
