import { Text, type StyleProp, type TextStyle } from 'react-native';
import { fonts } from '../theme/theme';
import { parseFormattedText } from './parseFormattedText';

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
};

/** Рендерит строку с **жирным** и *курсивом* внутри одного Text. */
export function FormattedText({ children, style }: Props) {
  const segments = parseFormattedText(children);
  return (
    <Text style={style}>
      {segments.map((seg, i) => {
        if (seg.kind === 'bold') {
          return (
            <Text key={i} style={{ fontFamily: fonts.demi }}>
              {seg.text}
            </Text>
          );
        }
        if (seg.kind === 'italic') {
          return (
            <Text key={i} style={{ fontStyle: 'italic' }}>
              {seg.text}
            </Text>
          );
        }
        return <Text key={i}>{seg.text}</Text>;
      })}
    </Text>
  );
}
