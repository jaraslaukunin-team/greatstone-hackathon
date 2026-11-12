/**
 * Откладывает сохранение: пока человек правит, сервер не дёргаем, а через паузу сохраняем последнее состояние.
 * flush нужен при закрытии экрана, чтобы последняя правка не потерялась.
 */
export function createDebouncedSaver<T>(save: (value: T) => Promise<unknown> | unknown, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { value: T } | null = null;

  function run() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!pending) return;
    const { value } = pending;
    pending = null;
    void save(value);
  }

  return {
    schedule(value: T) {
      pending = { value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delayMs);
    },
    flush: run,
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}
