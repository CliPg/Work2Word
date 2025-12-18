// word-extractor 类型声明
declare module 'word-extractor' {
  interface Document {
    getBody(): string;
    getFootnotes(): string;
    getEndnotes(): string;
    getHeaders(): string[];
    getFooters(): string[];
    getAnnotations(): string[];
  }

  class WordExtractor {
    extract(filePath: string): Promise<Document>;
  }

  export = WordExtractor;
}

// pdfkit 类型声明
declare module 'pdfkit' {
  import { Writable } from 'stream';

  interface PDFDocumentOptions {
    size?: string | [number, number];
    margins?: { top?: number; bottom?: number; left?: number; right?: number };
    info?: { Title?: string; Author?: string; Subject?: string; Keywords?: string };
    autoFirstPage?: boolean;
    bufferPages?: boolean;
  }

  class PDFDocument extends Writable {
    constructor(options?: PDFDocumentOptions);
    
    x: number;
    y: number;
    
    font(name: string, size?: number): this;
    registerFont(name: string, path: string): this;
    fontSize(size: number): this;
    fillColor(color: string): this;
    text(text: string, options?: any): this;
    text(text: string, x?: number, y?: number, options?: any): this;
    moveDown(lines?: number): this;
    rect(x: number, y: number, w: number, h: number): this;
    fill(color: string): this;
    heightOfString(text: string, options?: any): number;
    addPage(options?: any): this;
    end(): void;
    
    on(event: 'data', listener: (chunk: Buffer) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
  }

  export = PDFDocument;
}
