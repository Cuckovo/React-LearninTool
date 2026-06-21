/**
 * 高等数学知识树种子数据（同济版高数第七版）。
 *
 * Demo 范围：第一章前 5 个概念节点 (1.1.1~1.1.5) 含权威定义；
 * 其余章节仅骨架（chapter + section，不含叶子 concept）。
 */
import { getExpoDb, getExpoDbSync } from './database';
import { dbLog } from './logger';
import { generateId } from '@/lib/app-state';
import type { ChapterSeed, ConceptSeed } from '@/types/knowledge';

const NOW = Date.now();

// ── 基于同济版高数第七版的权威定义 ──

const MAPPING_DEFINITION = `设 X、Y 是两个非空集合，如果存在一个对应法则 f，使得对于 X 中的每一个元素 x，按照这个法则 f，在 Y 中有唯一确定的元素 y 与之对应，则称 f 为从 X 到 Y 的一个映射，记作 f: X→Y。其中 y 称为元素 x 在映射 f 下的像，记作 f(x)；元素 x 称为元素 y 在映射 f 下的一个原像。集合 X 称为映射 f 的定义域，记作 D_f；X 中所有元素的像所组成的集合称为映射 f 的值域，记作 R_f 或 f(X) = {f(x) | x∈X}。`;

const FUNCTION_DEFINITION = `设 D 是一个非空实数集合，如果存在一个确定的对应法则 f，使得对于 D 内的每一个数 x，都有唯一确定的实数 y 与之对应，则称 f 为定义在集合 D 上的一个函数。通常记作 y = f(x)，x∈D。其中 x 称为自变量，y 称为因变量；集合 D 称为函数 f 的定义域，通常记作 D_f；全体函数值组成的集合 {y | y = f(x), x∈D} 称为函数 f 的值域，记作 R_f。构成函数的两个要素是：定义域和对应法则。`;

const INVERSE_FUNCTION_DEFINITION = `设函数 f: X→Y 是单射（即对于任意不同的 x₁, x₂∈X，都有 f(x₁)≠f(x₂)），则对每一个 y∈f(X)（即值域中的元素），存在唯一的 x∈X 使得 f(x)=y。于是可以定义一个从 f(X) 到 X 的新函数 g，使得 g(y)=x（其中 x 满足 f(x)=y）。这个函数 g 称为函数 f 的反函数，记作 f⁻¹，其定义域为 f(X)，值域为 X。按习惯，反函数常写作 y=f⁻¹(x)。互为反函数的两个函数图像关于直线 y=x 对称。`;

const COMPOSITE_FUNCTION_DEFINITION = `设函数 y=f(u) 的定义域为 D_f，函数 u=g(x) 的定义域为 D_g，且其值域 R_g⊆D_f，则对于 D_g 中的每一个 x，按照对应法则先由 g 对应出 u=g(x)，再由 f 对应出 y=f(u)=f(g(x))。由此确定的定义在 D_g 上的函数称为由函数 u=g(x) 和函数 y=f(u) 构成的复合函数，记作 y=(f∘g)(x)=f(g(x))。其中 u 称为中间变量。只有当外层函数 f 的定义域包含内层函数 g 的值域时，复合函数才有意义。`;

const ELEMENTARY_FUNCTION_DEFINITION = `下列五类函数统称为基本初等函数：（1）常值函数 y=c（c 为常数）；（2）幂函数 y=x^μ（μ∈R 为常数）；（3）指数函数 y=a^x（a>0 且 a≠1）；（4）对数函数 y=log_a(x)（a>0 且 a≠1）；（5）三角函数 y=sin x, y=cos x, y=tan x 等以及反三角函数 y=arcsin x, y=arccos x, y=arctan x 等。由基本初等函数经过有限次四则运算和有限次函数复合运算所构成并可用一个解析式表示的函数，称为初等函数。初等函数在其定义区间内处处连续。`;

// ── 种子数据定义 ──

/**
 * 第一章前 5 个概念节点 (1.1.1~1.1.5)
 */
const concepts_1_1: ConceptSeed[] = [
  {
    label: '1.1.1 映射',
    sortOrder: 1,
    standardDefinition: MAPPING_DEFINITION,
  },
  {
    label: '1.1.2 函数',
    sortOrder: 2,
    standardDefinition: FUNCTION_DEFINITION,
  },
  {
    label: '1.1.3 反函数',
    sortOrder: 3,
    standardDefinition: INVERSE_FUNCTION_DEFINITION,
  },
  {
    label: '1.1.4 复合函数',
    sortOrder: 4,
    standardDefinition: COMPOSITE_FUNCTION_DEFINITION,
  },
  {
    label: '1.1.5 初等函数',
    sortOrder: 5,
    standardDefinition: ELEMENTARY_FUNCTION_DEFINITION,
  },
];

/**
 * 第一章结构：1.1~1.10（仅 1.1 含叶子 concept，其余节仅骨架）
 */
const chapters: ChapterSeed[] = [
  {
    label: '1. 函数与极限',
    sortOrder: 1,
    sections: [
      {
        label: '1.1 映射与函数',
        sortOrder: 1,
        concepts: concepts_1_1,
      },
      {
        label: '1.2 数列的极限',
        sortOrder: 2,
        concepts: [],
      },
      {
        label: '1.3 函数的极限',
        sortOrder: 3,
        concepts: [],
      },
      {
        label: '1.4 无穷小与无穷大',
        sortOrder: 4,
        concepts: [],
      },
      {
        label: '1.5 极限运算法则',
        sortOrder: 5,
        concepts: [],
      },
      {
        label: '1.6 极限存在准则 两个重要极限',
        sortOrder: 6,
        concepts: [],
      },
      {
        label: '1.7 无穷小的比较',
        sortOrder: 7,
        concepts: [],
      },
      {
        label: '1.8 函数的连续性与间断点',
        sortOrder: 8,
        concepts: [],
      },
      {
        label: '1.9 连续函数的运算与初等函数的连续性',
        sortOrder: 9,
        concepts: [],
      },
      {
        label: '1.10 闭区间上连续函数的性质',
        sortOrder: 10,
        concepts: [],
      },
    ],
  },
];

/**
 * 将种子数据插入数据库。
 *
 * 幂等：若 knowledge_nodes 已有数据则跳过。
 * 树结构：subject(高等数学) → chapter(章) → section(节) → concept(概念)。
 */
export async function initializeDemoData(): Promise<void> {
  const db = getExpoDbSync();
  if (!db) {
    dbLog.warn('initializeDemoData 跳过：DB 未初始化');
    return;
  }

  // 幂等检查
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM knowledge_nodes',
  );
  if ((existing?.count ?? 0) > 0) {
    dbLog.debug('种子数据跳过：knowledge_nodes 已有数据');
    return;
  }

  dbLog.info('开始插入知识树种子数据...');

  // 1. 根节点：学科
  const subjectId = 'kn-subject-highmath';
  await db.runAsync(
    `INSERT INTO knowledge_nodes (id, parent_id, type, label, standard_definition, user_notes, mastery_status, metadata, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      subjectId,
      null,
      'subject',
      '高等数学',
      null,
      null,
      'not_started',
      null,
      0,
      NOW,
      NOW,
    ],
  );

  let chapterSortOrder = 1;

  for (const chapter of chapters) {
    const chapterId = `kn-ch-${chapterSortOrder}`;
    await db.runAsync(
      `INSERT INTO knowledge_nodes (id, parent_id, type, label, standard_definition, user_notes, mastery_status, metadata, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        chapterId,
        subjectId,
        'chapter',
        chapter.label,
        null,
        null,
        'not_started',
        null,
        chapter.sortOrder,
        NOW,
        NOW,
      ],
    );

    for (const section of chapter.sections) {
      const sectionId = `kn-sec-${chapterSortOrder}-${section.sortOrder}`;
      await db.runAsync(
        `INSERT INTO knowledge_nodes (id, parent_id, type, label, standard_definition, user_notes, mastery_status, metadata, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sectionId,
          chapterId,
          'section',
          section.label,
          null,
          null,
          'not_started',
          null,
          section.sortOrder,
          NOW,
          NOW,
        ],
      );

      for (const concept of section.concepts) {
        const conceptId = `kn-conc-${chapterSortOrder}-${section.sortOrder}-${concept.sortOrder}`;
        await db.runAsync(
          `INSERT INTO knowledge_nodes (id, parent_id, type, label, standard_definition, user_notes, mastery_status, metadata, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            conceptId,
            sectionId,
            'concept',
            concept.label,
            concept.standardDefinition,
            null,
            'not_started',
            null,
            concept.sortOrder,
            NOW,
            NOW,
          ],
        );
      }
    }

    chapterSortOrder++;
  }

  dbLog.info(`种子数据插入完成：${chapters.length} 章，${chapters.reduce((acc, c) => acc + c.sections.length, 0)} 节，${chapters.reduce((acc, c) => acc + c.sections.reduce((acc2, s) => acc2 + s.concepts.length, 0), 0)} 个概念`);
}
