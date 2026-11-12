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

  function deferred() {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }
  const tick = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };

  it('пока идёт сохранение, следующее не стартует; после него уходит только последнее значение', async () => {
    const first = deferred();
    const save = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const saver = createDebouncedSaver(save, 1000);
    saver.schedule('a');
    jest.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1);

    saver.schedule('b');
    saver.schedule('c');
    jest.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1); // первое ещё не завершилось

    first.resolve();
    await tick();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('c');
  });

  it('flush при идущем сохранении ждёт его и отправляет последнее значение', async () => {
    const first = deferred();
    const save = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const saver = createDebouncedSaver(save, 1000);
    saver.schedule('a');
    jest.advanceTimersByTime(1000);
    saver.schedule('b');
    saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve();
    await tick();
    expect(save).toHaveBeenLastCalledWith('b');
  });

  it('ошибка сохранения не блокирует очередь', async () => {
    const first = deferred();
    const save = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const saver = createDebouncedSaver(save, 1000);
    saver.schedule('a');
    jest.advanceTimersByTime(1000);
    saver.schedule('b');
    jest.advanceTimersByTime(1000);
    first.reject(new Error('network'));
    await tick();
    expect(save).toHaveBeenLastCalledWith('b');
  });

  it('если новых значений не было, после завершения ничего лишнего не отправляется', async () => {
    const first = deferred();
    const save = jest.fn().mockReturnValueOnce(first.promise);
    const saver = createDebouncedSaver(save, 1000);
    saver.schedule('a');
    jest.advanceTimersByTime(1000);
    first.resolve();
    await tick();
    jest.advanceTimersByTime(5000);
    expect(save).toHaveBeenCalledTimes(1);
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
