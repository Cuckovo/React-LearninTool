/**
 * StreamBuffer — 流式传输缓冲渲染管理器。
 *
 * 在 SSE 流式传输过程中，逐 token 接收文本片段，
 * 按段落/块级公式/换行为边界进行缓冲，
 * 每次 flush 返回完整的可渲染片段，避免频繁重绘。
 */
export class StreamBuffer {
  private buffer: string = '';

  /**
   * 输入一个 token，返回可立即渲染的 HTML 片段。
   *
   * 触发 flush 的边界条件（按优先级）：
   * 1. 段落结束（连续两个换行 `\n\n`）→ flush 前面的所有段落
   * 2. 块级公式闭合（`$$...$$`）→ flush 至闭合处
   * 3. 单个换行 `\n` → flush 当前行
   *
   * @param chunk 新到达的文本片段（通常 1 个 token）
   * @returns 可立即渲染的文本片段，或 null 表示继续缓冲
   */
  feed(chunk: string): string | null {
    this.buffer += chunk;

    // 1. 段落结束 → flush 前面的完整段落
    if (this.buffer.includes('\n\n')) {
      const parts = this.buffer.split('\n\n');
      this.buffer = parts.pop() || ''; // 最后一段留在缓冲
      return parts.join('\n\n'); // 前面的段落输出
    }

    // 2. 块级公式闭合 → flush 至闭合处
    const dollarCount = (this.buffer.match(/\$\$/g) || []).length;
    if (dollarCount >= 2) {
      // 找到第二对 $$ 的位置
      const firstIdx = this.buffer.indexOf('$$');
      if (firstIdx !== -1) {
        const secondIdx = this.buffer.indexOf('$$', firstIdx + 2);
        if (secondIdx !== -1) {
          const output = this.buffer.substring(0, secondIdx + 2);
          this.buffer = this.buffer.substring(secondIdx + 2);
          return output;
        }
      }
    }

    // 3. 换行 → flush 当前行
    if (this.buffer.includes('\n')) {
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
