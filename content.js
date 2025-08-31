// CodeFill - LeetCode Template Injector
// Automatically injects code templates on LeetCode problem pages

class CodeFillInjector {
  constructor() {
    this.isInjected = false;
    this.isInjecting = false;
    this.observer = null;
    this.checkInterval = null;
    this.templates = {};
    this.injectionAttempts = 0;
    this.maxAttempts = 5;
    this.autoInjectEnabled = true;
    this.init();
  }

  async init() {
    await this.loadTemplates();
    await this.loadSettings();
    this.setupNavigationListener();
    this.setupStorageListener();

    // Add delay before creating inject button to let page load
    setTimeout(() => {
      this.createInjectButton(); // create fallback + attempt to place into editor
    }, 2000); // 2 second delay

    this.waitForEditor();
  }

  async loadSettings() {
    try {
      const result = await new Promise((resolve) =>
        chrome.storage.sync.get(["autoInject"], resolve)
      );
      this.autoInjectEnabled = result.autoInject !== false;
    } catch (error) {
      this.autoInjectEnabled = true;
    }
  }

  async loadTemplates() {
    try {
      const result = await new Promise((resolve) =>
        chrome.storage.sync.get(["templates"], resolve)
      );
      this.templates = result.templates || {};
      this.updateButtonState();
    } catch (error) {
      this.templates = {};
    }
  }

  softReset() {
    this.isInjected = false;
    this.isInjecting = false;
    this.injectionAttempts = 0;
    this.cleanup();
  }

  resetInjectionState({ removeButton = true } = {}) {
    this.isInjected = false;
    this.isInjecting = false;
    this.injectionAttempts = 0;
    this.cleanup();
    if (removeButton) this.removeInjectButton();
  }

  setupStorageListener() {
    // Listen for storage changes to update settings in real-time
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "sync") {
        if (changes.autoInject) {
          this.autoInjectEnabled = changes.autoInject.newValue !== false;
        }
        if (changes.templates) {
          this.templates = changes.templates.newValue || {};
          this.updateButtonState();
        }
      }
    });
  }

  setupNavigationListener() {
    let currentUrl = window.location.href;
    const checkUrlChange = () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.resetInjectionState();
        setTimeout(() => {
          this.waitForEditor();
          // Add longer delay for button creation after navigation
          setTimeout(() => this.createInjectButton(), 1500);
        }, 700);
      }
    };
    setInterval(checkUrlChange, 1000);
    window.addEventListener("popstate", () => {
      this.resetInjectionState();
      setTimeout(() => {
        this.waitForEditor();
        // Add longer delay for button creation after popstate navigation
        setTimeout(() => this.createInjectButton(), 1500);
      }, 700);
    });
  }

  createInjectButton() {
    // Create only once: remove if present
    this.removeInjectButton();

    // Ensure CSS styles exist
    if (!document.getElementById("codefill-styles")) {
      const style = document.createElement("style");
      style.id = "codefill-styles";
      style.textContent = `
        #codefill-inject-btn {
          color: white !important;
          border: none !important;
          border-radius: 50% !important;
          padding: 6px !important;
          font-size: 16px !important;
          cursor: pointer !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
          transition: transform 0.12s ease !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          width: 36px !important;
          height: 36px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          pointer-events: auto !important;
        }
        #codefill-inject-btn:hover { transform: translateY(-2px) !important; }
        #codefill-inject-wrapper { z-index: 100000 !important; pointer-events: auto !important; }
        #codefill-inject-btn:disabled { opacity: 0.7 !important; cursor: not-allowed !important; }
      `;
      document.head.appendChild(style);
    }

    // Create wrapper (fallback to body fixed)
    const wrapper = document.createElement("div");
    wrapper.id = "codefill-inject-wrapper";
    wrapper.style.position = "fixed";
    wrapper.style.top = "2px";
    wrapper.style.right = "17px";
    wrapper.style.zIndex = "100000";
    wrapper.style.pointerEvents = "auto";
    wrapper.style.width = "40px";
    wrapper.style.height = "40px";
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.justifyContent = "center";

    const button = document.createElement("button");
    button.id = "codefill-inject-btn";
    button.innerHTML = "🚀";
    button.title = "Inject Template";
    button.addEventListener("click", () => this.manualInject());

    wrapper.appendChild(button);
    document.body.appendChild(wrapper);

    // Try to place inside editor immediately
    this.placeButtonInEditor();

    // Keep trying for a short while (handles late loads)
    this.setupButtonRepositioning();

    this.updateButtonState();
  }

  // Periodically attempt to move the wrapper to the Monaco editor while the page is still loading
  setupButtonRepositioning() {
    const start = Date.now();
    const iv = setInterval(() => {
      try {
        this.placeButtonInEditor();
      } catch (e) {}
      if (Date.now() - start > 20000) clearInterval(iv);
    }, 1200);
  }

  removeInjectButton() {
    const wrapper = document.getElementById("codefill-inject-wrapper");
    if (wrapper) {
      // revert any host position change if necessary
      const parent = wrapper.parentElement;
      if (
        parent &&
        parent.getAttribute &&
        parent.getAttribute("data-codefill-pos-changed") === "1"
      ) {
        parent.style.position = "";
        parent.removeAttribute("data-codefill-pos-changed");
      }
      wrapper.remove();
      return;
    }
    const existingButton = document.getElementById("codefill-inject-btn");
    if (existingButton) existingButton.remove();
  }

  updateButtonState() {
    const button = document.getElementById("codefill-inject-btn");
    if (!button) return;

    const language = this.getCurrentLanguage();
    const template =
      this.templates[language] || this.templates[language.toLowerCase()];
    const hasTemplate = template && template.enabled && template.code;

    if (hasTemplate) {
      button.style.display = "inline-flex";
      button.innerHTML = "🚀";
      button.title = "Inject Template";
      button.style.background =
        "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)";
      button.disabled = false;
    } else {
      button.innerHTML = "🚫";
      button.title = "No Template Available";
      button.style.background =
        "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)";
      button.disabled = true;
    }
  }

  async manualInject() {
    const button = document.getElementById("codefill-inject-btn");
    if (button) {
      button.innerHTML = "⏳";
      button.title = "Injecting...";
      button.disabled = true;
    }

    const editorElement = this.findMonacoEditor();
    if (editorElement) delete editorElement.dataset.templateInjected;
    this.softReset();
    this.isInjected = false;

    const success = await this.injectTemplate();

    if (button) {
      button.disabled = false;
      if (success) {
        button.innerHTML = "✅";
        button.title = "Template Injected";
        button.style.background =
          "linear-gradient(135deg, #10b981 0%, #059669 100%)";
        setTimeout(() => {
          this.isInjected = false;
          this.updateButtonState();
        }, 1200);
      } else {
        this.updateButtonState();
      }
    }
    return success;
  }

  waitForEditor(onReady) {
    const editor = this.findMonacoEditor();
    if (editor) {
      setTimeout(() => {
        if (onReady) onReady(); // only create button after editor exists
        this.placeButtonInEditor();
        this.updateButtonState();
      }, 600);
      if (this.autoInjectEnabled) this.scheduleInjection(500);
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      if (this.isInjected || this.isInjecting) return;
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          const ed = this.findMonacoEditor();
          if (ed) {
            setTimeout(() => {
              if (onReady) onReady(); // create button now
              this.placeButtonInEditor();
              this.updateButtonState();
            }, 800);
            if (this.autoInjectEnabled) this.scheduleInjection(1000);
            this.cleanup();
            break;
          }
        }
      }
    });

    this.observer.observe(document.body, { childList: true, subtree: true });

    this.checkInterval = setInterval(() => {
      if (this.isInjected || this.isInjecting) {
        clearInterval(this.checkInterval);
        return;
      }
      const ed = this.findMonacoEditor();
      if (ed) {
        setTimeout(() => {
          if (onReady) onReady(); // create button here too
          this.placeButtonInEditor();
          this.updateButtonState();
        }, 600);
        if (this.autoInjectEnabled) this.scheduleInjection(500);
        this.cleanup();
      }
    }, 2000);

    setTimeout(() => this.cleanup(), 30000);
  }

  scheduleInjection(delay) {
    if (this.isInjected || this.isInjecting) {
      return;
    }
    if (!this.autoInjectEnabled) {
      this.updateButtonState();
      return;
    }

    this.injectionAttempts++;
    if (this.injectionAttempts > this.maxAttempts) {
      return;
    }
    setTimeout(() => {
      if (!this.isInjected && !this.isInjecting) {
        this.injectTemplate();
      }
    }, delay);
  }

  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Move wrapper into the editor container and position absolute top-right
  placeButtonInEditor() {
    const wrapper = document.getElementById("codefill-inject-wrapper");
    if (!wrapper) return;

    const editor = this.findMonacoEditor();
    if (editor) {
      const host =
        editor.classList && editor.classList.contains("monaco-editor")
          ? editor
          : editor.closest && editor.closest(".monaco-editor")
          ? editor.closest(".monaco-editor")
          : editor;

      if (host && wrapper.parentElement !== host) {
        // revert previous host style if changed
        const prev = wrapper.parentElement;
        if (
          prev &&
          prev.getAttribute &&
          prev.getAttribute("data-codefill-pos-changed") === "1"
        ) {
          prev.style.position = "";
          prev.removeAttribute("data-codefill-pos-changed");
        }

        // ensure host is positioned
        try {
          const computed = window.getComputedStyle(host);
          if (computed.position === "static" || !computed.position) {
            host.style.position = "relative";
            host.setAttribute("data-codefill-pos-changed", "1");
          }
        } catch (e) {}

        wrapper.style.position = "absolute";
        wrapper.style.top = "2px";
        wrapper.style.right = "17px";
        wrapper.style.margin = "0";
        wrapper.style.width = "40px";
        wrapper.style.height = "40px";
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.justifyContent = "center";

        host.appendChild(wrapper);
        this.updateButtonState();
      }
    } else {
      // no editor -> ensure wrapper is on body
      if (wrapper.parentElement !== document.body) {
        const prev = wrapper.parentElement;
        if (
          prev &&
          prev.getAttribute &&
          prev.getAttribute("data-codefill-pos-changed") === "1"
        ) {
          prev.style.position = "";
          prev.removeAttribute("data-codefill-pos-changed");
        }
        document.body.appendChild(wrapper);
      }
      wrapper.style.position = "fixed";
      wrapper.style.top = "2px";
      wrapper.style.right = "17px";
    }
  }

  // Find the monaco editor container reliably
  findMonacoEditor() {
    const container = document.querySelector(".monaco-editor");
    if (container) return container;

    const viewLines = document.querySelector(".view-lines");
    if (viewLines) return viewLines.closest(".monaco-editor") || viewLines;

    const ta = document.querySelector("textarea.inputarea");
    if (ta) return ta.closest(".monaco-editor") || ta;

    return null;
  }

  getCurrentLanguage() {
    const languageButton = document.querySelector(
      'button[aria-haspopup="dialog"]'
    );
    if (languageButton) {
      const languageText = languageButton.textContent.trim();
      if (languageText) return this.normalizeLanguageName(languageText);
    }

    const editorContainer = document.querySelector("[data-mode-id]");
    if (editorContainer)
      return this.normalizeLanguageName(
        editorContainer.getAttribute("data-mode-id")
      );

    const codeElement = document.querySelector(".view-lines .view-line");
    if (codeElement) {
      const codeContent = codeElement.textContent;
      if (
        codeContent.includes("#include") ||
        codeContent.includes("using namespace")
      )
        return "cpp";
      if (
        codeContent.includes("import java") ||
        codeContent.includes("class Solution")
      )
        return "java";
      if (/\bdef\b/.test(codeContent) || codeContent.includes("import "))
        return "python";
    }

    const url = window.location.href;
    if (url.includes("lang=")) {
      const match = url.match(/lang=([^&]+)/);
      if (match) return this.normalizeLanguageName(match[1]);
    }

    return "cpp";
  }

  normalizeLanguageName(language) {
    if (!language) return "cpp";
    const map = {
      "C++": "cpp",
      cpp: "cpp",
      "c++": "cpp",
      C: "c",
      c: "c",
      Java: "java",
      java: "java",
      Python: "python",
      Python3: "python",
      python: "python",
      JavaScript: "javascript",
      javascript: "javascript",
      TypeScript: "typescript",
      typescript: "typescript",
      Go: "go",
      go: "go",
      Rust: "rust",
      rust: "rust",
      "C#": "csharp",
      csharp: "csharp",
    };
    return map[language] || language.toLowerCase();
  }

  // comment prefix helper
  commentPrefixForLanguage(lang) {
    switch ((lang || "").toLowerCase()) {
      case "python":
      case "ruby":
      case "r":
        return "#";
      case "html":
      case "xml":
        return "<!--";
      default:
        return "//";
    }
  }

  extractCodeFromViewLines() {
    const viewLines = document.querySelector(".view-lines");
    if (!viewLines) return null;
    const lines = viewLines.querySelectorAll(".view-line");
    const codeLines = [];
    for (const line of lines) {
      let lineText = "";
      const spans = line.querySelectorAll("span");
      for (const span of spans) lineText += span.textContent || "";
      codeLines.push(lineText);
    }
    return codeLines.join("\n");
  }

  hasTemplateMarkers(code, lang) {
    if (!code) return false;
    const prefix = this.commentPrefixForLanguage(lang);
    const startMarker = `${prefix} __LC_TEMPLATE_START__::${lang}`;
    const endMarker = `${prefix} __LC_TEMPLATE_END__::${lang}`;
    return code.includes(startMarker) && code.includes(endMarker);
  }

  wrapTemplateWithMarkers(code, lang) {
    const prefix = this.commentPrefixForLanguage(lang);
    const start = `${prefix} __LC_TEMPLATE_START__::${lang}`;
    const end = `${prefix} __LC_TEMPLATE_END__::${lang}`;
    const cleaned = code.replace(/\r\n/g, "\n").replace(/\s+$/g, "");
    return `${start}\n${cleaned}\n${end}\n\n`;
  }

  escapeForRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  applyTemplateToContent(currentContent, templateCode, lang, position = "top") {
    const startMarker = `${this.commentPrefixForLanguage(
      lang
    )} __LC_TEMPLATE_START__::${lang}`;
    const endMarker = `${this.commentPrefixForLanguage(
      lang
    )} __LC_TEMPLATE_END__::${lang}`;
    const startEsc = this.escapeForRegex(startMarker);
    const endEsc = this.escapeForRegex(endMarker);
    const blockRegex = new RegExp(`${startEsc}[\\s\\S]*?${endEsc}`, "m");
    const newBlock = this.wrapTemplateWithMarkers(templateCode, lang);

    if (blockRegex.test(currentContent)) {
      return currentContent
        .replace(blockRegex, newBlock)
        .replace(/\n{3,}/g, "\n\n");
    } else {
      if (position === "bottom") {
        return (currentContent.trimEnd() + "\n\n" + newBlock).replace(
          /\n{3,}/g,
          "\n\n"
        );
      } else {
        return (newBlock + currentContent.trimStart()).replace(
          /\n{3,}/g,
          "\n\n"
        );
      }
    }
  }

  isDefaultStub(content, lang) {
    if (!content) return true;
    const trimmed = content.trim();
    if (!trimmed) return true;
    if (trimmed.includes("__LC_TEMPLATE_START__::")) return false;
    if (trimmed.length < 60) return true;
    const lower = trimmed.toLowerCase();

    if (lang === "cpp" || lang === "java" || lang === "csharp") {
      if (lower.includes("class solution") && trimmed.length < 2000)
        return true;
      const braceRatio =
        (trimmed.match(/[{}]/g) || []).length / Math.max(1, trimmed.length);
      if (braceRatio > 0.02 && trimmed.length < 1200) return true;
    }

    if (lang === "python") {
      if (
        (lower.includes("class solution") || /\bdef\b/.test(lower)) &&
        trimmed.length < 1500
      )
        return true;
      if (trimmed.split("\n").length <= 10 && /\bclass\b/.test(lower))
        return true;
    }

    if (lang === "javascript" || lang === "typescript") {
      if (
        (lower.includes("module.exports") ||
          lower.includes("export default")) &&
        trimmed.length < 1200
      )
        return true;
    }

    if (
      /todo|pass|\/\/\s*write|\/\*\s*write/i.test(trimmed) &&
      trimmed.length < 2000
    )
      return true;
    return false;
  }

  async waitForStableEditorContent(
    editor,
    stableChecks = 4,
    interval = 250,
    timeout = 8000
  ) {
    const getVal = () =>
      typeof editor.getValue === "function"
        ? editor.getValue()
        : editor.getText
        ? editor.getText()
        : "";
    let last = getVal();
    let stable = 0;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      await new Promise((r) => setTimeout(r, interval));
      const cur = getVal();
      if (cur === last) {
        stable++;
        if (stable >= stableChecks) return cur;
      } else {
        last = cur;
        stable = 0;
      }
    }
    return last;
  }

  // The injection routine (keeps all previous safeguards + dedupe)
  async injectTemplate() {
    if (this.isInjecting) {
      return false;
    }
    this.isInjecting = true;

    const language = this.getCurrentLanguage();
    const templateObj =
      this.templates[language] || this.templates[language.toLowerCase()];

    if (!templateObj || !templateObj.enabled) {
      this.isInjecting = false;
      return false;
    }
    const templateCode = templateObj.code || "";
    const position = templateObj.position || "top";

    try {
      const editorElement = this.findMonacoEditor();
      if (!editorElement) {
        this.isInjecting = false;
        return false;
      }

      if (
        editorElement.dataset.templateInjected === `${language}` &&
        !templateObj.forceReinject
      ) {
        this.isInjected = true;
        this.isInjecting = false;
        return true;
      }

      const editor = this.getMonacoEditorInstance(editorElement);
      if (!editor) {
        this.isInjecting = false;
        return false;
      }

      // WAIT until editor content stabilizes
      const currentContent = await this.waitForStableEditorContent(
        editor,
        4,
        250,
        8000
      );
      const viewLinesContent = this.extractCodeFromViewLines();
      const actualContent = currentContent || viewLinesContent || "";

      // Abort if ANY one of the template markers is present
      const prefix = this.commentPrefixForLanguage(language);
      const startMarker = `${prefix} __LC_TEMPLATE_START__::${language}`;
      const endMarker = `${prefix} __LC_TEMPLATE_END__::${language}`;

      const startPresent = actualContent.includes(startMarker);
      const endPresent = actualContent.includes(endMarker);

      if (startPresent || endPresent) {
        this.isInjecting = false;
        this.cleanup();
        this.updateButtonState();
        return false;
      }

      if (this.hasTemplateMarkers(actualContent, language)) {
        editorElement.dataset.templateInjected = `${language}`;
        this.isInjected = true;
        this.isInjecting = false;
        this.cleanup();
        this.updateButtonState();
        return true;
      }

      if (this.isDefaultStub(actualContent, language)) {
        const onlyTemplateContent =
          this.wrapTemplateWithMarkers(templateCode, language).trim() + "\n\n";
        if (typeof editor.setValue === "function") {
          editor.setValue(onlyTemplateContent);
        } else {
          const ta = editorElement.querySelector("textarea.inputarea");
          if (ta) {
            ta.value = onlyTemplateContent;
            ta.dispatchEvent(new Event("input", { bubbles: true }));
          } else {
            this.isInjecting = false;
            return false;
          }
        }

        // position cursor
        try {
          const templateLines = templateCode.split("\n").length;
          if (typeof editor.setPosition === "function") {
            editor.setPosition({ lineNumber: templateLines + 2, column: 1 });
            if (typeof editor.focus === "function") editor.focus();
          } else {
            const ta = editorElement.querySelector("textarea.inputarea");
            if (ta) {
              let charPos = 0;
              const lines = onlyTemplateContent.split("\n");
              for (let i = 0; i < templateLines + 1 && i < lines.length; i++)
                charPos += lines[i].length + 1;
              ta.focus();
              ta.setSelectionRange(charPos, charPos);
            }
          }
        } catch (posError) {
          // Ignore cursor positioning errors
        }

        editorElement.dataset.templateInjected = `${language}`;
        this.isInjected = true;
        this.isInjecting = false;
        this.cleanup();
        this.updateButtonState();
        return true;
      }

      // Normal insertion/replace behavior
      const newContent = this.applyTemplateToContent(
        actualContent,
        templateCode,
        language,
        position
      );

      if (newContent === actualContent) {
        editorElement.dataset.templateInjected = `${language}`;
        this.isInjected = true;
        this.isInjecting = false;
        this.cleanup();
        this.updateButtonState();
        return true;
      }

      // Re-read live to avoid races
      const liveBefore =
        typeof editor.getValue === "function"
          ? editor.getValue()
          : this.extractCodeFromViewLines() || "";
      if (this.hasTemplateMarkers(liveBefore, language)) {
        editorElement.dataset.templateInjected = `${language}`;
        this.isInjected = true;
        this.isInjecting = false;
        this.cleanup();
        this.updateButtonState();
        return true;
      }

      // Try to use Monaco model edits if available (atomic), fallback to setValue
      let wrote = false;
      try {
        if (
          editor &&
          typeof editor.getModel === "function" &&
          window.monaco &&
          window.monaco.Range
        ) {
          const model = editor.getModel();
          let fullRange;
          if (typeof model.getFullModelRange === "function") {
            fullRange = model.getFullModelRange();
          } else {
            const lastLine = model.getLineCount();
            const lastCol = model.getLineMaxColumn(lastLine);
            fullRange = new window.monaco.Range(1, 1, lastLine, lastCol);
          }
          model.pushEditOperations(
            [],
            [{ range: fullRange, text: newContent }],
            () => null
          );
          await new Promise((r) => setTimeout(r, 120));
          wrote = true;
        }
      } catch (monacoErr) {
        // Fallback to setValue if Monaco atomic replace fails
      }

      if (!wrote) {
        if (typeof editor.setValue === "function") {
          editor.setValue(newContent);
        } else {
          const ta = editorElement.querySelector("textarea.inputarea");
          if (ta) {
            ta.value = newContent;
            ta.dispatchEvent(new Event("input", { bubbles: true }));
          } else {
            this.isInjecting = false;
            return false;
          }
        }
      }

      // small delay to allow page/editor handlers to react
      await new Promise((r) => setTimeout(r, 220));

      // Dedupe multiple template blocks if any
      try {
        const prefixLocal = this.commentPrefixForLanguage(language);
        const startMarkerLocal = `${prefixLocal} __LC_TEMPLATE_START__::${language}`;
        const endMarkerLocal = `${prefixLocal} __LC_TEMPLATE_END__::${language}`;
        const startEscLocal = this.escapeForRegex(startMarkerLocal);
        const endEscLocal = this.escapeForRegex(endMarkerLocal);
        const blockRegexGlobal = new RegExp(
          `${startEscLocal}[\\s\\S]*?${endEscLocal}`,
          "gm"
        );

        const liveAfter =
          typeof editor.getValue === "function"
            ? editor.getValue()
            : this.extractCodeFromViewLines() || "";
        const matches = liveAfter.match(blockRegexGlobal) || [];
        if (matches.length > 1) {
          const newBlock = this.wrapTemplateWithMarkers(templateCode, language);
          const cleaned = liveAfter.replace(blockRegexGlobal, newBlock);
          if (typeof editor.setValue === "function") {
            editor.setValue(cleaned);
          } else {
            const ta2 = editorElement.querySelector("textarea.inputarea");
            if (ta2) {
              ta2.value = cleaned;
              ta2.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }
        }
      } catch (dedupeErr) {
        // Ignore dedupe errors
      }

      // position cursor after template
      try {
        const templateLines = templateCode.split("\n").length;
        if (typeof editor.setPosition === "function") {
          editor.setPosition({ lineNumber: templateLines + 2, column: 1 });
          if (typeof editor.focus === "function") editor.focus();
        } else {
          const ta = editorElement.querySelector("textarea.inputarea");
          if (ta) {
            let charPos = 0;
            const lines = newContent.split("\n");
            for (let i = 0; i < templateLines + 1 && i < lines.length; i++)
              charPos += lines[i].length + 1;
            ta.focus();
            ta.setSelectionRange(charPos, charPos);
          }
        }
      } catch (posError) {
        // Ignore cursor positioning errors
      }

      editorElement.dataset.templateInjected = `${language}`;
      this.isInjected = true;
      this.isInjecting = false;
      this.cleanup();
      this.updateButtonState();
      return true;
    } catch (error) {
      this.isInjecting = false;
      this.updateButtonState();
      return false;
    }
  }

  // getMonacoEditorInstance (unchanged, robust fallbacks)
  getMonacoEditorInstance(element) {
    if (element._monacoEditor) return element._monacoEditor;
    let curr = element;
    while (curr && curr !== document.body) {
      if (curr._monacoEditor) return curr._monacoEditor;
      curr = curr.parentElement;
    }

    if (window.monaco && window.monaco.editor) {
      try {
        const editors =
          typeof window.monaco.editor.getEditors === "function"
            ? window.monaco.editor.getEditors()
            : [];
        if (Array.isArray(editors) && editors.length > 0) {
          const focused = editors.find(
            (e) => typeof e.hasTextFocus === "function" && e.hasTextFocus()
          );
          return focused || editors[0];
        }
      } catch (e) {}
    }

    try {
      const textarea = element.querySelector("textarea.inputarea");
      if (textarea) {
        textarea.focus();
        if (window.monaco && window.monaco.editor) {
          const editors =
            typeof window.monaco.editor.getEditors === "function"
              ? window.monaco.editor.getEditors()
              : [];
          return (
            editors.find(
              (editor) => editor.hasTextFocus && editor.hasTextFocus()
            ) ||
            editors[0] ||
            null
          );
        }
      }
    } catch (error) {
      // Ignore errors in finding editor through textarea
    }

    const ta = element.querySelector("textarea.inputarea");
    if (ta) {
      return {
        getValue: () => ta.value,
        setValue: (value) => {
          ta.value = value;
          ta.dispatchEvent(new Event("input", { bubbles: true }));
        },
        setPosition: (position) => {
          const lines = ta.value.split("\n");
          let charPosition = 0;
          for (let i = 0; i < position.lineNumber - 1 && i < lines.length; i++)
            charPosition += lines[i].length + 1;
          charPosition += position.column - 1;
          ta.focus();
          ta.setSelectionRange(charPosition, charPosition);
        },
        focus: () => ta.focus(),
      };
    }
    return null;
  }
}

// message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const injector = window.leetCodeInjector;
  if (!injector) return sendResponse({ success: false });

  if (request.action === "getStatus") {
    const language = injector.getCurrentLanguage();
    const template =
      injector.templates[language] ||
      injector.templates[language.toLowerCase()];
    const templateStatus =
      template && template.enabled ? "Enabled" : "Disabled";
    const canInject = !!(template && template.enabled && !injector.isInjected);
    return sendResponse({ language, templateStatus, canInject });
  }

  if (request.action === "injectTemplate") {
    const editorElement = injector.findMonacoEditor();
    if (editorElement) delete editorElement.dataset.templateInjected;
    injector.softReset();
    injector.injectTemplate().then((result) => {
      injector.updateButtonState();
      sendResponse({ success: result });
    });
    return true;
  }
});

// init
let injector;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    injector = new CodeFillInjector();
    window.leetCodeInjector = injector;
  });
} else {
  injector = new CodeFillInjector();
  window.leetCodeInjector = injector;
}
