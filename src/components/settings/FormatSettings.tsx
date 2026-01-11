import React, { useState } from 'react';
import { X, Type, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import './FormatSettings.css';

// 排版设置类型
export interface ParagraphStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;      // 行间距倍数
  paragraphSpacing: number; // 段落间距（磅）
  firstLineIndent: number;  // 首行缩进（字符数）
}

export interface HeadingStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  alignment: 'left' | 'center' | 'right' | 'justify';
  spacingBefore: number;   // 段前间距（磅）
  spacingAfter: number;    // 段后间距（磅）
}

export interface FormatSettings {
  paragraph: ParagraphStyle;
  heading1: HeadingStyle;
  heading2: HeadingStyle;
  heading3: HeadingStyle;
  heading4: HeadingStyle;
}

// 默认排版设置
export const defaultFormatSettings: FormatSettings = {
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

// 常用字体列表
const fontFamilies = [
  '宋体',
  '黑体',
  '楷体',
  '仿宋',
  '微软雅黑',
  'Arial',
  'Times New Roman',
];

// 常用字号
const fontSizes = [10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48];

interface FormatSettingsProps {
  visible: boolean;
  onClose: () => void;
  settings: FormatSettings;
  onSettingsChange: (settings: FormatSettings) => void;
  sidebarMode?: boolean; // 新增：是否使用侧边栏模式
}

const FormatSettingsPanel: React.FC<FormatSettingsProps> = ({
  visible,
  onClose,
  settings,
  onSettingsChange,
  sidebarMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<'paragraph' | 'heading'>('paragraph');

  const updateParagraph = (updates: Partial<ParagraphStyle>) => {
    onSettingsChange({
      ...settings,
      paragraph: { ...settings.paragraph, ...updates },
    });
  };

  const updateHeading = (level: 1 | 2 | 3 | 4, updates: Partial<HeadingStyle>) => {
    const key = `heading${level}` as keyof FormatSettings;
    onSettingsChange({
      ...settings,
      [key]: { ...settings[key], ...updates },
    });
  };

  const renderAlignmentButtons = (
    value: 'left' | 'center' | 'right' | 'justify',
    onChange: (v: 'left' | 'center' | 'right' | 'justify') => void
  ) => (
    <div className="alignment-buttons">
      <button
        className={value === 'left' ? 'active' : ''}
        onClick={() => onChange('left')}
        title="左对齐"
      >
        <AlignLeft size={14} />
      </button>
      <button
        className={value === 'center' ? 'active' : ''}
        onClick={() => onChange('center')}
        title="居中"
      >
        <AlignCenter size={14} />
      </button>
      <button
        className={value === 'right' ? 'active' : ''}
        onClick={() => onChange('right')}
        title="右对齐"
      >
        <AlignRight size={14} />
      </button>
      <button
        className={value === 'justify' ? 'active' : ''}
        onClick={() => onChange('justify')}
        title="两端对齐"
      >
        <AlignJustify size={14} />
      </button>
    </div>
  );

  const renderHeadingSettings = (level: 1 | 2 | 3 | 4) => {
    const heading = settings[`heading${level}` as keyof FormatSettings] as HeadingStyle;
    return (
      <div className="heading-group" key={level}>
        <div className="heading-group-title">{level}级标题</div>
        <div className="settings-row">
          <div className="setting-field">
            <label>字体</label>
            <select
              value={heading.fontFamily}
              onChange={(e) => updateHeading(level, { fontFamily: e.target.value })}
            >
              {fontFamilies.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="setting-field">
            <label>字号</label>
            <select
              value={heading.fontSize}
              onChange={(e) => updateHeading(level, { fontSize: Number(e.target.value) })}
            >
              {fontSizes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="settings-row">
          <div className="setting-field">
            <label>行间距</label>
            <select
              value={heading.lineHeight}
              onChange={(e) => updateHeading(level, { lineHeight: Number(e.target.value) })}
            >
              <option value={1}>单倍</option>
              <option value={1.15}>1.15倍</option>
              <option value={1.5}>1.5倍</option>
              <option value={2}>2倍</option>
            </select>
          </div>
          <div className="setting-field">
            <label>对齐</label>
            {renderAlignmentButtons(heading.alignment, (v) => updateHeading(level, { alignment: v }))}
          </div>
        </div>
        <div className="settings-row">
          <div className="setting-field">
            <label>段前</label>
            <div className="number-input">
              <input
                type="number"
                value={heading.spacingBefore}
                onChange={(e) => updateHeading(level, { spacingBefore: Number(e.target.value) })}
                min={0}
                max={72}
              />
              <span>磅</span>
            </div>
          </div>
          <div className="setting-field">
            <label>段后</label>
            <div className="number-input">
              <input
                type="number"
                value={heading.spacingAfter}
                onChange={(e) => updateHeading(level, { spacingAfter: Number(e.target.value) })}
                min={0}
                max={72}
              />
              <span>磅</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!visible) return null;

  // 侧边栏模式：直接返回面板内容
  if (sidebarMode) {
    return (
      <div className="format-settings-sidebar">
        <div className="format-settings-header">
          <Type size={16} />
          <span>排版设置</span>
        </div>

        <div className="format-settings-tabs">
          <button
            className={activeTab === 'paragraph' ? 'active' : ''}
            onClick={() => setActiveTab('paragraph')}
          >
            正文段落
          </button>
          <button
            className={activeTab === 'heading' ? 'active' : ''}
            onClick={() => setActiveTab('heading')}
          >
            标题样式
          </button>
        </div>

        <div className="format-settings-content">
          {activeTab === 'paragraph' && (
            <div className="paragraph-settings">
              <div className="settings-row">
                <div className="setting-field">
                  <label>字体</label>
                  <select
                    value={settings.paragraph.fontFamily}
                    onChange={(e) => updateParagraph({ fontFamily: e.target.value })}
                  >
                    {fontFamilies.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div className="setting-field">
                  <label>字号</label>
                  <select
                    value={settings.paragraph.fontSize}
                    onChange={(e) => updateParagraph({ fontSize: Number(e.target.value) })}
                  >
                    {fontSizes.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="settings-row">
                <div className="setting-field">
                  <label>行间距</label>
                  <select
                    value={settings.paragraph.lineHeight}
                    onChange={(e) => updateParagraph({ lineHeight: Number(e.target.value) })}
                  >
                    <option value={1}>单倍</option>
                    <option value={1.15}>1.15倍</option>
                    <option value={1.5}>1.5倍</option>
                    <option value={2}>2倍</option>
                  </select>
                </div>
                <div className="setting-field">
                  <label>段落间距</label>
                  <div className="number-input">
                    <input
                      type="number"
                      value={settings.paragraph.paragraphSpacing}
                      onChange={(e) => updateParagraph({ paragraphSpacing: Number(e.target.value) })}
                      min={0}
                      max={72}
                    />
                    <span>磅</span>
                  </div>
                </div>
              </div>

              <div className="settings-row">
                <div className="setting-field">
                  <label>首行缩进</label>
                  <div className="number-input">
                    <input
                      type="number"
                      value={settings.paragraph.firstLineIndent}
                      onChange={(e) => updateParagraph({ firstLineIndent: Number(e.target.value) })}
                      min={0}
                      max={10}
                    />
                    <span>字符</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'heading' && (
            <div className="heading-settings">
              {[1, 2, 3, 4].map((level) => renderHeadingSettings(level as 1 | 2 | 3 | 4))}
            </div>
          )}
        </div>

        <div className="format-settings-footer">
          <button className="reset-btn" onClick={() => onSettingsChange(defaultFormatSettings)}>
            恢复默认
          </button>
        </div>
      </div>
    );
  }

  // 模态框模式（原有逻辑）
  return (
    <div className="format-settings-overlay" onClick={onClose}>
      <div className="format-settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="format-settings-header">
          <Type size={16} />
          <span>排版设置</span>
          <button className="close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="format-settings-tabs">
          <button
            className={activeTab === 'paragraph' ? 'active' : ''}
            onClick={() => setActiveTab('paragraph')}
          >
            正文段落
          </button>
          <button
            className={activeTab === 'heading' ? 'active' : ''}
            onClick={() => setActiveTab('heading')}
          >
            标题样式
          </button>
        </div>

        <div className="format-settings-content">
          {activeTab === 'paragraph' && (
            <div className="paragraph-settings">
              <div className="settings-row">
                <div className="setting-field">
                  <label>字体</label>
                  <select
                    value={settings.paragraph.fontFamily}
                    onChange={(e) => updateParagraph({ fontFamily: e.target.value })}
                  >
                    {fontFamilies.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div className="setting-field">
                  <label>字号</label>
                  <select
                    value={settings.paragraph.fontSize}
                    onChange={(e) => updateParagraph({ fontSize: Number(e.target.value) })}
                  >
                    {fontSizes.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="settings-row">
                <div className="setting-field">
                  <label>行间距</label>
                  <select
                    value={settings.paragraph.lineHeight}
                    onChange={(e) => updateParagraph({ lineHeight: Number(e.target.value) })}
                  >
                    <option value={1}>单倍</option>
                    <option value={1.15}>1.15倍</option>
                    <option value={1.5}>1.5倍</option>
                    <option value={2}>2倍</option>
                  </select>
                </div>
                <div className="setting-field">
                  <label>段落间距</label>
                  <div className="number-input">
                    <input
                      type="number"
                      value={settings.paragraph.paragraphSpacing}
                      onChange={(e) => updateParagraph({ paragraphSpacing: Number(e.target.value) })}
                      min={0}
                      max={72}
                    />
                    <span>磅</span>
                  </div>
                </div>
              </div>

              <div className="settings-row">
                <div className="setting-field">
                  <label>首行缩进</label>
                  <div className="number-input">
                    <input
                      type="number"
                      value={settings.paragraph.firstLineIndent}
                      onChange={(e) => updateParagraph({ firstLineIndent: Number(e.target.value) })}
                      min={0}
                      max={10}
                    />
                    <span>字符</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'heading' && (
            <div className="heading-settings">
              {[1, 2, 3, 4].map((level) => renderHeadingSettings(level as 1 | 2 | 3 | 4))}
            </div>
          )}
        </div>

        <div className="format-settings-footer">
          <button className="reset-btn" onClick={() => onSettingsChange(defaultFormatSettings)}>
            恢复默认
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormatSettingsPanel;
