# 安装问题解决指南

## 如果 npm install 卡住

### 问题原因
`puppeteer` 在安装时会自动下载 Chromium（约 200-300MB），如果网络较慢可能会卡住。

### 解决方案

#### 方案 1: 使用国内镜像（推荐）

项目已配置 `.npmrc` 文件使用淘宝镜像，如果仍然卡住，可以：

```bash
# 使用淘宝镜像安装
npm install --registry=https://registry.npmmirror.com

# 或者使用项目脚本
npm run install:cn
```

#### 方案 2: 跳过 Chromium 下载（快速安装）

如果暂时不需要 PDF 转换功能，可以跳过 Chromium 下载：

```bash
# 设置环境变量跳过 Chromium 下载
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install

# 或使用项目脚本
npm run install:fast
```

**注意**: 如果跳过 Chromium 下载，PDF 转换功能将不可用，直到手动安装 Chromium。

#### 方案 3: 手动安装 Chromium

如果已经安装了 Chrome/Chromium，可以配置 puppeteer 使用系统浏览器：

```bash
# 安装 puppeteer-core（不包含 Chromium）
npm install puppeteer-core --save

# 然后修改 electron/fileProcessor.ts 中的导入
# 将 `import puppeteer from 'puppeteer'` 改为使用系统 Chrome
```

#### 方案 4: 分步安装

如果网络不稳定，可以分步安装：

```bash
# 1. 先安装其他依赖（跳过 puppeteer）
npm install --ignore-scripts

# 2. 单独安装 puppeteer（使用镜像）
npm install puppeteer@^24.15.0 --registry=https://registry.npmmirror.com
```

### 检查安装进度

如果安装卡住，可以：

1. **查看详细日志**:
   ```bash
   npm install --verbose
   ```

2. **检查网络连接**:
   ```bash
   # 测试镜像连接
   curl https://registry.npmmirror.com
   ```

3. **查看 puppeteer 下载进度**:
   - 安装 puppeteer 时会在 `node_modules/.cache/puppeteer` 目录下载 Chromium
   - 可以查看该目录的大小变化来判断下载进度

### 常见错误

#### Error: Failed to download Chromium

**解决方法**:
```bash
# 使用国内镜像下载 Chromium
export PUPPETEER_DOWNLOAD_HOST=https://npmmirror.com/mirrors
npm install puppeteer
```

#### 网络超时

**解决方法**:
```bash
# 增加超时时间
npm install --fetch-timeout=600000
```

#### 权限问题

**解决方法**:
```bash
# 清理缓存后重试
npm cache clean --force
rm -rf node_modules
npm install
```

### 验证安装

安装完成后，验证关键依赖：

```bash
# 检查 puppeteer
npm list puppeteer

# 检查 electron
npm list electron

# 检查所有依赖
npm list --depth=0
```

### 如果仍然无法解决

1. 检查 Node.js 版本（建议 18+）:
   ```bash
   node -v
   ```

2. 更新 npm:
   ```bash
   npm install -g npm@latest
   ```

3. 使用 yarn 替代:
   ```bash
   npm install -g yarn
   yarn install
   ```

4. 查看详细错误信息:
   ```bash
   npm install --loglevel=verbose
   ```

