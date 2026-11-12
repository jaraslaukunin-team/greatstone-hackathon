import type { SkImage } from '@shopify/react-native-skia';
import type { EditAction, EditState } from '../editState';

/** Общие входные данные вкладок редактора. */
export type TabProps = {
  state: EditState;
  /** Размер исходного фото в пикселях: нужен для расчёта рамки обрезки. */
  srcW: number;
  srcH: number;
  dispatch(action: EditAction): void;
};

export type FilterTabProps = TabProps & { image: SkImage };
