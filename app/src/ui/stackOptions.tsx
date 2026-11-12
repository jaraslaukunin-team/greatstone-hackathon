import { fonts, lightColors } from '../theme/theme';
import { HeaderBackground } from './HeaderEdge';
import { BackButton } from './BackButton';

/** Единая шапка для всех стеков: фон бренда, заголовок Futura, иконка «назад» из набора брендбука. */
export const stackOptions = {
  headerShown: true,
  animation: 'slide_from_right' as const,
  headerShadowVisible: false,
  headerBackground: HeaderBackground,
  headerStyle: { backgroundColor: lightColors.bg },
  headerTintColor: lightColors.text,
  headerTitleStyle: { fontFamily: fonts.demi, fontSize: 18, color: lightColors.text },
  headerTitleAlign: 'center' as const,
  headerLeft: ({ canGoBack }: { canGoBack?: boolean }) => (canGoBack ? <BackButton /> : null),
  contentStyle: { backgroundColor: lightColors.bg },
};
