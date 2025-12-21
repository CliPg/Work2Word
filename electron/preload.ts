import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  processFile: (filePath: string) => ipcRenderer.invoke('process-file', filePath),
  callLLM: (prompt: string, fileContent: string, llmConfig: any) => 
    ipcRenderer.invoke('call-llm', prompt, fileContent, llmConfig),
  // 新增：分步处理作业
  processHomeworkSteps: (prompt: string, fileContent: string, llmConfig: any) =>
    ipcRenderer.invoke('process-homework-steps', prompt, fileContent, llmConfig),
  // 新增：编辑内容 (Copilot 风格)
  editContent: (instruction: string, currentContent: string, llmConfig: any) =>
    ipcRenderer.invoke('edit-content', instruction, currentContent, llmConfig),
  // 新增：保存调试数据
  saveDebugData: (data: any, filename: string) =>
    ipcRenderer.invoke('save-debug-data', data, filename),
  convertFile: (mdContent: string, format: 'doc' | 'pdf' | 'md', outputPath?: string, formatSettings?: any) =>
    ipcRenderer.invoke('convert-file', mdContent, format, outputPath, formatSettings),
  saveFileDialog: (defaultFilename: string) =>
    ipcRenderer.invoke('save-file-dialog', defaultFilename),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  // 设置相关
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  // 更新相关
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});

declare global {
  interface Window {
    electronAPI: {
      processFile: (filePath: string) => Promise<any>;
      callLLM: (prompt: string, fileContent: string, llmConfig: any) => Promise<any>;
      processHomeworkSteps: (prompt: string, fileContent: string, llmConfig: any) => Promise<any>;
      editContent: (instruction: string, currentContent: string, llmConfig: any) => Promise<any>;
      saveDebugData: (data: any, filename: string) => Promise<any>;
      convertFile: (mdContent: string, format: 'doc' | 'pdf' | 'md', outputPath?: string, formatSettings?: any) => Promise<any>;
      saveFileDialog: (defaultFilename: string) => Promise<any>;
      openFileDialog: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      loadSettings: () => Promise<any>;
      checkForUpdates: () => Promise<any>;
      getAppVersion: () => Promise<string>;
    };
  }
}

