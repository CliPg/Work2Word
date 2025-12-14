import * as fs from 'fs/promises';
import * as path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from 'docx';
import { marked } from 'marked';

export async function processFile(filePath: string): Promise<string> {
  try {
    // 检查文件是否存在
    await fs.access(filePath);
    
    const ext = path.extname(filePath).toLowerCase();
    const buffer = await fs.readFile(filePath);

    if (buffer.length === 0) {
      throw new Error('文件为空');
    }

    switch (ext) {
      case '.doc':
      case '.docx':
        return await processDocx(buffer);
      case '.pdf':
        return await processPdf(buffer);
      case '.txt':
        const text = buffer.toString('utf-8');
        if (!text.trim()) {
          throw new Error('文本文件内容为空');
        }
        return text;
      default:
        throw new Error(`不支持的文件格式: ${ext}。支持格式: .doc, .docx, .pdf, .txt`);
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error('文件不存在');
    }
    throw error;
  }
}

async function processDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value || '';
    if (!text.trim()) {
      throw new Error('文档内容为空或无法提取文本');
    }
    return text;
  } catch (error: any) {
    throw new Error(`处理 Word 文档失败: ${error.message || error}`);
  }
}

async function processPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    const text = data.text || '';
    if (!text.trim()) {
      throw new Error('PDF 内容为空或无法提取文本');
    }
    return text;
  } catch (error: any) {
    throw new Error(`处理 PDF 文档失败: ${error.message || error}`);
  }
}

// 默认样式设置
const defaultStyles = {
  fontSize: 12, // 磅
  fontFamily: '宋体',
  headingFontFamily: '黑体',
};

// TextRun 配置接口
interface TextRunConfig {
  text?: string;
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  color?: string;
  underline?: Record<string, unknown>;
  font?: { name: string };
  size?: number;
  shading?: { fill: string };
  break?: number;
}

// 获取标题级别
function getHeadingLevelValue(depth: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  switch (depth) {
    case 1: return HeadingLevel.HEADING_1;
    case 2: return HeadingLevel.HEADING_2;
    case 3: return HeadingLevel.HEADING_3;
    case 4: return HeadingLevel.HEADING_4;
    case 5: return HeadingLevel.HEADING_5;
    case 6: return HeadingLevel.HEADING_6;
    default: return HeadingLevel.HEADING_1;
  }
}

// 获取标题字号（磅）
function getHeadingFontSize(depth: number): number {
  switch (depth) {
    case 1: return 22; // 二号
    case 2: return 16; // 三号
    case 3: return 14; // 四号
    case 4: return 12; // 小四
    case 5: return 12;
    case 6: return 12;
    default: return 12;
  }
}

// 解析内联格式（粗体、斜体、删除线、代码等）
function parseInlineTokens(tokens: any[], baseConfig: Partial<TextRunConfig> = {}): TextRun[] {
  const runs: TextRun[] = [];
  
  for (const token of tokens) {
    const tokenType = token.type as string;
    
    switch (tokenType) {
      case 'text':
        runs.push(new TextRun({
          text: token.text || '',
          font: baseConfig.font || { name: defaultStyles.fontFamily },
          size: baseConfig.size || defaultStyles.fontSize * 2,
          bold: baseConfig.bold,
          italics: baseConfig.italics,
          strike: baseConfig.strike,
          color: baseConfig.color,
        }));
        break;
        
      case 'strong': {
        // 获取加粗文本内容
        let strongText = token.text || '';
        if (!strongText && token.tokens && Array.isArray(token.tokens)) {
          strongText = token.tokens.map((t: any) => t.text || t.raw || '').join('');
        }
        if (!strongText && token.raw) {
          // 从raw中提取，去掉**标记
          strongText = token.raw.replace(/^\*\*|\*\*$/g, '');
        }
        runs.push(new TextRun({
          text: strongText,
          bold: true,
          font: baseConfig.font || { name: defaultStyles.fontFamily },
          size: baseConfig.size || defaultStyles.fontSize * 2,
          italics: baseConfig.italics,
          strike: baseConfig.strike,
          color: baseConfig.color,
        }));
        break;
      }
        
      case 'em': {
        // 获取斜体文本内容
        let emText = token.text || '';
        if (!emText && token.tokens && Array.isArray(token.tokens)) {
          emText = token.tokens.map((t: any) => t.text || t.raw || '').join('');
        }
        if (!emText && token.raw) {
          emText = token.raw.replace(/^\*|\*$/g, '');
        }
        runs.push(new TextRun({
          text: emText,
          italics: true,
          font: baseConfig.font || { name: defaultStyles.fontFamily },
          size: baseConfig.size || defaultStyles.fontSize * 2,
          bold: baseConfig.bold,
          strike: baseConfig.strike,
          color: baseConfig.color,
        }));
        break;
      }
        
      case 'del': {
        let delText = token.text || '';
        if (!delText && token.tokens && Array.isArray(token.tokens)) {
          delText = token.tokens.map((t: any) => t.text || t.raw || '').join('');
        }
        if (!delText && token.raw) {
          delText = token.raw.replace(/^~~|~~$/g, '');
        }
        runs.push(new TextRun({
          text: delText,
          strike: true,
          font: baseConfig.font || { name: defaultStyles.fontFamily },
          size: baseConfig.size || defaultStyles.fontSize * 2,
          bold: baseConfig.bold,
          italics: baseConfig.italics,
          color: baseConfig.color,
        }));
        break;
      }
        
      case 'codespan':
        runs.push(new TextRun({
          text: token.text || '',
          font: { name: 'Courier New' },
          size: defaultStyles.fontSize * 2,
          shading: { fill: 'F5F5F5' },
        }));
        break;
        
      case 'link': {
        let linkText = token.text || '';
        if (!linkText && token.tokens && Array.isArray(token.tokens)) {
          linkText = token.tokens.map((t: any) => t.text || t.raw || '').join('');
        }
        runs.push(new TextRun({
          text: linkText,
          color: '0563C1',
          underline: {},
          font: baseConfig.font || { name: defaultStyles.fontFamily },
          size: baseConfig.size || defaultStyles.fontSize * 2,
        }));
        break;
      }
        
      case 'br':
        runs.push(new TextRun({ break: 1 }));
        break;
        
      default:
        // 对于其他类型，尝试提取文本
        if (token.text) {
          runs.push(new TextRun({
            text: token.text,
            font: baseConfig.font || { name: defaultStyles.fontFamily },
            size: baseConfig.size || defaultStyles.fontSize * 2,
            bold: baseConfig.bold,
            italics: baseConfig.italics,
            strike: baseConfig.strike,
            color: baseConfig.color,
          }));
        } else if (token.raw) {
          runs.push(new TextRun({
            text: token.raw,
            font: baseConfig.font || { name: defaultStyles.fontFamily },
            size: baseConfig.size || defaultStyles.fontSize * 2,
            bold: baseConfig.bold,
            italics: baseConfig.italics,
            strike: baseConfig.strike,
            color: baseConfig.color,
          }));
        }
    }
  }
  
  return runs;
}

// 创建标题段落
function createHeadingParagraph(token: any): Paragraph {
  const depth = token.depth || 1;
  const fontSize = getHeadingFontSize(depth);
  
  // 提取标题纯文本（处理可能的内联格式）
  let headingText = token.text || '';
  if (!headingText && token.tokens && Array.isArray(token.tokens)) {
    headingText = token.tokens.map((t: any) => t.text || t.raw || '').join('');
  }
  
  const runs = [new TextRun({
    text: headingText,
    bold: true,
    font: { name: defaultStyles.headingFontFamily },
    size: fontSize * 2,
  })];
  
  return new Paragraph({
    children: runs,
    spacing: {
      before: 240, // 12磅
      after: 120,  // 6磅
    },
  });
}

// 简单的文本解析：处理 **加粗** 格式
function parseTextWithBold(text: string, baseConfig: Partial<TextRunConfig> = {}): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // 添加加粗前的普通文本
    if (match.index > lastIndex) {
      const normalText = text.slice(lastIndex, match.index);
      if (normalText) {
        runs.push(new TextRun({
          text: normalText,
          font: baseConfig.font || { name: defaultStyles.fontFamily },
          size: baseConfig.size || defaultStyles.fontSize * 2,
          bold: baseConfig.bold,
          italics: baseConfig.italics,
          color: baseConfig.color,
        }));
      }
    }
    
    // 添加加粗文本
    runs.push(new TextRun({
      text: match[1],
      bold: true,
      font: baseConfig.font || { name: defaultStyles.fontFamily },
      size: baseConfig.size || defaultStyles.fontSize * 2,
      italics: baseConfig.italics,
      color: baseConfig.color,
    }));
    
    lastIndex = regex.lastIndex;
  }
  
  // 添加剩余的普通文本
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (remainingText) {
      runs.push(new TextRun({
        text: remainingText,
        font: baseConfig.font || { name: defaultStyles.fontFamily },
        size: baseConfig.size || defaultStyles.fontSize * 2,
        bold: baseConfig.bold,
        italics: baseConfig.italics,
        color: baseConfig.color,
      }));
    }
  }
  
  // 如果没有任何匹配，返回原始文本
  if (runs.length === 0) {
    runs.push(new TextRun({
      text: text,
      font: baseConfig.font || { name: defaultStyles.fontFamily },
      size: baseConfig.size || defaultStyles.fontSize * 2,
      bold: baseConfig.bold,
      italics: baseConfig.italics,
      color: baseConfig.color,
    }));
  }
  
  return runs;
}

// 创建普通段落
function createParagraphElement(token: any): Paragraph {
  // 获取段落的原始文本（包含markdown标记）
  const rawText = token.raw || token.text || '';
  // 使用简单的正则处理加粗
  const runs = parseTextWithBold(rawText);
  
  return new Paragraph({
    children: runs,
    spacing: {
      after: 120, // 6磅段后间距
      line: 360,  // 1.5倍行距 (240 * 1.5)
    },
  });
}

// 创建引用块
function createBlockquoteParagraphs(token: any): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  
  if (token.tokens && Array.isArray(token.tokens)) {
    for (const innerToken of token.tokens) {
      if (innerToken.type === 'paragraph') {
        const runs = innerToken.tokens
          ? parseInlineTokens(innerToken.tokens, { color: '666666', italics: true })
          : [new TextRun({ text: innerToken.text || '', color: '666666', italics: true })];
        
        paragraphs.push(new Paragraph({
          children: runs,
          spacing: {
            before: 120,
            after: 120,
          },
          indent: {
            left: 720, // 左缩进0.5英寸
          },
          border: {
            left: {
              color: 'CCCCCC',
              space: 10,
              style: 'single' as const,
              size: 10,
            },
          },
        }));
      }
    }
  }
  
  if (paragraphs.length === 0) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({
        text: token.text || token.raw || '',
        color: '666666',
        italics: true,
      })],
      indent: { left: 720 },
      border: {
        left: {
          color: 'CCCCCC',
          space: 10,
          style: 'single' as const,
          size: 10,
        },
      },
    }));
  }
  
  return paragraphs;
}

// 创建代码块
function createCodeBlockParagraphs(token: any): Paragraph[] {
  const text = token.text || '';
  const codeLines = text.split('\n');
  const paragraphs: Paragraph[] = [];
  
  codeLines.forEach((line: string, index: number) => {
    paragraphs.push(new Paragraph({
      children: [new TextRun({
        text: line || ' ', // 空行用空格占位
        font: { name: 'Courier New' },
        size: 20, // 10磅
      })],
      spacing: {
        before: index === 0 ? 120 : 0,
        after: index === codeLines.length - 1 ? 120 : 0,
        line: 240, // 单倍行距
      },
      shading: {
        fill: 'F8F8F8',
      },
      indent: {
        left: 360,
        right: 360,
      },
    }));
  });
  
  return paragraphs;
}

// 创建列表项
function createListItemParagraphs(token: any, level: number = 0): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const isOrdered = token.ordered || false;
  const bulletChars = ['●', '○', '▪'];
  const bulletChar = isOrdered ? '' : bulletChars[level % 3];
  
  const items = token.items || [];
  items.forEach((item: any, index: number) => {
    const prefix = isOrdered ? `${index + 1}. ` : `${bulletChar} `;
    
    // 处理列表项内容
    let runs: TextRun[] = [];
    if (item.tokens && Array.isArray(item.tokens)) {
      for (const innerToken of item.tokens) {
        if (innerToken.type === 'text' && innerToken.tokens && Array.isArray(innerToken.tokens)) {
          runs = runs.concat(parseInlineTokens(innerToken.tokens));
        } else if (innerToken.type === 'paragraph' && innerToken.tokens) {
          runs = runs.concat(parseInlineTokens(innerToken.tokens));
        } else if (innerToken.text) {
          runs.push(new TextRun({
            text: innerToken.text,
            font: { name: defaultStyles.fontFamily },
            size: defaultStyles.fontSize * 2,
          }));
        }
      }
    }
    
    if (runs.length === 0) {
      runs = [new TextRun({
        text: item.text || '',
        font: { name: defaultStyles.fontFamily },
        size: defaultStyles.fontSize * 2,
      })];
    }
    
    // 添加列表前缀
    runs.unshift(new TextRun({
      text: prefix,
      font: { name: defaultStyles.fontFamily },
      size: defaultStyles.fontSize * 2,
    }));
    
    paragraphs.push(new Paragraph({
      children: runs,
      spacing: {
        after: 60, // 3磅
      },
      indent: {
        left: 720 * (level + 1), // 根据层级缩进
        hanging: 360, // 悬挂缩进
      },
    }));
    
    // 处理嵌套列表
    if (item.tokens && Array.isArray(item.tokens)) {
      for (const innerToken of item.tokens) {
        if (innerToken.type === 'list') {
          paragraphs.push(...createListItemParagraphs(innerToken, level + 1));
        }
      }
    }
  });
  
  return paragraphs;
}

// 创建水平分割线
function createHorizontalRuleParagraph(): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: '' })],
    spacing: {
      before: 240,
      after: 240,
    },
    border: {
      bottom: {
        color: '999999',
        space: 1,
        style: 'single' as const,
        size: 6,
      },
    },
  });
}

// 创建表格
function createTableElement(token: any): Table {
  const tableToken = token as any;
  const rows: TableRow[] = [];
  
  // 处理表头
  if (tableToken.header && Array.isArray(tableToken.header)) {
    const headerCells = tableToken.header.map((cell: any) => {
      const cellText = cell.text || (cell.tokens ? cell.tokens.map((t: any) => t.text || t.raw || '').join('') : '');
      return new TableCell({
        children: [new Paragraph({
          children: [new TextRun({
            text: cellText,
            bold: true,
            font: { name: defaultStyles.fontFamily },
            size: defaultStyles.fontSize * 2,
          })],
          alignment: AlignmentType.CENTER,
        })],
        shading: { fill: 'F0F0F0' },
      });
    });
    rows.push(new TableRow({ children: headerCells }));
  }
  
  // 处理表格内容
  if (tableToken.rows && Array.isArray(tableToken.rows)) {
    for (const row of tableToken.rows) {
      const rowCells = row.map((cell: any) => {
        const cellText = cell.text || (cell.tokens ? cell.tokens.map((t: any) => t.text || t.raw || '').join('') : '');
        return new TableCell({
          children: [new Paragraph({
            children: [new TextRun({
              text: cellText,
              font: { name: defaultStyles.fontFamily },
              size: defaultStyles.fontSize * 2,
            })],
          })],
        });
      });
      rows.push(new TableRow({ children: rowCells }));
    }
  }
  
  return new Table({
    rows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
  });
}

// 将 Markdown 转换为段落数组（使用 marked 解析器）
function markdownToParagraphs(mdContent: string): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  
  // 使用 marked.lexer 解析 Markdown 为 tokens
  const tokens = marked.lexer(mdContent);
  
  for (const token of tokens) {
    try {
      const tokenType = token.type as string;
      
      switch (tokenType) {
        case 'heading':
          elements.push(createHeadingParagraph(token));
          break;
        case 'paragraph':
          elements.push(createParagraphElement(token));
          break;
        case 'blockquote':
          elements.push(...createBlockquoteParagraphs(token));
          break;
        case 'code':
          elements.push(...createCodeBlockParagraphs(token));
          break;
        case 'list':
          elements.push(...createListItemParagraphs(token));
          break;
        case 'table':
          elements.push(createTableElement(token));
          break;
        case 'hr':
          elements.push(createHorizontalRuleParagraph());
          break;
        case 'space':
          // 空行，添加空段落
          elements.push(new Paragraph({ text: '' }));
          break;
        case 'html':
          // HTML 内容，尝试提取纯文本
          const htmlText = (token as any).text;
          if (htmlText && htmlText.trim()) {
            elements.push(new Paragraph({
              children: [new TextRun({
                text: htmlText.replace(/<[^>]*>/g, ''),
                font: { name: defaultStyles.fontFamily },
                size: defaultStyles.fontSize * 2,
              })],
            }));
          }
          break;
        default:
          // 其他类型，尝试提取文本
          const text = (token as any).text;
          if (text) {
            elements.push(new Paragraph({
              children: [new TextRun({
                text: text,
                font: { name: defaultStyles.fontFamily },
                size: defaultStyles.fontSize * 2,
              })],
            }));
          }
      }
    } catch (error) {
      console.error(`处理 token 时发生错误:`, token.type, error);
      // 出错时创建一个简单的文本段落
      const tokenText = (token as any).text || (token as any).raw;
      if (tokenText) {
        elements.push(new Paragraph({
          children: [new TextRun({
            text: tokenText,
            font: { name: defaultStyles.fontFamily },
            size: defaultStyles.fontSize * 2,
          })],
        }));
      }
    }
  }
  
  return elements;
}

export async function convertToFormat(
  mdContent: string,
  format: 'doc' | 'pdf' | 'md',
  outputPath?: string
): Promise<{ path: string; buffer?: Buffer }> {
  if (format === 'md') {
    const filePath = outputPath || `output_${Date.now()}.md`;
    await fs.writeFile(filePath, mdContent, 'utf-8');
    return { path: filePath };
  }

  const filePath = outputPath || `output_${Date.now()}.${format === 'doc' ? 'docx' : 'pdf'}`;
  
  if (format === 'doc') {
    try {
      const elements = markdownToParagraphs(mdContent);
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: elements,
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);
      await fs.writeFile(filePath, buffer);
      return { path: filePath, buffer };
    } catch (error: any) {
      throw new Error(`转换 Word 文档失败: ${error.message}`);
    }
  }

  if (format === 'pdf') {
    let browser: any = null;
    try {
      // 使用 Puppeteer 将 Markdown 转换为 HTML 再转为 PDF
      const puppeteer = await import('puppeteer');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      
      const page = await browser.newPage();
      
      // 使用 marked 将 Markdown 转换为 HTML
      const htmlContent = marked.parse(mdContent) as string;
      
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
                line-height: 1.8;
                max-width: 800px;
                margin: 0 auto;
                padding: 40px 20px;
                color: #333;
              }
              h1 { font-size: 2em; margin-top: 0.67em; margin-bottom: 0.67em; font-weight: 600; }
              h2 { font-size: 1.5em; margin-top: 0.83em; margin-bottom: 0.83em; font-weight: 600; }
              h3 { font-size: 1.17em; margin-top: 1em; margin-bottom: 1em; font-weight: 600; }
              p { margin: 1em 0; }
              ul, ol { margin: 1em 0; padding-left: 2em; }
              li { margin: 0.5em 0; }
              code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: 'Monaco', monospace; }
              pre { background: #f5f5f5; padding: 16px; border-radius: 8px; overflow-x: auto; }
              blockquote { border-left: 4px solid #667eea; padding-left: 16px; margin-left: 0; color: #666; }
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `;
      
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: filePath,
        format: 'A4',
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
        printBackground: true,
      });
      
      const buffer = await fs.readFile(filePath);
      return { path: filePath, buffer };
    } catch (error: any) {
      throw new Error(`转换 PDF 失败: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  throw new Error(`不支持的输出格式: ${format}`);
}

