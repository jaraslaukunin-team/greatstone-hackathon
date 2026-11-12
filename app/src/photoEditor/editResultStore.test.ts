import type { PhotoDTO } from '@picpac/shared';
import { useEditResult } from './editResultStore';

const photo = (id: string): PhotoDTO => ({ id, width: 100, height: 100, takenAt: null, url: `/files/${id}`, uploadedBy: null, source: 'gallery' });

describe('editResultStore', () => {
  beforeEach(() => useEditResult.setState({ results: {} }));

  it('take без set отдаёт null', () => {
    expect(useEditResult.getState().take('r1')).toBeNull();
  });

  it('set, затем take возвращают фото, повторный take уже пуст', () => {
    useEditResult.getState().set('r1', photo('a'));
    expect(useEditResult.getState().take('r1')?.id).toBe('a');
    expect(useEditResult.getState().take('r1')).toBeNull();
  });

  it('результат другого запроса не отдаётся', () => {
    useEditResult.getState().set('r1', photo('a'));
    expect(useEditResult.getState().take('r2')).toBeNull();
    expect(useEditResult.getState().take('r1')?.id).toBe('a');
  });

  it('два запроса живут независимо', () => {
    useEditResult.getState().set('r1', photo('a'));
    useEditResult.getState().set('r2', photo('b'));
    expect(useEditResult.getState().take('r2')?.id).toBe('b');
    expect(useEditResult.getState().take('r1')?.id).toBe('a');
  });
});
