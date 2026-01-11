import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { autoUpdater } from 'electron-updater';
import { processFile, convertToFormat } from './fileProcessor';
import { callLLM, processHomework, ProcessStepResult, HomeworkProcessResult, editContent } from './services/llmService';

let mainWindow: BrowserWindow | null = null;

// 检测当前平台
const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

function createWindow() {
  // 根据平台设置窗口选项
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#ffffff',
    show: false, // 先不显示，等页面加载完成后再显示
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  };

  // Mac 特有的标题栏样式
  if (isMac) {
    windowOptions.titleBarStyle = 'hiddenInset';
  }

  // Windows 特有设置
  if (isWin) {
    windowOptions.frame = true; // 使用系统标准窗口框架
    windowOptions.autoHideMenuBar = true; // 自动隐藏菜单栏
  }

  mainWindow = new BrowserWindow(windowOptions);

  // 监听页面加载完成
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('页面加载完成');
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // 监听页面加载错误
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('页面加载失败:', {
      errorCode,
      errorDescription,
      url: validatedURL,
    });
    
    // 如果是开发模式且连接失败，显示错误信息
    if (process.env.NODE_ENV === 'development' && errorCode === -106) {
      mainWindow?.webContents.executeJavaScript(`
        document.body.innerHTML = \`
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: -apple-system, sans-serif;">
            <h1 style="color: #ff3b30;">无法连接到开发服务器</h1>
            <p style="color: #86868b; margin: 16px 0;">错误代码: ${errorCode}</p>
            <p style="color: #86868b;">请确保 Vite 开发服务器正在运行在 http://localhost:5173</p>
            <p style="color: #86868b; margin-top: 8px;">正在尝试重新加载...</p>
          </div>
        \`;
      `);
      
      // 3秒后重试
      setTimeout(() => {
        if (mainWindow) {
          mainWindow.reload();
        }
      }, 3000);
    }
  });

  // 监听控制台消息
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[Console ${level}]:`, message);
  });

  // 判断是否为开发模式：检查是否打包运行
  // app.isPackaged 在打包后的应用中为 true
  const isDev = !app.isPackaged;
  
  if (isDev) {
    console.log('开发模式：尝试加载 http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173').catch((err) => {
      console.error('加载 URL 失败:', err);
    });
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式：index.html 在 dist 目录下，与 main.js 同级
    const indexPath = path.join(__dirname, 'index.html');
    console.log('生产模式：加载本地文件', indexPath);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ==================== 自动更新配置 ====================
function setupAutoUpdater() {
  // 仅在打包后的应用中启用自动更新
  if (!app.isPackaged) {
    console.log('开发模式：跳过自动更新检查');
    return;
  }

  // 配置日志
  autoUpdater.logger = console;

  // 检查更新出错
  autoUpdater.on('error', (error) => {
    console.error('更新检查失败:', error);
  });

  // 检查更新中
  autoUpdater.on('checking-for-update', () => {
    console.log('正在检查更新...');
  });

  // 有可用更新
  autoUpdater.on('update-available', (info) => {
    console.log('发现新版本:', info.version);
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 ${info.version}，正在后台下载...`,
        buttons: ['确定']
      });
    }
  });

  // 没有可用更新
  autoUpdater.on('update-not-available', () => {
    console.log('当前已是最新版本');
  });

  // 下载进度
  autoUpdater.on('download-progress', (progress) => {
    console.log(`下载进度: ${Math.round(progress.percent)}%`);
  });

  // 下载完成
  autoUpdater.on('update-downloaded', (info) => {
    console.log('更新下载完成:', info.version);
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '更新已就绪',
        message: `新版本 ${info.version} 已下载完成，是否立即重启应用以完成更新？`,
        buttons: ['立即重启', '稍后']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    }
  });

  // 启动时检查更新
  autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(() => {
  // 注册自定义协议来处理本地图片
  protocol.handle('work2word-local', async (request) => {
    try {
      // 从 URL 中提取文件名
      const url = request.url;
      const fileName = url.replace('work2word-local://', '');

      // 构建图片的完整路径
      const documentsPath = app.getPath('documents');
      const imagePath = path.join(documentsPath, 'Work2Word_Assets', 'images', fileName);

      // 检查文件是否存在
      try {
        await fs.access(imagePath, fsConstants.R_OK);
      } catch {
        // 文件不存在，返回 404
        return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
      }

      // 读取图片文件
      const imageBuffer = await fs.readFile(imagePath);

      // 根据文件扩展名确定 MIME 类型
      const ext = path.extname(fileName).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
      };
      const contentType = mimeTypes[ext] || 'image/png';

      // 返回图片数据
      return new Response(imageBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (error) {
      console.error('加载本地图片失败:', error);
      return new Response('Internal Server Error', { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  });

  createWindow();
  
  // 启动自动更新检查
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('process-file', async (_, filePath: string) => {
  try {
    const content = await processFile(filePath);
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('call-llm', async (_, prompt: string, fileContent: string, llmConfig: any) => {
  try {
    const result = await callLLM(prompt, fileContent, llmConfig);
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 新增：分步处理作业接口
ipcMain.handle('process-homework-steps', async (_, prompt: string, fileContent: string, llmConfig: any) => {
  try {
    const result = await processHomework(prompt, fileContent, llmConfig);
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 新增：编辑内容接口 (Copilot 风格)
ipcMain.handle('edit-content', async (_, instruction: string, currentContent: string, llmConfig: any) => {
  try {
    const result = await editContent(instruction, currentContent, llmConfig);
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 新增：保存调试数据接口
ipcMain.handle('save-debug-data', async (_, data: ProcessStepResult, filename: string) => {
  try {
    // 获取用户文档目录
    const documentsPath = app.getPath('documents');
    const debugDir = path.join(documentsPath, 'Work2Word_Debug');
    
    // 确保目录存在
    await fs.mkdir(debugDir, { recursive: true });
    
    const filePath = path.join(debugDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    
    return { success: true, path: filePath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('convert-file', async (_, mdContent: string, format: 'doc' | 'pdf' | 'md', outputPath?: string, formatSettings?: any) => {
  try {
    const result = await convertToFormat(mdContent, format, outputPath, formatSettings);
    return { success: true, ...result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-file-dialog', async (_, defaultFilename: string) => {
  if (!mainWindow) return { canceled: true };

  // 根据文件扩展名确定默认的文件类型
  const ext = path.extname(defaultFilename).toLowerCase();

  // 定义所有可用的过滤器
  const allFilters = [
    { name: 'Word Document', extensions: ['docx'] },
    { name: 'PDF', extensions: ['pdf'] },
    { name: 'Markdown', extensions: ['md'] },
  ];

  // 根据扩展名调整过滤器顺序，使匹配的类型排在前面
  let filters = [...allFilters];
  if (ext === '.docx') {
    filters = [allFilters[0], allFilters[1], allFilters[2]];
  } else if (ext === '.pdf') {
    filters = [allFilters[1], allFilters[0], allFilters[2]];
  } else if (ext === '.md') {
    filters = [allFilters[2], allFilters[0], allFilters[1]];
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultFilename,
    filters,
  });

  return result;
});

ipcMain.handle('open-file-dialog', async () => {
  if (!mainWindow) return { canceled: true };
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: '文档文件', extensions: ['doc', 'docx', 'pdf', 'txt'] },
      { name: 'Word 文档', extensions: ['doc', 'docx'] },
      { name: 'PDF 文档', extensions: ['pdf'] },
      { name: '文本文件', extensions: ['txt'] },
    ],
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  
  return { canceled: false, filePath: result.filePaths[0] };
});

// 获取设置文件路径
const getSettingsPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'settings.json');
};

// 保存设置到文件
ipcMain.handle('save-settings', async (_, settings: any) => {
  try {
    const settingsPath = getSettingsPath();
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return { success: true };
  } catch (error: any) {
    console.error('保存设置失败:', error);
    return { success: false, error: error.message };
  }
});

// 加载设置
ipcMain.handle('load-settings', async () => {
  try {
    const settingsPath = getSettingsPath();
    const data = await fs.readFile(settingsPath, 'utf-8');
    return { success: true, settings: JSON.parse(data) };
  } catch (error: any) {
    // 文件不存在时返回空设置
    if (error.code === 'ENOENT') {
      return { success: true, settings: null };
    }
    console.error('加载设置失败:', error);
    return { success: false, error: error.message };
  }
});

// 手动检查更新
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { success: false, error: '开发模式下无法检查更新' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, version: result?.updateInfo?.version };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 获取应用版本
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// 选择并保存图片
ipcMain.handle('select-and-save-image', async () => {
  if (!mainWindow) return { success: false, error: '窗口不可用' };

  try {
    // 获取用户文档目录
    const documentsPath = app.getPath('documents');
    const assetsDir = path.join(documentsPath, 'Work2Word_Assets', 'images');

    // 确保目录存在
    await fs.mkdir(assetsDir, { recursive: true });

    // 打开文件选择对话框
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] },
        { name: 'PNG', extensions: ['png'] },
        { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
        { name: 'GIF', extensions: ['gif'] },
        { name: 'WebP', extensions: ['webp'] },
        { name: 'BMP', extensions: ['bmp'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const sourcePath = result.filePaths[0];
    const fileName = path.basename(sourcePath);
    const destPath = path.join(assetsDir, fileName);

    // 检查文件是否已存在，如果存在则添加时间戳
    let finalDestPath = destPath;
    try {
      await fs.access(destPath);
      const ext = path.extname(fileName);
      const nameWithoutExt = path.basename(fileName, ext);
      const timestamp = Date.now();
      finalDestPath = path.join(assetsDir, `${nameWithoutExt}_${timestamp}${ext}`);
    } catch {
      // 文件不存在，使用原路径
    }

    // 复制图片到 assets 目录
    await fs.copyFile(sourcePath, finalDestPath);

    // 返回相对路径
    const relativePath = `./assets/images/${path.basename(finalDestPath)}`;
    return { success: true, relativePath, fullPath: finalDestPath };
  } catch (error: any) {
    console.error('保存图片失败:', error);
    return { success: false, error: error.message };
  }
});

