import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { FileText, Loader2, FileCode, File, ImageOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './WordPreview.css';

export interface WordPreviewHandle {
  scrollTo: (scrollPercent: number) => void;
}

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
  onScroll?: (scrollPercent: number) => void;
}

// 字体名称到 CSS 字体栈的映射
const fontFamilyMap: Record<string, string> = {
  '宋体': '"SimSun", "宋体", "STSong", "华文宋体", serif',
  '黑体': '"SimHei", "黑体", "STHeiti", "华文黑体", sans-serif',
  '楷体': '"KaiTi", "楷体", "STKaiti", "华文楷体", serif',
  '仿宋': '"FangSong", "仿宋", "STFangsong", "华文仿宋", serif',
  '微软雅黑': '"Microsoft YaHei", "微软雅黑", "PingFang SC", "苹方", sans-serif',
  'Arial': 'Arial, "Helvetica Neue", Helvetica, sans-serif',
  'Times New Roman': '"Times New Roman", Times, "Georgia", serif',
};

// 获取完整的 CSS 字体栈
const getFontStack = (fontName: string): string => {
  return fontFamilyMap[fontName] || `"${fontName}", sans-serif`;
};

// 自定义图片组件
const CustomImage = ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  // 处理相对路径的图片
  const getImageSrc = (src: string): string => {
    if (!src) return '';

    // 如果是 ./assets/images/ 开头的相对路径，转换为完整的文件路径
    if (src.startsWith('./assets/images/') || src.startsWith('assets/images/')) {
      const fileName = src.split('/').pop() || '';
      // 在 Electron 环境中，使用用户文档目录
      if (window.electronAPI) {
        // 使用特殊的协议来标记需要通过 Electron 处理的图片
        return `work2word-local://${fileName}`;
      }
      // 开发环境中的回退处理
      return src;
    }

    // 如果是 http/https URL，直接返回
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return src;
    }

    // 其他情况，返回原始路径
    return src;
  };

  const imageSrc = getImageSrc(src || '');

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  const handleLoad = () => {
    setLoading(false);
  };

  // 如果图片加载失败，显示占位符
  if (error) {
    return (
      <div className="image-error" title={`图片加载失败: ${alt || src}`}>
        <ImageOff size={24} />
        <span>{alt || '图片'}</span>
        <small>{src}</small>
      </div>
    );
  }

  return (
    <div className="markdown-image-wrapper">
      {loading && <div className="image-loading">加载中...</div>}
      <img
        src={imageSrc}
        alt={alt}
        loading="lazy"
        onError={handleError}
        onLoad={handleLoad}
        {...props}
      />
    </div>
  );
};

const WordPreview = forwardRef<WordPreviewHandle, WordPreviewProps>(({
  content,
  loading = false,
  onSave,
  formatSettings,
  onScroll,
}, ref) => {
  const previewBodyRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // 暴露滚动方法给父组件
  useImperativeHandle(ref, () => ({
    scrollTo: (scrollPercent: number) => {
      if (previewBodyRef.current && !isScrollingRef.current) {
        isScrollingRef.current = true;
        const maxScroll = previewBodyRef.current.scrollHeight - previewBodyRef.current.clientHeight;
        previewBodyRef.current.scrollTop = maxScroll * scrollPercent;
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 50);
      }
    }
  }));

  // 处理滚动事件
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const maxScroll = target.scrollHeight - target.clientHeight;
    const scrollPercent = maxScroll > 0 ? target.scrollTop / maxScroll : 0;
    
    if (onScroll && !isScrollingRef.current) {
      onScroll(scrollPercent);
    }
  };
  // 生成 CSS 变量样式
  const getCSSVariables = (): Record<string, string | number> => {
    if (!formatSettings) return {};
    
    return {
      '--para-font': getFontStack(formatSettings.paragraph.fontFamily),
      '--para-size': `${formatSettings.paragraph.fontSize}pt`,
      '--para-line-height': String(formatSettings.paragraph.lineHeight),
      '--para-spacing': `${formatSettings.paragraph.paragraphSpacing}pt`,
      '--para-indent': `${formatSettings.paragraph.firstLineIndent}em`,
      '--h1-font': getFontStack(formatSettings.heading1.fontFamily),
      '--h1-size': `${formatSettings.heading1.fontSize}pt`,
      '--h1-line-height': String(formatSettings.heading1.lineHeight),
      '--h1-align': formatSettings.heading1.alignment,
      '--h1-before': `${formatSettings.heading1.spacingBefore}pt`,
      '--h1-after': `${formatSettings.heading1.spacingAfter}pt`,
      '--h2-font': getFontStack(formatSettings.heading2.fontFamily),
      '--h2-size': `${formatSettings.heading2.fontSize}pt`,
      '--h2-line-height': String(formatSettings.heading2.lineHeight),
      '--h2-align': formatSettings.heading2.alignment,
      '--h2-before': `${formatSettings.heading2.spacingBefore}pt`,
      '--h2-after': `${formatSettings.heading2.spacingAfter}pt`,
      '--h3-font': getFontStack(formatSettings.heading3.fontFamily),
      '--h3-size': `${formatSettings.heading3.fontSize}pt`,
      '--h3-line-height': String(formatSettings.heading3.lineHeight),
      '--h3-align': formatSettings.heading3.alignment,
      '--h3-before': `${formatSettings.heading3.spacingBefore}pt`,
      '--h3-after': `${formatSettings.heading3.spacingAfter}pt`,
      '--h4-font': getFontStack(formatSettings.heading4.fontFamily),
      '--h4-size': `${formatSettings.heading4.fontSize}pt`,
      '--h4-line-height': String(formatSettings.heading4.lineHeight),
      '--h4-align': formatSettings.heading4.alignment,
      '--h4-before': `${formatSettings.heading4.spacingBefore}pt`,
      '--h4-after': `${formatSettings.heading4.spacingAfter}pt`,
    };
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
      <div className="preview-body" ref={previewBodyRef} onScroll={handleScroll}>
        {loading ? (
          <div className="preview-loading">
            <Loader2 className="spin" size={32} />
            <p>正在生成预览...</p>
          </div>
        ) : content ? (
          <div className="preview-document">
            <div className="document-paper" style={getCSSVariables() as React.CSSProperties}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  img: CustomImage,
                }}
              >
                {content}
              </ReactMarkdown>
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
});

WordPreview.displayName = 'WordPreview';

export default WordPreview;
