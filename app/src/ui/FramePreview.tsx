import { fitRect, type FitMode, type Size } from '@picpac/shared';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { lightColors } from '../theme/theme';

type Props = { uri: string; photo: Size; frame: Size; fit: FitMode; width: number };

/**
 * Как фото ляжет на отпечаток: белый лист пропорций кадра, фото внутри без растяжения.
 * contain — фото целиком с белыми полями, cover — кадр заполнен, лишнее обрезано.
 */
export function FramePreview({ uri, photo, frame, fit, width }: Props) {
  const height = (width * frame.height) / frame.width;
  const [failed, setFailed] = useState(false);
  const r = fitRect(photo, { width, height }, fit);
  return (
    <View style={[styles.sheet, { width, height }]}>
      {failed ? null : (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          style={{ position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height }}
          resizeMode="cover"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: lightColors.border,
  },
});
