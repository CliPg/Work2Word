import React, { useState } from 'react';
import { FileText, File, FileCode, Loader2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './ResultDisplay.css';

interface ResultDisplayProps {
  result: string;
  loading: boolean;
  error: string;
  success?: string;
  onSave: (format: 'doc' | 'pdf' | 'md') => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({
  result,
  loading,
  error,
  success,
  onSave,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div className="result-display">
      <div className="result-header">
        <h2 className="section-title">处理结果</h2>
        {result && (
          <div className="result-actions">
            <button className="copy-btn" onClick={handleCopy}>
              {copySuccess ? '已复制' : '复制'}
            </button>
          </div>
        )}
      </div>

      <div className="result-content">
        {loading ? (
          <div className="result-loading">
            <Loader2 className="icon spin" />
            <p>AI 正在处理中，请稍候...</p>
          </div>
        ) : error ? (
          <div className="result-error">
            <AlertCircle className="icon" />
            <p>{error}</p>
          </div>
        ) : success ? (
          <div className="result-success">
            <p>{success}</p>
          </div>
        ) : result ? (
          <div className="result-markdown">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        ) : (
          <div className="result-empty">
            <FileText className="icon" />
            <p>处理结果将显示在这里</p>
          </div>
        )}
      </div>

      {result && !loading && (
        <div className="result-footer">
          <p className="save-label">保存为：</p>
          <div className="save-buttons">
            <button
              className="save-btn"
              onClick={() => onSave('md')}
              title="Markdown"
            >
              <FileCode className="btn-icon" />
              MD
            </button>
            <button
              className="save-btn"
              onClick={() => onSave('doc')}
              title="Word 文档"
            >
              <FileText className="btn-icon" />
              DOC
            </button>
            <button
              className="save-btn"
              onClick={() => onSave('pdf')}
              title="PDF 文档"
            >
              <File className="btn-icon" />
              PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultDisplay;

