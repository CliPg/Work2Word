import React from 'react';
import { Code, Copy, Check } from 'lucide-react';
import './MarkdownEditor.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (value) {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="markdown-editor">
      <div className="editor-header">
        <div className="editor-title">
          <Code size={16} />
          <span>Markdown 编辑器</span>
        </div>
        <div className="editor-actions">
          <button 
            className="editor-action-btn"
            onClick={handleCopy}
            disabled={!value}
            title="复制内容"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </div>
      <div className="editor-body">
        <div className="line-numbers">
          {value.split('\n').map((_, index) => (
            <div key={index} className="line-number">{index + 1}</div>
          ))}
          {!value && <div className="line-number">1</div>}
        </div>
        <textarea
          className="editor-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="AI 生成的 Markdown 内容将显示在这里，你可以直接编辑..."
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default MarkdownEditor;
