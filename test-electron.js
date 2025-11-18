const { app, BrowserWindow } = require('electron');

console.log('Testing Electron...');
console.log('app object:', typeof app);

if (app) {
  app.whenReady().then(() => {
    console.log('Electron is ready!');
    app.quit();
  });
} else {
  console.error('app is undefined!');
}