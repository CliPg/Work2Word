import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// 检查 electronAPI 是否可用
if (typeof window !== 'undefined') {
  console.log('Window object:', window);
  console.log('electronAPI available:', !!window.electronAPI);
  if (window.electronAPI) {
    console.log('electronAPI methods:', Object.keys(window.electronAPI));
  } else {
    console.warn('⚠️ electronAPI 不可用 - 请确保在 Electron 环境中运行');
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

