import * as React from 'react';
import { useSettingsStore } from '../settings/settingsStore';
import { BE } from './beDict';

/** Свойства элементов, в которых лежит видимый текст (подписи кнопок, подсказки, доступность). */
const TEXT_PROPS = ['title', 'label', 'placeholder', 'accessibilityLabel', 'accessibilityHint', 'subtitle', 'caption'] as const;

/** Переводит строку на белорусский, если он выбран и для неё есть перевод; иначе возвращает исходную. */
export function tr(text: string): string {
  if (useSettingsStore.getState().lang !== 'be') return text;
  const exact = BE[text];
  if (exact !== undefined) return exact;
  const trimmed = text.trim();
  if (trimmed && trimmed !== text) {
    const hit = BE[trimmed];
    if (hit !== undefined) return text.replace(trimmed, hit);
  }
  return text;
}

function translateChildren(children: unknown): unknown {
  if (typeof children === 'string') return tr(children);
  if (Array.isArray(children)) {
    let changed = false;
    const next = children.map((c) => {
      if (typeof c !== 'string') return c;
      const t = tr(c);
      if (t !== c) changed = true;
      return t;
    });
    return changed ? next : children;
  }
  return children;
}

function translateProps<P extends Record<string, unknown>>(type: unknown, props: P): P {
  if (useSettingsStore.getState().lang !== 'be' || !props) return props;
  // Поле ввода хранит данные пользователя: переводим только подсказку.
  const isInput = typeof type === 'object' || typeof type === 'function' ? /TextInput/i.test(String((type as { displayName?: string; name?: string }).displayName ?? (type as { name?: string }).name ?? '')) : false;
  let next: Record<string, unknown> | null = null;
  if (!isInput) {
    const children = translateChildren(props.children);
    if (children !== props.children) next = { ...props, children };
  }
  for (const key of TEXT_PROPS) {
    const value = props[key];
    if (typeof value === 'string') {
      const t = tr(value);
      if (t !== value) next = { ...(next ?? props), [key]: t };
    }
  }
  return (next ?? props) as P;
}

let installed = false;

/**
 * Подмена JSX-фабрик: при белорусском языке строки в тексте и подписях переводятся по словарю BE при отрисовке.
 * Так переводится весь интерфейс без правки каждого экрана; динамические строки с числами остаются русскими.
 */
export function installRuntimeTranslate(): void {
  if (installed) return;
  installed = true;
  const patch = (runtime: Record<string, unknown> | undefined, names: string[]) => {
    if (!runtime) return;
    for (const name of names) {
      const original = runtime[name] as ((type: unknown, props: Record<string, unknown>, ...rest: unknown[]) => unknown) | undefined;
      if (typeof original !== 'function') continue;
      try {
        runtime[name] = (type: unknown, props: Record<string, unknown>, ...rest: unknown[]) => original(type, translateProps(type, props), ...rest);
      } catch {
        // Модуль только для чтения: перевод остаётся только для явных вызовов tr().
      }
    }
  };
  try {
    patch(require('react/jsx-runtime'), ['jsx', 'jsxs']);
  } catch {}
  try {
    patch(require('react/jsx-dev-runtime'), ['jsxDEV']);
  } catch {}
  try {
    const original = React.createElement as (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => unknown;
    (React as unknown as { createElement: typeof original }).createElement = (type, props, ...children) =>
      original(type, props ? translateProps(type, props) : props, ...(translateChildren(children) as unknown[]));
  } catch {}
}
