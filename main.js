const path = require("path");
const { app, BrowserWindow } = require("electron");

// ------------------------------------------------------------
// SINGLE INSTANCE LOCK (Prevents opening multiple main apps)
// ------------------------------------------------------------
const gotTheLock = app.requestSingleInstanceLock();
let mainWindow = null;

if (!gotTheLock) {
    app.quit();
} else {
    app.on("second-instance", () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // ------------------------------------------------------------
    // USER-WRITABLE ELECTRON PROFILE
    // ------------------------------------------------------------
    const ALLOWED_NAVIGATION_DOMAINS = [
      "allen.in",
      "allen.ac.in"
    ];

    function isAllowedNavigation(url) {
      try {
        const hostname = new URL(url).hostname.toLowerCase();
        return ALLOWED_NAVIGATION_DOMAINS.some(domain =>
          hostname === domain ||
          hostname.endsWith("." + domain)
        );
      } catch {
        return false;
      }
    }

    app.setPath(
        "userData",
        path.join(app.getPath("appData"), "ALLEN")
    );

    // ------------------------------------------------------------
    // CREATE WINDOW
    // ------------------------------------------------------------

    function createWindow() {
        if (mainWindow) {
            mainWindow.focus();
            return;
        }

        mainWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            show: true,
            frame: true,
            fullscreen: false,
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        mainWindow.on("closed", () => {
            mainWindow = null;
        });

        mainWindow.webContents.on("will-navigate", (event, url) => {
          if (!isAllowedNavigation(url)) {
            event.preventDefault();
          }
        });

        mainWindow.webContents.on("will-redirect", (event, url) => {
          if (!isAllowedNavigation(url)) {
            event.preventDefault();
          }
        });

        // ------------------------------------------------------------
        // MAXIMIZED — NOT FULLSCREEN
        // ------------------------------------------------------------

        mainWindow.setFullScreen(false);
        mainWindow.maximize();

        // ------------------------------------------------------------
        // CHROME USER-AGENT SPOOF
        // ------------------------------------------------------------

        mainWindow.webContents.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/152.0.7977.54 Safari/537.36"
        );

        // ------------------------------------------------------------
        // BACK / FORWARD NAVIGATION
        // ------------------------------------------------------------

        mainWindow.webContents.on("before-input-event", (event, input) => {
            if (input.type !== "keyDown") {
                return;
            }

            const isBack =
                input.key === "BrowserBack" ||
                (input.alt && (input.key === "ArrowLeft" || input.key === "Left"));

            const isForward =
                input.key === "BrowserForward" ||
                (input.alt && (input.key === "ArrowRight" || input.key === "Right"));

            if (isBack) {
                if (mainWindow.webContents.canGoBack()) {
                    mainWindow.webContents.goBack();
                }
                event.preventDefault();
                return;
            }

            if (isForward) {
                if (mainWindow.webContents.canGoForward()) {
                    mainWindow.webContents.goForward();
                }
                event.preventDefault();
            }
        });

        // ------------------------------------------------------------
        // BLOCK DISTRACTING EXTERNAL SITES
        // ------------------------------------------------------------

        const blockedDomains = [
            "youtube.com",
            "youtu.be",
            "instagram.com",
            "facebook.com",
            "reddit.com"
        ];

        mainWindow.webContents.on("will-navigate", (event, url) => {
            try {
                const host = new URL(url).hostname.toLowerCase();
                const blocked = blockedDomains.some(domain =>
                    host === domain || host.endsWith("." + domain)
                );

                if (blocked) {
                    event.preventDefault();
                }
            } catch {
                // Ignore malformed URLs.
            }
        });

        // ------------------------------------------------------------
        // ALLOW RECORDED ALLEN VIDEO & PDF CHILD WINDOWS
        // BLOCK ALL OTHER NEW WINDOWS
        // ------------------------------------------------------------

        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            try {
                const parsedURL = new URL(url);
                const host = parsedURL.hostname.toLowerCase();
                const pathname = parsedURL.pathname.toLowerCase();

                // 1. Allow the Allen video player child window
                const isRecordedAllenVideo =
                    host === "allen.in" &&
                    pathname === "/videoplayer";

                // 2. Allow the Allen PDF viewer child window
                const isAllenPdfViewer =
                    host === "allen.in" &&
                    pathname === "/pdf_viewer.html";

                if (isRecordedAllenVideo || isAllenPdfViewer) {
                    return { action: "allow" };
                }

            } catch {
                // Invalid URL -> block
            }

            // Everything else is strictly blocked.
            return { action: "deny" };
        });

        // ------------------------------------------------------------
        // LOAD ALLEN
        // ------------------------------------------------------------

        mainWindow.loadURL("https://www.allen.in/");

        // ------------------------------------------------------------
        // ALLEN LANDING / AD PAGE HANDLING
        // ------------------------------------------------------------

        mainWindow.webContents.on("did-finish-load", () => {
            mainWindow.webContents.executeJavaScript(`
                (() => {
                    if (window.__allenWrapperStarted) {
                        return;
                    }
                    window.__allenWrapperStarted = true;

                    let clickedLandingLogo = false;

                    const checkLandingPage = () => {
                        const bodyText = document.body?.innerText || "";
                        const isLandingPage =
                            bodyText.includes("Explore Courses") &&
                            !bodyText.includes("Schedule");

                        if (!isLandingPage) return;

                        const logo = document.querySelector(
                            '[data-testid="onboardingAllenLogo"]'
                        );
                        if (!logo) return;

                        const link = logo.closest("a");
                        if (!link) return;

                        if (link.getAttribute("href") !== "/") return;

                        if (!clickedLandingLogo) {
                            clickedLandingLogo = true;
                            link.click();
                        }
                    };

                    checkLandingPage();
                    window.__allenLandingInterval =
                        setInterval(checkLandingPage, 500);
                })();
            `).catch(() => {});
        });

        mainWindow.webContents.on("did-navigate", () => {
            mainWindow.webContents.executeJavaScript(`
                (() => {
                    const bodyText = document.body?.innerText || "";
                    const stillLanding =
                        bodyText.includes("Explore Courses") &&
                        !bodyText.includes("Schedule");

                    if (!stillLanding && window.__allenLandingInterval) {
                        clearInterval(window.__allenLandingInterval);
                        window.__allenLandingInterval = null;
                    }
                })();
            `).catch(() => {});
        });
    }

    // ------------------------------------------------------------
    // START ELECTRON
    // ------------------------------------------------------------

    app.whenReady().then(createWindow);

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            app.quit();
        }
    });
}
