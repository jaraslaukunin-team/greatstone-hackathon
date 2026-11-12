/**
 * Откладывает сохранение: пока человек правит, сервер не дёргаем, а через паузу сохраняем последнее состояние.
 * flush нужен при закрытии экрана, чтобы последняя правка не потерялась.
 * Сохранения идут строго по одному: пока предыдущее не завершилось, следующее ждёт и уходит с последним значением,
 * иначе два запроса с одной версией проекта конфликтуют между собой.
 */
export function createDebouncedSaver<T>(save: (value: T) => Promise<unknown> | unknown, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { value: T } | null = null;
  let inFlight = false;

  function run() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!pending || inFlight) return; // если идёт сохранение, его завершение заберёт pending
    const { value } = pending;
    pending = null;
    inFlight = true;
    let result: Promise<unknown>;
    try {
      result = Promise.resolve(save(value));
    } catch (e) {
      result = Promise.reject(e);
    }
    result
      .catch(() => undefined)
      .then(() => {
        inFlight = false;
        if (pending && !timer) run();
      });
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
