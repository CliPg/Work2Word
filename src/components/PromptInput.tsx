import React from 'react';
import { Send } from 'lucide-react';
import './PromptInput.css';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onProcess: () => void;
  disabled: boolean;
}

const PromptInput: React.FC<PromptInputProps> = ({
  value,
  onChange,
  onProcess,
  disabled,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onProcess();
      }
    }
  };

  return (
    <div className="prompt-input">
      <h2 className="section-title">作业要求</h2>
      <div className="input-wrapper">
        <textarea
          className="prompt-textarea"
          placeholder="请输入作业要求，例如：请分析附件中的文章，并写一篇 500 字的读后感..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={6}
        />
        <button
          className="process-btn"
          onClick={onProcess}
          disabled={disabled || !value.trim()}
        >
          <Send className="btn-icon" />
          开始处理
        </button>
      </div>
      <p className="hint">按 ⌘ + Enter 或 Ctrl + Enter 快速处理</p>
    </div>
  );
};

export default PromptInput;

