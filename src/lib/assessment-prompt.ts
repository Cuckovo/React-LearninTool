/**
 * 考核评分系统提示词 + 评分请求构建。
 *
 * 用途：
 * - ASSESSMENT_SYSTEM_PROMPT 作为考核评分 API 调用的 system message
 * - buildAssessmentPrompt() 构建完整的评分请求 user message
 */
import type { AssessmentResult } from '@/types/knowledge';

/** 考核评分的系统提示词 */
export const ASSESSMENT_SYSTEM_PROMPT = `你是高等数学考核评分专家。你的任务是：

## 评分要求

1. 根据题目的标准定义和用户的回答，给出公正的评分（0-100 分）
2. 评分标准：
   - 90-100：准确理解核心概念，表述完整清晰，能用自己的语言正确阐述
   - 70-89：基本理解，有少量不准确之处但核心正确
   - 50-69：部分理解，存在明显概念混淆或遗漏
   - 0-49：理解有重大错误，或未认真作答

3. 分析用户回答中的薄弱点（weak_points 数组，每条 1-2 句话）
4. 判断是否通过考核（passed）：评分 >= 70 为通过
5. 生成建议笔记（suggested_user_note）：一段 50-150 字的精炼总结，帮助用户巩固该知识点

## 输出格式

你必须严格按照以下 JSON 格式输出，不要包含任何其他文字：

{
  "score": <0-100 的整数>,
  "analysis": "<详细解析，200-500字>",
  "weakPoints": ["薄弱点1", "薄弱点2"],
  "passed": <true/false>,
  "suggestedUserNote": "<50-150字的知识点精炼总结>"
}

## 评分原则

- 客观公正，不因回答简短而扣分（只要核心正确）
- 对概念性题目，看重理解的准确性而非措辞的完整性
- 鼓励性语言，分析中先肯定优点再指出不足`;

/**
 * 构建考核评分请求的 user message。
 *
 * @param standardDefinition 知识点的标准定义（教材原文）
 * @param questions AI 出的题目
 * @param userAnswers 用户对每道题的回答
 * @returns 完整的 user message 供考核评分 API 使用
 */
export function buildAssessmentPrompt(
  standardDefinition: string | null,
  questions: string[],
  userAnswers: string[],
): string {
  const defSection = standardDefinition
    ? `## 教材标准定义\n\n${standardDefinition}\n`
    : '（无预置标准定义，请根据数学常识评分）\n';

  let prompt = `## 考核评分任务\n\n${defSection}\n## 题目与回答\n\n`;

  for (let i = 0; i < questions.length; i++) {
    const qNum = i + 1;
    const question = questions[i] ?? `第${qNum}题`;
    const answer = userAnswers[i] ?? '（未作答）';
    prompt += `### 第${qNum}题\n**题目**：${question}\n**用户回答**：${answer}\n\n`;
  }

  prompt += `请根据以上信息，按照系统提示词中的 JSON 格式输出评分结果。`;

  return prompt;
}

/**
 * 尝试从 AI 回复中解析 AssessmentResult。
 *
 * 支持两种格式：
 * 1. 纯 JSON 块 ` ```json { ... } ``
 * 2. 直接 JSON 字符串
 *
 * @param aiResponse AI 的评分回复文本
 * @returns 解析后的 AssessmentResult，解析失败返回 null
 */
export function parseAssessmentResult(aiResponse: string): AssessmentResult | null {
  try {
    // 尝试提取 ```json 代码块
    let jsonStr = aiResponse;
    const jsonBlockMatch = aiResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1].trim();
    } else {
      // 尝试直接找到第一个 { 到最后一个 }
      const firstBrace = aiResponse.indexOf('{');
      const lastBrace = aiResponse.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = aiResponse.slice(firstBrace, lastBrace + 1);
      }
    }

    const parsed = JSON.parse(jsonStr);

    // 校验必要字段
    if (
      typeof parsed.score !== 'number' ||
      typeof parsed.analysis !== 'string' ||
      !Array.isArray(parsed.weakPoints) ||
      typeof parsed.passed !== 'boolean' ||
      typeof parsed.suggestedUserNote !== 'string'
    ) {
      return null;
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      analysis: parsed.analysis,
      weakPoints: parsed.weakPoints.filter(
        (w: unknown) => typeof w === 'string',
      ) as string[],
      passed: parsed.passed,
      suggestedUserNote: parsed.suggestedUserNote,
    };
  } catch {
    return null;
  }
}
