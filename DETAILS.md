## 图片插入与渲染

**WordPreview.tsx**
```
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
```

**MarkdownEditor**
```
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
```

**fileProcessor**
```
// 收集 Markdown tokens 中的图片路径
function collectImagePaths(token: any, imageMap: Map<string, Buffer>) {
  if (token.type === 'image') {
    const imagePath = token.href || '';
    if (imagePath) {
      imageMap.set(imagePath, Buffer.alloc(0)); // 占位符
    }
  }
  // 递归处理子 tokens
  if (token.tokens && Array.isArray(token.tokens)) {
    for (const childToken of token.tokens) {
      collectImagePaths(childToken, imageMap);
    }
  }
  // 特殊处理列表项
  if (token.items && Array.isArray(token.items)) {
    for (const item of token.items) {
      if (item.tokens && Array.isArray(item.tokens)) {
        for (const childToken of item.tokens) {
          collectImagePaths(childToken, imageMap);
        }
      }
    }
  }
}

// 将 Markdown 转换为段落数组（使用 marked 解析器）
async function markdownToParagraphs(mdContent: string, formatSettings?: FormatSettings): Promise<(Paragraph | Table)[]> {
  const elements: (Paragraph | Table)[] = [];

  // 预处理：收集所有图片路径并加载数据
  const imageMap = new Map<string, Buffer>();

  // 使用 marked.lexer 解析 Markdown 为 tokens
  const tokens = marked.lexer(mdContent);

  // 首先遍历 tokens 收集图片路径
  for (const token of tokens) {
    collectImagePaths(token, imageMap);
  }

  // 加载所有图片数据
  for (const [imagePath, buffer] of imageMap) {
    // 跳过已经加载的 buffer
    if (imagePath.endsWith('::__buffer__')) {
      continue;
    }

    try {
      let imageBuffer: Buffer | null = null;

      // 处理 work2word-local:// 协议
      if (imagePath.startsWith('work2word-local://')) {
        const fileName = imagePath.replace('work2word-local://', '');
        const { app: electronApp } = require('electron');
        if (electronApp) {
          const documentsPath = electronApp.getPath('documents');
          const fullImagePath = path.join(documentsPath, 'Work2Word_Assets', 'images', fileName);
          imageBuffer = await fs.readFile(fullImagePath);
        }
      }
      // 处理 ./assets/images/ 或 assets/images/ 相对路径
      else if (imagePath.startsWith('./assets/images/') || imagePath.startsWith('assets/images/')) {
        const fileName = imagePath.split('/').pop() || '';
        const { app: electronApp } = require('electron');
        if (electronApp) {
          const documentsPath = electronApp.getPath('documents');
          const fullImagePath = path.join(documentsPath, 'Work2Word_Assets', 'images', fileName);
          imageBuffer = await fs.readFile(fullImagePath);
        }
      }
      // 处理 http/https URL
      else if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        try {
          const response = await fetch(imagePath);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
          }
        } catch (fetchError) {
          console.error('下载网络图片失败:', imagePath, fetchError);
        }
      }
      // 处理本地绝对路径
      else {
        imageBuffer = await fs.readFile(imagePath);
      }

      if (imageBuffer) {
        // 存储图片 buffer
        imageMap.set(imagePath + '::__buffer__', imageBuffer);
        console.log('成功加载图片:', imagePath, '大小:', imageBuffer.length);
      }
    } catch (error) {
      console.error('无法加载图片:', imagePath, error);
    }
  }

  for (const token of tokens) {
    try {
      const tokenType = token.type as string;
      
      switch (tokenType) {
        case 'heading':
          elements.push(createHeadingParagraph(token, formatSettings));
          break;
        case 'paragraph':
          // 检查段落是否包含图片
          const tokenAny = token as any;
          if (tokenAny.tokens && Array.isArray(tokenAny.tokens)) {
            const hasImage = tokenAny.tokens.some((t: any) => t.type === 'image');
            if (hasImage) {
              // 处理包含图片的段落
              for (const innerToken of tokenAny.tokens) {
                if (innerToken.type === 'image') {
                  const imagePath = innerToken.href || '';
                  const imageBuffer = imageMap.get(imagePath + '::__buffer__');
                  const altText = innerToken.text || innerToken.alt || '图片';

                  if (imageBuffer && imageBuffer.length > 0) {
                    try {
                      const width = 400;
                      const height = 300;

                      elements.push(new Paragraph({
                        children: [new ImageRun({
                          data: imageBuffer,
                          transformation: {
                            width,
                            height,
                          },
                        })],
                        alignment: AlignmentType.CENTER,
                        spacing: {
                          before: 200,
                          after: 200,
                        },
                      }));
                    } catch (error) {
                      console.warn('插入内嵌图片失败，使用占位符:', imagePath, error);
                      elements.push(new Paragraph({
                        children: [new TextRun({
                          text: `[图片: ${altText}]`,
                          color: '999999',
                          italics: true,
                        })],
                      }));
                    }
                  } else {
                    elements.push(new Paragraph({
                      children: [new TextRun({
                        text: `[图片: ${altText}](${imagePath})`,
                        color: '999999',
                        italics: true,
                      })],
                    }));
                  }
                } else if (innerToken.type === 'text' && innerToken.text?.trim()) {
                  // 处理图片旁边的文本
                  elements.push(createParagraphElement({ raw: innerToken.text, text: innerToken.text }, formatSettings));
                }
              }
              break;
            }
          }
          // 普通段落（不包含图片）
          elements.push(createParagraphElement(token, formatSettings));
          break;
        case 'blockquote':
          elements.push(...createBlockquoteParagraphs(token, formatSettings));
          break;
        case 'code':
          elements.push(...createCodeBlockParagraphs(token));
          break;
        case 'list':
          elements.push(...createListItemParagraphs(token, 0, formatSettings));
          break;
        case 'table':
          elements.push(createTableElement(token, formatSettings));
          break;
        case 'hr':
          elements.push(createHorizontalRuleParagraph());
          break;
        case 'image': {
          // 处理图片
          const imageToken = token as { type: 'image'; href: string; text?: string; alt?: string; raw: string };
          const imagePath = imageToken.href || '';
          const imageBuffer = imageMap.get(imagePath + '::__buffer__');
          const altText = imageToken.text || imageToken.alt || '图片';

          console.log('处理图片:', imagePath, 'buffer存在:', !!imageBuffer, '大小:', imageBuffer?.length);

          if (imageBuffer && imageBuffer.length > 0) {
            try {
              // 获取图片尺寸（简单设置为默认值）
              const width = 400;
              const height = 300;

              elements.push(new Paragraph({
                children: [new ImageRun({
                  data: imageBuffer,
                  transformation: {
                    width,
                    height,
                  },
                })],
                alignment: AlignmentType.CENTER,
                spacing: {
                  before: 200,
                  after: 200,
                },
              }));
              console.log('成功插入图片到段落');
            } catch (error) {
              console.warn('插入图片失败，使用占位符:', imagePath, error);
              elements.push(new Paragraph({
                children: [new TextRun({
                  text: `[图片: ${altText}]`,
                  color: '999999',
                  italics: true,
                })],
              }));
            }
          } else {
            console.warn('图片 buffer 为空:', imagePath, 'map keys:', Array.from(imageMap.keys()));
            elements.push(new Paragraph({
              children: [new TextRun({
                text: `[图片: ${altText}](${imagePath})`,
                color: '999999',
                italics: true,
              })],
            }));
          }
          break;
        }
      }
```