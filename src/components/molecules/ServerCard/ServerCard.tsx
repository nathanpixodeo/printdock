import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { parsePort } from '@/screens/Startup/config';

import { AppText } from '@/design/components';
import { Icon } from '@/design/Icon';
import { usePalette } from '@/design/tokens';

type Props = {
  status: 'stopped' | 'starting' | 'listening' | 'stopping' | 'failed';
  ipAddress: string | null;
  port: string | null;
  deviceName: string | null;
  error: string | null;
  queuedJobs?: number;
};

export default function ServerCard({
  status,
  ipAddress,
  port,
  deviceName,
  error,
  queuedJobs = 0,
}: Props) {
  const { t } = useTranslation();
  const palette = usePalette();
  const validPort = port !== null && parsePort(port) !== null;
  const ready = Boolean(deviceName && ipAddress && validPort);
  const active = status === 'listening';
  const title =
    status === 'stopped'
      ? ready
        ? t('home.ready_title')
        : t('home.standby_title')
      : {
          starting: t('home.starting_title'),
          listening: t('home.listening_title'),
          stopping: t('home.stopping_title'),
          failed: t('home.failed_title'),
        }[status];
  const description =
    status === 'failed'
      ? t('home.failed_body')
      : active
        ? t('home.listening_body')
        : ready
          ? t('home.ready_body')
          : t('home.standby_body');
  return (
    <View style={[styles.card, { backgroundColor: palette.hero }]}>
      <View style={styles.header}>
        <AppText style={{ color: palette.heroMuted }} variant="eyebrow">
          {t('home.status_label')}
        </AppText>
        <View
          accessibilityLabel={t(`print_server.status.${status}`)}
          accessibilityLiveRegion="polite"
          accessibilityRole="text"
          style={styles.badge}
        >
          <View
            style={[
              styles.dot,
              {
                backgroundColor: active
                  ? palette.heroAccent
                  : palette.heroMuted,
              },
            ]}
          />
          <AppText style={{ color: palette.onHero }} variant="caption">
            {t(`print_server.status.${status}`)}
          </AppText>
        </View>
      </View>
      <View style={styles.message}>
        <View style={styles.title}>
          <AppText style={{ color: palette.onHero }} variant="title">
            {title}
          </AppText>
          <AppText style={{ color: palette.heroMuted }} variant="caption">
            {description}
          </AppText>
        </View>
        <View style={styles.printer}>
          <Icon color={palette.heroAccent} name="printer" size={34} />
        </View>
      </View>
      <View style={styles.endpoint}>
        <AppText style={{ color: palette.heroMuted }} variant="eyebrow">
          {t('home.endpoint')}
        </AppText>
        <AppText
          selectable
          style={{
            color: palette.onHero,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          }}
          variant="heading"
        >
          {ipAddress && validPort ? `${ipAddress}:${port}` : '—'}
        </AppText>
        <View style={styles.printerRow}>
          <Icon color={palette.heroMuted} name="bluetooth" size={16} />
          <AppText
            style={{ color: palette.heroMuted, flex: 1 }}
            variant="caption"
          >
            {deviceName ?? t('print_server.not_selected')}
          </AppText>
        </View>
        {active ? (
          <AppText style={{ color: palette.heroAccent }} variant="caption">
            {t('home.queue', { count: queuedJobs })}
          </AppText>
        ) : null}
      </View>
      {error ? (
        <AppText
          accessibilityLiveRegion="polite"
          style={{ color: '#FFD4D7' }}
          variant="caption"
        >
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 22, gap: 20 },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#24434D',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  message: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { flex: 1, gap: 8 },
  printer: {
    width: 60,
    height: 68,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#365561',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endpoint: {
    borderTopWidth: 1,
    borderTopColor: '#365561',
    paddingTop: 16,
    gap: 6,
  },
  printerRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
