import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Settings, File, Loader2, MessageSquare, ChevronDown, ChevronUp, X } from 'lucide-react';
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
  fileLoading: boolean;
  
  // 对话
  prompt: string;
  onPromptChange: (value: string) => void;
  onSendMessage: () => void;
  messages: Message[];
  
  // LLM 配置
  llmConfig: LLMConfigType;
  onConfigChange: (config: LLMConfigType) => void;
  
  // 状态
  loading: boolean;
  processingStep: string;
  error: string;
  success: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  filePath,
  onFileSelect,
  fileLoading,
  prompt,
  onPromptChange,
  onSendMessage,
  messages,
  llmConfig,
  onConfigChange,
  loading,
  processingStep,
  error,
  success,
}) => {
  const [configExpanded, setConfigExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fileName = filePath ? filePath.split('/').pop() || filePath.split('\\').pop() : '';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
              <button 
                className="change-file-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onFileSelect();
                }}
              >
                更换
              </button>
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

      {/* 对话区域 */}
      <div className="sidebar-section chat-section">
        <div className="section-header">
          <MessageSquare size={14} />
          <span>对话</span>
        </div>
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="messages-empty">
              <p>输入作业要求开始处理</p>
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
          <div ref={messagesEndRef} />
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
        <div className="chat-input-container">
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入作业要求..."
            disabled={loading}
            rows={3}
          />
          <button
            className="send-btn"
            onClick={onSendMessage}
            disabled={loading || !prompt.trim() || !filePath}
            title={!filePath ? '请先上传文件' : '发送'}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
