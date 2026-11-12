import { createDebouncedSaver } from './debouncedSaver';

describe('createDebouncedSaver', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('сохраняет один раз после паузы, а не на каждое изменение', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const saver = createDebouncedSaver(save, 1000);
    saver.schedule('a');
    saver.schedule('b');
    saver.schedule('c');
    jest.advanceTimersByTime(999);
    expect(save).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('c');
  });

  it('flush сохраняет сразу и снимает таймер', () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const saver = createDebouncedSaver(save, 1000);
    saver.schedule('a');
    saver.flush();
    expect(save).toHaveBeenCalledWith('a');
    jest.advanceTimersByTime(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flush без ожидающих изменений ничего не делает', () => {
    const save = jest.fn().mockResolvedValue(undefined);
    createDebouncedSaver(save, 1000).flush();
    expect(save).not.toHaveBeenCalled();
  });

  it('cancel отменяет ожидающее сохранение', () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const saver = createDebouncedSaver(save, 1000);
    saver.schedule('a');
    saver.cancel();
    jest.advanceTimersByTime(5000);
    expect(save).not.toHaveBeenCalled();
  });
});
