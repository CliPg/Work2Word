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

// 排版设置类型定义
export interface ParagraphStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  firstLineIndent: number;
}

export interface HeadingStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  alignment: 'left' | 'center' | 'right' | 'justify';
  spacingBefore: number;
  spacingAfter: number;
}

export interface FormatSettings {
  paragraph: ParagraphStyle;
  heading1: HeadingStyle;
  heading2: HeadingStyle;
  heading3: HeadingStyle;
  heading4: HeadingStyle;
}

// 默认排版设置
const defaultFormatSettings: FormatSettings = {
  paragraph: {
    fontFamily: '宋体',
    fontSize: 12,
    lineHeight: 1.5,
    paragraphSpacing: 6,
    firstLineIndent: 2,
  },
  heading1: {
    fontFamily: '黑体',
    fontSize: 22,
    lineHeight: 1.5,
    alignment: 'center',
    spacingBefore: 12,
    spacingAfter: 6,
  },
  heading2: {
    fontFamily: '黑体',
    fontSize: 16,
    lineHeight: 1.5,
    alignment: 'left',
    spacingBefore: 12,
    spacingAfter: 6,
  },
  heading3: {
    fontFamily: '黑体',
    fontSize: 14,
    lineHeight: 1.5,
    alignment: 'left',
    spacingBefore: 12,
    spacingAfter: 6,
  },
  heading4: {
    fontFamily: '黑体',
    fontSize: 12,
    lineHeight: 1.5,
    alignment: 'left',
    spacingBefore: 12,
    spacingAfter: 6,
  },
};

// 默认样式设置（保留兼容）
const defaultStyles: ParagraphStyle = {
  fontSize: 12, // 磅
  fontFamily: '宋体',
  lineHeight: 1.5,
  paragraphSpacing: 6,
  firstLineIndent: 2,
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
function parseInlineTokens(tokens: any[], baseConfig: Partial<TextRunConfig> = {}, formatSettings?: FormatSettings): TextRun[] {
  const runs: TextRun[] = [];
  const paraStyle = formatSettings?.paragraph || defaultStyles;
  
  for (const token of tokens) {
    const tokenType = token.type as string;
    
    switch (tokenType) {
      case 'text':
        runs.push(new TextRun({
          text: token.text || '',
          font: baseConfig.font || { name: paraStyle.fontFamily || defaultStyles.fontFamily },
          size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
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
          font: baseConfig.font || { name: paraStyle.fontFamily || defaultStyles.fontFamily },
          size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
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
          font: baseConfig.font || { name: paraStyle.fontFamily || defaultStyles.fontFamily },
          size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
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
          font: baseConfig.font || { name: paraStyle.fontFamily || defaultStyles.fontFamily },
          size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
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
          size: (paraStyle.fontSize || defaultStyles.fontSize) * 2,
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
          font: baseConfig.font || { name: paraStyle.fontFamily || defaultStyles.fontFamily },
          size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
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
            font: baseConfig.font || { name: paraStyle.fontFamily || defaultStyles.fontFamily },
            size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
            bold: baseConfig.bold,
            italics: baseConfig.italics,
            strike: baseConfig.strike,
            color: baseConfig.color,
          }));
        } else if (token.raw) {
          runs.push(new TextRun({
            text: token.raw,
            font: baseConfig.font || { name: paraStyle.fontFamily || defaultStyles.fontFamily },
            size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
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

// 获取对齐方式
function getAlignment(align: 'left' | 'center' | 'right' | 'justify'): typeof AlignmentType[keyof typeof AlignmentType] {
  switch (align) {
    case 'center': return AlignmentType.CENTER;
    case 'right': return AlignmentType.RIGHT;
    case 'justify': return AlignmentType.JUSTIFIED;
    default: return AlignmentType.LEFT;
  }
}

// 默认标题样式
const defaultHeadingStyles: Record<string, HeadingStyle> = {
  heading1: { fontFamily: '黑体', fontSize: 22, lineHeight: 1.5, alignment: 'center', spacingBefore: 12, spacingAfter: 12 },
  heading2: { fontFamily: '黑体', fontSize: 16, lineHeight: 1.5, alignment: 'left', spacingBefore: 12, spacingAfter: 6 },
  heading3: { fontFamily: '黑体', fontSize: 14, lineHeight: 1.5, alignment: 'left', spacingBefore: 6, spacingAfter: 6 },
  heading4: { fontFamily: '黑体', fontSize: 12, lineHeight: 1.5, alignment: 'left', spacingBefore: 6, spacingAfter: 6 },
};

// 创建标题段落
function createHeadingParagraph(token: any, formatSettings?: FormatSettings): Paragraph {
  const depth = token.depth || 1;
  
  // 获取对应级别的标题样式
  const headingKey = `heading${Math.min(depth, 4)}` as keyof FormatSettings;
  const headingStyle = (formatSettings?.[headingKey] as HeadingStyle) || defaultHeadingStyles[headingKey];
  
  // 提取标题纯文本（处理可能的内联格式）
  let headingText = token.text || '';
  if (!headingText && token.tokens && Array.isArray(token.tokens)) {
    headingText = token.tokens.map((t: any) => t.text || t.raw || '').join('');
  }
  
  const runs = [new TextRun({
    text: headingText,
    bold: true,
    font: { name: headingStyle.fontFamily },
    size: headingStyle.fontSize * 2, // Word 使用半磅
  })];
  
  return new Paragraph({
    children: runs,
    alignment: getAlignment(headingStyle.alignment),
    spacing: {
      before: headingStyle.spacingBefore * 20, // 磅转twip
      after: headingStyle.spacingAfter * 20,
      line: headingStyle.lineHeight * 240, // 行距倍数转twip
    },
  });
}

// LaTeX 到 Unicode 的简单转换映射
const latexToUnicode: Record<string, string> = {
  // 希腊字母
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
  '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
  '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
  '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ',
  '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
  '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
  '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
  '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Phi': 'Φ',
  '\\Psi': 'Ψ', '\\Omega': 'Ω',
  // 运算符
  '\\times': '×', '\\div': '÷', '\\pm': '±', '\\mp': '∓',
  '\\cdot': '·', '\\ast': '∗', '\\star': '⋆',
  '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\approx': '≈',
  '\\equiv': '≡', '\\sim': '∼', '\\simeq': '≃',
  '\\ll': '≪', '\\gg': '≫', '\\subset': '⊂', '\\supset': '⊃',
  '\\subseteq': '⊆', '\\supseteq': '⊇', '\\in': '∈', '\\ni': '∋',
  '\\notin': '∉', '\\cap': '∩', '\\cup': '∪',
  '\\land': '∧', '\\lor': '∨', '\\neg': '¬',
  '\\forall': '∀', '\\exists': '∃', '\\partial': '∂',
  '\\nabla': '∇', '\\infty': '∞', '\\emptyset': '∅',
  '\\sum': '∑', '\\prod': '∏', '\\int': '∫',
  '\\sqrt': '√', '\\angle': '∠', '\\perp': '⊥', '\\parallel': '∥',
  '\\triangle': '△', '\\square': '□', '\\circ': '∘',
  '\\rightarrow': '→', '\\leftarrow': '←', '\\Rightarrow': '⇒', '\\Leftarrow': '⇐',
  '\\leftrightarrow': '↔', '\\Leftrightarrow': '⇔',
  '\\uparrow': '↑', '\\downarrow': '↓',
  '\\ldots': '…', '\\cdots': '⋯', '\\vdots': '⋮', '\\ddots': '⋱',
  // 特殊符号
  '\\prime': '′', '\\degree': '°', '\\%': '%',
};

// 将简单的 LaTeX 转换为 Unicode
function latexToUnicodeText(latex: string): string {
  let result = latex;
  
  // 替换已知的 LaTeX 命令
  for (const [cmd, unicode] of Object.entries(latexToUnicode)) {
    result = result.replace(new RegExp(cmd.replace(/\\/g, '\\\\'), 'g'), unicode);
  }
  
  // 处理上标 ^{...} 或 ^x
  result = result.replace(/\^{([^}]+)}/g, (_, content) => {
    return content.split('').map((c: string) => {
      const superscripts: Record<string, string> = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
        '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
        'n': 'ⁿ', 'i': 'ⁱ',
      };
      return superscripts[c] || c;
    }).join('');
  });
  result = result.replace(/\^(\d)/g, (_, d) => {
    const superscripts: Record<string, string> = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    };
    return superscripts[d] || d;
  });
  
  // 处理下标 _{...} 或 _x
  result = result.replace(/_{([^}]+)}/g, (_, content) => {
    return content.split('').map((c: string) => {
      const subscripts: Record<string, string> = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
        '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
        '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
        'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ',
        'i': 'ᵢ', 'j': 'ⱼ', 'n': 'ₙ', 'm': 'ₘ',
      };
      return subscripts[c] || c;
    }).join('');
  });
  result = result.replace(/_(\d)/g, (_, d) => {
    const subscripts: Record<string, string> = {
      '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
      '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    };
    return subscripts[d] || d;
  });
  
  // 处理分数 \frac{a}{b} -> a/b
  result = result.replace(/\\frac{([^}]+)}{([^}]+)}/g, '($1/$2)');
  
  // 处理平方根 \sqrt{x} -> √x
  result = result.replace(/\\sqrt{([^}]+)}/g, '√($1)');
  
  // 处理阶乘 n! 保持不变
  // 移除剩余的 LaTeX 命令格式如 \text{...}
  result = result.replace(/\\text{([^}]+)}/g, '$1');
  result = result.replace(/\\mathrm{([^}]+)}/g, '$1');
  result = result.replace(/\\mathbf{([^}]+)}/g, '$1');
  
  // 清理多余的花括号
  result = result.replace(/{([^{}]+)}/g, '$1');
  
  // 清理空格
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

// 简单的文本解析：处理 **加粗**、`代码` 和 $公式$ 格式
function parseTextWithFormat(text: string, formatSettings?: FormatSettings, baseConfig: Partial<TextRunConfig> = {}): TextRun[] {
  const runs: TextRun[] = [];
  const paraStyle = formatSettings?.paragraph || defaultStyles;
  
  // 匹配 **加粗**、`代码` 或 $公式$（包括 $$公式$$）
  // 注意顺序：先匹配 $$ ，再匹配 $
  const regex = /(\$\$([^$]+)\$\$)|(\$([^$]+)\$)|(`+)([^`]+)\5|\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // 添加匹配前的普通文本
    if (match.index > lastIndex) {
      const normalText = text.slice(lastIndex, match.index);
      if (normalText) {
        runs.push(new TextRun({
          text: normalText,
          font: baseConfig.font || { name: paraStyle.fontFamily || defaultStyles.fontFamily },
          size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
          bold: baseConfig.bold,
          italics: baseConfig.italics,
          color: baseConfig.color,
        }));
      }
    }
    
    if (match[2] !== undefined) {
      // 匹配到块级公式 $$...$$ 
      const unicodeFormula = latexToUnicodeText(match[2]);
      runs.push(new TextRun({
        text: unicodeFormula,
        font: { name: 'Cambria Math' },
        size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
        italics: true,
      }));
    } else if (match[4] !== undefined) {
      // 匹配到行内公式 $...$
      const unicodeFormula = latexToUnicodeText(match[4]);
      runs.push(new TextRun({
        text: unicodeFormula,
        font: { name: 'Cambria Math' },
        size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
        italics: true,
      }));
    } else if (match[6] !== undefined) {
      // 匹配到行内代码 `code`
      runs.push(new TextRun({
        text: match[6],
        font: { name: 'Courier New' },
        size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
        shading: { fill: 'F0F0F0' },
      }));
    } else if (match[7] !== undefined) {
      // 匹配到加粗 **text**
      runs.push(new TextRun({
        text: match[7],
        bold: true,
        font: baseConfig.font || { name: paraStyle.fontFamily || defaultStyles.fontFamily },
        size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
        italics: baseConfig.italics,
        color: baseConfig.color,
      }));
    }
    
    lastIndex = regex.lastIndex;
  }
  
  // 添加剩余的普通文本
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (remainingText) {
      runs.push(new TextRun({
        text: remainingText,
        font: baseConfig.font || { name: paraStyle.fontFamily || defaultStyles.fontFamily },
        size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
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
      font: baseConfig.font || { name: paraStyle.fontFamily || defaultStyles.fontFamily },
      size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
      bold: baseConfig.bold,
      italics: baseConfig.italics,
      color: baseConfig.color,
    }));
  }
  
  return runs;
}

// 创建普通段落
function createParagraphElement(token: any, formatSettings?: FormatSettings): Paragraph {
  const paraStyle = formatSettings?.paragraph || defaultStyles;
  // 获取段落的原始文本（包含markdown标记）
  const rawText = token.raw || token.text || '';
  // 使用简单的正则处理格式
  const runs = parseTextWithFormat(rawText, formatSettings);
  
  // 计算首行缩进（字符数 * 字号 * 20 twip）
  const firstLineIndent = (paraStyle.firstLineIndent || 0) * (paraStyle.fontSize || defaultStyles.fontSize) * 20;
  
  return new Paragraph({
    children: runs,
    spacing: {
      after: (paraStyle.paragraphSpacing || 0) * 20, // 磅转twip
      line: (paraStyle.lineHeight || defaultStyles.lineHeight) * 240, // 行距倍数转twip
    },
    indent: (paraStyle.firstLineIndent || 0) > 0 ? {
      firstLine: firstLineIndent,
    } : undefined,
  });
}

// 创建引用块
function createBlockquoteParagraphs(token: any, formatSettings?: FormatSettings): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const paraStyle = formatSettings?.paragraph || defaultStyles;
  
  if (token.tokens && Array.isArray(token.tokens)) {
    for (const innerToken of token.tokens) {
      if (innerToken.type === 'paragraph') {
        const runs = innerToken.tokens
          ? parseInlineTokens(innerToken.tokens, { color: '666666', italics: true }, formatSettings)
          : [new TextRun({ 
              text: innerToken.text || '', 
              color: '666666', 
              italics: true,
              font: { name: paraStyle.fontFamily || defaultStyles.fontFamily },
              size: (paraStyle.fontSize || defaultStyles.fontSize) * 2,
            })];
        
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
function createListItemParagraphs(token: any, level: number = 0, formatSettings?: FormatSettings): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const paraStyle = formatSettings?.paragraph || defaultStyles;
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
          runs = runs.concat(parseInlineTokens(innerToken.tokens, {}, formatSettings));
        } else if (innerToken.type === 'paragraph' && innerToken.tokens) {
          runs = runs.concat(parseInlineTokens(innerToken.tokens, {}, formatSettings));
        } else if (innerToken.text) {
          runs.push(new TextRun({
            text: innerToken.text,
            font: { name: paraStyle.fontFamily || defaultStyles.fontFamily },
            size: (paraStyle.fontSize || defaultStyles.fontSize) * 2,
          }));
        }
      }
    }
    
    if (runs.length === 0) {
      runs = [new TextRun({
        text: item.text || '',
        font: { name: paraStyle.fontFamily || defaultStyles.fontFamily },
        size: (paraStyle.fontSize || defaultStyles.fontSize) * 2,
      })];
    }
    
    // 添加列表前缀
    runs.unshift(new TextRun({
      text: prefix,
      font: { name: paraStyle.fontFamily || defaultStyles.fontFamily },
      size: (paraStyle.fontSize || defaultStyles.fontSize) * 2,
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
          paragraphs.push(...createListItemParagraphs(innerToken, level + 1, formatSettings));
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
function createTableElement(token: any, formatSettings?: FormatSettings): Table {
  const tableToken = token as any;
  const paraStyle = formatSettings?.paragraph || defaultStyles;
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
            font: { name: paraStyle.fontFamily || defaultStyles.fontFamily },
            size: (paraStyle.fontSize || defaultStyles.fontSize) * 2,
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
              font: { name: paraStyle.fontFamily || defaultStyles.fontFamily },
              size: (paraStyle.fontSize || defaultStyles.fontSize) * 2,
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
function markdownToParagraphs(mdContent: string, formatSettings?: FormatSettings): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  
  // 使用 marked.lexer 解析 Markdown 为 tokens
  const tokens = marked.lexer(mdContent);
  
  for (const token of tokens) {
    try {
      const tokenType = token.type as string;
      
      switch (tokenType) {
        case 'heading':
          elements.push(createHeadingParagraph(token, formatSettings));
          break;
        case 'paragraph':
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
        case 'space':
          // 空行，添加空段落
          elements.push(new Paragraph({ text: '' }));
          break;
        case 'html':
          // HTML 内容，尝试提取纯文本
          const htmlText = (token as any).text;
          const paraStyle = formatSettings?.paragraph;
          if (htmlText && htmlText.trim()) {
            elements.push(new Paragraph({
              children: [new TextRun({
                text: htmlText.replace(/<[^>]*>/g, ''),
                font: { name: paraStyle?.fontFamily || defaultStyles.fontFamily },
                size: (paraStyle?.fontSize || defaultStyles.fontSize) * 2,
              })],
            }));
          }
          break;
        default:
          // 其他类型，尝试提取文本
          const text = (token as any).text;
          const defaultParaStyle = formatSettings?.paragraph;
          if (text) {
            elements.push(new Paragraph({
              children: [new TextRun({
                text: text,
                font: { name: defaultParaStyle?.fontFamily || defaultStyles.fontFamily },
                size: (defaultParaStyle?.fontSize || defaultStyles.fontSize) * 2,
              })],
            }));
          }
      }
    } catch (error) {
      console.error(`处理 token 时发生错误:`, token.type, error);
      // 出错时创建一个简单的文本段落
      const tokenText = (token as any).text || (token as any).raw;
      const fallbackParaStyle = formatSettings?.paragraph;
      if (tokenText) {
        elements.push(new Paragraph({
          children: [new TextRun({
            text: tokenText,
            font: { name: fallbackParaStyle?.fontFamily || defaultStyles.fontFamily },
            size: (fallbackParaStyle?.fontSize || defaultStyles.fontSize) * 2,
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
  outputPath?: string,
  formatSettings?: FormatSettings
): Promise<{ path: string; buffer?: Buffer }> {
  if (format === 'md') {
    const filePath = outputPath || `output_${Date.now()}.md`;
    await fs.writeFile(filePath, mdContent, 'utf-8');
    return { path: filePath };
  }

  const filePath = outputPath || `output_${Date.now()}.${format === 'doc' ? 'docx' : 'pdf'}`;
  
  if (format === 'doc') {
    try {
      const elements = markdownToParagraphs(mdContent, formatSettings);
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
      
      // 处理 LaTeX 公式：将 $...$ 和 $$...$$ 转换为 KaTeX span
      const processedHtml = htmlContent
        .replace(/\$\$([^$]+)\$\$/g, '<span class="katex-display">$1</span>')
        .replace(/\$([^$]+)\$/g, '<span class="katex-inline">$1</span>');
      
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
            <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
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
              .katex-display { display: block; text-align: center; margin: 1em 0; }
            </style>
          </head>
          <body>
            ${processedHtml}
            <script>
              // 渲染所有 KaTeX 公式
              document.querySelectorAll('.katex-inline').forEach(el => {
                try {
                  katex.render(el.textContent, el, { throwOnError: false });
                } catch (e) { console.error(e); }
              });
              document.querySelectorAll('.katex-display').forEach(el => {
                try {
                  katex.render(el.textContent, el, { throwOnError: false, displayMode: true });
                } catch (e) { console.error(e); }
              });
            </script>
          </body>
        </html>
      `;
      
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
      // 等待 KaTeX 渲染完成
      await page.waitForFunction(`
        (() => {
          const elements = document.querySelectorAll('.katex-inline, .katex-display');
          return elements.length === 0 || Array.from(elements).every(el => el.querySelector('.katex'));
        })()
      `, { timeout: 5000 }).catch(() => {});
      
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

