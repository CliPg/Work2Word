import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  processFile: (filePath: string) => ipcRenderer.invoke('process-file', filePath),
  callLLM: (prompt: string, fileContent: string, llmConfig: any) => 
    ipcRenderer.invoke('call-llm', prompt, fileContent, llmConfig),
  convertFile: (mdContent: string, format: 'doc' | 'pdf' | 'md', outputPath?: string) =>
    ipcRenderer.invoke('convert-file', mdContent, format, outputPath),
  saveFileDialog: (defaultFilename: string) =>
    ipcRenderer.invoke('save-file-dialog', defaultFilename),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
});

declare global {
  interface Window {
    electronAPI: {
      processFile: (filePath: string) => Promise<any>;
      callLLM: (prompt: string, fileContent: string, llmConfig: any) => Promise<any>;
      convertFile: (mdContent: string, format: 'doc' | 'pdf' | 'md', outputPath?: string) => Promise<any>;
      saveFileDialog: (defaultFilename: string) => Promise<any>;
      openFileDialog: () => Promise<any>;
    };
  }
}

