(function registerManualMosaicWorkshop() {
  "use strict";

  class ManualMosaicWorkshop extends HTMLElement {
    async connectedCallback() {
      if (this.shadowRoot || this.dataset.loading === "true") return;
      this.dataset.loading = "true";

      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<p class="loading" role="status">正在加载手动马赛克工具…</p>`;

      try {
        const response = await fetch("./manual-mosaic.html");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const source = await response.text();
        const parsed = new DOMParser().parseFromString(source, "text/html");
        const style = parsed.querySelector("style")?.textContent || "";
        const script = [...parsed.querySelectorAll("script")].at(-1)?.textContent || "";
        const content = [...parsed.body.children]
          .filter(element => element.tagName !== "SCRIPT")
          .map(element => element.outerHTML)
          .join("");

        const scopedStyle = style
          .replace(/:root/g, ":host")
          .replace(/html\.is-embedded/g, ":host")
          .replace(/html/g, ":host")
          .replace(/body/g, ".workshop-root");

        root.innerHTML = `
          <style>
            :host { display: block; color: var(--text, oklch(0.245 0.035 263)); }
            ${scopedStyle}
            .workshop-root {
              min-height: 0;
              padding: 0;
              background: transparent;
              color: inherit;
              font-family: inherit;
            }
            .workshop-root::before,
            .workshop-root::after { display: none; }
            .app-header { max-width: none; padding: 24px 24px 18px; align-items: center; }
            .header-copy h1 { font-size: 1.375rem; letter-spacing: 0; }
            main { max-width: none; padding: 0 24px 28px; }
            .top-deck, .gallery-area, .inspector { box-shadow: 0 8px 24px rgb(23 32 51 / 0.055); }
            .settings-line {
              display: grid;
              grid-template-columns: minmax(0, 1fr);
              gap: 16px;
            }
            .preset-row {
              grid-template-columns: repeat(6, minmax(72px, 1fr));
              gap: 8px;
            }
            .preset-button {
              min-height: 52px;
              padding: 8px 6px;
              white-space: nowrap;
            }
            .custom-group { min-width: 0; }
            .custom-group .number-row {
              justify-content: flex-start;
            }
            .custom-group .number-field {
              flex: 0 1 112px;
            }
            @media (max-width: 640px) {
              .app-header { padding-inline: 16px; }
              main { padding-inline: 16px; }
              .preset-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              .custom-group .number-row { flex-wrap: wrap; }
              .gallery-head {
                align-items: stretch;
                flex-direction: column;
              }
              .gallery-actions {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }
              .gallery-actions button { width: 100%; }
            }
          </style>
          <div class="workshop-root">${content}</div>
        `;

        const componentScript = script
          .replaceAll("document.getElementById", "root.getElementById")
          .replace(/\n\s*const embedded = new URLSearchParams[\s\S]*?window\.addEventListener\("load", reportHeight, \{ once: true \}\);\n\s*\}/, "");
        new Function("root", componentScript)(root);
      } catch (error) {
        root.innerHTML = `<p class="loading error" role="alert">手动马赛克工具加载失败，请刷新页面重试。</p>`;
        console.error("Manual mosaic workshop failed to initialize", error);
      }
    }
  }

  customElements.define("manual-mosaic-workshop", ManualMosaicWorkshop);
})();
