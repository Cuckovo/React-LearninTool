import type { ChatMessage } from './app-state';

const DEEPSEEK_API_KEY = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY ?? '';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = 'deepseek-chat';

const SYSTEM_PROMPT = `你是一个高等数学解题助手。你必须严格按以下格式输出回复，不得省略任何部分：

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

export async function sendChatMessage(messages: ChatMessage[]): Promise<string> {
  const msgList = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
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
  return data.choices?.[0]?.message?.content ?? 'AI 未返回有效内容';
}
