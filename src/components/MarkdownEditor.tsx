import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { Code, Copy, Check } from 'lucide-react';
import './MarkdownEditor.css';

export interface MarkdownEditorHandle {
  scrollTo: (scrollPercent: number) => void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onScroll?: (scrollPercent: number) => void;
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(({
  value,
  onChange,
  disabled = false,
  onScroll,
}, ref) => {
  const [copied, setCopied] = React.useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // 暴露滚动方法给父组件
  useImperativeHandle(ref, () => ({
    scrollTo: (scrollPercent: number) => {
      if (textareaRef.current && !isScrollingRef.current) {
        isScrollingRef.current = true;
        const maxScroll = textareaRef.current.scrollHeight - textareaRef.current.clientHeight;
        textareaRef.current.scrollTop = maxScroll * scrollPercent;
        // 同步行号滚动
        if (lineNumbersRef.current) {
          lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
        }
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 50);
      }
    }
  }));

  // 处理滚动事件
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const maxScroll = target.scrollHeight - target.clientHeight;
    const scrollPercent = maxScroll > 0 ? target.scrollTop / maxScroll : 0;
    
    // 同步行号滚动
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = target.scrollTop;
    }
    
    // 通知父组件滚动位置
    if (onScroll && !isScrollingRef.current) {
      onScroll(scrollPercent);
    }
  };

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
        <div className="line-numbers" ref={lineNumbersRef}>
          {value.split('\n').map((_, index) => (
            <div key={index} className="line-number">{index + 1}</div>
          ))}
          {!value && <div className="line-number">1</div>}
        </div>
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          disabled={disabled}
          placeholder="AI 生成的 Markdown 内容将显示在这里，你可以直接编辑..."
          spellCheck={false}
        />
      </div>
    </div>
  );
});

MarkdownEditor.displayName = 'MarkdownEditor';

export default MarkdownEditor;
