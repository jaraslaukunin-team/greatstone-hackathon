// Запрещённые темы запросов к AI-редактору. Список короткий и намеренно грубый:
// ловит явные случаи на уровне подстроки (ё и е не различаются); команде стоит дополнять его по мере проверки.
export const BLOCKED_TERMS: string[] = [
  'порно',
  'эротик',
  'обнажённ',
  'голый',
  'голая',
  'без одежды',
  'nsfw',
  'nude',
  'naked',
  'porn',
  'sexual',
  'расчленён',
  'кровь',
  'gore',
  'самоубийств',
  'suicide',
  'свастик',
  'swastika',
];

const normalize = (s: string): string => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

export function isPromptAllowed(prompt: string): boolean {
  const text = normalize(prompt);
  return !BLOCKED_TERMS.some((term) => text.includes(normalize(term)));
}
