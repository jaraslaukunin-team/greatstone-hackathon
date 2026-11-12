import {
  canProceed,
  groupIssues,
  issueDetail,
  issueKey,
  issueTitle,
  type QualityIssue,
} from './quality';

const blocker: QualityIssue = {
  kind: 'empty-cell',
  severity: 'blocker',
  pageIndex: 0,
  cellIndex: 0,
};

const missing: QualityIssue = {
  kind: 'missing-photo',
  severity: 'blocker',
  pageIndex: 2,
  cellIndex: 1,
};

const warning: QualityIssue = {
  kind: 'low-dpi',
  severity: 'warning',
  pageIndex: 1,
  cellIndex: 0,
  dpi: 120,
};

const veryLow: QualityIssue = {
  kind: 'very-low-dpi',
  severity: 'warning',
  pageIndex: 3,
  cellIndex: 0,
  dpi: 72.4,
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

  it('issueTitle и issueDetail объясняют проблему', () => {
    expect(issueTitle(blocker)).toBe('Пустая ячейка');
    expect(issueDetail(blocker)).toMatch(/стр\. 1/);
    expect(issueDetail(blocker)).toMatch(/без фото/);

    expect(issueTitle(missing)).toBe('Фото отсутствует');
    expect(issueDetail(missing)).toMatch(/нет в проекте/);

    expect(issueTitle(warning)).toBe('Низкое разрешение');
    expect(issueDetail(warning)).toMatch(/~120 dpi/);

    expect(issueTitle(veryLow)).toBe('Очень низкое разрешение');
    expect(issueDetail(veryLow)).toMatch(/~72 dpi/);
  });
});
