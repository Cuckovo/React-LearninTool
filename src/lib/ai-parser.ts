import type { ParsedAIResponse } from './app-state';

export function parseAIResponse(text: string): ParsedAIResponse {
  const raw = text;
  try {
    const solutionMatch = text.match(/【解题过程】\s*([\s\S]*?)(?=【图像判断】|$)/);
    const judgeMatch = text.match(/【图像判断】\s*([\s\S]*?)(?=【函数表达式】|$)/);
    const exprMatch = text.match(/【函数表达式】\s*([\s\S]*?)$/);

    const solution = solutionMatch?.[1]?.trim() ?? text;
    const judge = judgeMatch?.[1]?.trim() ?? '';
    const expr = exprMatch?.[1]?.trim() ?? '';

    const isPlottable = judge.includes('可绘制') && !judge.includes('不可绘制');
    const functionExpression =
      isPlottable && expr && expr !== '无'
        ? expr.replace(/^f\(x\)\s*=?\s*/i, 'f(x) = ')
        : null;

    return { solution, isPlottable, functionExpression, raw, parsed: true };
  } catch (err) {
    return {
      solution: text,
      isPlottable: false,
      functionExpression: null,
      raw,
      parsed: false,
      parseError: String(err),
    };
  }
}

/**
 * 从 AI 回复内容中移除所有 ```db ... ``` 代码块。
 *
 * 用途：知识库模式下 AI 回复可能包含 DB 指令块，
 * 这些块由 db-command-parser 提取并执行后，需要从展示文本中过滤掉。
 *
 * @param content AI 回复的完整文本
 * @returns 移除 db 代码块后的纯展示文本
 */
export function filterDBCommands(content: string): string {
  // 移除 ```db ... ``` 代码块及其内容
  let result = content.replace(/```db\s*\n?[\s\S]*?\n?```/g, '');

  // 清理多余的空行（连续 3 个以上换行 → 2 个）
  result = result.replace(/\n{3,}/g, '\n\n');

  // 去除首尾空白
  result = result.trim();

  return result;
}
