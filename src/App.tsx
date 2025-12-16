import { useState, useEffect, useRef, useCallback } from 'react';
import MarkdownEditor, { MarkdownEditorHandle } from './components/MarkdownEditor';
import WordPreview, { WordPreviewHandle } from './components/WordPreview';
import Sidebar from './components/Sidebar';
import FormatSettingsPanel, { FormatSettings, defaultFormatSettings } from './components/FormatSettings';
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
const FORMAT_STORAGE_KEY = 'work2word_format';

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

  // 从 localStorage 加载排版设置
  const loadFormatSettings = (): FormatSettings => {
    try {
      const saved = localStorage.getItem(FORMAT_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('加载排版设置失败:', e);
    }
    return defaultFormatSettings;
  };

  const [llmConfig, setLLMConfig] = useState<LLMConfigType>(loadConfig);
  const [formatSettings, setFormatSettings] = useState<FormatSettings>(loadFormatSettings);
  const [formatPanelVisible, setFormatPanelVisible] = useState(false);
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [fileLoading, setFileLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [processingStep, setProcessingStep] = useState<string>('');

  // 面板宽度状态 (百分比)
  const [editorWidth, setEditorWidth] = useState<number>(33);
  const [previewWidth, setPreviewWidth] = useState<number>(34);
  const [sidebarWidth, setSidebarWidth] = useState<number>(33);
  
  // 拖拽相关
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<'left' | 'right' | null>(null);
  const startX = useRef<number>(0);
  const startWidths = useRef<{ editor: number; preview: number; sidebar: number }>({ editor: 33, preview: 34, sidebar: 33 });

  // 滚动同步相关
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const previewRef = useRef<WordPreviewHandle>(null);

  // 处理鼠标按下事件
  const handleMouseDown = useCallback((resizer: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = resizer;
    startX.current = e.clientX;
    startWidths.current = { editor: editorWidth, preview: previewWidth, sidebar: sidebarWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [editorWidth, previewWidth, sidebarWidth]);

  // 处理鼠标移动事件
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      
      const containerWidth = containerRef.current.offsetWidth;
      const deltaX = e.clientX - startX.current;
      const deltaPercent = (deltaX / containerWidth) * 100;
      
      const minWidth = 15; // 最小宽度百分比
      const maxWidth = 60; // 最大宽度百分比
      
      if (isDragging.current === 'left') {
        // 调整编辑器和预览之间的分隔条
        let newEditorWidth = startWidths.current.editor + deltaPercent;
        let newPreviewWidth = startWidths.current.preview - deltaPercent;
        
        // 限制宽度范围
        if (newEditorWidth < minWidth) {
          newPreviewWidth += (newEditorWidth - minWidth);
          newEditorWidth = minWidth;
        }
        if (newEditorWidth > maxWidth) {
          newPreviewWidth += (newEditorWidth - maxWidth);
          newEditorWidth = maxWidth;
        }
        if (newPreviewWidth < minWidth) {
          newEditorWidth += (newPreviewWidth - minWidth);
          newPreviewWidth = minWidth;
        }
        if (newPreviewWidth > maxWidth) {
          newEditorWidth += (newPreviewWidth - maxWidth);
          newPreviewWidth = maxWidth;
        }
        
        setEditorWidth(newEditorWidth);
        setPreviewWidth(newPreviewWidth);
      } else if (isDragging.current === 'right') {
        // 调整预览和侧边栏之间的分隔条
        let newPreviewWidth = startWidths.current.preview + deltaPercent;
        let newSidebarWidth = startWidths.current.sidebar - deltaPercent;
        
        // 限制宽度范围
        if (newPreviewWidth < minWidth) {
          newSidebarWidth += (newPreviewWidth - minWidth);
          newPreviewWidth = minWidth;
        }
        if (newPreviewWidth > maxWidth) {
          newSidebarWidth += (newPreviewWidth - maxWidth);
          newPreviewWidth = maxWidth;
        }
        if (newSidebarWidth < minWidth) {
          newPreviewWidth += (newSidebarWidth - minWidth);
          newSidebarWidth = minWidth;
        }
        if (newSidebarWidth > maxWidth) {
          newPreviewWidth += (newSidebarWidth - maxWidth);
          newSidebarWidth = maxWidth;
        }
        
        setPreviewWidth(newPreviewWidth);
        setSidebarWidth(newSidebarWidth);
      }
    };
    
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // 保存配置到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(llmConfig));
    } catch (e) {
      console.error('保存配置失败:', e);
    }
  }, [llmConfig]);

  // 保存排版设置到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FORMAT_STORAGE_KEY, JSON.stringify(formatSettings));
    } catch (e) {
      console.error('保存排版设置失败:', e);
    }
  }, [formatSettings]);

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
        `作业_${Date.now()}`
      );

      if (dialogResult.canceled) {
        return;
      }

      setLoading(true);
      const response = await window.electronAPI.convertFile(
        result,
        format,
        dialogResult.filePath,
        formatSettings
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
      <div className="main-content" ref={containerRef}>
        {/* 左侧: Markdown 编辑器 */}
        <div className="panel editor-panel" style={{ width: `${editorWidth}%` }}>
          <MarkdownEditor
            ref={editorRef}
            value={result}
            onChange={setResult}
            disabled={loading}
            onScroll={(scrollPercent) => previewRef.current?.scrollTo(scrollPercent)}
          />
        </div>

        {/* 分隔条 */}
        <div 
          className="panel-resizer" 
          onMouseDown={handleMouseDown('left')}
        />

        {/* 中间: Word 预览 */}
        <div className="panel preview-panel" style={{ width: `${previewWidth}%` }}>
          <WordPreview
            ref={previewRef}
            content={result}
            loading={loading}
            onSave={handleSave}
            formatSettings={formatSettings}
            onScroll={(scrollPercent) => editorRef.current?.scrollTo(scrollPercent)}
          />
        </div>

        {/* 分隔条 */}
        <div 
          className="panel-resizer" 
          onMouseDown={handleMouseDown('right')}
        />

        {/* 右侧: 侧边栏 */}
        <div className="panel sidebar-panel" style={{ width: `${sidebarWidth}%` }}>
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
            onOpenFormatSettings={() => setFormatPanelVisible(true)}
            loading={loading}
            processingStep={processingStep}
            error={error}
            success={success}
          />
        </div>
      </div>

      {/* 排版设置面板 */}
      <FormatSettingsPanel
        visible={formatPanelVisible}
        onClose={() => setFormatPanelVisible(false)}
        settings={formatSettings}
        onSettingsChange={setFormatSettings}
      />

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
