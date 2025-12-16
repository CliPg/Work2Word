import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Settings, File, Loader2, MessageSquare, ChevronDown, ChevronUp, X, Type, Edit3 } from 'lucide-react';
import './Sidebar.css';

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
  
  // 编辑模式
  isEditMode: boolean;
  onToggleEditMode: () => void;
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
  isEditMode,
  onToggleEditMode,
  hasContent,
}) => {
  const [configExpanded, setConfigExpanded] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fileName = filePath ? filePath.split('/').pop() || filePath.split('\\').pop() : '';

  useEffect(() => {
    // 使用容器的 scrollTop 而不是 scrollIntoView，避免影响页面滚动
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

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

  return (
    <div className="sidebar">
      {/* 标题栏 */}
      <div className="sidebar-header">
        <div className="sidebar-title">
          <MessageSquare size={16} />
          <span>Work2Word</span>
        </div>
      </div>

      {/* 文件上传区域 */}
      <div className="sidebar-section file-section">
        <div className="section-header">
          <Upload size={14} />
          <span>作业附件</span>
        </div>
        <div 
          className={`file-upload-area ${filePath ? 'has-file' : ''}`}
          onClick={onFileSelect}
        >
          {fileLoading ? (
            <>
              <Loader2 size={16} className="spin" />
              <span>处理中...</span>
            </>
          ) : filePath ? (
            <>
              <File size={16} />
              <span className="file-name" title={fileName}>{fileName}</span>
              <div className="file-actions">
                <button 
                  className="change-file-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileSelect();
                  }}
                  title="更换文件"
                >
                  更换
                </button>
                <button 
                  className="remove-file-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileRemove();
                  }}
                  title="删除文件"
                >
                  <X size={14} />
                </button>
              </div>
            </>
          ) : (
            <>
              <Upload size={16} />
              <span>点击上传文件</span>
            </>
          )}
        </div>
        <div className="file-hint">支持 DOC、DOCX、PDF、TXT</div>
      </div>

      {/* LLM 配置区域 */}
      <div className="sidebar-section config-section">
        <div 
          className="section-header clickable"
          onClick={() => setConfigExpanded(!configExpanded)}
        >
          <Settings size={14} />
          <span>模型配置</span>
          {configExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
        {configExpanded && (
          <div className="config-content">
            <div className="config-field">
              <label>提供商</label>
              <select
                value={llmConfig.provider}
                onChange={(e) => {
                  const provider = e.target.value as 'qwen' | 'openai' | 'custom';
                  updateConfig({
                    provider,
                    model: provider === 'qwen' ? 'qwen-turbo' : provider === 'openai' ? 'gpt-3.5-turbo' : '',
                  });
                }}
                disabled={loading}
              >
                <option value="qwen">通义千问</option>
                <option value="openai">OpenAI</option>
                <option value="custom">自定义</option>
              </select>
            </div>
            <div className="config-field">
              <label>API Key</label>
              <input
                type="password"
                value={llmConfig.apiKey}
                onChange={(e) => updateConfig({ apiKey: e.target.value })}
                disabled={loading}
                placeholder="输入 API Key"
              />
            </div>
            {llmConfig.provider === 'custom' && (
              <div className="config-field">
                <label>API URL</label>
                <input
                  type="text"
                  value={llmConfig.apiUrl}
                  onChange={(e) => updateConfig({ apiUrl: e.target.value })}
                  disabled={loading}
                  placeholder="API 地址"
                />
              </div>
            )}
            <div className="config-field">
              <label>模型</label>
              <input
                type="text"
                value={llmConfig.model}
                onChange={(e) => updateConfig({ model: e.target.value })}
                disabled={loading}
                placeholder="模型名称"
              />
            </div>
          </div>
        )}
      </div>

      {/* 排版设置按钮 */}
      <div className="sidebar-section format-section">
        <div 
          className="section-header clickable"
          onClick={onOpenFormatSettings}
        >
          <Type size={14} />
          <span>排版格式</span>
          <ChevronDown size={14} style={{ transform: 'rotate(-90deg)' }} />
        </div>
      </div>

      {/* 编辑模式切换 */}
      {hasContent && (
        <div className="sidebar-section edit-mode-section">
          <div 
            className={`section-header clickable edit-mode-toggle ${isEditMode ? 'active' : ''}`}
            onClick={onToggleEditMode}
          >
            <Edit3 size={14} />
            <span>AI 编辑模式</span>
            <div className={`toggle-switch ${isEditMode ? 'on' : ''}`}>
              <div className="toggle-knob" />
            </div>
          </div>
          {isEditMode && (
            <div className="edit-mode-hint">
              发送指令让 AI 修改现有内容，可预览并选择接受或拒绝
            </div>
          )}
        </div>
      )}

      {/* 对话区域 */}
      <div className="sidebar-section chat-section">
        <div className="section-header">
          <MessageSquare size={14} />
          <span>对话</span>
        </div>
        <div className="messages-container" ref={messagesContainerRef}>
          {messages.length === 0 ? (
            <div className="messages-empty">
              <p>{isEditMode ? '输入编辑指令修改内容' : '输入作业要求开始处理'}</p>
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

        {/* 输入区域 */}
        <div className={`chat-input-container ${isEditMode ? 'edit-mode' : ''}`}>
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isEditMode ? '输入编辑指令，如：把第一段改成更正式的语气...' : '输入作业要求...'}
            disabled={loading}
            rows={3}
          />
          <button
            className="send-btn"
            onClick={onSendMessage}
            disabled={loading || !prompt.trim()}
            title={isEditMode ? '发送编辑指令' : '发送'}
          >
            {loading ? <Loader2 size={16} className="spin" /> : isEditMode ? <Edit3 size={16} /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
