const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path"); 

let win; 

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
  win.webContents.openDevTools();
}

// دالة سحرية تستقبل طلبات الانتقال وتفتح المسار الصحيح للملف مضغوطاً أو مفتوحاً
ipcMain.on("change-page", (event, pagePath) => {
  if (win) {
    win.loadFile(path.join(__dirname, pagePath));
  }
});

app.whenReady().then(createWindow);
