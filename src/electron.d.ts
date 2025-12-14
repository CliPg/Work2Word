// Electron API 类型声明

// 处理步骤结果接口
interface ProcessStepResult {
  step: 'format' | 'questions' | 'final';
  content: string;
  timestamp: string;
}

// 完整处理结果接口
interface HomeworkProcessResult {
  formatTemplate: ProcessStepResult;
  questionsAnswer: ProcessStepResult;
  finalResult: ProcessStepResult;
}

declare global {
  interface Window {
    electronAPI: {
      processFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      callLLM: (prompt: string, fileContent: string, llmConfig: any) => Promise<{ success: boolean; result?: string; error?: string }>;
      // 新增：分步处理作业
      processHomeworkSteps: (prompt: string, fileContent: string, llmConfig: any) => Promise<{ 
        success: boolean; 
        result?: HomeworkProcessResult; 
        error?: string 
      }>;
      // 新增：保存调试数据
      saveDebugData: (data: ProcessStepResult, filename: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      convertFile: (mdContent: string, format: 'doc' | 'pdf' | 'md', outputPath?: string) => Promise<{ success: boolean; path?: string; buffer?: Buffer; error?: string }>;
      saveFileDialog: (defaultFilename: string) => Promise<{ canceled: boolean; filePath?: string }>;
      openFileDialog: () => Promise<{ canceled: boolean; filePath?: string }>;
    };
  }
}

export { ProcessStepResult, HomeworkProcessResult };

