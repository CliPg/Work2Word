import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
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
    console.log('生产模式：加载本地文件');
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

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
  
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultFilename,
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Word Document', extensions: ['docx'] },
      { name: 'PDF', extensions: ['pdf'] },
    ],
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

