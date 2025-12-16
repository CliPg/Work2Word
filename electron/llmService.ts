import axios from 'axios';

export interface LLMConfig {
  provider: 'qwen' | 'openai' | 'custom';
  apiKey?: string;
  apiUrl?: string;
  model?: string;
}

// 处理步骤结果接口
export interface ProcessStepResult {
  step: 'format' | 'questions' | 'final';
  content: string;
  timestamp: string;
}

// 完整处理结果接口
export interface HomeworkProcessResult {
  formatTemplate: ProcessStepResult;
  questionsAnswer: ProcessStepResult;
  finalResult: ProcessStepResult;
}

// 步骤1：提取作业格式要求
export async function extractFormatTemplate(
  userPrompt: string,
  fileContent: string,
  config: LLMConfig
): Promise<ProcessStepResult> {
  const maxContentLength = 10000;
  const truncatedContent = fileContent.length > maxContentLength 
    ? fileContent.substring(0, maxContentLength) + '\n\n[内容已截断...]'
    : fileContent;

  const formatExtractionPrompt = `你是一个作业格式分析专家。请仔细分析以下文档内容和用户输入，提取出作业的格式要求。

【用户输入的作业要求】
${userPrompt}

【文档内容】
${truncatedContent}

【任务要求】
请提取并输出作业的格式模版，包括但不限于：
1. 作业标题格式（如：标题层级、编号方式）
2. 整体结构要求（如：需要哪些部分，顺序如何）
3. 排版要求（如：字体、字号、段落格式等，如有提及）
4. 特殊格式要求（如：封面、目录、参考文献格式等）
5. 页面布局要求（如：页边距、行距等，如有提及）

请以 JSON 格式输出格式模版，格式如下：
\`\`\`json
{
  "title": "作业标题格式描述",
  "structure": ["结构部分1", "结构部分2", ...],
  "headingStyle": "标题层级描述",
  "numberingStyle": "编号方式描述",
  "specialRequirements": ["特殊要求1", "特殊要求2", ...],
  "layoutRequirements": "页面布局要求",
  "otherFormats": "其他格式说明"
}
\`\`\`

如果某些信息在文档中没有明确提及，请根据常规学术作业格式进行合理推断并标注"(推断)"。`;

  const result = await callLLMInternal(formatExtractionPrompt, config);
  
  return {
    step: 'format',
    content: result,
    timestamp: new Date().toISOString()
  };
}

// 步骤2：提取作业题目并完成答案
export async function extractAndAnswerQuestions(
  userPrompt: string,
  fileContent: string,
  config: LLMConfig
): Promise<ProcessStepResult> {
  const maxContentLength = 10000;
  const truncatedContent = fileContent.length > maxContentLength 
    ? fileContent.substring(0, maxContentLength) + '\n\n[内容已截断...]'
    : fileContent;

  const questionExtractionPrompt = `你是一个专业的作业解答助手。请仔细分析以下文档内容和用户输入，提取出所有作业题目并逐一完成解答。

【用户输入的作业要求】
${userPrompt}

【文档内容】
${truncatedContent}

【任务要求】
1. 首先识别并列出文档中的所有题目/问题/任务
2. 然后针对每个题目给出详细、专业、准确的答案

请按以下 JSON 格式输出：
\`\`\`json
{
  "questions": [
    {
      "id": 1,
      "question": "题目1原文",
      "type": "题目类型（如：简答题、论述题、计算题、分析题等）",
      "answer": "详细答案",
      "keyPoints": ["要点1", "要点2", ...]
    },
    {
      "id": 2,
      "question": "题目2原文",
      "type": "题目类型",
      "answer": "详细答案",
      "keyPoints": ["要点1", "要点2", ...]
    }
  ],
  "summary": "作业整体概述"
}
\`\`\`

【注意事项】
- 答案应该专业、准确、有深度
- 适当引用相关理论、概念或数据支持
- 如有计算题，需展示计算过程
- 保持逻辑清晰，条理分明`;

  const result = await callLLMInternal(questionExtractionPrompt, config);
  
  return {
    step: 'questions',
    content: result,
    timestamp: new Date().toISOString()
  };
}

// 步骤3：整合格式和答案生成最终 Markdown
export async function generateFinalMarkdown(
  formatTemplate: string,
  questionsAnswer: string,
  userPrompt: string,
  config: LLMConfig
): Promise<ProcessStepResult> {
  const integrationPrompt = `你是一个专业的文档排版专家。请根据以下作业格式模版和题目答案，生成一份格式规范、内容完整的作业文档。

【作业格式模版】
${formatTemplate}

【题目与答案】
${questionsAnswer}

【用户原始要求】
${userPrompt}

【任务要求】
请将以上内容整合，生成一份完整的 Markdown 格式作业文档。要求：
1. 严格按照格式模版的要求进行排版
2. 确保所有题目和答案都被包含
3. 使用规范的 Markdown 语法
4. 添加适当的标题层级和格式
5. 保持内容的逻辑连贯性

【输出格式】
直接输出完整的 Markdown 文档内容，不需要代码块包裹。文档应该：
- 有清晰的标题和层级结构
- 每道题目和答案排版整齐
- 如有需要，包含封面信息、目录等
- 格式美观，便于后续转换为 Word 或 PDF`;

  const result = await callLLMInternal(integrationPrompt, config);
  
  return {
    step: 'final',
    content: result,
    timestamp: new Date().toISOString()
  };
}

// 直接生成模式：无需上传文件，直接根据 prompt 生成内容
async function directGeneration(
  prompt: string,
  config: LLMConfig,
  onStepComplete?: (step: ProcessStepResult) => void
): Promise<HomeworkProcessResult> {
  const directPrompt = `你是一个专业的文档生成助手。请根据用户的需求，生成高质量的内容。

【用户需求】
${prompt}

【任务要求】
请根据用户的需求，生成完整、专业、格式规范的内容。要求：
1. 内容准确、专业、有深度
2. 使用规范的 Markdown 语法
3. 结构清晰，层次分明
4. 适当使用标题、列表、代码块等格式化元素
5. 如涉及数学公式，使用 LaTeX 语法（如 $E=mc^2$）
6. 如涉及代码，使用正确的代码块标记

【输出格式】
直接输出完整的 Markdown 文档内容，不需要代码块包裹。`;

  const result = await callLLMInternal(directPrompt, config);
  
  const timestamp = new Date().toISOString();
  
  // 创建一个简化的结果结构
  const formatTemplate: ProcessStepResult = {
    step: 'format',
    content: JSON.stringify({ mode: 'direct', prompt: prompt }),
    timestamp
  };
  
  const questionsAnswer: ProcessStepResult = {
    step: 'questions',
    content: JSON.stringify({ mode: 'direct', generated: true }),
    timestamp
  };
  
  const finalResult: ProcessStepResult = {
    step: 'final',
    content: result,
    timestamp
  };
  
  if (onStepComplete) {
    onStepComplete(formatTemplate);
    onStepComplete(questionsAnswer);
    onStepComplete(finalResult);
  }
  
  return {
    formatTemplate,
    questionsAnswer,
    finalResult
  };
}

// 完整的作业处理流程
export async function processHomework(
  prompt: string,
  fileContent: string,
  config: LLMConfig,
  onStepComplete?: (step: ProcessStepResult) => void
): Promise<HomeworkProcessResult> {
  if (!prompt || !prompt.trim()) {
    throw new Error('请求内容不能为空');
  }

  // 如果没有文件内容，使用简化的直接生成模式
  if (!fileContent || !fileContent.trim()) {
    return await directGeneration(prompt, config, onStepComplete);
  }

  // 步骤1：提取格式模版
  const formatTemplate = await extractFormatTemplate(prompt, fileContent, config);
  if (onStepComplete) onStepComplete(formatTemplate);

  // 步骤2：提取题目并解答
  const questionsAnswer = await extractAndAnswerQuestions(prompt, fileContent, config);
  if (onStepComplete) onStepComplete(questionsAnswer);

  // 步骤3：整合生成最终文档
  const finalResult = await generateFinalMarkdown(
    formatTemplate.content,
    questionsAnswer.content,
    prompt,
    config
  );
  if (onStepComplete) onStepComplete(finalResult);

  return {
    formatTemplate,
    questionsAnswer,
    finalResult
  };
}

// 兼容旧接口的 callLLM 函数
export async function callLLM(
  prompt: string,
  fileContent: string,
  config: LLMConfig
): Promise<string> {
  const result = await processHomework(prompt, fileContent, config);
  return result.finalResult.content;
}

// 内部 LLM 调用函数
async function callLLMInternal(prompt: string, config: LLMConfig): Promise<string> {
  switch (config.provider) {
    case 'qwen':
      return await callQwen(prompt, config);
    case 'openai':
      return await callOpenAI(prompt, config);
    case 'custom':
      return await callCustom(prompt, config);
    default:
      throw new Error(`不支持的 LLM 提供商: ${config.provider}`);
  }
}

async function callQwen(prompt: string, config: LLMConfig): Promise<string> {
  const apiKey = config.apiKey || process.env.QWEN_API_KEY;
  if (!apiKey) {
    throw new Error('请配置 Qwen API Key');
  }

  try {
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        model: config.model || 'qwen-turbo',
        input: {
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        },
        parameters: {
          temperature: 0.7,
          max_tokens: 2000,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.data?.output?.choices?.[0]?.message?.content) {
      throw new Error('Qwen API 返回格式异常');
    }
    return response.data.output.choices[0].message.content;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('API Key 无效，请检查您的 Qwen API Key');
    } else if (error.response?.status === 429) {
      throw new Error('API 请求频率过高，请稍后再试');
    }
    throw new Error(`调用 Qwen API 失败: ${error.response?.data?.message || error.message}`);
  }
}

async function callOpenAI(prompt: string, config: LLMConfig): Promise<string> {
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('请配置 OpenAI API Key');
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: config.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('OpenAI API 返回格式异常');
    }
    return response.data.choices[0].message.content;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('API Key 无效，请检查您的 OpenAI API Key');
    } else if (error.response?.status === 429) {
      throw new Error('API 请求频率过高，请稍后再试');
    }
    throw new Error(`调用 OpenAI API 失败: ${error.response?.data?.error?.message || error.message}`);
  }
}

async function callCustom(prompt: string, config: LLMConfig): Promise<string> {
  if (!config.apiUrl) {
    throw new Error('请配置自定义 API URL');
  }

  try {
    const response = await axios.post(
      config.apiUrl,
      {
        prompt,
        model: config.model,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
        },
      }
    );

    // 假设自定义 API 返回格式为 { result: string } 或 { content: string } 或直接返回字符串
    if (typeof response.data === 'string') {
      return response.data;
    }
    return response.data.result || response.data.content || response.data.message || JSON.stringify(response.data);
  } catch (error: any) {
    throw new Error(`调用自定义 API 失败: ${error.message}`);
  }
}

// 编辑现有内容 - Copilot 风格
// 编辑修改项接口
export interface EditChange {
  searchText: string;      // 要替换的原文本
  replaceText: string;     // 替换后的新文本
  description: string;     // 这个修改的简要描述
}

export interface EditContentResult {
  changes: EditChange[];
  summary: string;         // 总体修改摘要
}

export async function editContent(
  instruction: string,
  currentContent: string,
  config: LLMConfig
): Promise<EditContentResult> {
  if (!instruction || !instruction.trim()) {
    throw new Error('编辑指令不能为空');
  }

  if (!currentContent || !currentContent.trim()) {
    throw new Error('当前内容不能为空');
  }

  const editPrompt = `你是一个专业的文档编辑助手。请根据用户的编辑指令，找出需要修改的部分。

【当前文档内容】
${currentContent}

【用户编辑指令】
${instruction}

【任务要求】
分析文档，找出需要修改的具体部分，以 JSON 格式返回修改列表。

【输出格式】
请严格按照以下 JSON 格式输出，不要有其他内容：
\`\`\`json
{
  "changes": [
    {
      "searchText": "要被替换的原始文本（必须是文档中存在的精确文本）",
      "replaceText": "替换后的新文本",
      "description": "这个修改的简要说明"
    }
  ],
  "summary": "总体修改摘要（一句话）"
}
\`\`\`

【重要规则】
1. searchText 必须是文档中存在的精确文本，可以是一行或多行
2. 每个修改应该是独立的，不要重叠
3. 只返回需要修改的部分，不需要返回未改变的内容
4. 如果没有需要修改的地方，返回空的 changes 数组`;

  const result = await callLLMInternal(editPrompt, config);
  
  // 解析 JSON 结果
  try {
    // 尝试提取 JSON
    let jsonStr = result;
    const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      // 尝试直接解析
      const startIdx = result.indexOf('{');
      const endIdx = result.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        jsonStr = result.substring(startIdx, endIdx + 1);
      }
    }
    
    const parsed = JSON.parse(jsonStr);
    return {
      changes: parsed.changes || [],
      summary: parsed.summary || '已完成编辑'
    };
  } catch (e) {
    console.error('解析编辑结果失败:', e, result);
    throw new Error('AI 返回的格式不正确，请重试');
  }
}

