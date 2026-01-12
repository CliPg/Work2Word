import React, { useState, useRef, useEffect } from 'react';
import { Send, File, Loader2, MessageSquare, ChevronDown, X, Type, Edit3, Paperclip, Bot, Hammer } from 'lucide-react';
import './Sidebar.css';

type ModeType = 'build' | 'ask' | 'edit';

interface LLMConfigType {
  provider: 'qwen' | 'openai' | 'custom';
  apiKey: string;
  apiUrl: string;
  model: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface SidebarProps {
  // 文件上传
  filePath: string;
  onFileSelect: () => void;
  onFileRemove: () => void;
  fileLoading: boolean;

  // 对话
  prompt: string;
  onPromptChange: (value: string) => void;
  onSendMessage: () => void;
  messages: Message[];

  // LLM 配置
  llmConfig: LLMConfigType;
  onConfigChange: (config: LLMConfigType) => void;

  // 排版设置
  onOpenFormatSettings: () => void;

  // 状态
  loading: boolean;
  processingStep: string;
  error: string;
  success: string;

  // 模式
  mode: ModeType;
  onModeChange: (mode: ModeType) => void;
  hasContent: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  filePath,
  onFileSelect,
  onFileRemove,
  fileLoading,
  prompt,
  onPromptChange,
  onSendMessage,
  messages,
  llmConfig,
  onConfigChange,
  onOpenFormatSettings,
  loading,
  processingStep,
  error,
  success,
  mode,
  onModeChange,
  hasContent,
}) => {
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [modeSelectorOpen, setModeSelectorOpen] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const modeSelectorRef = useRef<HTMLDivElement>(null);

  const fileName = filePath ? filePath.split('/').pop() || filePath.split('\\').pop() : '';

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
        setModelSelectorOpen(false);
      }
      if (modeSelectorRef.current && !modeSelectorRef.current.contains(event.target as Node)) {
        setModeSelectorOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // 使用容器的 scrollTop 而不是 scrollIntoView，避免影响页面滚动
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // 点击外部关闭模型选择器
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(e.target as Node)) {
        setModelSelectorOpen(false);
      }
    };
    if (modelSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [modelSelectorOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && prompt.trim()) {
        onSendMessage();
      }
    }
  };

  const updateConfig = (updates: Partial<LLMConfigType>) => {
    onConfigChange({ ...llmConfig, ...updates });
  };

  const getModelDisplayName = () => {
    if (llmConfig.provider === 'qwen') return `通义 · ${llmConfig.model}`;
    if (llmConfig.provider === 'openai') return `OpenAI · ${llmConfig.model}`;
    return llmConfig.model || '自定义模型';
  };

  return (
    <div className="sidebar">
      {/* 标题栏 */}
      <div className="sidebar-header">
        <div className="sidebar-title">
          <MessageSquare size={16} />
          <span>Work2Word</span>
        </div>
      </div>

      {/* 对话区域 */}
      <div className="chat-area">
        <div className="messages-container" ref={messagesContainerRef}>
          {messages.length === 0 ? (
            <div className="messages-empty">
              <MessageSquare size={32} />
              <p>
                {mode === 'edit' ? '输入编辑指令修改内容' :
                 mode === 'ask' ? '输入问题开始对话' :
                 '输入作业要求开始处理'}
              </p>
              <span className="hint-text">可以附加文件或直接开始对话</span>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
                <div className="message-time">
                  {msg.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
          {processingStep && (
            <div className="message assistant processing">
              <Loader2 size={14} className="spin" />
              <span>{processingStep}</span>
            </div>
          )}
        </div>

        {/* 状态提示 */}
        {error && (
          <div className="status-message error">
            <X size={14} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="status-message success">
            <span>{success}</span>
          </div>
        )}
      </div>

      {/* VSCode 风格的统一输入区域 */}
      <div className={`unified-input-container ${mode === 'build' ? 'build-mode' : ''} ${mode === 'ask' ? 'ask-mode' : ''} ${mode === 'edit' ? 'edit-mode' : ''}`}>
        {/* 附件预览 */}
        {filePath && (
          <div className="attached-file">
            <File size={14} />
            <span className="attached-file-name" title={fileName}>{fileName}</span>
            {fileLoading ? (
              <Loader2 size={14} className="spin" />
            ) : (
              <button 
                className="remove-attached-btn"
                onClick={onFileRemove}
                title="移除文件"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* 输入框 */}
        <div className="input-box">
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'edit' ? '输入编辑指令，如：把第一段改成更正式的语气...' :
              mode === 'ask' ? '输入问题开始对话...' :
              '输入作业要求...'
            }
            disabled={loading}
            rows={2}
          />
        </div>

        {/* 工具栏 */}
        <div className="input-toolbar">
          <div className="toolbar-left">
            {/* 附件按钮 */}
            <button
              className="toolbar-btn"
              onClick={onFileSelect}
              disabled={loading || fileLoading}
              title="附加文件 (DOC, DOCX, PDF, TXT)"
            >
              <Paperclip size={16} />
            </button>

            {/* 模型选择器 */}
            <div className="model-selector-wrapper" ref={modelSelectorRef}>
              <button
                className="toolbar-btn model-btn"
                onClick={() => setModelSelectorOpen(!modelSelectorOpen)}
                disabled={loading}
                title="选择模型"
              >
                <Bot size={16} />
                <span className="model-name">{getModelDisplayName()}</span>
                <ChevronDown size={12} className={modelSelectorOpen ? 'rotate' : ''} />
              </button>

              {modelSelectorOpen && (
                <div className="model-dropdown">
                  <div className="dropdown-section">
                    <div className="dropdown-label">提供商</div>
                    <div className="dropdown-options">
                      {(['qwen', 'openai', 'custom'] as const).map(provider => (
                        <button
                          key={provider}
                          className={`dropdown-option ${llmConfig.provider === provider ? 'active' : ''}`}
                          onClick={() => {
                            updateConfig({
                              provider,
                              model: provider === 'qwen' ? 'qwen-turbo' : provider === 'openai' ? 'gpt-3.5-turbo' : llmConfig.model,
                            });
                          }}
                        >
                          {provider === 'qwen' ? '通义千问' : provider === 'openai' ? 'OpenAI' : '自定义'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="dropdown-section">
                    <div className="dropdown-label">模型</div>
                    <input
                      type="text"
                      className="dropdown-input"
                      value={llmConfig.model}
                      onChange={(e) => updateConfig({ model: e.target.value })}
                      placeholder="模型名称"
                    />
                  </div>
                  <div className="dropdown-section">
                    <div className="dropdown-label">API Key</div>
                    <input
                      type="password"
                      className="dropdown-input"
                      value={llmConfig.apiKey}
                      onChange={(e) => updateConfig({ apiKey: e.target.value })}
                      placeholder="输入 API Key"
                    />
                  </div>
                  {llmConfig.provider === 'custom' && (
                    <div className="dropdown-section">
                      <div className="dropdown-label">API URL</div>
                      <input
                        type="text"
                        className="dropdown-input"
                        value={llmConfig.apiUrl}
                        onChange={(e) => updateConfig({ apiUrl: e.target.value })}
                        placeholder="API 地址"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 模式选择 */}
            <div className="mode-selector-wrapper" ref={modeSelectorRef}>
              <button
                className="toolbar-btn mode-btn"
                onClick={() => setModeSelectorOpen(!modeSelectorOpen)}
              >
                {mode === 'build' && <Hammer size={16} />}
                {mode === 'edit' && <Edit3 size={16} />}
                {mode === 'ask' && <Bot size={16} />}
                <span className="mode-name">
                  {mode === 'build' ? 'Build' : mode === 'edit' ? 'Edit' : 'Ask'}
                </span>
                <ChevronDown
                  size={14}
                  className={modeSelectorOpen ? 'rotate' : ''}
                />
              </button>

              {modeSelectorOpen && (
                <div className="mode-dropdown">
                  <div className="dropdown-section">
                    <div className="dropdown-label">选择模式</div>
                    <div className="dropdown-options">
                      <button
                        className={`dropdown-option ${mode === 'build' ? 'active' : ''}`}
                        onClick={() => {
                          onModeChange('build');
                          setModeSelectorOpen(false);
                        }}
                      >
                        <Hammer size={14} />
                        Build
                      </button>
                      <button
                        className={`dropdown-option ${mode === 'ask' ? 'active' : ''}`}
                        onClick={() => {
                          onModeChange('ask');
                          setModeSelectorOpen(false);
                        }}
                      >
                        <Bot size={14} />
                        Ask
                      </button>
                      <button
                        className={`dropdown-option ${mode === 'edit' ? 'active' : ''}`}
                        onClick={() => {
                          onModeChange('edit');
                          setModeSelectorOpen(false);
                        }}
                      >
                        <Edit3 size={14} />
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="toolbar-right">
            <button
              className="send-btn"
              onClick={onSendMessage}
              disabled={loading || !prompt.trim()}
              title={
                mode === 'edit' ? '发送编辑指令' :
                mode === 'ask' ? '发送' :
                '发送'
              }
            >
              {loading ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
