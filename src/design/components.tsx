import type { IconName } from './Icon';
import type { PropsWithChildren } from 'react';
import type { StyleProp, TextProps, ViewStyle } from 'react-native';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Icon } from './Icon';
import { typography, usePalette } from './tokens';

export function AppText({
  variant = 'body',
  style,
  ...props
}: TextProps & { variant?: keyof typeof typography }) {
  const palette = usePalette();
  return (
    <Text
      {...props}
      style={[typography[variant], { color: palette.text }, style]}
    />
  );
}

export function Surface({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const palette = usePalette();
  return (
    <View
      style={[
        styles.surface,
        { backgroundColor: palette.surface, borderColor: palette.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  hint?: string;
  variant?: 'primary' | 'secondary' | 'danger';
};

export function AppButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  hint,
  variant = 'primary',
}: ButtonProps) {
  const palette = usePalette();
  const foreground =
    variant === 'secondary'
      ? palette.primary
      : variant === 'danger'
        ? palette.danger
        : palette.onPrimary;
  const background =
    variant === 'secondary'
      ? palette.primarySoft
      : variant === 'danger'
        ? palette.dangerSoft
        : palette.primary;
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator accessible={false} color={foreground} />
      ) : icon ? (
        <Icon color={foreground} name={icon} size={20} />
      ) : null}
      <AppText
        style={{ color: foreground, textAlign: 'center', flexShrink: 1 }}
        variant="label"
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: pressed ? palette.primarySoft : palette.surface,
          borderColor: palette.border,
        },
      ]}
    >
      <Icon color={palette.text} name={icon} />
    </Pressable>
  );
}

export function Notice({
  title,
  children,
  error = false,
}: PropsWithChildren<{ title: string; error?: boolean }>) {
  const palette = usePalette();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.notice,
        { backgroundColor: error ? palette.dangerSoft : palette.primarySoft },
      ]}
    >
      <Icon
        color={error ? palette.danger : palette.primary}
        name={error ? 'alert' : 'info'}
        size={20}
      />
      <View style={styles.flex}>
        <AppText
          style={{ color: error ? palette.danger : palette.text }}
          variant="label"
        >
          {title}
        </AppText>
        {children ? (
          <AppText
            style={{ color: palette.muted, marginTop: 4 }}
            variant="caption"
          >
            {children}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

export function ChoiceRow({
  label,
  description,
  icon,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          borderColor: selected ? palette.primary : palette.controlBorder,
          backgroundColor:
            selected || pressed ? palette.primarySoft : palette.surface,
        },
      ]}
    >
      {icon ? (
        <Icon color={selected ? palette.primary : palette.muted} name={icon} />
      ) : null}
      <View style={styles.flex}>
        <AppText variant="label">{label}</AppText>
        {description ? (
          <AppText style={{ color: palette.muted }} variant="caption">
            {description}
          </AppText>
        ) : null}
      </View>
      <View
        style={[
          styles.radio,
          {
            borderColor: selected ? palette.primary : palette.controlBorder,
            backgroundColor: selected ? palette.primary : palette.surface,
          },
        ]}
      >
        {selected ? (
          <Icon color={palette.onPrimary} name="check" size={14} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  surface: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 16 },
  button: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  choice: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
