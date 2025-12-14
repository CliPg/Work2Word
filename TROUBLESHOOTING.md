# 故障排除指南

## Electron 窗口显示空白

### 问题描述
Electron 窗口显示空白，但网页 UI 在浏览器中显示正常。

### 可能原因和解决方案

#### 1. Vite 开发服务器未启动

**检查方法**:
- 打开终端，查看是否有 Vite 服务器运行在 `http://localhost:5173`
- 在浏览器中访问 `http://localhost:5173` 查看是否能正常显示

**解决方案**:
```bash
# 确保使用正确的启动命令
npm run dev

# 这会同时启动：
# 1. Vite 开发服务器 (端口 5173)
# 2. Electron 应用
```

#### 2. Electron 无法连接到 Vite 服务器

**检查方法**:
- 打开 Electron 的开发者工具（应该自动打开）
- 查看 Console 标签页的错误信息
- 查看 Network 标签页，确认是否有请求失败

**解决方案**:
```bash
# 确保 Vite 服务器先启动
npm run dev:react

# 在另一个终端启动 Electron
npm run dev:electron
```

#### 3. Preload 脚本未正确加载

**检查方法**:
- 在 Electron 开发者工具的 Console 中运行：
  ```javascript
  console.log(window.electronAPI);
  ```
- 如果返回 `undefined`，说明 preload 脚本未正确加载

**解决方案**:
```bash
# 重新构建 Electron 代码
npm run build:electron

# 检查 dist/preload.js 是否存在
ls -la dist/preload.js
```

#### 4. 路径问题

**检查方法**:
- 查看 `dist/main.js` 中的路径是否正确
- 确认 `preload.js` 的路径

**解决方案**:
- 确保 `dist/preload.js` 文件存在
- 检查 `electron/main.ts` 中的路径配置

## 无法导入文件

### 问题描述
点击文件上传按钮没有反应，或无法打开文件选择对话框。

### 可能原因和解决方案

#### 1. electronAPI 未定义

**检查方法**:
在 Electron 开发者工具的 Console 中运行：
```javascript
console.log(typeof window.electronAPI);
console.log(window.electronAPI);
```

**如果返回 `undefined`**:
- Preload 脚本未正确加载
- 检查 `dist/preload.js` 是否存在
- 重新构建：`npm run build:electron`

#### 2. IPC 通信失败

**检查方法**:
- 查看 Electron 主进程的终端输出
- 查看是否有错误信息

**解决方案**:
```bash
# 检查主进程代码是否正确编译
cat dist/main.js | grep "ipcMain.handle"

# 应该看到类似：
# ipcMain.handle('open-file-dialog', ...)
```

#### 3. 文件对话框权限问题

**检查方法**:
- 查看是否有权限错误
- 检查 macOS 的隐私设置

**解决方案**:
- 在 macOS 系统设置中，确保应用有文件访问权限
- 重新启动应用

## 调试步骤

### 步骤 1: 检查所有服务是否运行

```bash
# 检查 Vite 服务器
curl http://localhost:5173

# 检查 Electron 进程
ps aux | grep electron
```

### 步骤 2: 查看日志

**Electron 主进程日志**:
- 查看运行 `npm run dev` 的终端输出
- 查找错误信息

**渲染进程日志**:
- 打开 Electron 开发者工具（应该自动打开）
- 查看 Console 标签页

### 步骤 3: 验证文件结构

```bash
# 检查关键文件是否存在
ls -la dist/main.js
ls -la dist/preload.js
ls -la index.html
```

### 步骤 4: 清理并重新构建

```bash
# 清理所有构建文件
npm run clean

# 重新安装依赖（如果需要）
npm install

# 重新构建
npm run build:electron

# 启动开发服务器
npm run dev
```

## 常见错误信息

### "Cannot find module '/Users/.../dist/main.js'"
**解决方案**: 运行 `npm run build:electron`

### "electronAPI is not defined"
**解决方案**: 
1. 确保 `dist/preload.js` 存在
2. 重新构建：`npm run build:electron`
3. 重启 Electron

### "Failed to load resource: net::ERR_CONNECTION_REFUSED"
**解决方案**: 
1. 确保 Vite 服务器正在运行
2. 检查端口 5173 是否被占用

### "Uncaught TypeError: Cannot read property 'openFileDialog' of undefined"
**解决方案**: 
1. 检查 preload 脚本是否正确加载
2. 重新构建 Electron 代码

## 获取帮助

如果以上方法都无法解决问题：

1. **查看完整错误信息**:
   - Electron 开发者工具的 Console
   - 终端中的主进程日志

2. **检查环境**:
   ```bash
   node -v
   npm -v
   ```

3. **重新安装依赖**:
   ```bash
   npm run clean
   npm install
   npm run build:electron
   ```

