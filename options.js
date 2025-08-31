// CodeFill Options - Template Manager
class TemplateManager {
  constructor() {
    this.templates = {};
    this.currentLanguage = "cpp";
    this._previousLanguage = null;
    this.init();
  }

  async init() {
    this.initDarkMode();
    await this.loadTemplates();
    this.setupEventListeners();
    // ensure previousLanguage is initialized
    this._previousLanguage = this.currentLanguage;
    this.loadLanguageTemplate();
    this.updateLineNumbers();
  }

  initDarkMode() {
    const savedTheme = localStorage.getItem("darkMode");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const isDark =
      savedTheme === "true" || (savedTheme === null && prefersDark);

    if (isDark) {
      document.documentElement.setAttribute("data-theme", "dark");
      const toggle = document.getElementById("darkModeToggle");
      if (toggle) toggle.checked = true;
    }
  }

  setupEventListeners() {
    // Dark mode toggle
    const darkToggle = document.getElementById("darkModeToggle");
    if (darkToggle) {
      darkToggle.addEventListener("change", (e) =>
        this.toggleDarkMode(e.target.checked)
      );
    }

    // Language selector - SAVE current language before switching
    const langSelect = document.getElementById("languageSelect");
    if (langSelect) {
      langSelect.addEventListener("change", (e) => {
        // Save current language's edits before switching
        this.saveCurrentTemplateToMemory();

        // Update current language
        this._previousLanguage = this.currentLanguage;
        this.currentLanguage = e.target.value;

        // Load the new language template (without double-saving)
        this.loadLanguageTemplateOnly();

        // Force line numbers update after language change
        setTimeout(() => {
          this.updateLineNumbers();
        }, 50);
      });
    }

    // Enable toggle
    const enableCheckbox = document.getElementById("enableTemplate");
    if (enableCheckbox) {
      enableCheckbox.addEventListener("change", (e) => {
        this.updateTemplateEnabled(e.target.checked);
      });
    }

    // Template textarea
    const textarea = document.getElementById("templateCode");
    if (textarea) {
      textarea.addEventListener("input", (e) => {
        this.updateTemplateCode(e.target.value);
        requestAnimationFrame(() => this.updateLineNumbers());
      });

      textarea.addEventListener("scroll", () => this.syncLineNumbers());

      // Keyboard handling (tab & shift+tab)
      textarea.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          if (e.shiftKey) {
            // Unindent current line if possible
            const before = textarea.value.substring(0, start);
            const lineStart = before.lastIndexOf("\n") + 1;
            if (textarea.value.substring(lineStart, lineStart + 4) === "    ") {
              textarea.value =
                textarea.value.substring(0, lineStart) +
                textarea.value.substring(lineStart + 4);
              textarea.selectionStart = Math.max(start - 4, lineStart);
              textarea.selectionEnd = Math.max(end - 4, lineStart);
            } else if (
              textarea.value.substring(lineStart, lineStart + 1) === "\t"
            ) {
              textarea.value =
                textarea.value.substring(0, lineStart) +
                textarea.value.substring(lineStart + 1);
              textarea.selectionStart = Math.max(start - 1, lineStart);
              textarea.selectionEnd = Math.max(end - 1, lineStart);
            }
          } else {
            // Insert 4 spaces
            const before = textarea.value.substring(0, start);
            const after = textarea.value.substring(end);
            textarea.value = before + "    " + after;
            textarea.selectionStart = textarea.selectionEnd = start + 4;
          }

          // push change into memory and update numbers
          this.updateTemplateCode(textarea.value);
          requestAnimationFrame(() => this.updateLineNumbers());
        }
      });

      // Keep line numbers in sync on window resize
      window.addEventListener("resize", () => this.updateLineNumbers());
    }

    // Save button
    const saveBtn = document.getElementById("saveTemplate");
    if (saveBtn) saveBtn.addEventListener("click", () => this.saveTemplates());

    // Feedback button
    const feedbackBtn = document.getElementById("feedbackBtn");
    if (feedbackBtn) {
      feedbackBtn.addEventListener("click", () => {
        window.open(
          "https://docs.google.com/forms/d/e/1FAIpQLSd0iz4Vb8_46YUwMoPemA-atX5lMd0qe7HhKKUBt86OY9y8Ag/viewform?usp=sharing&ouid=108233983843022228610",
          "_blank"
        );
      });
    }

    // Rate us button
    const rateBtn = document.getElementById("rateBtn");
    if (rateBtn) {
      rateBtn.addEventListener("click", () => {
        window.open(
          "https://chromewebstore.google.com/detail/jdnjifbbcldnpjemeffkbkolgillmjgd?utm_source=item-share-cb",
          "_blank"
        );
      });
    }

    // Save current language template before unloading page
    window.addEventListener("beforeunload", () => {
      this.saveCurrentTemplateToMemory();
      // Try best-effort sync save (non-blocking)
      chrome &&
        chrome.storage &&
        chrome.storage.sync &&
        chrome.storage.sync.set &&
        chrome.storage.sync.set({ templates: this.templates }, () => {});
    });
  }

  toggleDarkMode(isDark) {
    if (isDark) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("darkMode", "true");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("darkMode", "false");
    }
  }

  updateLineNumbers() {
    const textarea = document.getElementById("templateCode");
    const lineNumbers = document.getElementById("lineNumbers");
    if (!textarea || !lineNumbers) return;

    // ensure monospace font for better alignment
    textarea.style.fontFamily = textarea.style.fontFamily || "monospace";
    lineNumbers.style.whiteSpace = "pre";
    lineNumbers.style.textAlign = "right";

    // Copy font-size and line-height from textarea for alignment
    const cs = window.getComputedStyle(textarea);
    const fontSize = cs.fontSize || "14px";
    let lineHeight = cs.lineHeight;
    if (!lineHeight || lineHeight === "normal") {
      // fallback: approximate using font-size
      const sizeNum = parseFloat(fontSize);
      lineHeight = Math.round(sizeNum * 1.4) + "px";
    }
    lineNumbers.style.fontSize = fontSize;
    lineNumbers.style.lineHeight = lineHeight;
    lineNumbers.style.fontFamily = cs.fontFamily;

    // Make lineNumbers height match textarea visible area
    lineNumbers.style.height = textarea.clientHeight + "px";
    lineNumbers.style.overflow = "hidden"; // hide its own scrollbars

    // Build line numbers content
    const lines = textarea.value.split("\n");
    const lineCount = Math.max(lines.length, 1);
    let lineNumbersHtml = "";
    for (let i = 1; i <= lineCount; i++) {
      lineNumbersHtml += i + (i < lineCount ? "\n" : "");
    }
    lineNumbers.textContent = lineNumbersHtml;

    // Sync scrolling offset (mirror textarea)
    this.syncLineNumbers();
  }

  syncLineNumbers() {
    const textarea = document.getElementById("templateCode");
    const lineNumbers = document.getElementById("lineNumbers");
    if (!textarea || !lineNumbers) return;

    // Mirror vertical offset by using scrollTop (works if line-height matches)
    lineNumbers.scrollTop = textarea.scrollTop;
    // Mirror horizontal offset so long lines align
    lineNumbers.scrollLeft = textarea.scrollLeft;
  }

  // Save the currently shown template fields into this.templates for the currentLanguage
  saveCurrentTemplateToMemory() {
    const textarea = document.getElementById("templateCode");
    const enabled = document.getElementById("enableTemplate")?.checked || false;
    const code = textarea ? textarea.value : "";

    if (!this.templates[this.currentLanguage]) {
      this.templates[this.currentLanguage] = {
        enabled: enabled,
        code: code,
      };
    } else {
      this.templates[this.currentLanguage].enabled = enabled;
      this.templates[this.currentLanguage].code = code;
    }
  }

  async loadTemplates() {
    try {
      const result = await new Promise((resolve) =>
        chrome.storage.sync.get(["templates"], resolve)
      );
      this.templates = result.templates || {};
    } catch (error) {
      this.showStatus("Error loading templates", "error");
      this.templates = {};
    }
  }

  async saveTemplates() {
    try {
      // Ensure current edits are saved into memory before persisting
      this.saveCurrentTemplateToMemory();
      await new Promise((resolve) =>
        chrome.storage.sync.set({ templates: this.templates }, resolve)
      );
      this.showStatus("Templates saved successfully!", "success");
    } catch (error) {
      this.showStatus("Error saving templates", "error");
    }
  }

  loadLanguageTemplate() {
    // Persist current edits first to avoid losing them when switching
    if (
      this._previousLanguage &&
      this._previousLanguage !== this.currentLanguage
    ) {
      this.saveCurrentTemplateToMemory();
    }

    this.loadLanguageTemplateOnly();
  }

  loadLanguageTemplateOnly() {
    const template = this.templates[this.currentLanguage] || {
      enabled: false,
      code: "",
    };

    // Update UI
    const enableCheckbox = document.getElementById("enableTemplate");
    if (enableCheckbox) enableCheckbox.checked = !!template.enabled;

    const textarea = document.getElementById("templateCode");
    if (textarea) {
      textarea.value = template.code || "";
      // ensure caret at start
      textarea.selectionStart = textarea.selectionEnd = 0;
    }

    // Always update line numbers after changing language
    this.updateLineNumbers();

    // Also update after a short delay to ensure everything is rendered
    setTimeout(() => {
      this.updateLineNumbers();
    }, 10);
  }

  updateTemplateEnabled(enabled) {
    if (!this.templates[this.currentLanguage]) {
      this.templates[this.currentLanguage] = {
        enabled: enabled,
        code: "",
      };
    } else {
      this.templates[this.currentLanguage].enabled = enabled;
    }
  }

  updateTemplateCode(code) {
    if (!this.templates[this.currentLanguage]) {
      this.templates[this.currentLanguage] = {
        enabled: false,
        code: code,
      };
    } else {
      this.templates[this.currentLanguage].code = code;
    }
  }

  showStatus(message, type = "info") {
    const statusElement = document.getElementById("statusMessage");
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    setTimeout(() => {
      statusElement.textContent = "";
      statusElement.className = "status-message";
    }, 3000);
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.templateManager = new TemplateManager();
});
