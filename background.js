// Privacy Shield - Enhanced Background Service Worker
class BackgroundService {
  constructor() {
    this.contextMenuId = "privacy-shield-context-menu";
    this.init();
  }

  init() {
    this.setupInstallation();
    this.setupContextMenus();
    this.setupCommands();
    this.setupMessageHandling();
    this.setupStorageSync();
    this.setupTabHandling();
  }

  setupInstallation() {
    chrome.runtime.onInstalled.addListener((details) => {

      // Set default settings
      const defaultSettings = {
        enabled: false,
        mode: "blur",
        blurIntensity: 8,
        maskSymbol: "*",
        autoDisable: true,
        shortcuts: {
          toggle: "Alt+P",
          emergency: "Alt+E",
          removeAll: "Alt+R",
        },
      };

      chrome.storage.sync.set(defaultSettings);

      // Show welcome notification on first install
      if (details.reason === "install") {
        this.showWelcomeNotification();
      }

      // Update context menus
      this.createContextMenus();
    });
  }

  setupContextMenus() {
    this.createContextMenus();
  }

  createContextMenus() {
    // Remove existing context menus
    chrome.contextMenus.removeAll(() => {
      // Main context menu
      chrome.contextMenus.create({
        id: this.contextMenuId,
        title: "Privacy Shield",
        contexts: ["page", "selection", "image", "video"],
      });

      // Sub-menus
      chrome.contextMenus.create({
        id: "toggle-protection",
        parentId: this.contextMenuId,
        title: "Toggle Protection",
        contexts: ["page"],
      });

      chrome.contextMenus.create({
        id: "protect-selection",
        parentId: this.contextMenuId,
        title: "Protect Selected Text",
        contexts: ["selection"],
      });

      chrome.contextMenus.create({
        id: "emergency-blur",
        parentId: this.contextMenuId,
        title: "Emergency Blur All",
        contexts: ["page"],
      });

      chrome.contextMenus.create({
        id: "remove-all",
        parentId: this.contextMenuId,
        title: "Remove All Protection",
        contexts: ["page"],
      });

      chrome.contextMenus.create({
        id: "separator1",
        parentId: this.contextMenuId,
        type: "separator",
        contexts: ["page"],
      });

      // Mode selection sub-menus
      chrome.contextMenus.create({
        id: "mode-blur",
        parentId: this.contextMenuId,
        title: "🌫️ Blur Mode",
        type: "radio",
        checked: true,
        contexts: ["page"],
      });

      chrome.contextMenus.create({
        id: "mode-mask",
        parentId: this.contextMenuId,
        title: "✱ Mask Mode",
        type: "radio",
        contexts: ["page"],
      });

      chrome.contextMenus.create({
        id: "mode-pixelate",
        parentId: this.contextMenuId,
        title: "⬛ Pixelate Mode",
        type: "radio",
        contexts: ["page"],
      });

      chrome.contextMenus.create({
        id: "mode-blackout",
        parentId: this.contextMenuId,
        title: "⚫ Blackout Mode",
        type: "radio",
        contexts: ["page"],
      });
    });

    // Handle context menu clicks
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });
  }

  async handleContextMenuClick(info, tab) {
    try {
      switch (info.menuItemId) {
        case "toggle-protection":
          await this.toggleProtection(tab.id);
          break;

        case "protect-selection":
          await this.protectSelection(tab.id);
          break;

        case "emergency-blur":
          await this.emergencyBlur(tab.id);
          break;

        case "remove-all":
          await this.removeAllProtection(tab.id);
          break;

        case "mode-blur":
        case "mode-mask":
        case "mode-pixelate":
        case "mode-blackout":
          await this.changeMode(tab.id, info.menuItemId.replace("mode-", ""));
          break;
      }
    } catch (error) {
      console.error("Context menu action failed:", error);
    }
  }

  setupCommands() {
    chrome.commands.onCommand.addListener(async (command) => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab) return;

        switch (command) {
          case "toggle-protection":
            await this.toggleProtection(tab.id);
            break;

          case "emergency-blur":
            await this.emergencyBlur(tab.id);
            break;

          case "remove-all":
            await this.removeAllProtection(tab.id);
            break;
        }
      } catch (error) {
        console.error("Command execution failed:", error);
      }
    });
  }

  setupMessageHandling() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case "getTabInfo":
          const tabInfo = await this.getTabInfo(sender.tab?.id);
          sendResponse({ success: true, data: tabInfo });
          break;

        case "updateBadge":
          await this.updateBadge(sender.tab?.id, message.count);
          sendResponse({ success: true });
          break;

        case "showNotification":
          await this.showNotification(
            message.title,
            message.message,
            message.type
          );
          sendResponse({ success: true });
          break;

        case "logActivity":
          await this.logActivity(message.activity);
          sendResponse({ success: true });
          break;

        default:
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
    // Update context menu states when mode changes
    if (changes.mode) {
      const newMode = changes.mode.newValue;
      this.updateContextMenuMode(newMode);
    }

    // Sync settings across tabs
    this.broadcastSettingsUpdate(changes);
  }

  updateContextMenuMode(mode) {
    const modes = ["blur", "mask", "pixelate", "blackout"];

    modes.forEach((m) => {
      chrome.contextMenus.update(`mode-${m}`, {
        checked: m === mode,
      });
    });
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
    // Clean up when tabs are closed
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.cleanupTab(tabId);
    });

    // Update badge when tab becomes active
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.refreshTabBadge(activeInfo.tabId);
    });

    // Handle tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete") {
        this.refreshTabBadge(tabId);
      }
    });
  }

  // Action methods
  async toggleProtection(tabId) {
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
  }

  async protectSelection(tabId) {
    await chrome.tabs.sendMessage(tabId, {
      action: "protectSelection",
    });
  }

  async emergencyBlur(tabId) {
    await chrome.tabs.sendMessage(tabId, {
      action: "emergencyBlur",
    });

    this.showNotification(
      "Privacy Shield Pro",
      "🚨 Emergency protection activated",
      "emergency"
    );
  }

  async removeAllProtection(tabId) {
    await chrome.tabs.sendMessage(tabId, {
      action: "removeAll",
    });

    this.showNotification(
      "Privacy Shield Pro",
      "🧹 All protection removed",
      "success"
    );
  }

  async changeMode(tabId, mode) {
    const { blurIntensity, maskSymbol } = await chrome.storage.sync.get([
      "blurIntensity",
      "maskSymbol",
    ]);

    await chrome.storage.sync.set({ mode });

    await chrome.tabs.sendMessage(tabId, {
      action: "changeMode",
      mode,
      blurIntensity,
      maskSymbol,
    });

    const modeNames = {
      blur: "🌫️ Blur Effect",
      mask: "✱ Character Mask",
      pixelate: "⬛ Pixelate",
      blackout: "⚫ Blackout",
    };

    this.showNotification(
      "Privacy Shield Pro",
      `Mode: ${modeNames[mode]}`,
      "info"
    );
  }

  // Utility methods
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
      // Content script not ready or not applicable
      await this.updateBadge(tabId, 0);
    }
  }

  async showNotification(title, message, type = "info") {
    const icons = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️",
      emergency: "🚨",
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

  async logActivity(activity) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      ...activity,
      timestamp,
    };

    try {
      const { activityLog = [] } = await chrome.storage.local.get([
        "activityLog",
      ]);
      activityLog.push(logEntry);

      // Keep only last 100 entries
      if (activityLog.length > 100) {
        activityLog.splice(0, activityLog.length - 100);
      }

      await chrome.storage.local.set({ activityLog });
    } catch (error) {
      console.error("Activity logging failed:", error);
    }
  }

  cleanupTab(tabId) {
    // Clear badge for closed tab
    chrome.action.setBadgeText({ text: "", tabId }).catch(() => {});

    // Clear any tab-specific storage
    this.clearTabStorage(tabId);
  }

  async clearTabStorage(tabId) {
    try {
      const { tabData = {} } = await chrome.storage.local.get(["tabData"]);
      delete tabData[tabId];
      await chrome.storage.local.set({ tabData });
    } catch (error) {
      console.error("Tab storage cleanup failed:", error);
    }
  }

  showWelcomeNotification() {
    this.showNotification(
      "Privacy Shield Pro Installed!",
      "Click the extension icon to start protecting your content",
      "success"
    );
  }

  // Analytics and usage tracking (privacy-focused)
  async trackUsage(action, details = {}) {
    try {
      const { usageStats = {} } = await chrome.storage.local.get([
        "usageStats",
      ]);

      const today = new Date().toDateString();
      if (!usageStats[today]) {
        usageStats[today] = {};
      }

      if (!usageStats[today][action]) {
        usageStats[today][action] = 0;
      }

      usageStats[today][action]++;

      // Keep only last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      Object.keys(usageStats).forEach((date) => {
        if (new Date(date) < thirtyDaysAgo) {
          delete usageStats[date];
        }
      });

      await chrome.storage.local.set({ usageStats });
    } catch (error) {
      console.error("Usage tracking failed:", error);
    }
  }

  // Performance monitoring
  async monitorPerformance() {
    setInterval(async () => {
      try {
        const tabs = await chrome.tabs.query({});
        const activeTabs = tabs.filter((tab) => tab.url.startsWith("http"));

        if (activeTabs.length > 10) {
          console.warn("High tab count detected:", activeTabs.length);
        }

        // Check memory usage if available
        if (chrome.system && chrome.system.memory) {
          const memInfo = await chrome.system.memory.getInfo();
          if (memInfo.availableCapacity < 1000000000) {
            // Less than 1GB
            console.warn("Low memory detected");
          }
        }
      } catch (error) {
        console.error("Performance monitoring failed:", error);
      }
    }, 60000); // Check every minute
  }

  // Auto-update settings migration
  async migrateSettings() {
    try {
      const { version } = await chrome.storage.sync.get(["version"]);
      const currentVersion = chrome.runtime.getManifest().version;

      if (version !== currentVersion) {
        await this.performMigration(version, currentVersion);
        await chrome.storage.sync.set({ version: currentVersion });
      }
    } catch (error) {
      console.error("Settings migration failed:", error);
    }
  }

  async performMigration(fromVersion, toVersion) {
    console.log(`Migrating from ${fromVersion} to ${toVersion}`);

    // Add migration logic here as needed
    // For example, adding new default settings or converting old formats

    const { settings } = await chrome.storage.sync.get(["settings"]);
    if (settings) {
      // Migrate old settings format if needed
      const migratedSettings = this.convertOldSettings(settings);
      await chrome.storage.sync.set(migratedSettings);
    }
  }

  convertOldSettings(oldSettings) {
    // Convert old settings format to new format
    // This is a placeholder for future migrations
    return oldSettings;
  }

  // Health check for content scripts
  async performHealthCheck() {
    try {
      const tabs = await chrome.tabs.query({
        url: ["http://*/*", "https://*/*"],
      });

      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: "healthCheck" });
        } catch (error) {
          // Content script not responding, might need reinjection
          console.log(`Health check failed for tab ${tab.id}`);
        }
      }
    } catch (error) {
      console.error("Health check failed:", error);
    }
  }

  // Initialize background service
  static init() {
    if (!globalThis.backgroundService) {
      globalThis.backgroundService = new BackgroundService();

      // Start performance monitoring
      globalThis.backgroundService.monitorPerformance();

      // Perform health check every 5 minutes
      setInterval(() => {
        globalThis.backgroundService.performHealthCheck();
      }, 300000);

      // Migrate settings if needed
      globalThis.backgroundService.migrateSettings();
    }

    return globalThis.backgroundService;
  }
}

// Initialize the background service
BackgroundService.init();
