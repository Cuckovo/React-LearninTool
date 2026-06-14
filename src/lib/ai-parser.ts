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
