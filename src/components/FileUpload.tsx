import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, Loader2 } from 'lucide-react';
import './FileUpload.css';

interface FileUploadProps {
  onFileSelect: (path: string) => void;
  filePath: string;
  loading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, filePath, loading }) => {
  const handleClick = async () => {
    try {
      // 检查 electronAPI 是否可用
      if (!window.electronAPI) {
        console.error('electronAPI 不可用，请确保在 Electron 环境中运行');
        alert('文件选择功能需要在 Electron 环境中运行');
        return;
      }
      
      const result = await window.electronAPI.openFileDialog();
      if (!result.canceled && result.filePath) {
        onFileSelect(result.filePath);
      }
    } catch (error: any) {
      console.error('打开文件对话框失败:', error);
      alert(`打开文件对话框失败: ${error.message || error}`);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      // 在 Electron 中，拖拽的文件需要通过文件路径处理
      // 由于浏览器安全限制，我们使用文件选择对话框
      handleClick();
    }
  }, []);

  const { getRootProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
    },
    noClick: true,
    disabled: loading,
    noKeyboard: true,
  });

  const fileName = filePath ? filePath.split('/').pop() || filePath.split('\\').pop() : '';

  return (
    <div className="file-upload">
      <h2 className="section-title">作业附件</h2>
      <div
        {...getRootProps()}
        className={`upload-area ${isDragActive ? 'drag-active' : ''} ${filePath ? 'has-file' : ''}`}
        onClick={handleClick}
      >
        {loading ? (
          <div className="upload-loading">
            <Loader2 className="icon spin" />
            <p>处理中...</p>
          </div>
        ) : filePath ? (
          <div className="upload-success">
            <File className="icon" />
            <p className="file-name">{fileName}</p>
            <button
              className="change-file-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
            >
              更换文件
            </button>
          </div>
        ) : (
          <div className="upload-placeholder">
            <Upload className="icon" />
            <p className="upload-text">
              {isDragActive ? '松开以上传文件' : '点击或拖拽文件到此处'}
            </p>
            <p className="upload-hint">支持 DOC、DOCX、PDF、TXT 格式</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;

