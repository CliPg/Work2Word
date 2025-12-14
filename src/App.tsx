import { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import PromptInput from './components/PromptInput';
import LLMConfig from './components/LLMConfig';
import ResultDisplay from './components/ResultDisplay';
import './App.css';

interface LLMConfigType {
  provider: 'qwen' | 'openai' | 'custom';
  apiKey: string;
  apiUrl: string;
  model: string;
}

interface ProcessStepResult {
  step: 'format' | 'questions' | 'final';
  content: string;
  timestamp: string;
}

interface HomeworkProcessResult {
  formatTemplate: ProcessStepResult;
  questionsAnswer: ProcessStepResult;
  finalResult: ProcessStepResult;
}

const STORAGE_KEY = 'work2word_config';

function App() {
  const [filePath, setFilePath] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  
  // 从 localStorage 加载配置
  const loadConfig = (): LLMConfigType => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('加载配置失败:', e);
    }
    return {
      provider: 'qwen',
      apiKey: '',
      apiUrl: '',
      model: 'qwen-turbo',
    };
  };

  const [llmConfig, setLLMConfig] = useState<LLMConfigType>(loadConfig);
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // 新增：处理进度状态
  const [processingStep, setProcessingStep] = useState<string>('');
  const [debugData, setDebugData] = useState<HomeworkProcessResult | null>(null);
  const [showDebug, setShowDebug] = useState<boolean>(false);

  // 保存配置到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(llmConfig));
    } catch (e) {
      console.error('保存配置失败:', e);
    }
  }, [llmConfig]);

  const handleFileSelect = async (path: string) => {
    try {
      // 检查 electronAPI 是否可用
      if (!window.electronAPI) {
        setError('Electron API 不可用，请确保在 Electron 环境中运行');
        return;
      }
      
      setError('');
      setLoading(true);
      const response = await window.electronAPI.processFile(path);
      if (response.success && response.content) {
        setFilePath(path);
        setFileContent(response.content);
      } else {
        setError(response.error || '处理文件失败');
      }
    } catch (err: any) {
      console.error('处理文件错误:', err);
      setError(err.message || '处理文件失败');
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!prompt.trim()) {
      setError('请输入作业要求');
      setSuccess('');
      return;
    }

    if (!fileContent && !filePath) {
      setError('请先上传作业附件');
      setSuccess('');
      return;
    }

    if (!llmConfig.apiKey && llmConfig.provider !== 'custom') {
      setError('请先配置 API Key');
      setSuccess('');
      return;
    }

    // 检查 electronAPI 是否可用
    if (!window.electronAPI) {
      setError('Electron API 不可用，请确保在 Electron 环境中运行');
      return;
    }

    try {
      setError('');
      setSuccess('');
      setLoading(true);
      setDebugData(null);
      
      // 使用分步处理
      setProcessingStep('正在分析作业格式要求...');
      const response = await window.electronAPI.processHomeworkSteps(
        prompt,
        fileContent,
        llmConfig
      );
      
      if (response.success && response.result) {
        const processResult = response.result as HomeworkProcessResult;
        setDebugData(processResult);
        setResult(processResult.finalResult.content);
        
        // 自动保存调试数据
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await window.electronAPI.saveDebugData(
          processResult.formatTemplate,
          `format_template_${timestamp}.json`
        );
        await window.electronAPI.saveDebugData(
          processResult.questionsAnswer,
          `questions_answer_${timestamp}.json`
        );
        await window.electronAPI.saveDebugData(
          processResult.finalResult,
          `final_result_${timestamp}.json`
        );
        
        setSuccess('✅ 作业处理完成！调试数据已保存到文档目录的 Work2Word_Debug 文件夹');
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(response.error || '处理失败');
      }
    } catch (err: any) {
      console.error('处理错误:', err);
      setError(err.message || '处理失败');
    } finally {
      setLoading(false);
      setProcessingStep('');
    }
  };

  const handleSave = async (format: 'doc' | 'pdf' | 'md') => {
    if (!result) {
      setError('没有可保存的内容');
      return;
    }

    // 检查 electronAPI 是否可用
    if (!window.electronAPI) {
      setError('Electron API 不可用，请确保在 Electron 环境中运行');
      return;
    }

    try {
      setError('');
      const dialogResult = await window.electronAPI.saveFileDialog(
        `作业_${Date.now()}.${format === 'doc' ? 'docx' : format}`
      );

      if (dialogResult.canceled) {
        return;
      }

      setLoading(true);
      const response = await window.electronAPI.convertFile(
        result,
        format,
        dialogResult.filePath
      );

      if (response.success) {
        setError('');
        setSuccess(`✅ 文件已成功保存到: ${dialogResult.filePath}`);
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(response.error || '保存失败');
        setSuccess('');
      }
    } catch (err: any) {
      console.error('保存错误:', err);
      setError(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Work2Word</h1>
        {debugData && (
          <button 
            className="debug-toggle-btn"
            onClick={() => setShowDebug(!showDebug)}
          >
            {showDebug ? '隐藏调试' : '显示调试'}
          </button>
        )}
      </header>

      <main className="app-main">
        <div className="left-panel">
          <FileUpload
            onFileSelect={handleFileSelect}
            filePath={filePath}
            loading={loading}
          />
          <PromptInput
            value={prompt}
            onChange={setPrompt}
            onProcess={handleProcess}
            disabled={loading || !fileContent}
          />
          {processingStep && (
            <div className="processing-step">
              <span className="step-indicator">⏳</span>
              {processingStep}
            </div>
          )}
          <LLMConfig
            config={llmConfig}
            onChange={setLLMConfig}
            disabled={loading}
          />
        </div>

        <div className="right-panel">
          {showDebug && debugData && (
            <div className="debug-panel">
              <h3>🔧 调试数据</h3>
              <div className="debug-section">
                <h4>步骤1: 格式模版提取</h4>
                <pre>{debugData.formatTemplate.content}</pre>
                <small>时间: {debugData.formatTemplate.timestamp}</small>
              </div>
              <div className="debug-section">
                <h4>步骤2: 题目提取与解答</h4>
                <pre>{debugData.questionsAnswer.content}</pre>
                <small>时间: {debugData.questionsAnswer.timestamp}</small>
              </div>
              <div className="debug-section">
                <h4>步骤3: 最终文档生成</h4>
                <small>时间: {debugData.finalResult.timestamp}</small>
              </div>
            </div>
          )}
          <ResultDisplay
            result={result}
            loading={loading}
            error={error}
            success={success}
            onSave={handleSave}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
