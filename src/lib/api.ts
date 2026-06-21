import type { ChatMessage } from './app-state';
import type { ChatMode, AssessmentResult } from '@/types/knowledge';
import { KNOWLEDGE_SYSTEM_PROMPT } from './knowledge-prompt';
import { ASSESSMENT_SYSTEM_PROMPT, buildAssessmentPrompt, parseAssessmentResult } from './assessment-prompt';

const DEEPSEEK_API_KEY = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY ?? '';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = 'deepseek-chat';

const SOLVER_SYSTEM_PROMPT = `你是一个高等数学解题助手。你必须严格按以下格式输出回复，不得省略任何部分：

【解题过程】
（分步解题，使用 $...$ 包裹行内公式，$$...$$ 包裹独立公式）

【图像判断】
可绘制 / 不可绘制

【函数表达式】
（如果可绘制，输出 f(x) = 表达式；如果不可绘制，输出"无"）

━━━━━━━━━━━━━━━━━━━━

函数表达式规范（仅当可绘制时）：
- 格式：f(x) = 表达式
- 函数名用英文小写：sin(x), cos(x), tan(x), log(x), exp(x), sqrt(x), abs(x), ln(x), log(b,x)
- 运算符：+ - * / ^
- 分数：1/x，指数：x^2，根号：sqrt(x)

❌ 禁止在【函数表达式】区域使用 LaTeX 语法（\\sin{x}、x^{2}、\\frac{1}{x} 等）

示例回复：
【解题过程】
函数 $f(x)=\\sin x$ 的导数为 $f'(x)=\\cos x$。

【图像判断】
可绘制

【函数表达式】
f(x) = sin(x)`;

/** 发送聊天消息时额外传入的选项 */
export interface SendChatOptions {
  mode?: ChatMode;
  /** 知识库模式下的节点上下文（作为额外的 system message 注入） */
  nodeContextSystemMessage?: string;
}

/**
 * 发送聊天消息到 DeepSeek API。
 *
 * @param messages 当前会话的历史消息
 * @param options 可选：mode（solver/knowledge）和节点上下文
 * @returns AI 回复文本
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  options?: SendChatOptions,
): Promise<string> {
  const mode = options?.mode ?? 'solver';
  const systemPrompt = mode === 'knowledge' ? KNOWLEDGE_SYSTEM_PROMPT : SOLVER_SYSTEM_PROMPT;

  // 构建消息列表
  const msgList: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];

  // 知识库模式：如果提供了节点上下文，作为第二条 system message 注入
  if (mode === 'knowledge' && options?.nodeContextSystemMessage) {
    msgList.push({ role: 'system', content: options.nodeContextSystemMessage });
  }

  for (const m of messages) {
    msgList.push({ role: m.role as 'user' | 'assistant', content: m.content });
  }

  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({ model: DEEPSEEK_MODEL, messages: msgList, stream: false }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? 'AI 未返回有效内容';
}

/**
 * 发送考核评分请求到 DeepSeek API。
 *
 * 使用独立的 system prompt（ASSESSMENT_SYSTEM_PROMPT），
 * stream=false 以获取完整 JSON 输出。
 *
 * @param standardDefinition 知识点标准定义
 * @param questions AI 出的题目列表
 * @param userAnswers 用户回答列表
 * @returns 解析后的 AssessmentResult，失败返回 null
 */
export async function sendAssessment(
  standardDefinition: string | null,
  questions: string[],
  userAnswers: string[],
): Promise<AssessmentResult | null> {
  const userMessage = buildAssessmentPrompt(standardDefinition, questions, userAnswers);

  const msgList = [
    { role: 'system', content: ASSESSMENT_SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({ model: DEEPSEEK_MODEL, messages: msgList, stream: false }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const aiResponse: string = data.choices?.[0]?.message?.content ?? '';

  return parseAssessmentResult(aiResponse);
}
