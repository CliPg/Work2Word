// Electron API 类型声明
declare global {
  interface Window {
    electronAPI: {
      processFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      callLLM: (prompt: string, fileContent: string, llmConfig: any) => Promise<{ success: boolean; result?: string; error?: string }>;
      convertFile: (mdContent: string, format: 'doc' | 'pdf' | 'md', outputPath?: string) => Promise<{ success: boolean; path?: string; buffer?: Buffer; error?: string }>;
      saveFileDialog: (defaultFilename: string) => Promise<{ canceled: boolean; filePath?: string }>;
      openFileDialog: () => Promise<{ canceled: boolean; filePath?: string }>;
    };
  }
}

export {};

