import type { QualityIssue } from '@picpac/shared';

export type { QualityIssue };

export function groupIssues(issues: QualityIssue[]): {
  blockers: QualityIssue[];
  warnings: QualityIssue[];
} {
  return {
    blockers: issues.filter((i) => i.severity === 'blocker'),
    warnings: issues.filter((i) => i.severity === 'warning'),
  };
}

export function issueKey(issue: QualityIssue): string {
  return `${issue.kind}:${issue.pageIndex}:${issue.cellIndex}`;
}

export function canProceed(issues: QualityIssue[], acknowledged: string[]): boolean {
  const { blockers, warnings } = groupIssues(issues);
  if (blockers.length > 0) return false;
  return warnings.every((w) => acknowledged.includes(issueKey(w)));
}

/** Краткий заголовок замечания для экрана проверки перед заказом. */
export function issueTitle(issue: QualityIssue): string {
  switch (issue.kind) {
    case 'empty-cell':
      return 'Пустая ячейка';
    case 'missing-photo':
      return 'Фото отсутствует';
    case 'low-dpi':
      return 'Низкое разрешение';
    case 'very-low-dpi':
      return 'Очень низкое разрешение';
  }
}

/** Пояснение, в чём проблема и что делать. */
export function issueDetail(issue: QualityIssue): string {
  const page = issue.pageIndex + 1;
  switch (issue.kind) {
    case 'empty-cell':
      return `На стр. ${page} есть место без фото. Добавьте снимок или уберите пустую ячейку.`;
    case 'missing-photo':
      return `На стр. ${page} в макете указано фото, которого нет в проекте. Замените его другим.`;
    case 'low-dpi': {
      const dpi = issue.dpi != null ? Math.round(issue.dpi) : null;
      return dpi != null
        ? `На стр. ${page} фото может напечататься размытым (~${dpi} dpi). Лучше заменить на снимок крупнее.`
        : `На стр. ${page} фото может напечататься размытым. Лучше заменить на снимок крупнее.`;
    }
    case 'very-low-dpi': {
      const dpi = issue.dpi != null ? Math.round(issue.dpi) : null;
      return dpi != null
        ? `На стр. ${page} разрешение слишком низкое (~${dpi} dpi) — печать будет заметно мыльной. Замените фото.`
        : `На стр. ${page} разрешение слишком низкое — печать будет заметно мыльной. Замените фото.`;
    }
  }
}
