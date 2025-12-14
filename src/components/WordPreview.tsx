import React from 'react';
import { FileText, Loader2, FileCode, File } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './WordPreview.css';

interface ParagraphStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  firstLineIndent: number;
}

interface HeadingStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  alignment: 'left' | 'center' | 'right' | 'justify';
  spacingBefore: number;
  spacingAfter: number;
}

interface FormatSettings {
  paragraph: ParagraphStyle;
  heading1: HeadingStyle;
  heading2: HeadingStyle;
  heading3: HeadingStyle;
  heading4: HeadingStyle;
}

interface WordPreviewProps {
  content: string;
  loading?: boolean;
  onSave: (format: 'doc' | 'pdf' | 'md') => void;
  formatSettings?: FormatSettings;
}

const WordPreview: React.FC<WordPreviewProps> = ({
  content,
  loading = false,
  onSave,
  formatSettings,
}) => {
  // 生成 CSS 变量样式
  const getCSSVariables = (): React.CSSProperties => {
    if (!formatSettings) return {};
    
    return {
      '--para-font': formatSettings.paragraph.fontFamily,
      '--para-size': `${formatSettings.paragraph.fontSize}pt`,
      '--para-line-height': formatSettings.paragraph.lineHeight,
      '--para-spacing': `${formatSettings.paragraph.paragraphSpacing}pt`,
      '--para-indent': `${formatSettings.paragraph.firstLineIndent}em`,
      '--h1-font': formatSettings.heading1.fontFamily,
      '--h1-size': `${formatSettings.heading1.fontSize}pt`,
      '--h1-line-height': formatSettings.heading1.lineHeight,
      '--h1-align': formatSettings.heading1.alignment,
      '--h1-before': `${formatSettings.heading1.spacingBefore}pt`,
      '--h1-after': `${formatSettings.heading1.spacingAfter}pt`,
      '--h2-font': formatSettings.heading2.fontFamily,
      '--h2-size': `${formatSettings.heading2.fontSize}pt`,
      '--h2-line-height': formatSettings.heading2.lineHeight,
      '--h2-align': formatSettings.heading2.alignment,
      '--h2-before': `${formatSettings.heading2.spacingBefore}pt`,
      '--h2-after': `${formatSettings.heading2.spacingAfter}pt`,
      '--h3-font': formatSettings.heading3.fontFamily,
      '--h3-size': `${formatSettings.heading3.fontSize}pt`,
      '--h3-line-height': formatSettings.heading3.lineHeight,
      '--h3-align': formatSettings.heading3.alignment,
      '--h3-before': `${formatSettings.heading3.spacingBefore}pt`,
      '--h3-after': `${formatSettings.heading3.spacingAfter}pt`,
      '--h4-font': formatSettings.heading4.fontFamily,
      '--h4-size': `${formatSettings.heading4.fontSize}pt`,
      '--h4-line-height': formatSettings.heading4.lineHeight,
      '--h4-align': formatSettings.heading4.alignment,
      '--h4-before': `${formatSettings.heading4.spacingBefore}pt`,
      '--h4-after': `${formatSettings.heading4.spacingAfter}pt`,
    } as React.CSSProperties;
  };

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
            <div className="document-paper" style={getCSSVariables()}>
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
