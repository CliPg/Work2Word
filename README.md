<p align="center">
  <a href="https://www.getzep.com/">
    <img src="./imgs/w2w.png" width="150">
  </a>
</p>


<h1 align="center" style="font-family: 'Times New Roman', Times, serif;">
  Work2Word
</h1>

一个简洁美观的跨平台应用程序，用Markdown编辑文本，Word渲染，支持导出word、pdf、md。目前需要自行配置api实现根据上传文件和提示词生成和编辑md文本。软件开发的起因是大学时要写太多的报告、不断调整Word格式。

## 功能特性

- 📄 **多格式文件支持**：支持 DOC、DOCX、PDF、TXT 格式的作业附件
- ✍️ **智能作业处理**：输入作业要求，AI 自动完成作业内容
- 🤖 **多 LLM 支持**：支持通义千问 (Qwen)、OpenAI 和自定义 API
- 📝 **多格式导出**：支持导出为 Markdown、Word 文档和 PDF 格式
- 🎨 **简洁美观的界面**：现代化的 UI 设计，提供流畅的用户体验
- 💻 **跨平台支持**：同时支持 macOS 和 Windows 系统

## 技术栈

- **前端**：React + TypeScript + Vite
- **桌面框架**：Electron
- **文件处理**：mammoth (Word)、pdf-parse (PDF)
- **格式转换**：docx (Word 生成)、puppeteer (PDF 生成)
- **Markdown 渲染**：react-markdown

## 安装和运行

### 前置要求

- Node.js 18+ 
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

这将同时启动 React 开发服务器和 Electron 应用。

### 构建应用

```bash
# 构建前端和 Electron
npm run build

# 打包为 macOS 应用
npm run package:mac

# 打包为 Windows 应用
npm run package:win

# 同时打包 macOS 和 Windows
npm run package:all
```

## 使用说明

1. **上传作业附件**：点击或拖拽文件到上传区域，支持 DOC、DOCX、PDF、TXT 格式
2. **输入作业要求**：在文本框中输入您的作业要求（prompt）
3. **配置 LLM**：选择 LLM 提供商并输入 API Key
4. **开始处理**：点击"开始处理"按钮，AI 将根据作业要求和附件内容生成答案
5. **查看结果**：处理完成后，结果会以 Markdown 格式显示在右侧面板
6. **导出文件**：点击底部的保存按钮，选择导出格式（MD、DOC、PDF）

## LLM 配置

### 通义千问 (Qwen)

1. 在"提供商"下拉框中选择"通义千问 (Qwen)"
2. 输入您的 API Key（可在阿里云 DashScope 获取）
3. 选择模型（默认：qwen-turbo）

### OpenAI

1. 在"提供商"下拉框中选择"OpenAI"
2. 输入您的 OpenAI API Key
3. 选择模型（默认：gpt-3.5-turbo）

### 自定义 API

1. 在"提供商"下拉框中选择"自定义 API"
2. 输入 API URL 和 API Key（如需要）
3. 输入模型名称

## 项目结构

```
electron/
├── main.ts                 # 主进程入口
├── preload.ts              # 预加载脚本
├── types.d.ts              # 类型声明
├── services/               # 服务层
│   ├── index.ts            # 服务导出
│   ├── fileService.ts      # 文件读取服务
│   ├── llmService.ts       # LLM 调用服务
│   └── exportService.ts    # 导出转换服务
├── utils/                  # 工具函数
│   ├── index.ts            # 工具导出
│   ├── markdownParser.ts   # Markdown 解析
│   └── latexConverter.ts   # LaTeX 转换
└── types/                  # 类型定义
    └── index.ts            # 类型导出

src/
├── main.tsx                # React 入口
├── App.tsx                 # 主组件
├── App.css                 # 主样式
├── index.css               # 全局样式
├── electron.d.ts           # Electron API 声明
├── components/             # UI 组件
│   ├── index.ts            # 组件导出
│   ├── editor/             # 编辑器相关
│   │   ├── MarkdownEditor.tsx
│   │   └── MarkdownEditor.css
│   ├── preview/            # 预览相关
│   │   ├── WordPreview.tsx
│   │   └── WordPreview.css
│   ├── sidebar/            # 侧边栏相关
│   │   ├── Sidebar.tsx
│   │   └── Sidebar.css
│   ├── settings/           # 设置相关
│   │   ├── FormatSettings.tsx
│   │   ├── FormatSettings.css
│   │   ├── LLMConfig.tsx
│   │   └── LLMConfig.css
│   └── common/             # 通用组件
│       ├── FileUpload.tsx
│       ├── FileUpload.css
│       ├── PromptInput.tsx
│       ├── PromptInput.css
│       ├── ResultDisplay.tsx
│       └── ResultDisplay.css
└── hooks/                  # 自定义 Hooks（未来扩展）
    └── index.ts
```

## 注意事项

- PDF 转换功能使用 Puppeteer，首次运行可能需要下载 Chromium
- 确保您有有效的 LLM API Key 才能使用 AI 功能
- 文件大小建议控制在合理范围内，过大的文件可能影响处理速度
- 配置信息会自动保存到本地存储，无需每次重新输入

## 开发

### 项目结构

```
work2word/
├── electron/              # Electron 主进程代码
│   ├── main.ts           # 主进程入口，窗口管理和 IPC 处理
│   ├── preload.ts        # 预加载脚本，暴露安全的 API
│   ├── fileProcessor.ts  # 文件处理逻辑（Word/PDF/TXT）
│   └── llmService.ts     # LLM 调用服务（Qwen/OpenAI/自定义）
├── src/                  # React 前端代码
│   ├── components/       # React 组件
│   │   ├── FileUpload.tsx      # 文件上传组件
│   │   ├── PromptInput.tsx     # 作业要求输入组件
│   │   ├── LLMConfig.tsx       # LLM 配置组件
│   │   └── ResultDisplay.tsx   # 结果展示组件
│   ├── App.tsx           # 主应用组件
│   ├── main.tsx          # React 入口
│   └── index.css         # 全局样式
├── package.json          # 项目配置和依赖
├── vite.config.ts        # Vite 配置
├── tsconfig.json         # TypeScript 配置（React）
├── tsconfig.electron.json # TypeScript 配置（Electron）
└── README.md             # 项目说明
```

### 开发命令

```bash
# 开发模式（同时启动 React 和 Electron）
npm run dev

# 仅启动 React 开发服务器
npm run dev:react

# 仅启动 Electron
npm run dev:electron

# 构建生产版本
npm run build

# 打包应用
npm run package:mac    # macOS
npm run package:win    # Windows
npm run package:all    # 所有平台
```

## 功能特性详解

### 文件处理
- **Word 文档 (DOC/DOCX)**: 使用 mammoth 库提取文本内容
- **PDF 文档**: 使用 pdf-parse 库提取文本内容
- **文本文件 (TXT)**: 直接读取 UTF-8 编码内容

### LLM 集成
- **通义千问**: 支持 DashScope API，默认模型 qwen-turbo
- **OpenAI**: 支持 GPT 系列模型，默认 gpt-3.5-turbo
- **自定义 API**: 支持自定义 API 端点，灵活配置

### 格式转换
- **Markdown**: 直接保存为 .md 文件
- **Word 文档**: 使用 docx 库生成 .docx 文件，支持标题、粗体、斜体等格式
- **PDF 文档**: 使用 Puppeteer 将 Markdown 渲染为 HTML 后转换为 PDF

## 许可证

MIT

