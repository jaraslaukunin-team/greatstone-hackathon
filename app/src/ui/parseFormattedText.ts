/** Сегмент inline-разметки: обычный / жирный (**…**) / курсив (*…*). */
export type FormattedSegment =
  | { kind: 'plain'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string };

/**
 * Разбирает **жирный** и *курсив* (двойные звёздочки приоритетнее).
 * Вложенность не поддерживается; незакрытые маркеры остаются текстом.
 */
export function parseFormattedText(input: string): FormattedSegment[] {
  if (!input) return [];
  const segments: FormattedSegment[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    if (match.index > last) {
      segments.push({ kind: 'plain', text: input.slice(last, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ kind: 'bold', text: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ kind: 'italic', text: match[2] });
    }
    last = match.index + match[0].length;
  }
  if (last < input.length) {
    segments.push({ kind: 'plain', text: input.slice(last) });
  }
  return segments;
}
