// CodeFill Popup - Extension Interface
class PopupManager {
  constructor() {
    this.init();
  }

  async init() {
    // Check current tab and update status
    await this.updateStatus();

    // Load auto-inject setting
    await this.loadAutoInjectSetting();

    // Setup event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Open options button
    document.getElementById("openOptions").addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });

    // Auto-inject toggle
    document
      .getElementById("autoInjectToggle")
      .addEventListener("change", async (e) => {
        await this.saveAutoInjectSetting(e.target.checked);
      });
  }

  async loadAutoInjectSetting() {
    try {
      const result = await chrome.storage.sync.get(["autoInject"]);
      const autoInject = result.autoInject !== false; // Default to true
      document.getElementById("autoInjectToggle").checked = autoInject;
    } catch (error) {
      document.getElementById("autoInjectToggle").checked = true;
    }
  }

  async saveAutoInjectSetting(enabled) {
    try {
      await chrome.storage.sync.set({ autoInject: enabled });
    } catch (error) {
      // Ignore save errors
    }
  }

  async updateStatus() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) {
        this.setStatus("No active tab", "Unknown", "Not available");
        return;
      }

      // Check if on LeetCode
      const isLeetCode = tab.url && tab.url.includes("leetcode.com");
      const isProblemPage = isLeetCode && tab.url.includes("/problems/");

      if (!isLeetCode) {
        this.setStatus("Not on LeetCode", "Unknown", "Not available");
        return;
      }

      if (!isProblemPage) {
        this.setStatus(
          "LeetCode (not problem page)",
          "Unknown",
          "Not available"
        );
        return;
      }

      // On a problem page
      this.setStatus("LeetCode Problem Page", "Detecting...", "Checking...");

      // Try to get language and template info from content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: "getStatus",
        });
        if (response) {
          this.setStatus(
            "LeetCode Problem Page",
            response.language,
            response.templateStatus
          );
        }
      } catch (error) {
        // Fallback: Check templates directly from storage
        try {
          const result = await chrome.storage.sync.get(["templates"]);
          const templates = result.templates || {};

          // Default to cpp if we can't detect language
          const language = "cpp";
          const template = templates[language];
          const hasTemplate = template && template.enabled && template.code;

          this.setStatus(
            "LeetCode Problem Page",
            language,
            hasTemplate ? "Available" : "Not configured"
          );
        } catch (storageError) {
          this.setStatus(
            "LeetCode Problem Page",
            "Unknown",
            "Error checking templates"
          );
        }
      }
    } catch (error) {
      this.setStatus("Error", "Unknown", "Not available");
    }
  }

  setStatus(page, language, template) {
    document.getElementById("currentPage").textContent = page;
    document.getElementById("currentLanguage").textContent = language;
    document.getElementById("templateStatus").textContent = template;
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new PopupManager();
});
