import { useState, useEffect, useRef, useCallback } from 'react';
import MarkdownEditor, { MarkdownEditorHandle, EditChange } from './components/editor/MarkdownEditor';
import WordPreview, { WordPreviewHandle } from './components/preview/WordPreview';
import Sidebar from './components/sidebar/Sidebar';
import FormatSettingsPanel, { FormatSettings, defaultFormatSettings } from './components/settings/FormatSettings';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import './App.css';

type ModeType = 'build' | 'ask' | 'edit';

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

// 编辑结果接口
interface EditContentResult {
  changes: EditChange[];
  summary: string;
}

// 默认配置
const defaultLLMConfig: LLMConfigType = {
  provider: 'qwen',
  apiKey: '',
  apiUrl: '',
  model: 'qwen-turbo',
};

// localStorage 键名（作为 Electron API 不可用时的回退）
const STORAGE_KEY = 'work2word_settings';

function App() {
  const [filePath, setFilePath] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);

  const [llmConfig, setLLMConfig] = useState<LLMConfigType>(defaultLLMConfig);
  const [formatSettings, setFormatSettings] = useState<FormatSettings>(defaultFormatSettings);

  // 从文件加载设置
  useEffect(() => {
    const loadSettings = async () => {
      // 优先使用 Electron API
      if (window.electronAPI?.loadSettings) {
        try {
          const result = await window.electronAPI.loadSettings();
          if (result.success && result.settings) {
            if (result.settings.llmConfig) {
              setLLMConfig(result.settings.llmConfig);
            }
            if (result.settings.formatSettings) {
              setFormatSettings(result.settings.formatSettings);
            }
            console.log('设置已从文件加载');
          }
        } catch (e) {
          console.error('加载设置失败:', e);
        } finally {
          setSettingsLoaded(true);
        }
        return;
      }

      // 回退到 localStorage（开发模式或浏览器环境）
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const settings = JSON.parse(saved);
          if (settings.llmConfig) {
            setLLMConfig(settings.llmConfig);
          }
          if (settings.formatSettings) {
            setFormatSettings(settings.formatSettings);
          }
          console.log('设置已从 localStorage 加载');
        }
      } catch (e) {
        console.error('从 localStorage 加载设置失败:', e);
      } finally {
        setSettingsLoaded(true);
      }
    };

    loadSettings();
  }, []);
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [fileLoading, setFileLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [processingStep, setProcessingStep] = useState<string>('');

  // 模式状态
  const [mode, setMode] = useState<ModeType>('build');
  const [pendingChanges, setPendingChanges] = useState<EditChange[]>([]);

  // 侧边栏可见性
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(true);
  const [formatSidebarVisible, setFormatSidebarVisible] = useState<boolean>(false);

  // 面板宽度状态 (百分比)
  const [formatSidebarWidth, setFormatSidebarWidth] = useState<number>(20);
  const [editorWidth, setEditorWidth] = useState<number>(26);
  const [previewWidth, setPreviewWidth] = useState<number>(27);
  const [sidebarWidth, setSidebarWidth] = useState<number>(27);
  
  // 拖拽相关
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<'format' | 'editor' | 'preview' | null>(null);
  const startX = useRef<number>(0);
  const startWidths = useRef<{ format: number; editor: number; preview: number; sidebar: number }>({
    format: 20,
    editor: 26,
    preview: 27,
    sidebar: 27
  });

  // 滚动同步相关
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const previewRef = useRef<WordPreviewHandle>(null);

  // 处理鼠标按下事件
  const handleMouseDown = useCallback((resizer: 'format' | 'editor' | 'preview') => (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = resizer;
    startX.current = e.clientX;
    startWidths.current = { format: formatSidebarWidth, editor: editorWidth, preview: previewWidth, sidebar: sidebarWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [formatSidebarWidth, editorWidth, previewWidth, sidebarWidth]);

  // 处理鼠标移动事件
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const deltaX = e.clientX - startX.current;
      const deltaPercent = (deltaX / containerWidth) * 100;

      const minWidth = 15; // 最小宽度百分比
      const maxWidth = 60; // 最大宽度百分比

      if (isDragging.current === 'format') {
        // 调整排版侧边栏和编辑器之间的分隔条
        let newFormatWidth = startWidths.current.format + deltaPercent;
        let newEditorWidth = startWidths.current.editor - deltaPercent;

        // 限制宽度范围
        if (newFormatWidth < minWidth) {
          newEditorWidth -= (minWidth - newFormatWidth);
          newFormatWidth = minWidth;
        }
        if (newFormatWidth > maxWidth) {
          newEditorWidth += (newFormatWidth - maxWidth);
          newFormatWidth = maxWidth;
        }
        if (newEditorWidth < minWidth) {
          newFormatWidth -= (minWidth - newEditorWidth);
          newEditorWidth = minWidth;
        }
        if (newEditorWidth > maxWidth) {
          newFormatWidth += (newEditorWidth - maxWidth);
          newEditorWidth = maxWidth;
        }

        setFormatSidebarWidth(newFormatWidth);
        setEditorWidth(newEditorWidth);
      } else if (isDragging.current === 'editor') {
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
      } else if (isDragging.current === 'preview') {
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

  // 保存设置到文件
  useEffect(() => {
    // 等待设置加载完成后再保存，避免覆盖已保存的设置
    if (!settingsLoaded) return;
    
    const saveSettings = async () => {
      const settingsData = {
        llmConfig,
        formatSettings,
      };

      // 优先使用 Electron API
      if (window.electronAPI?.saveSettings) {
        try {
          await window.electronAPI.saveSettings(settingsData);
          console.log('设置已保存到文件');
        } catch (e) {
          console.error('保存设置失败:', e);
        }
        return;
      }

      // 回退到 localStorage（开发模式或浏览器环境）
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsData));
        console.log('设置已保存到 localStorage');
      } catch (e) {
        console.error('保存设置到 localStorage 失败:', e);
      }
    };

    saveSettings();
  }, [llmConfig, formatSettings, settingsLoaded]);

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
      setError('请输入内容要求');
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
    const currentPrompt = prompt;
    setPrompt('');

    try {
      setError('');
      setSuccess('');
      setLoading(true);

      // Ask 模式：直接在对话框中回答，不更新编辑器
      if (mode === 'ask') {
        setProcessingStep('AI 正在思考...');
        const response = await window.electronAPI.callLLM(
          currentPrompt,
          fileContent || '',
          llmConfig
        );

        if (response.success && response.result) {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: response.result,
            timestamp: new Date()
          }]);
        } else {
          setError(response.error || '处理失败');
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `处理失败: ${response.error || '未知错误'}`,
            timestamp: new Date()
          }]);
        }
      }
      // Edit 模式：编辑现有内容
      else if (mode === 'edit') {
        if (!result.trim()) {
          setError('编辑模式需要先有内容，请先使用 Build 模式生成内容');
          setLoading(false);
          return;
        }

        setProcessingStep('AI 正在分析并生成修改建议...');
        const response = await window.electronAPI.editContent(
          currentPrompt,
          result,
          llmConfig
        );

        if (response.success && response.result) {
          const editResult = response.result as EditContentResult;
          if (editResult.changes.length > 0) {
            setPendingChanges(editResult.changes);

            // 添加助手消息
            setMessages(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: `${editResult.summary}（共 ${editResult.changes.length} 处修改）`,
              timestamp: new Date()
            }]);
          } else {
            setMessages(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: '没有找到需要修改的内容',
              timestamp: new Date()
            }]);
          }
        } else {
          setError(response.error || '编辑失败');
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `编辑失败: ${response.error || '未知错误'}`,
            timestamp: new Date()
          }]);
        }
      }
      // Build 模式：根据提示词和文件生成文本到编辑器
      else if (mode === 'build') {
        setProcessingStep(fileContent ? '正在分析作业格式要求...' : '正在生成内容...');
        const response = await window.electronAPI.processHomeworkSteps(
          currentPrompt,
          fileContent || '',
          llmConfig
        );

        if (response.success && response.result) {
          const processResult = response.result as HomeworkProcessResult;
          setResult(processResult.finalResult.content);

          // 添加助手消息
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '处理完成！已生成 Markdown 文档，你可以在左侧编辑器中查看和修改。',
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
      }
    } catch (err: any) {
      console.error('处理错误:', err);
      setError(err.message || '处理失败');
    } finally {
      setLoading(false);
      setProcessingStep('');
    }
  };

  // 接受单个修改
  const handleAcceptChange = (index: number) => {
    const change = pendingChanges[index];
    if (change) {
      // 应用修改
      const newResult = result.replace(change.searchText, change.replaceText);
      setResult(newResult);
      // 移除已处理的修改
      setPendingChanges(prev => prev.filter((_, i) => i !== index));
    }
  };

  // 拒绝单个修改
  const handleRejectChange = (index: number) => {
    setPendingChanges(prev => prev.filter((_, i) => i !== index));
  };

  // 接受所有修改
  const handleAcceptAllChanges = () => {
    let newResult = result;
    for (const change of pendingChanges) {
      newResult = newResult.replace(change.searchText, change.replaceText);
    }
    setResult(newResult);
    setPendingChanges([]);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'system',
      content: '已接受所有修改',
      timestamp: new Date()
    }]);
    setSuccess('已应用所有修改');
    setTimeout(() => setSuccess(''), 3000);
  };

  // 拒绝所有修改
  const handleRejectAllChanges = () => {
    setPendingChanges([]);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'system',
      content: '已放弃所有修改',
      timestamp: new Date()
    }]);
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
      // 根据格式生成默认文件名和后缀
      const getFilenameForFormat = (fmt: 'doc' | 'pdf' | 'md') => {
        const baseName = `作业_${Date.now()}`;
        switch (fmt) {
          case 'doc':
            return `${baseName}.docx`;
          case 'pdf':
            return `${baseName}.pdf`;
          case 'md':
            return `${baseName}.md`;
          default:
            return baseName;
        }
      };

      const dialogResult = await window.electronAPI.saveFileDialog(
        getFilenameForFormat(format)
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

  // 计算实际显示宽度
  const getVisibleWidths = () => {
    const visible: { format: boolean; editor: boolean; preview: boolean; sidebar: boolean } = {
      format: formatSidebarVisible,
      editor: true,
      preview: true,
      sidebar: sidebarVisible
    };
    const visibleCount = Object.values(visible).filter(Boolean).length;

    if (formatSidebarVisible && sidebarVisible) {
      return { format: formatSidebarWidth, editor: editorWidth, preview: previewWidth, sidebar: sidebarWidth };
    } else if (formatSidebarVisible && !sidebarVisible) {
      const total = formatSidebarWidth + editorWidth + previewWidth;
      return {
        format: (formatSidebarWidth / total) * 100,
        editor: (editorWidth / total) * 100,
        preview: (previewWidth / total) * 100,
        sidebar: 0
      };
    } else if (!formatSidebarVisible && sidebarVisible) {
      const total = editorWidth + previewWidth + sidebarWidth;
      return {
        format: 0,
        editor: (editorWidth / total) * 100,
        preview: (previewWidth / total) * 100,
        sidebar: (sidebarWidth / total) * 100
      };
    } else {
      const total = editorWidth + previewWidth;
      return {
        format: 0,
        editor: (editorWidth / total) * 100,
        preview: (previewWidth / total) * 100,
        sidebar: 0
      };
    }
  };

  const widths = getVisibleWidths();

  return (
    <div className="app-container">
      {/* 活动栏 */}
      <div className="activity-bar">
        <div className="activity-icon active" title="Work2Word">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
          </svg>
        </div>
        <div
          className={`activity-icon ${formatSidebarVisible ? 'active' : ''}`}
          title={formatSidebarVisible ? '隐藏排版设置' : '显示排版设置'}
          onClick={() => setFormatSidebarVisible(!formatSidebarVisible)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z"/>
          </svg>
        </div>
        <div
          className={`activity-icon ${sidebarVisible ? 'active' : ''}`}
          title={sidebarVisible ? '隐藏对话侧边栏' : '显示对话侧边栏'}
          onClick={() => setSidebarVisible(!sidebarVisible)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h4v4H7V7zm0 6h4v4H7v-4zm6-6h4v2h-4V7zm0 4h4v2h-4v-2zm0 4h4v2h-4v-2z"/>
          </svg>
        </div>
        {/* 主题切换按钮 */}
        <ThemeToggleButton />
      </div>

      {/* 主内容区 */}
      <div className="main-content" ref={containerRef}>
        {/* 排版设置侧边栏 */}
        {formatSidebarVisible && (
          <>
            <div className="panel format-sidebar-panel" style={{ width: `${widths.format}%` }}>
              <FormatSettingsPanel
                visible={true}
                onClose={() => setFormatSidebarVisible(false)}
                settings={formatSettings}
                onSettingsChange={setFormatSettings}
                sidebarMode={true}
              />
            </div>
            <div className="panel-resizer" onMouseDown={handleMouseDown('format')} />
          </>
        )}

        {/* Markdown 编辑器 */}
        <div className="panel editor-panel" style={{ width: `${widths.editor}%` }}>
          <MarkdownEditor
            ref={editorRef}
            value={result}
            onChange={setResult}
            disabled={loading}
            onScroll={(scrollPercent) => previewRef.current?.scrollTo(scrollPercent)}
            pendingChanges={pendingChanges}
            onAcceptChange={handleAcceptChange}
            onRejectChange={handleRejectChange}
            onAcceptAll={handleAcceptAllChanges}
            onRejectAll={handleRejectAllChanges}
          />
        </div>

        {/* 分隔条 */}
        <div
          className="panel-resizer"
          onMouseDown={handleMouseDown('editor')}
        />

        {/* Word 预览 */}
        <div className="panel preview-panel" style={{ width: `${widths.preview}%` }}>
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
        {sidebarVisible && (
          <div
            className="panel-resizer"
            onMouseDown={handleMouseDown('preview')}
          />
        )}

        {/* 右侧: 侧边栏 */}
        {sidebarVisible && (
          <div className="panel sidebar-panel" style={{ width: `${widths.sidebar}%` }}>
            <Sidebar
              filePath={filePath}
              onFileSelect={handleFileSelect}
              onFileRemove={() => {
                setFilePath('');
                setFileContent('');
              }}
              fileLoading={fileLoading}
              prompt={prompt}
              onPromptChange={setPrompt}
              onSendMessage={handleSendMessage}
              messages={messages}
              llmConfig={llmConfig}
              onConfigChange={setLLMConfig}
              onOpenFormatSettings={() => setFormatSidebarVisible(true)}
              loading={loading}
              processingStep={processingStep}
              error={error}
              success={success}
              mode={mode}
              onModeChange={setMode}
              hasContent={!!result.trim()}
            />
          </div>
        )}
      </div>

      {/* 状态栏 */}
      <div className="status-bar">
        <div className="status-left">
          <span className="status-item">
            {filePath ? `📄 ${filePath.split('/').pop()}` : '未选择文件'}
          </span>
          <span className={`status-item mode-indicator mode-${mode}`}>
            {mode === 'build' && '🔨 Build'}
            {mode === 'ask' && '🤖 Ask'}
            {mode === 'edit' && '✏️ Edit'}
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

// 主题切换按钮组件
function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className="activity-icon"
      title={theme === 'light' ? '切换到黑夜模式' : '切换到白天模式'}
      onClick={toggleTheme}
    >
      {theme === 'light' ? (
        <Moon size={20} strokeWidth={2} />
      ) : (
        <Sun size={20} strokeWidth={2} />
      )}
    </div>
  );
}

// 用 ThemeProvider 包装 App
export default function AppWrapper() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}
