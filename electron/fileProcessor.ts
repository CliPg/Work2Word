import * as fs from 'fs/promises';
import * as path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
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

// 将 Markdown 转换为简单的段落数组（简化版）
function markdownToParagraphs(mdContent: string): Paragraph[] {
  const lines = mdContent.split('\n');
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) {
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }

    // 处理标题
    if (trimmed.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.substring(2),
          heading: HeadingLevel.HEADING_1,
        })
      );
    } else if (trimmed.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.substring(3),
          heading: HeadingLevel.HEADING_2,
        })
      );
    } else if (trimmed.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.substring(4),
          heading: HeadingLevel.HEADING_3,
        })
      );
    } else {
      // 处理粗体和斜体（简化处理）
      const runs: TextRun[] = [];
      let currentText = '';
      let inBold = false;
      let inItalic = false;

      for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];
        const nextChar = trimmed[i + 1];

        if (char === '*' && nextChar === '*') {
          if (currentText) {
            runs.push(new TextRun({ text: currentText, bold: inBold, italics: inItalic }));
            currentText = '';
          }
          inBold = !inBold;
          i++; // 跳过下一个 *
        } else if (char === '*' && !inBold) {
          if (currentText) {
            runs.push(new TextRun({ text: currentText, bold: inBold, italics: inItalic }));
            currentText = '';
          }
          inItalic = !inItalic;
        } else {
          currentText += char;
        }
      }

      if (currentText) {
        runs.push(new TextRun({ text: currentText, bold: inBold, italics: inItalic }));
      }

      paragraphs.push(new Paragraph({ children: runs.length > 0 ? runs : [new TextRun({ text: trimmed })] }));
    }
  }

  return paragraphs;
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
      const paragraphs = markdownToParagraphs(mdContent);
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs,
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

