import axios from 'axios';

export interface LLMConfig {
  provider: 'qwen' | 'openai' | 'custom';
  apiKey?: string;
  apiUrl?: string;
  model?: string;
}

export async function callLLM(
  prompt: string,
  fileContent: string,
  config: LLMConfig
): Promise<string> {
  if (!prompt || !prompt.trim()) {
    throw new Error('作业要求不能为空');
  }

  // 限制文件内容长度，避免超出 API 限制
  const maxContentLength = 10000;
  const truncatedContent = fileContent.length > maxContentLength 
    ? fileContent.substring(0, maxContentLength) + '\n\n[内容已截断...]'
    : fileContent;

  const fullPrompt = `请根据以下作业要求和附件内容完成作业：

作业要求：
${prompt}

附件内容：
${truncatedContent}

请以 Markdown 格式输出完整的作业答案。确保格式清晰，结构完整。`;

  switch (config.provider) {
    case 'qwen':
      return await callQwen(fullPrompt, config);
    case 'openai':
      return await callOpenAI(fullPrompt, config);
    case 'custom':
      return await callCustom(fullPrompt, config);
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

