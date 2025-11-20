const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Suppress unhandled promise rejections and uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.log('Uncaught Exception:', error);
});

let tray = null;
let mainWindow = null;
let devServer = null;
let serverLogs = [];
let isLoggingEnabled = false;

const isDev = process.env.NODE_ENV === 'development';
const port = process.env.HOSTED_DEV_PORT || '5500';

function createTray() {
  // Use the cosmic raid icon
  const iconPath = path.join(__dirname, 'public', 'cosmicraid.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '🚀 Cosmic Raid - Local Services',
      enabled: false
    },
    { type: 'separator' },
    {
      label: '📱 Show Dashboard',
      click: () => {
        isLoggingEnabled = true;
        serverLogs = [`[SYS] ${new Date().toLocaleTimeString()}: Command logs ready - Cosmic Raid Local Services active`]; // Initialize with ready message
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    },
    {
      label: '🔄 Restart Services',
      click: () => {
        updateTrayStatus('restarting');
        restartDevServer();
      }
    },
    {
      label: '⏹️ Stop Services',
      click: () => {
        if (devServer) {
          devServer.kill();
          updateTrayStatus('stopped');
        }
      }
    },
    {
      label: '▶️ Start Services',
      click: () => {
        if (!devServer || devServer.killed) {
          updateTrayStatus('starting');
          startDevServer();
        }
      }
    },
    { type: 'separator' },
    {
      label: '❌ Quit Cosmic Raid',
      click: () => {
        if (devServer && !devServer.killed) {
          devServer.kill('SIGKILL');
        }
        app.quit();
        process.exit(0);
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Cosmic Raid - Local Services');
  
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Start hidden
    skipTaskbar: true, // Don't show in taskbar when hidden
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false // Prevent throttling when hidden
    },
    icon: path.join(__dirname, 'public', 'cosmicraid.png')
  });

  // Load a simple HTML page with logs
  const logHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>🚀 Cosmic Raid - Local Services Dashboard</title>
      <style>
        body { font-family: 'Courier New', monospace; background: #0f0f23; color: #00ff00; padding: 20px; }
        .header { color: #667eea; font-size: 18px; margin-bottom: 20px; }
        .logs { background: #000; padding: 15px; border-radius: 8px; height: 600px; overflow-y: auto; }
        .log-line { margin: 2px 0; }
        .error { color: #ff6b6b; }
        .system { color: #ffd93d; }
        .output { color: #00ff00; }
      </style>
    </head>
    <body>
      <div class="header">🚀 Cosmic Raid Local Services - Command Log</div>
      <div class="logs" id="logs">Starting up...</div>
      <script>
        const { ipcRenderer } = require('electron');
        setInterval(() => {
          ipcRenderer.send('get-logs');
        }, 1000);
        
        ipcRenderer.on('logs-update', (event, logs) => {
          const logsDiv = document.getElementById('logs');
          logsDiv.innerHTML = logs.map(log => {
            let className = 'output';
            if (log.includes('[ERR]')) className = 'error';
            if (log.includes('[SYS]')) className = 'system';
            return \`<div class="log-line \${className}">\${log}</div>\`;
          }).join('');
          logsDiv.scrollTop = logsDiv.scrollHeight;
        });
      </script>
    </body>
    </html>
  `;
  
  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(logHtml));

  mainWindow.on('close', (event) => {
    // Prevent closing, just hide instead
    event.preventDefault();
    mainWindow.hide();
    isLoggingEnabled = false; // Stop logging when dashboard closes
    serverLogs = []; // Clear logs to free memory
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startDevServer() {
  // Add startup log
  if (isLoggingEnabled) {
    serverLogs.push(`[SYS] ${new Date().toLocaleTimeString()}: Starting Cosmic Raid Local Services (concurrent mode)...`);
  }
  
  const env = {
    ...process.env,
    COSMICRAID_HOSTED_DEV: '1',
    PORT: port,
    ELECTRON_MODE: '1'
  };

  // Spawn concurrent startup script for minimal resource usage
  const nodeCmd = process.platform === 'win32' ? 'node' : 'node';
  devServer = spawn(
    nodeCmd,
    ['electron-startup.js'],
    {
      cwd: __dirname,
      env: {
        ...env,
        PATH: process.env.PATH + ';C:\\Program Files\\nodejs;C:\\Users\\' + require('os').userInfo().username + '\\AppData\\Roaming\\npm'
      },
      stdio: 'pipe',
      shell: true,
      windowsHide: true,
      detached: false
    }
  );
  
  devServer.stdout.on('data', (data) => {
    const log = data.toString();
    
    // Only store logs when dashboard is open
    if (isLoggingEnabled) {
      serverLogs.push(`[OUT] ${new Date().toLocaleTimeString()}: ${log}`);
      if (serverLogs.length > 100) serverLogs.shift();
    }
    
    // Always check for ready status
    if (log.includes('Ready') || log.includes('started server')) {
      updateTrayStatus('ready');
    }
  });
  
  devServer.stderr.on('data', (data) => {
    const log = data.toString();
    
    // Only store logs when dashboard is open
    if (isLoggingEnabled) {
      serverLogs.push(`[ERR] ${new Date().toLocaleTimeString()}: ${log}`);
      if (serverLogs.length > 100) serverLogs.shift();
    }
  });
  
  devServer.on('exit', (code) => {
    serverLogs.push(`[SYS] ${new Date().toLocaleTimeString()}: Process exited with code ${code}`);
    updateTrayStatus('stopped');
  });
  
  console.log('🚀 CosmicRaid booted up - running in system tray');
  console.log('You can now close this window');
  
  // Add initial system log
  if (isLoggingEnabled) {
    serverLogs.push(`[SYS] ${new Date().toLocaleTimeString()}: Local services initialized`);
  }

  devServer.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Ready') || output.includes('started server')) {
      console.log('✅ Local services ready');
      updateTrayStatus('ready');
    }
  });

  devServer.stderr.on('data', (data) => {
    console.error('Dev server error:', data.toString());
  });

  devServer.on('exit', (code) => {
    console.log(`Dev server exited with code ${code}`);
    updateTrayStatus('stopped');
  });
}

function restartDevServer() {
  if (devServer) {
    devServer.kill();
  }
  setTimeout(() => {
    startDevServer();
  }, 2000);
}

function updateTrayStatus(status) {
  if (!tray) return;
  
  const statusText = {
    ready: '🚀 Cosmic Raid - Services Running',
    stopped: '⏹️ Cosmic Raid - Services Stopped',
    starting: '⏳ Cosmic Raid - Starting Services...',
    restarting: '🔄 Cosmic Raid - Restarting Services...'
  };
  
  tray.setToolTip(statusText[status] || '🚀 Cosmic Raid - Local Services');
}

app.whenReady().then(() => {
  createTray();
  
  // Start the local dev server for Puppeteer/FFmpeg
  startDevServer();
  
  // Optionally create window (hidden by default)
  if (isDev) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  // Don't quit on macOS when all windows are closed
  // Keep running in system tray
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  console.log('[Electron] Shutting down services...');
  if (devServer && !devServer.killed) {
    // Send shutdown message to child process
    devServer.send && devServer.send({ type: 'shutdown' });
    // Force kill after 5 seconds if not responding
    setTimeout(() => {
      if (devServer && !devServer.killed) {
        devServer.kill('SIGKILL');
      }
    }, 5000);
  }
});

app.on('window-all-closed', () => {
  // Don't quit - keep running in system tray
  // This ensures minimal resource usage for long-term running
});

// Handle IPC for logs
ipcMain.on('get-logs', (event) => {
  event.reply('logs-update', serverLogs);
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
}