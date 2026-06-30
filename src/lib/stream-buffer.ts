/**
 * StreamBuffer — 流式传输缓冲渲染管理器。
 *
 * 在 SSE 流式传输过程中，逐 token 接收文本片段，
 * 按段落/块级公式/换行为边界进行缓冲，
 * 每次 flush 返回完整的可渲染片段，避免频繁重绘。
 *
 * v2 改进：增加最小刷新阈值，防止不完整片段导致的渲染竞争。
 */
export class StreamBuffer {
  private buffer: string = '';
  /** 最小刷新字符数 — 少于这个量不触发 flush，避免频繁更新导致渲染闪烁 */
  private static readonly MIN_FLUSH_CHARS = 80;

  /**
   * 输入一个 token，返回可立即渲染的 HTML 片段。
   *
   * 触发 flush 的边界条件（按优先级）：
   * 1. 段落结束（连续两个换行 `\n\n`）→ flush 前面的完整段落
   * 2. 块级公式闭合（`$$...$$`）→ flush 至闭合处
   * 3. 单个换行 `\n` → flush 当前行（前提：累积超过 MIN_FLUSH_CHARS）
   *
   * @param chunk 新到达的文本片段（通常 1 个 token）
   * @returns 可立即渲染的文本片段，或 null 表示继续缓冲
   */
  feed(chunk: string): string | null {
    this.buffer += chunk;

    // 1. 段落结束 → flush 前面的完整段落（段落边界天然完整，优先输出）
    if (this.buffer.includes('\n\n')) {
      const parts = this.buffer.split('\n\n');
      this.buffer = parts.pop() || '';
      return parts.join('\n\n');
    }

    // 2. 块级公式闭合 → flush 至闭合处（公式边界完整）
    const firstIdx = this.buffer.indexOf('$$');
    if (firstIdx !== -1) {
      const secondIdx = this.buffer.indexOf('$$', firstIdx + 2);
      if (secondIdx !== -1) {
        const output = this.buffer.substring(0, secondIdx + 2);
        this.buffer = this.buffer.substring(secondIdx + 2);
        return output;
      }
    }

    // 3. 换行 → flush 当前行（需要累积足够字符，避免高频琐碎更新）
    if (this.buffer.includes('\n') && this.buffer.length >= StreamBuffer.MIN_FLUSH_CHARS) {
      const idx = this.buffer.lastIndexOf('\n');
      const output = this.buffer.substring(0, idx + 1);
      this.buffer = this.buffer.substring(idx + 1);
      return output;
    }

    // 4. 继续缓冲
    return null;
  }

  /**
   * 流结束时返回缓冲中的剩余内容。
   *
   * @returns 缓冲中剩余的文本（可能为空字符串）
   */
  flush(): string {
    const remaining = this.buffer;
    this.buffer = '';
    return remaining;
  }
}
