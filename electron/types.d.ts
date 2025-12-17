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
