# Work2Word 快速启动指南

## 安装步骤

### 1. 安装依赖

```bash
npm install
```

**⚠️ 如果安装卡住**: 
- 可能是 `puppeteer` 正在下载 Chromium（约 200-300MB），需要一些时间
- 如果长时间卡住（超过 10 分钟），请查看 [INSTALL_TIPS.md](./INSTALL_TIPS.md) 获取详细解决方案
- 快速解决方案：
  ```bash
  # 使用国内镜像加速
  npm run install:cn
  
  # 或跳过 Chromium 下载（PDF 功能将不可用）
  npm run install:fast
  ```

**注意**: 如果安装时出现依赖警告（如 puppeteer、glob 等），这是正常的。这些警告不会影响功能使用。如果遇到问题，可以尝试：

```bash
# 清理并重新安装依赖
npm run reinstall

# 或者强制重新安装 puppeteer
npm install puppeteer@latest --force
```

### 2. 启动开发模式

```bash
npm run dev
```

这将同时启动：
- React 开发服务器（Vite）在 http://localhost:5173
- Electron 应用窗口

## 使用说明

### 首次使用

1. **配置 LLM API**
   - 在左侧面板的"LLM 配置"区域选择提供商（Qwen/OpenAI/自定义）
   - 输入您的 API Key
   - 配置会自动保存到本地存储

2. **上传作业附件**
   - 点击或拖拽文件到上传区域
   - 支持格式：DOC, DOCX, PDF, TXT

3. **输入作业要求**
   - 在"作业要求"文本框中输入您的 prompt
   - 例如："请分析附件中的文章，并写一篇 500 字的读后感"

4. **开始处理**
   - 点击"开始处理"按钮或按 ⌘ + Enter
   - AI 将根据作业要求和附件内容生成答案

5. **查看和导出结果**
   - 处理完成后，结果会以 Markdown 格式显示在右侧
   - 点击底部的保存按钮（MD/DOC/PDF）导出文件

## 构建和打包

### 构建生产版本

```bash
npm run build
```

### 打包为 Mac 应用

```bash
npm run package
```

打包后的文件会在 `dist` 目录中。

## 常见问题

### Q: API Key 在哪里获取？

**通义千问 (Qwen):**
- 访问：https://dashscope.aliyuncs.com/
- 注册账号并创建 API Key

**OpenAI:**
- 访问：https://platform.openai.com/api-keys
- 登录并创建 API Key

### Q: PDF 转换失败？

- 首次使用 PDF 转换功能时，Puppeteer 需要下载 Chromium（约 200MB）
- 确保网络连接正常
- 如果失败，可以尝试：
  ```bash
  npm install puppeteer@latest --force
  npm run reinstall
  ```

### Q: 安装依赖时出现警告？

以下警告是正常的，不会影响应用功能：

- **`puppeteer@21.11.0`**: 已更新到 `^24.15.0`，警告已解决
- **`glob@7.2.3`**: 已通过 `overrides` 处理
- **`inflight`**: 已通过 `overrides` 处理
- **`boolean@3.2.0`**: 这是 Electron 的间接依赖，无法直接替换，但不影响功能

这些警告主要来自 Electron 及其依赖链，是 npm 生态系统的常见情况。项目已配置 `overrides` 来处理可以安全替换的依赖。

如果担心，可以运行：
```bash
npm run reinstall
```

### Q: 文件处理失败？

- 确保文件格式正确（支持 .doc, .docx, .pdf, .txt）
- 检查文件是否损坏
- 确保文件大小在合理范围内（建议 < 10MB）

### Q: 如何清除配置？

- 打开浏览器开发者工具（开发模式下自动打开）
- 在 Console 中执行：`localStorage.removeItem('work2word_config')`
- 刷新应用

## 技术栈

- **前端**: React 18 + TypeScript + Vite
- **桌面框架**: Electron 28
- **UI 组件**: Lucide React Icons
- **文件处理**: mammoth (Word), pdf-parse (PDF)
- **格式转换**: docx (Word), puppeteer (PDF)
- **Markdown**: react-markdown, marked

## 开发提示

- 开发模式下会自动打开开发者工具
- 所有配置会自动保存到 localStorage
- 支持热重载，修改代码后自动刷新

