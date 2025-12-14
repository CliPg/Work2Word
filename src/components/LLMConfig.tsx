import React from 'react';
import { Settings } from 'lucide-react';
import './LLMConfig.css';

interface LLMConfigType {
  provider: 'qwen' | 'openai' | 'custom';
  apiKey: string;
  apiUrl: string;
  model: string;
}

interface LLMConfigProps {
  config: LLMConfigType;
  onChange: (config: LLMConfigType) => void;
  disabled: boolean;
}

const LLMConfig: React.FC<LLMConfigProps> = ({ config, onChange, disabled }) => {
  const updateConfig = (updates: Partial<LLMConfigType>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="llm-config">
      <div className="config-header">
        <Settings className="icon" />
        <h2 className="section-title">LLM 配置</h2>
      </div>

      <div className="config-content">
        <div className="config-field">
          <label>提供商</label>
          <select
            value={config.provider}
            onChange={(e) => {
              const provider = e.target.value as 'qwen' | 'openai' | 'custom';
              updateConfig({
                provider,
                model: provider === 'qwen' ? 'qwen-turbo' : provider === 'openai' ? 'gpt-3.5-turbo' : '',
              });
            }}
            disabled={disabled}
            className="config-select"
          >
            <option value="qwen">通义千问 (Qwen)</option>
            <option value="openai">OpenAI</option>
            <option value="custom">自定义 API</option>
          </select>
        </div>

        <div className="config-field">
          <label>API Key</label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => updateConfig({ apiKey: e.target.value })}
            disabled={disabled}
            placeholder="请输入 API Key"
            className="config-input"
          />
        </div>

        {config.provider === 'custom' && (
          <div className="config-field">
            <label>API URL</label>
            <input
              type="text"
              value={config.apiUrl}
              onChange={(e) => updateConfig({ apiUrl: e.target.value })}
              disabled={disabled}
              placeholder="https://api.example.com/v1/chat"
              className="config-input"
            />
          </div>
        )}

        <div className="config-field">
          <label>模型名称</label>
          <input
            type="text"
            value={config.model}
            onChange={(e) => updateConfig({ model: e.target.value })}
            disabled={disabled}
            placeholder={config.provider === 'qwen' ? 'qwen-turbo' : 'gpt-3.5-turbo'}
            className="config-input"
          />
        </div>
      </div>
    </div>
  );
};

export default LLMConfig;

