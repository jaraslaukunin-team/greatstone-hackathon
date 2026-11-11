export type QualityIssue = {
  kind: 'empty-cell' | 'low-dpi' | 'very-low-dpi';
  severity: 'blocker' | 'warning';
  pageIndex: number;
  cellIndex: number;
  dpi?: number;
};

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

export function checkQualityFallback(layout: {
  pages: Array<{ cells: Array<{ photoId: string | null }> }>;
}): QualityIssue[] {
  const issues: QualityIssue[] = [];
  layout.pages.forEach((page, pageIndex) => {
    page.cells.forEach((cell, cellIndex) => {
      if (cell.photoId == null) {
        issues.push({
          kind: 'empty-cell',
          severity: 'blocker',
          pageIndex,
          cellIndex,
        });
      }
    });
  });
  return issues;
}
