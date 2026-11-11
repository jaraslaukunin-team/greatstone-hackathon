// Провайдер редактирования фото по текстовой инструкции. Реализации взаимозаменяемы:
// настоящий сервис (aiai.by) и заглушка для разработки и запасного варианта на демо.
export interface ImageEditProvider {
  readonly name: string;
  edit(input: {
    image: Buffer;
    mime: 'image/jpeg' | 'image/png';
    prompt: string;
    signal: AbortSignal;
  }): Promise<{ image: Buffer; mime: string }>;
}
