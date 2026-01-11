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

// 编辑修改项接口
interface EditChange {
  searchText: string;
  replaceText: string;
  description: string;
}

// 编辑内容结果接口
interface EditContentResult {
  changes: EditChange[];
  summary: string;
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
      // 新增：编辑内容 (Copilot 风格)
      editContent: (instruction: string, currentContent: string, llmConfig: any) => Promise<{
        success: boolean;
        result?: EditContentResult;
        error?: string
      }>;
      // 新增：保存调试数据
      saveDebugData: (data: ProcessStepResult, filename: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      convertFile: (mdContent: string, format: 'doc' | 'pdf' | 'md', outputPath?: string, formatSettings?: any) => Promise<{ success: boolean; path?: string; buffer?: Buffer; error?: string }>;
      saveFileDialog: (defaultFilename: string) => Promise<{ canceled: boolean; filePath?: string }>;
      openFileDialog: () => Promise<{ canceled: boolean; filePath?: string }>;
      openMarkdownFileDialog: () => Promise<{ canceled: boolean; filePath?: string }>;
      // 设置相关
      saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
      loadSettings: () => Promise<{ success: boolean; settings?: any; error?: string }>;
      // 图片相关
      selectAndSaveImage: () => Promise<{ success: boolean; canceled?: boolean; relativePath?: string; fullPath?: string; error?: string }>;
    };
  }
}

export { ProcessStepResult, HomeworkProcessResult, EditContentResult, EditChange };

