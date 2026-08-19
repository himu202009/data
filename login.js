/* ============================================================
   Login page logic.
   The password itself lives in config.js (SITE_CONFIG.auth.password)
   — this file just reads it and compares it. No backend, no
   database: it's a simple client-side gate.
   ============================================================ */

(function () {
    "use strict";

    var cfg = (typeof SITE_CONFIG !== "undefined" && SITE_CONFIG.auth) ? SITE_CONFIG.auth : {};
    var CORRECT_PASSWORD = cfg.password || "hahahihi";
    var STORAGE_KEY = "sp_authenticated";
    var THEME_KEY = "theme";

    var form = document.getElementById("login-form");
    var passwordInput = document.getElementById("password-input");
    var passwordField = document.getElementById("password-field");
    var errorEl = document.getElementById("login-error");
    var rememberBox = document.getElementById("remember-me");
    var toggleBtn = document.getElementById("toggle-password");
    var themeToggle = document.getElementById("theme-toggle");

    // ---------- apply editable text from config.js ----------
    function applyText() {
        if (!cfg) return;
        setText("login-heading", cfg.heading);
        setText("login-subtitle", cfg.subtitle);
        setText("login-submit-label", cfg.submitLabel);
        setText("remember-me-label", cfg.rememberMeLabel);
        if (cfg.passwordPlaceholder) passwordInput.placeholder = cfg.passwordPlaceholder;
    }

    function setText(id, value) {
        if (!value) return;
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // ---------- theme toggle (mirrors the main site) ----------
    function applyStoredTheme() {
        var stored = null;
        try { stored = localStorage.getItem(THEME_KEY); } catch (e) {}
        var theme = stored || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        setTheme(theme);
    }

    function setTheme(theme) {
        if (theme === "dark") {
            document.documentElement.setAttribute("data-theme", "dark");
            themeToggle.setAttribute("aria-pressed", "true");
            themeToggle.setAttribute("aria-label", "Switch to light mode");
        } else {
            document.documentElement.removeAttribute("data-theme");
            themeToggle.setAttribute("aria-pressed", "false");
            themeToggle.setAttribute("aria-label", "Switch to dark mode");
        }
    }

    if (themeToggle) {
        themeToggle.addEventListener("click", function () {
            var isDark = document.documentElement.getAttribute("data-theme") === "dark";
            var next = isDark ? "light" : "dark";
            setTheme(next);
            try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
        });
    }

    // ---------- show / hide password ----------
    if (toggleBtn) {
        toggleBtn.addEventListener("click", function () {
            var showing = toggleBtn.getAttribute("aria-pressed") === "true";
            var next = !showing;
            passwordInput.type = next ? "text" : "password";
            toggleBtn.setAttribute("aria-pressed", String(next));
            toggleBtn.setAttribute("aria-label", next ? "Hide password" : "Show password");
        });
    }

    // ---------- submit ----------
    function showError(message) {
        errorEl.textContent = message || (cfg.wrongPasswordText || "Incorrect password. Please try again.");
        passwordField.classList.remove("shake");
        // restart the animation
        void passwordField.offsetWidth;
        passwordField.classList.add("shake");
    }

    function redirectAfterLogin() {
        var params = new URLSearchParams(window.location.search);
        var target = params.get("redirect") || "index.html";
        window.location.replace(target);
    }

    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            var entered = passwordInput.value;

            if (entered === CORRECT_PASSWORD) {
                errorEl.textContent = "";
                try {
                    sessionStorage.setItem(STORAGE_KEY, "true");
                    if (rememberBox && rememberBox.checked) {
                        localStorage.setItem(STORAGE_KEY, "true");
                    }
                } catch (err) {}
                redirectAfterLogin();
            } else {
                showError();
                passwordInput.value = "";
                passwordInput.focus();
            }
        });
    }

    applyStoredTheme();
    applyText();
})();
