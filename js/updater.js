/* ============================================================
   ODYSSEY — js/updater.js
   Mandatory In-App Live Update client:
   - Uses window.AndroidUpdater inside the APK (or fetch fallback in browser)
   - Shows update status on the home screen
   - Blocks starting/continuing the game whenever an update is required
   ============================================================ */

const $ = (id) => document.getElementById(id);

function parseJSONSafe(str, fallback = null) {
  try {
    return typeof str === "string" ? JSON.parse(str) : str;
  } catch {
    return fallback;
  }
}

export const Updater = {
  state: {
    bundledBuild: 2,
    installedBuild: 2,
    installedVersion: "1.2.0",
    installedHash: "",
    pendingBuild: 0,
    pendingVersion: "",
    pendingNotes: "",
    pendingHash: "",
    manifestUrl: "https://raw.githubusercontent.com/SwarupRock/ODYSSEY/main/version.json",
  },
  locked: false,
  checking: false,
  downloading: false,
  onLockChange: null,

  init(onLockChange) {
    this.onLockChange = onLockChange || null;
    this._readNativeState();
    this.locked = this._hasPending();

    window.__odysseyUpdaterEvent = (ev) => this._handleNativeEvent(ev);
    window.odysseyCheckUpdate = (manual = false) => this.check(manual);

    const btnCheck = $("btn-check-update");
    if (btnCheck) {
      btnCheck.addEventListener("click", () => this.check(true));
    }
    const btnNow = $("btn-update-now");
    if (btnNow) {
      btnNow.addEventListener("click", () => this.startDownload());
    }
    const btnRetry = $("btn-update-retry");
    if (btnRetry) {
      btnRetry.addEventListener("click", () => {
        if (this.locked) this.startDownload();
        else this.check(true);
      });
    }

    this.render();
    // Auto-check shortly after title renders so startup stays snappy
    setTimeout(() => this.check(false), 350);
  },

  _readNativeState() {
    if (window.AndroidUpdater && window.AndroidUpdater.getState) {
      const info = parseJSONSafe(window.AndroidUpdater.getState());
      if (info) Object.assign(this.state, info);
      return;
    }
    // Browser / PWA fallback: remember local version tag if cached
    try {
      const saved = parseJSONSafe(localStorage.getItem("odyssey-ota-pending"));
      if (saved && saved.build > this.state.installedBuild) {
        this.state.pendingBuild = saved.build;
        this.state.pendingVersion = saved.version || "";
        this.state.pendingNotes = saved.notes || "";
        this.state.pendingHash = saved.hash || "";
      }
    } catch {}
  },

  _hasPending() {
    const s = this.state;
    if (s.pendingBuild > s.installedBuild) return true;
    if (s.pendingHash && s.installedHash && s.pendingHash !== s.installedHash) return true;
    return false;
  },

  isLocked() {
    return this.locked || this._hasPending();
  },

  setLocked(on) {
    this.locked = !!on;
    if (this.onLockChange) this.onLockChange(this.locked);
    this.render();
  },

  async check(manual = false) {
    if (this.checking || this.downloading) return;
    this.checking = true;
    this._setStatusText(manual ? "Checking for updates…" : "Checking version…");

    if (window.AndroidUpdater && window.AndroidUpdater.checkUpdate) {
      window.AndroidUpdater.checkUpdate(this.state.manifestUrl || "");
      return;
    }

    // Browser fallback (non-APK): fetch version.json directly with cache-bust
    try {
      const res = await fetch("./version.json?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const remote = await res.json();
      const needs = Number(remote.build) > this.state.installedBuild ||
        (remote.hash && this.state.installedHash && remote.hash !== this.state.installedHash);
      if (needs) {
        this._handleNativeEvent({
          type: "status",
          status: "update_available",
          remoteBuild: remote.build,
          remoteVersion: remote.version,
          notes: remote.notes || "",
          hash: remote.hash || "",
        });
      } else {
        this._handleNativeEvent({ type: "status", status: "up_to_date" });
      }
    } catch {
      this._handleNativeEvent({ type: "status", status: "offline" });
    }
  },

  startDownload() {
    if (this.downloading) return;
    this.downloading = true;
    this._setModalError("");
    this.render();

    if (window.AndroidUpdater && window.AndroidUpdater.startUpdate) {
      window.AndroidUpdater.startUpdate(this.state.manifestUrl || "");
      return;
    }

    // Web/PWA fallback: bust service worker caches and reload
    this._handleNativeEvent({ type: "progress", done: 1, total: 1, file: "Refreshing cache…" });
    setTimeout(async () => {
      try {
        localStorage.removeItem("odyssey-ota-pending");
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {}
      location.reload();
    }, 350);
  },

  _handleNativeEvent(ev) {
    if (!ev || !ev.type) return;
    if (ev.type === "status") {
      this.checking = false;
      if (ev.installedBuild) {
        this.state.installedBuild = ev.installedBuild;
        this.state.installedVersion = ev.installedVersion || this.state.installedVersion;
        this.state.installedHash = ev.installedHash || this.state.installedHash;
      }
      if (ev.status === "update_available") {
        this.state.pendingBuild = ev.remoteBuild || (this.state.installedBuild + 1);
        this.state.pendingVersion = ev.remoteVersion || "New";
        this.state.pendingNotes = ev.notes || "A new update is ready to install.";
        this.state.pendingHash = ev.hash || "";
        this._setStatusText(`Update v${this.state.pendingVersion} required!`);
        this.setLocked(true);
      } else if (ev.status === "up_to_date") {
        this.state.pendingBuild = 0;
        this.state.pendingVersion = "";
        this.state.pendingHash = "";
        this._setStatusText("Up to date");
        this.setLocked(false);
      } else {
        // Offline or unreachable: lock only if an update was already discovered previously
        const stillPending = this._hasPending();
        this._setStatusText(stillPending ? "Update required (offline)" : "Offline · Bundled v" + this.state.installedVersion);
        this.setLocked(stillPending);
      }
      return;
    }

    if (ev.type === "progress") {
      const done = ev.done || 0;
      const total = Math.max(1, ev.total || 1);
      const pct = Math.min(100, Math.round((done / total) * 100));
      const fill = $("update-progress-fill");
      const label = $("update-progress-label");
      if (fill) fill.style.width = pct + "%";
      if (label) label.textContent = `Downloading ${ev.file || "files"} (${done}/${total}) · ${pct}%`;
      return;
    }

    if (ev.type === "error") {
      this.downloading = false;
      this.checking = false;
      this._setModalError(ev.message || "Download failed — check connection and retry.");
      this.render();
      return;
    }

    if (ev.type === "complete") {
      this.downloading = false;
      this.state.installedBuild = ev.build || this.state.pendingBuild || this.state.installedBuild;
      this.state.installedVersion = ev.version || this.state.pendingVersion || this.state.installedVersion;
      this.state.pendingBuild = 0;
      this.state.pendingVersion = "";
      this.state.pendingHash = "";
      this.locked = false;
      const fill = $("update-progress-fill");
      const label = $("update-progress-label");
      if (fill) fill.style.width = "100%";
      if (label) label.textContent = "Update installed! Launching…";
      try {
        const cur = (typeof window !== "undefined" && window.__odysseyCurrentIdx !== undefined)
          ? window.__odysseyCurrentIdx : -1;
        if (cur >= 0) {
          localStorage.setItem("odyssey-resume-after-update", String(cur));
        }
      } catch {}
      setTimeout(() => {
        if (window.AndroidUpdater && window.AndroidUpdater.reloadApp) {
          window.AndroidUpdater.reloadApp();
        } else {
          location.reload();
        }
      }, 300);
    }
  },

  _setStatusText(txt) {
    const el = $("update-status-text");
    if (el) el.textContent = txt;
  },

  _setModalError(txt) {
    const el = $("update-error-text");
    if (el) {
      el.textContent = txt;
      el.classList.toggle("hidden", !txt);
    }
    const retry = $("btn-update-retry");
    if (retry) retry.classList.toggle("hidden", !txt);
  },

  render() {
    const verEl = $("app-version-label");
    if (verEl) verEl.textContent = `v${this.state.installedVersion} · Build ${this.state.installedBuild}`;

    const locked = this.isLocked();
    const banner = $("home-update-alert");
    if (banner) {
      banner.classList.toggle("hidden", !locked);
      const bt = $("home-update-alert-text");
      if (bt && locked) {
        bt.textContent = `Mandatory update v${this.state.pendingVersion || "new"} (Build ${this.state.pendingBuild || "?"}) available — update to play`;
      }
    }

    // Lock primary play/navigation buttons when mandatory update is pending
    for (const id of ["btn-new-game", "btn-continue", "btn-chapters", "btn-armory"]) {
      const btn = $(id);
      if (!btn) continue;
      btn.disabled = locked;
      btn.classList.toggle("btn-locked", locked);
    }

    const modal = $("update-modal");
    if (modal) {
      modal.classList.toggle("hidden", !locked);
      const ver = $("update-target-ver");
      if (ver) {
        ver.textContent = `v${this.state.installedVersion} (Build ${this.state.installedBuild}) → v${this.state.pendingVersion || "?"} (Build ${this.state.pendingBuild || "?"})`;
      }
      const notes = $("update-notes-text");
      if (notes) notes.textContent = this.state.pendingNotes || "New update ready — install to continue playing ODYSSEY.";

      const nowBtn = $("btn-update-now");
      const progWrap = $("update-progress-wrap");
      if (nowBtn) {
        nowBtn.disabled = this.downloading;
        nowBtn.classList.toggle("hidden", this.downloading);
      }
      if (progWrap) progWrap.classList.toggle("hidden", !this.downloading);
    }
  },
};
