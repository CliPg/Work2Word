import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import WordExtractor from 'word-extractor';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ImageRun, Media, Math as DocxMath } from 'docx';
import { marked } from 'marked';
// @ts-ignore - latex-to-omml 没有类型声明
import { latexToOMML } from 'latex-to-omml';
import { DOMParser } from '@xmldom/xmldom';

const wordExtractor = new WordExtractor();

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
        return await processDoc(filePath);
      case '.docx':
        return await processDocx(buffer);
      case '.pdf':
        return await processPdf(buffer);
      case '.txt':
      case '.md':
        const text = buffer.toString('utf-8');
        if (!text.trim()) {
          throw new Error('文本文件内容为空');
        }
        return text;
      default:
        throw new Error(`不支持的文件格式: ${ext}。支持格式: .doc, .docx, .pdf, .txt, .md`);
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error('文件不存在');
    }
    throw error;
  }
}

async function processDoc(filePath: string): Promise<string> {
  try {
    const extracted = await wordExtractor.extract(filePath);
    const text = extracted.getBody() || '';
    if (!text.trim()) {
      throw new Error('文档内容为空或无法提取文本');
    }
    return text;
  } catch (error: any) {
    throw new Error(`处理 Word 文档(.doc)失败: ${error.message || error}`);
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
async function parseInlineTokens(tokens: any[], baseConfig: Partial<TextRunConfig> = {}, formatSettings?: FormatSettings): Promise<ParagraphChild[]> {
  const runs: ParagraphChild[] = [];
  const paraStyle = formatSettings?.paragraph || defaultStyles;

  for (const token of tokens) {
    const tokenType = token.type as string;

    switch (tokenType) {
      case 'text': {
        // 使用 parseTextWithFormat 处理文本，以支持 LaTeX 公式
        const textContent = token.text || '';
        if (textContent) {
          const textRuns = await parseTextWithFormat(textContent, formatSettings, baseConfig);
          runs.push(...textRuns);
        }
        break;
      }
        
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
        
      default: {
        // 对于其他类型，尝试提取文本并使用 parseTextWithFormat 处理
        const textContent = token.text || token.raw || '';
        if (textContent) {
          const textRuns = await parseTextWithFormat(textContent, formatSettings, baseConfig);
          runs.push(...textRuns);
        }
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

// 格式化矩阵内容为文本表示
function formatMatrixContent(content: string, leftBracket: string, rightBracket: string): string {
  const rows = content.trim().split(/\\\\/).filter(r => r.trim());
  if (rows.length === 0) return `${leftBracket}${rightBracket}`;

  const formattedRows = rows.map(row => {
    const cols = row.split('&').map(c => c.trim());
    return cols.join('  ');
  });

  if (formattedRows.length === 1) {
    return `${leftBracket} ${formattedRows[0]} ${rightBracket}`;
  }
  // 多行矩阵用分号分隔行
  return `${leftBracket} ${formattedRows.join(';  ')} ${rightBracket}`;
}

// 将简单的 LaTeX 转换为 Unicode
function latexToUnicodeText(latex: string): string {
  let result = latex;

  // ===== 第一步：处理 LaTeX 环境（必须在花括号清理之前） =====

  // 处理矩阵环境
  result = result.replace(/\\begin\{bmatrix\}([\s\S]*?)\\end\{bmatrix\}/g, (_, content) => {
    return formatMatrixContent(content, '[', ']');
  });
  result = result.replace(/\\begin\{pmatrix\}([\s\S]*?)\\end\{pmatrix\}/g, (_, content) => {
    return formatMatrixContent(content, '(', ')');
  });
  result = result.replace(/\\begin\{vmatrix\}([\s\S]*?)\\end\{vmatrix\}/g, (_, content) => {
    return formatMatrixContent(content, '|', '|');
  });
  result = result.replace(/\\begin\{Vmatrix\}([\s\S]*?)\\end\{Vmatrix\}/g, (_, content) => {
    return formatMatrixContent(content, '‖', '‖');
  });
  result = result.replace(/\\begin\{matrix\}([\s\S]*?)\\end\{matrix\}/g, (_, content) => {
    return formatMatrixContent(content, '', '');
  });

  // 处理 cases 环境
  result = result.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (_, content) => {
    const rows = content.trim().split(/\\\\/).filter((r: string) => r.trim());
    return '{ ' + rows.map((r: string) => r.trim().replace(/&/g, ', ')).join('; ') + ' }';
  });

  // 处理 aligned 环境
  result = result.replace(/\\begin\{aligned\}([\s\S]*?)\\end\{aligned\}/g, (_, content) => {
    const rows = content.trim().split(/\\\\/).filter((r: string) => r.trim());
    return rows.map((r: string) => r.trim().replace(/&/g, ' ')).join('; ');
  });

  // 处理 \left 和 \right 括号
  result = result.replace(/\\left\(/g, '(');
  result = result.replace(/\\right\)/g, ')');
  result = result.replace(/\\left\[/g, '[');
  result = result.replace(/\\right\]/g, ']');
  result = result.replace(/\\left\\\{/g, '{');
  result = result.replace(/\\right\\\}/g, '}');
  result = result.replace(/\\left\|/g, '|');
  result = result.replace(/\\right\|/g, '|');

  // ===== 第二步：替换已知的 LaTeX 命令 =====
  for (const [cmd, unicode] of Object.entries(latexToUnicode)) {
    result = result.replace(new RegExp(cmd.replace(/\\/g, '\\\\'), 'g'), unicode);
  }

  // 处理间距命令
  result = result.replace(/\\qquad/g, '    ');
  result = result.replace(/\\quad/g, '  ');
  result = result.replace(/\\;/g, ' ');
  result = result.replace(/\\:/g, ' ');
  result = result.replace(/\\,/g, ' ');
  result = result.replace(/\\!/g, '');

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

  // 处理下标 _{...}
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
  // 处理单字符下标（数字和字母）
  result = result.replace(/_([a-zA-Z\d])/g, (_, c) => {
    const subscripts: Record<string, string> = {
      '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
      '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
      '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
      'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ',
      'i': 'ᵢ', 'j': 'ⱼ', 'n': 'ₙ', 'm': 'ₘ',
    };
    return subscripts[c] || c;
  });

  // 处理分数 \frac{a}{b} -> a/b
  result = result.replace(/\\frac{([^}]+)}{([^}]+)}/g, '($1/$2)');

  // 处理平方根 \sqrt{x} -> √x
  result = result.replace(/\\sqrt{([^}]+)}/g, '√($1)');

  // 移除剩余的 LaTeX 命令格式如 \text{...}
  result = result.replace(/\\text{([^}]+)}/g, '$1');
  result = result.replace(/\\mathrm{([^}]+)}/g, '$1');
  result = result.replace(/\\mathbf{([^}]+)}/g, '$1');

  // 清理未处理的 \begin{...} 和 \end{...}
  result = result.replace(/\\begin\{[^}]+\}/g, '');
  result = result.replace(/\\end\{[^}]+\}/g, '');

  // 清理多余的花括号
  result = result.replace(/{([^{}]+)}/g, '$1');

  // 清理空格
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

// ===== OMML 原生 Word 公式支持 =====

// 将 DOM 节点递归转换为 docx 的 IXmlableObject 格式
function domNodeToXmlObject(node: Element): Record<string, any> {
  const children: any[] = [];

  // 收集属性
  const attrs: Record<string, string> = {};
  if (node.attributes && node.attributes.length > 0) {
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i];
      attrs[attr.name] = attr.value;
    }
  }
  if (Object.keys(attrs).length > 0) {
    children.push({ _attr: attrs });
  }

  // 处理子节点
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 1) {
      // 元素节点
      children.push(domNodeToXmlObject(child as Element));
    } else if (child.nodeType === 3) {
      // 文本节点
      const text = child.nodeValue?.trim();
      if (text) {
        children.push(text);
      }
    }
  }

  return { [node.tagName]: children.length > 0 ? children : {} };
}

// 自定义 Math 类：继承 docx 的 Math，覆盖 prepForXml 输出原生 OMML
class OmmlMath extends DocxMath {
  private ommlData: Record<string, any>;

  constructor(ommlXml: string) {
    super({ children: [] });
    const doc = new DOMParser().parseFromString(ommlXml, 'text/xml');
    const mathElement = doc.documentElement;
    this.ommlData = domNodeToXmlObject(mathElement);
  }

  prepForXml(context: any): Record<string, any> | undefined {
    return this.ommlData;
  }
}

// 将 LaTeX 转换为 docx 原生 Math 对象（异步，带 fallback）
async function latexToNativeMath(latex: string, isBlock: boolean = false): Promise<DocxMath | null> {
  try {
    const ommlXml = await latexToOMML(latex, { displayMode: isBlock });
    if (ommlXml && ommlXml.includes('m:oMath')) {
      return new OmmlMath(ommlXml);
    }
    return null;
  } catch (e) {
    console.warn('LaTeX 转 OMML 失败，将使用 Unicode 降级:', (e as Error).message);
    return null;
  }
}

// 简单的文本解析：处理 **加粗**、`代码` 和 $公式$ 格式（异步，支持原生 Math）
type ParagraphChild = TextRun | DocxMath;
async function parseTextWithFormat(text: string, formatSettings?: FormatSettings, baseConfig: Partial<TextRunConfig> = {}): Promise<ParagraphChild[]> {
  const runs: ParagraphChild[] = [];
  const paraStyle = formatSettings?.paragraph || defaultStyles;

  // 分步处理：先处理公式，再处理其他格式
  // 使用更健壮的正则表达式来匹配 LaTeX 公式
  // $$...$$：块级公式（非贪婪匹配）
  // $...$：行内公式（排除连续的$$，并允许包含任意字符）
  const regex = /(\$\$(.+?)\$\$)|(\$(?!\$)(.+?)(?<!\$)\$)|(`+)([^`]+)\5|\*\*(.+?)\*\*/gs;
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
      // 匹配到块级公式 $$...$$ - 尝试原生 OMML
      const mathObj = await latexToNativeMath(match[2], true);
      if (mathObj) {
        runs.push(mathObj);
      } else {
        const unicodeFormula = latexToUnicodeText(match[2]);
        runs.push(new TextRun({
          text: unicodeFormula,
          font: { name: 'Cambria Math' },
          size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
          italics: true,
        }));
      }
    } else if (match[4] !== undefined) {
      // 匹配到行内公式 $...$ - 尝试原生 OMML
      const mathObj = await latexToNativeMath(match[4], false);
      if (mathObj) {
        runs.push(mathObj);
      } else {
        const unicodeFormula = latexToUnicodeText(match[4]);
        runs.push(new TextRun({
          text: unicodeFormula,
          font: { name: 'Cambria Math' },
          size: baseConfig.size || (paraStyle.fontSize || defaultStyles.fontSize) * 2,
          italics: true,
        }));
      }
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
async function createParagraphElement(token: any, formatSettings?: FormatSettings): Promise<Paragraph> {
  const paraStyle = formatSettings?.paragraph || defaultStyles;
  // 获取段落的原始文本（包含markdown标记）
  const rawText = token.raw || token.text || '';
  // 使用简单的正则处理格式
  const runs = await parseTextWithFormat(rawText, formatSettings);

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
async function createBlockquoteParagraphs(token: any, formatSettings?: FormatSettings): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];
  const paraStyle = formatSettings?.paragraph || defaultStyles;

  if (token.tokens && Array.isArray(token.tokens)) {
    for (const innerToken of token.tokens) {
      if (innerToken.type === 'paragraph') {
        const runs = innerToken.tokens
          ? await parseInlineTokens(innerToken.tokens, { color: '666666', italics: true }, formatSettings)
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
async function createListItemParagraphs(token: any, level: number = 0, formatSettings?: FormatSettings): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];
  const paraStyle = formatSettings?.paragraph || defaultStyles;
  const isOrdered = token.ordered || false;
  // 使用更小的圆点符号
  const bulletChars = ['•', '◦', '▪'];
  const bulletChar = isOrdered ? '' : bulletChars[level % 3];

  const items = token.items || [];
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const prefix = isOrdered ? `${idx + 1}. ` : `${bulletChar} `;

    // 处理列表项内容
    let runs: ParagraphChild[] = [];
    if (item.tokens && Array.isArray(item.tokens)) {
      for (const innerToken of item.tokens) {
        if (innerToken.type === 'text' && innerToken.tokens && Array.isArray(innerToken.tokens)) {
          runs = runs.concat(await parseInlineTokens(innerToken.tokens, {}, formatSettings));
        } else if (innerToken.type === 'paragraph' && innerToken.tokens) {
          runs = runs.concat(await parseInlineTokens(innerToken.tokens, {}, formatSettings));
        } else if (innerToken.text) {
          // 使用 parseTextWithFormat 处理文本以支持公式
          runs = runs.concat(await parseTextWithFormat(innerToken.text, formatSettings));
        }
      }
    }

    if (runs.length === 0 && item.text) {
      // 使用 parseTextWithFormat 处理文本以支持公式
      runs = await parseTextWithFormat(item.text, formatSettings);
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
          paragraphs.push(...(await createListItemParagraphs(innerToken, level + 1, formatSettings)));
        }
      }
    }
  }

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
                  elements.push(await createParagraphElement({ raw: innerToken.text, text: innerToken.text }, formatSettings));
                }
              }
              break;
            }
          }
          // 普通段落（不包含图片）
          elements.push(await createParagraphElement(token, formatSettings));
          break;
        case 'blockquote':
          elements.push(...(await createBlockquoteParagraphs(token, formatSettings)));
          break;
        case 'code':
          elements.push(...createCodeBlockParagraphs(token));
          break;
        case 'list':
          elements.push(...(await createListItemParagraphs(token, 0, formatSettings)));
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
): Promise<{ path: string; buffer?: Buffer; html?: string }> {
  if (format === 'md') {
    const filePath = outputPath || `output_${Date.now()}.md`;

    // 将相对路径转换为绝对路径
    // 匹配 markdown 图片语法 ![alt](./assets/images/xxx.png)
    const processedContent = mdContent.replace(
      /!\[([^\]]*)\]\(\.\/assets\/images\/([^)]+)\)/g,
      (match, alt, filename) => {
        // 获取用户文档目录
        const documentsPath = app.getPath('documents');
        const absolutePath = path.join(documentsPath, 'Work2Word_Assets', 'images', filename);
        return `![${alt}](${absolutePath})`;
      }
    );

    await fs.writeFile(filePath, processedContent, 'utf-8');
    return { path: filePath };
  }

  const filePath = outputPath || `output_${Date.now()}.${format === 'doc' ? 'docx' : 'pdf'}`;
  
  if (format === 'doc') {
    try {
      const elements = await markdownToParagraphs(mdContent, formatSettings);
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
    try {
      // 生成 HTML 内容，由 main 进程使用 printToPDF 转换
      const html = await generatePdfHtml(mdContent, formatSettings);
      return { path: filePath, html };
    } catch (error: any) {
      throw new Error(`生成 PDF HTML 失败: ${error.message}`);
    }
  }

  throw new Error(`不支持的输出格式: ${format}`);
}

// 生成用于 PDF 导出的 HTML
async function generatePdfHtml(mdContent: string, formatSettings?: FormatSettings): Promise<string> {
  const settings = formatSettings || defaultFormatSettings;
  const fontFamily = settings.paragraph?.fontFamily || '宋体';
  const fontSize = settings.paragraph?.fontSize || 12;
  const lineHeight = settings.paragraph?.lineHeight || 1.5;

  const h1FontFamily = settings.heading1?.fontFamily || '黑体';
  const h1FontSize = settings.heading1?.fontSize || 22;
  const h2FontFamily = settings.heading2?.fontFamily || '黑体';
  const h2FontSize = settings.heading2?.fontSize || 18;
  const h3FontFamily = settings.heading3?.fontFamily || '黑体';
  const h3FontSize = settings.heading3?.fontSize || 16;
  const h4FontFamily = settings.heading4?.fontFamily || '黑体';
  const h4FontSize = settings.heading4?.fontSize || 14;

  // 解析 Markdown 为 HTML
  const bodyHtml = await marked.parse(mdContent);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    body {
      font-family: "${fontFamily}", "PingFang SC", "Microsoft YaHei", "SimSun", sans-serif;
      font-size: ${fontSize}pt;
      line-height: ${lineHeight};
      color: #333;
      max-width: 100%;
      padding: 0;
      margin: 0;
    }
    h1 { font-family: "${h1FontFamily}", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: ${h1FontSize}pt; margin: 16pt 0 12pt 0; font-weight: bold; }
    h2 { font-family: "${h2FontFamily}", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: ${h2FontSize}pt; margin: 14pt 0 10pt 0; font-weight: bold; }
    h3 { font-family: "${h3FontFamily}", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: ${h3FontSize}pt; margin: 12pt 0 8pt 0; font-weight: bold; }
    h4 { font-family: "${h4FontFamily}", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: ${h4FontSize}pt; margin: 10pt 0 6pt 0; font-weight: bold; }
    h5, h6 { font-size: 12pt; margin: 8pt 0 4pt 0; font-weight: bold; }
    p { margin: 8pt 0; text-align: justify; text-indent: ${settings.paragraph?.firstLineIndent || 2}em; }
    ul, ol { margin: 8pt 0; padding-left: 24pt; }
    li { margin: 4pt 0; }
    li p { text-indent: 0; }
    blockquote {
      margin: 12pt 0;
      padding: 8pt 16pt;
      border-left: 4pt solid #ddd;
      background: #f9f9f9;
      color: #666;
    }
    blockquote p { text-indent: 0; }
    code {
      font-family: "Courier New", monospace;
      background: #f5f5f5;
      padding: 2pt 4pt;
      border-radius: 3pt;
      font-size: 90%;
    }
    pre {
      background: #f5f5f5;
      padding: 12pt;
      border-radius: 4pt;
      overflow-x: auto;
      margin: 12pt 0;
    }
    pre code {
      background: none;
      padding: 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12pt 0;
    }
    th, td {
      border: 1pt solid #ddd;
      padding: 8pt;
      text-align: left;
    }
    th {
      background: #f5f5f5;
      font-weight: bold;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    hr {
      border: none;
      border-top: 1pt solid #ddd;
      margin: 16pt 0;
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

