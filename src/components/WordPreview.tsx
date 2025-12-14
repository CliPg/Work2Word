import React from 'react';
import { FileText, Loader2, FileCode, File } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './WordPreview.css';

interface WordPreviewProps {
  content: string;
  loading?: boolean;
  onSave: (format: 'doc' | 'pdf' | 'md') => void;
}

const WordPreview: React.FC<WordPreviewProps> = ({
  content,
  loading = false,
  onSave,
}) => {
  return (
    <div className="word-preview">
      <div className="preview-header">
        <div className="preview-title">
          <FileText size={16} />
          <span>文档预览</span>
        </div>
        <div className="preview-actions">
          {content && (
            <>
              <button 
                className="preview-action-btn"
                onClick={() => onSave('md')}
                title="保存为 Markdown"
              >
                <FileCode size={14} />
                MD
              </button>
              <button 
                className="preview-action-btn"
                onClick={() => onSave('doc')}
                title="保存为 Word"
              >
                <FileText size={14} />
                DOC
              </button>
              <button 
                className="preview-action-btn"
                onClick={() => onSave('pdf')}
                title="保存为 PDF"
              >
                <File size={14} />
                PDF
              </button>
            </>
          )}
        </div>
      </div>
      <div className="preview-body">
        {loading ? (
          <div className="preview-loading">
            <Loader2 className="spin" size={32} />
            <p>正在生成预览...</p>
          </div>
        ) : content ? (
          <div className="preview-document">
            <div className="document-paper">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="preview-empty">
            <FileText size={48} strokeWidth={1} />
            <p>文档预览</p>
            <span>处理完成后将在这里显示 Word 样式预览</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WordPreview;
