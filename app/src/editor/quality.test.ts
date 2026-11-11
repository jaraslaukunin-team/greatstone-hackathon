import { canProceed, groupIssues, issueKey, type QualityIssue } from './quality';

const blocker: QualityIssue = {
  kind: 'empty-cell',
  severity: 'blocker',
  pageIndex: 0,
  cellIndex: 0,
};

const warning: QualityIssue = {
  kind: 'low-dpi',
  severity: 'warning',
  pageIndex: 1,
  cellIndex: 0,
  dpi: 120,
};

describe('quality helpers', () => {
  it('groupIssues разделяет замечания', () => {
    const grouped = groupIssues([blocker, warning]);
    expect(grouped.blockers).toHaveLength(1);
    expect(grouped.warnings).toHaveLength(1);
  });

  it('canProceed требует отсутствие блокеров и подтверждение предупреждений', () => {
    expect(canProceed([blocker, warning], [])).toBe(false);
    expect(canProceed([warning], [])).toBe(false);
    expect(canProceed([warning], [issueKey(warning)])).toBe(true);
  });
});
