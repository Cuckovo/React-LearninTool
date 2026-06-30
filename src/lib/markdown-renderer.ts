/**
 * Markdown 渲染器 — 轻量级手写转换。
 *
 * 将 Markdown 语法转换为 HTML，同时**保护 LaTeX 公式**（$...$ 和 $$...$$）
 * 不被 Markdown 处理污染。
 *
 * 使用策略：
 * 1. 先用占位符保护 LaTeX 公式
 * 2. 对余下文本执行 Markdown → HTML 转换
 * 3. 恢复 LaTeX 公式
 *
 * 调用顺序：renderMarkdown 必须在 renderLatex 之前执行。
 */

// ── 保护 / 恢复 LaTeX 公式 ──

interface ProtectedSegment {
  placeholder: string;
  original: string;
}

/**
 * 用占位符替换所有 LaTeX 公式（$$...$$ 和 $...$），返回受保护文本和占位符映射。
 */
function protectLatex(text: string): { protectedText: string; segments: ProtectedSegment[] } {
  const segments: ProtectedSegment[] = [];
  let counter = 0;

  // 改进的正则：$$...$$ 和 $...$（不支持跨行$）
  const combinedRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;

  const protectedText = text.replace(combinedRegex, (match) => {
    const placeholder = `\x00LATEX_${counter}\x00`;
    segments.push({ placeholder, original: match });
    counter++;
    return placeholder;
  });

  return { protectedText, segments };
}

/**
 * 用原始 LaTeX 公式替换回占位符。
 */
function restoreLatex(html: string, segments: ProtectedSegment[]): string {
  let result = html;
  for (const seg of segments) {
    // 将占位符直接替换为原始 LaTeX 文本（供后续 renderLatex 处理）
    result = result.replace(seg.placeholder, seg.original);
  }
  return result;
}

// ── Markdown → HTML 转换 ──

/**
 * 将 Markdown 文本转换为 HTML。
 *
 * 注意：此函数在 renderLatex 之前执行。
 * LaTeX 公式在转换过程中被保护，不会被 Markdown 处理碰坏。
 *
 * 支持的语法：
 * - ### 三级标题 → <h3>
 * - ## 二级标题 → <h2>
 * - **加粗** → <strong>
 * - `行内代码` → <code>
 * - - 无序列表 → <li>
 * - 1. 有序列表 → <li>
 * - > 引用 → <blockquote>
 * - --- 分隔线 → <hr>
 * - 连续空行 → 段落分隔
 * - 单换行 → <br/>
 *
 * @param text 原始 Markdown 文本（可能含 LaTeX 公式）
 * @returns HTML 字符串（LaTeX 公式保持原样，待 renderLatex 处理）
 */
export function renderMarkdown(text: string): string {
  // 步骤 1：保护 LaTeX 公式
  const { protectedText, segments } = protectLatex(text);

  // 步骤 2：在受保护的文本上执行 Markdown → HTML
  let html = protectedText;

  // 标题 — 必须在换行和段落处理之前
  html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>');

  // 加粗
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 行内代码 — 避免与占位符中的 \x00 冲突
  html = html.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');

  // 列表项 — 在标题之后处理
  html = html.replace(/^- (.+)$/gm, '<li class="md-li">$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="md-li-ordered">$2</li>');

  // 引用
  html = html.replace(/^> (.+)$/gm, '<blockquote class="md-quote">$1</blockquote>');

  // 分隔线
  html = html.replace(/^---$/gm, '<hr class="md-hr"/>');

  // 段落（两个以上连续换行 → <br/><br/>）
  html = html.replace(/\n{2,}/g, '<br/><br/>');

  // 单换行 → <br/>
  html = html.replace(/\n/g, '<br/>');

  // 步骤 3：恢复 LaTeX 公式
  html = restoreLatex(html, segments);

  return html;
}
