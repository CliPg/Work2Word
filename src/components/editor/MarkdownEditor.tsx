import React, { useRef, useImperativeHandle, forwardRef, useMemo, useState } from 'react';
import { Code, Copy, Check, CheckCircle, XCircle, Image, FileUp } from 'lucide-react';
import './MarkdownEditor.css';

// 编辑修改项接口
export interface EditChange {
  searchText: string;
  replaceText: string;
  description: string;
}

export interface MarkdownEditorHandle {
  scrollTo: (scrollPercent: number) => void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onScroll?: (scrollPercent: number) => void;
  // 编辑建议相关
  pendingChanges?: EditChange[];
  onAcceptChange?: (index: number) => void;
  onRejectChange?: (index: number) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  // 图片插入相关
  onInsertImage?: (relativePath: string, alt?: string) => void;
}

// 将内容分割成段落，标记哪些需要显示 diff
interface ContentSegment {
  type: 'normal' | 'change';
  content: string;
  changeIndex?: number;
  change?: EditChange;
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(({
  value,
  onChange,
  disabled = false,
  onScroll,
  pendingChanges = [],
  onAcceptChange,
  onRejectChange,
  onAcceptAll,
  onRejectAll,
  onInsertImage,
}, ref) => {
  const [copied, setCopied] = React.useState(false);
  const [insertingImage, setInsertingImage] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // 暴露滚动方法给父组件
  useImperativeHandle(ref, () => ({
    scrollTo: (scrollPercent: number) => {
      const scrollTarget = pendingChanges.length > 0 ? editorContainerRef.current : textareaRef.current;
      if (scrollTarget && !isScrollingRef.current) {
        isScrollingRef.current = true;
        const maxScroll = scrollTarget.scrollHeight - scrollTarget.clientHeight;
        scrollTarget.scrollTop = maxScroll * scrollPercent;
        // 同步行号滚动
        if (lineNumbersRef.current && !pendingChanges.length) {
          lineNumbersRef.current.scrollTop = scrollTarget.scrollTop;
        }
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 50);
      }
    }
  }));

  // 处理滚动事件
  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const target = e.currentTarget;
    const maxScroll = target.scrollHeight - target.clientHeight;
    const scrollPercent = maxScroll > 0 ? target.scrollTop / maxScroll : 0;
    
    // 同步行号滚动
    if (lineNumbersRef.current && !pendingChanges.length) {
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

  const handleInsertImage = async () => {
    if (!window.electronAPI) {
      alert('Electron API 不可用，请在桌面应用中使用此功能');
      return;
    }

    setInsertingImage(true);
    try {
      const result = await window.electronAPI.selectAndSaveImage();
      if (result.success && result.relativePath) {
        // 获取当前光标位置
        const textarea = textareaRef.current;
        const start = textarea?.selectionStart || value.length;
        const end = textarea?.selectionEnd || value.length;

        // 获取图片文件名作为默认 alt 文本
        const fileName = result.relativePath.split('/').pop() || '';
        const altText = fileName.replace(/\.[^/.]+$/, ''); // 移除扩展名

        // 构建 Markdown 图片语法
        const imageMarkdown = `![${altText}](${result.relativePath})`;

        // 插入到文本中
        const newValue =
          value.substring(0, start) + imageMarkdown + value.substring(end);
        onChange(newValue);

        // 设置光标位置到插入的图片后面
        setTimeout(() => {
          if (textarea) {
            const newPosition = start + imageMarkdown.length;
            textarea.setSelectionRange(newPosition, newPosition);
            textarea.focus();
          }
        }, 0);

        // 调用回调通知父组件
        if (onInsertImage) {
          onInsertImage(result.relativePath, altText);
        }
      }
    } catch (error: any) {
      console.error('插入图片失败:', error);
      alert(`插入图片失败: ${error.message}`);
    } finally {
      setInsertingImage(false);
    }
  };

  const handleImportFile = async () => {
    if (!window.electronAPI) {
      alert('Electron API 不可用，请在桌面应用中使用此功能');
      return;
    }

    setImportingFile(true);
    try {
      const result = await window.electronAPI.openMarkdownFileDialog();
      if (!result.canceled && result.filePath) {
        // 调用 processFile 来读取文件内容
        const fileResult = await window.electronAPI.processFile(result.filePath);
        if (fileResult.success && fileResult.content) {
          const content = fileResult.content;
          // 如果编辑器已有内容，询问是否追加
          if (value.trim() && value.trim() !== content.trim()) {
            const shouldAppend = confirm('编辑器已有内容，是否要追加导入的内容？\n\n点击"确定"追加内容，点击"取消"替换现有内容。');
            if (shouldAppend) {
              // 追加内容：在现有内容后添加两个换行符，然后添加新内容
              onChange(value + '\n\n' + content);
            } else {
              // 替换内容
              onChange(content);
            }
          } else {
            // 编辑器为空或内容相同，直接设置
            onChange(content);
          }
        } else if (fileResult.error) {
          alert(`导入文件失败: ${fileResult.error}`);
        }
      }
    } catch (error: any) {
      console.error('导入文件失败:', error);
      alert(`导入文件失败: ${error.message}`);
    } finally {
      setImportingFile(false);
    }
  };

  // 计算内容段落，标记需要修改的部分
  const segments = useMemo((): ContentSegment[] => {
    if (pendingChanges.length === 0) {
      return [{ type: 'normal', content: value }];
    }

    const result: ContentSegment[] = [];
    let processedChanges: { start: number; end: number; change: EditChange; index: number }[] = [];

    // 找出所有修改的位置
    pendingChanges.forEach((change, index) => {
      const start = value.indexOf(change.searchText);
      if (start !== -1) {
        processedChanges.push({
          start,
          end: start + change.searchText.length,
          change,
          index
        });
      }
    });

    // 按位置排序
    processedChanges.sort((a, b) => a.start - b.start);

    let currentPos = 0;
    for (const pc of processedChanges) {
      // 添加修改前的普通内容
      if (pc.start > currentPos) {
        result.push({
          type: 'normal',
          content: value.substring(currentPos, pc.start)
        });
      }
      // 添加修改部分
      result.push({
        type: 'change',
        content: pc.change.searchText,
        changeIndex: pc.index,
        change: pc.change
      });
      currentPos = pc.end;
    }

    // 添加剩余内容
    if (currentPos < value.length) {
      result.push({
        type: 'normal',
        content: value.substring(currentPos)
      });
    }

    return result;
  }, [value, pendingChanges]);

  const hasChanges = pendingChanges.length > 0;

  // 普通编辑模式
  if (!hasChanges) {
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
              onClick={handleImportFile}
              disabled={disabled || importingFile}
              title="导入文件"
            >
              <FileUp size={14} />
              {importingFile ? '导入中...' : '导入'}
            </button>
            <button
              className="editor-action-btn"
              onClick={handleInsertImage}
              disabled={disabled || insertingImage}
              title="插入图片"
            >
              <Image size={14} />
              {insertingImage ? '插入中...' : '图片'}
            </button>
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
  }

  // 有修改建议时的 Diff 模式
  return (
    <div className="markdown-editor has-changes">
      <div className="editor-header">
        <div className="editor-title">
          <Code size={16} />
          <span>Markdown 编辑器</span>
          <span className="changes-badge">{pendingChanges.length} 处修改</span>
        </div>
        <div className="editor-actions">
          <button 
            className="editor-action-btn accept-all"
            onClick={onAcceptAll}
            title="接受所有修改"
          >
            <CheckCircle size={14} />
            全部接受
          </button>
          <button 
            className="editor-action-btn reject-all"
            onClick={onRejectAll}
            title="拒绝所有修改"
          >
            <XCircle size={14} />
            全部拒绝
          </button>
        </div>
      </div>
      <div 
        className="editor-body diff-mode" 
        ref={editorContainerRef}
        onScroll={handleScroll}
      >
        <div className="diff-content">
          {segments.map((segment, idx) => {
            if (segment.type === 'normal') {
              return (
                <span key={idx} className="segment-normal">
                  {segment.content}
                </span>
              );
            } else {
              return (
                <span key={idx} className="segment-change">
                  <span className="change-wrapper">
                    <span className="change-deleted">{segment.content}</span>
                    <span className="change-added">{segment.change?.replaceText}</span>
                    <span className="change-actions">
                      <button
                        className="change-btn accept"
                        onClick={() => onAcceptChange?.(segment.changeIndex!)}
                        title={`接受: ${segment.change?.description}`}
                      >
                        <CheckCircle size={12} />
                      </button>
                      <button
                        className="change-btn reject"
                        onClick={() => onRejectChange?.(segment.changeIndex!)}
                        title="拒绝修改"
                      >
                        <XCircle size={12} />
                      </button>
                    </span>
                  </span>
                </span>
              );
            }
          })}
        </div>
      </div>
    </div>
  );
});

MarkdownEditor.displayName = 'MarkdownEditor';

export default MarkdownEditor;
