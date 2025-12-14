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
      const response = await window.electronAPI.callLLM(
        prompt,
        fileContent,
        llmConfig
      );
      if (response.success && response.result) {
        setResult(response.result);
        setSuccess('✅ 作业处理完成！');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || '处理失败');
      }
    } catch (err: any) {
      console.error('处理错误:', err);
      setError(err.message || '处理失败');
    } finally {
      setLoading(false);
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
          <LLMConfig
            config={llmConfig}
            onChange={setLLMConfig}
            disabled={loading}
          />
        </div>

        <div className="right-panel">
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

