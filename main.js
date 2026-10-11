const path = require("path");
const { app, BrowserWindow, shell } = require("electron");

// ------------------------------------------------------------
// APPLICATION PROFILING & REGISTRATION
// ------------------------------------------------------------
const ALLOWED_NAVIGATION_DOMAINS = [
  "pw.live",
  "physicswallah.live",
  "pwskills.com"
];

function isAllowedNavigation(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return ALLOWED_NAVIGATION_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith("." + domain)
    );
  } catch {
    return false;
  }
}

// Stores logins/sessions isolated under Physics Wallah instead of ALLEN
app.setPath(
    "userData",
    path.join(app.getPath("appData"), "PhysicsWallah")
);

// ------------------------------------------------------------
// CREATE APPLICATION CANVAS
// ------------------------------------------------------------
function createWindow() {
    const win = new BrowserWindow({
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

    // Maximize on initial window load
    win.setFullScreen(false);
    win.maximize();

    // ------------------------------------------------------------
    // CHROME USER-AGENT SPOOF (Ensures HD Video Streaming Compatibility)
    // ------------------------------------------------------------
    win.webContents.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36"
    );

    // ------------------------------------------------------------
    // BACK / FORWARD SHORTCUT ENGINE
    // Alt + Left = Back | Alt + Right = Forward
    // ------------------------------------------------------------
    win.webContents.on("before-input-event", (event, input) => {
        if (input.type !== "keyDown") return;

        const isBack =
            input.key === "BrowserBack" ||
            (input.alt && (input.key === "ArrowLeft" || input.key === "Left"));

        const isForward =
            input.key === "BrowserForward" ||
            (input.alt && (input.key === "ArrowRight" || input.key === "Right"));

        if (isBack) {
            if (win.webContents.canGoBack()) win.webContents.goBack();
            event.preventDefault();
            return;
        }

        if (isForward) {
            if (win.webContents.canGoForward()) win.webContents.goForward();
            event.preventDefault();
        }
    });

    // ------------------------------------------------------------
    // INTERNAL APPLICATION ROUTING SECURITY
    // ------------------------------------------------------------
    win.webContents.on("will-navigate", (event, url) => {
        if (!isAllowedNavigation(url)) {
            event.preventDefault();
        }
    });

    win.webContents.on("will-redirect", (event, url) => {
        if (!isAllowedNavigation(url)) {
            event.preventDefault();
        }
    });

    // ------------------------------------------------------------
    // OPEN WINDOW / LINK CLICKS HANDLER
    // ------------------------------------------------------------
    win.webContents.setWindowOpenHandler(({ url }) => {
        // If the clicked link is an internal classroom link, allow it to spawn a child window
        if (isAllowedNavigation(url)) {
            return { action: "allow" };
        }
        
        // Push general distraction links or support links completely out to your default desktop browser
        shell.openExternal(url);
        return { action: "deny" };
    });

    // ------------------------------------------------------------
    // TARGET INTERACTION DASHBOARD
    // ------------------------------------------------------------
    win.loadURL("https://pw.live");
}

// Start compilation process
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
