import { useState, useEffect } from 'react';
import MarkdownEditor from './components/MarkdownEditor';
import WordPreview from './components/WordPreview';
import Sidebar from './components/Sidebar';
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

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

const STORAGE_KEY = 'work2word_config';

function App() {
  const [filePath, setFilePath] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  
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
  const [fileLoading, setFileLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [processingStep, setProcessingStep] = useState<string>('');

  // 保存配置到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(llmConfig));
    } catch (e) {
      console.error('保存配置失败:', e);
    }
  }, [llmConfig]);

  const handleFileSelect = async () => {
    try {
      if (!window.electronAPI) {
        setError('Electron API 不可用');
        return;
      }
      
      const dialogResult = await window.electronAPI.openFileDialog();
      if (dialogResult.canceled || !dialogResult.filePath) {
        return;
      }
      
      setError('');
      setFileLoading(true);
      const response = await window.electronAPI.processFile(dialogResult.filePath);
      if (response.success && response.content) {
        setFilePath(dialogResult.filePath);
        setFileContent(response.content);
        
        // 添加系统消息
        const fileName = dialogResult.filePath.split('/').pop() || dialogResult.filePath;
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `已上传文件: ${fileName}`,
          timestamp: new Date()
        }]);
      } else {
        setError(response.error || '处理文件失败');
      }
    } catch (err: any) {
      console.error('处理文件错误:', err);
      setError(err.message || '处理文件失败');
    } finally {
      setFileLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!prompt.trim()) {
      setError('请输入作业要求');
      return;
    }

    if (!fileContent) {
      setError('请先上传作业附件');
      return;
    }

    if (!llmConfig.apiKey && llmConfig.provider !== 'custom') {
      setError('请先配置 API Key');
      return;
    }

    if (!window.electronAPI) {
      setError('Electron API 不可用');
      return;
    }

    // 添加用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setPrompt('');

    try {
      setError('');
      setSuccess('');
      setLoading(true);
      
      setProcessingStep('正在分析作业格式要求...');
      const response = await window.electronAPI.processHomeworkSteps(
        userMessage.content,
        fileContent,
        llmConfig
      );
      
      if (response.success && response.result) {
        const processResult = response.result as HomeworkProcessResult;
        setResult(processResult.finalResult.content);
        
        // 添加助手消息
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '作业处理完成！已生成 Markdown 文档，你可以在左侧编辑器中查看和修改。',
          timestamp: new Date()
        }]);
        
        // 保存调试数据
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
        
        setSuccess('处理完成');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || '处理失败');
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `处理失败: ${response.error || '未知错误'}`,
          timestamp: new Date()
        }]);
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

    if (!window.electronAPI) {
      setError('Electron API 不可用');
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
        setSuccess(`文件已保存到: ${dialogResult.filePath}`);
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(response.error || '保存失败');
      }
    } catch (err: any) {
      console.error('保存错误:', err);
      setError(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* 活动栏 */}
      <div className="activity-bar">
        <div className="activity-icon active" title="Work2Word">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
          </svg>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="main-content">
        {/* 左侧: Markdown 编辑器 */}
        <div className="panel editor-panel">
          <MarkdownEditor
            value={result}
            onChange={setResult}
            disabled={loading}
          />
        </div>

        {/* 分隔条 */}
        <div className="panel-resizer" />

        {/* 中间: Word 预览 */}
        <div className="panel preview-panel">
          <WordPreview
            content={result}
            loading={loading}
            onSave={handleSave}
          />
        </div>

        {/* 分隔条 */}
        <div className="panel-resizer" />

        {/* 右侧: 侧边栏 */}
        <div className="panel sidebar-panel">
          <Sidebar
            filePath={filePath}
            onFileSelect={handleFileSelect}
            fileLoading={fileLoading}
            prompt={prompt}
            onPromptChange={setPrompt}
            onSendMessage={handleSendMessage}
            messages={messages}
            llmConfig={llmConfig}
            onConfigChange={setLLMConfig}
            loading={loading}
            processingStep={processingStep}
            error={error}
            success={success}
          />
        </div>
      </div>

      {/* 状态栏 */}
      <div className="status-bar">
        <div className="status-left">
          <span className="status-item">
            {filePath ? `📄 ${filePath.split('/').pop()}` : '未选择文件'}
          </span>
        </div>
        <div className="status-right">
          <span className="status-item">{llmConfig.provider}</span>
          <span className="status-item">{llmConfig.model}</span>
        </div>
      </div>
    </div>
  );
}

export default App;
