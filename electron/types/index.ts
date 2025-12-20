// ==================== 排版设置类型 ====================

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

// ==================== LLM 配置类型 ====================

export interface LLMConfig {
  provider: 'qwen' | 'openai' | 'custom';
  apiKey?: string;
  apiUrl?: string;
  model?: string;
}

// ==================== 处理结果类型 ====================

export interface ProcessStepResult {
  step: 'format' | 'questions' | 'final';
  content: string;
  timestamp: string;
}

export interface HomeworkProcessResult {
  formatTemplate: ProcessStepResult;
  questionsAnswer: ProcessStepResult;
  finalResult: ProcessStepResult;
}

// ==================== 编辑相关类型 ====================

export interface EditChange {
  searchText: string;
  replaceText: string;
  description: string;
}

export interface EditContentResult {
  changes: EditChange[];
  summary: string;
}

// ==================== TextRun 配置类型 ====================

export interface TextRunConfig {
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

// ==================== 导出结果类型 ====================

export interface ExportResult {
  path: string;
  buffer?: Buffer;
}
