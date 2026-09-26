import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/navigation/types';

import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import ServerCard from '@/components/molecules/ServerCard/ServerCard';
import SafeScreen from '@/components/templates/SafeScreen/SafeScreen';

import { BrandMark } from '@/design/Brand';
import {
  AppButton,
  AppText,
  IconButton,
  Notice,
  Surface,
} from '@/design/components';
import { Icon } from '@/design/Icon';
import { usePalette } from '@/design/tokens';

import { usePrintController } from './usePrintController';

export default function HomeScreen() {
  const { t } = useTranslation();
  const palette = usePalette();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const controller = usePrintController();
  const { snapshot, selectedDevice, isRunning, isBusy, canStop } = controller;
  const configLocked = isRunning || isBusy || snapshot.status === 'failed';

  return (
    <SafeScreen style={{ backgroundColor: palette.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <BrandMark />
            <View style={styles.flex}>
              <AppText variant="title">{t('app_name')}</AppText>
              <AppText style={{ color: palette.muted }} variant="caption">
                {t('home.workspace')}
              </AppText>
            </View>
            <IconButton
              icon="settings"
              label={t('settings.title')}
              onPress={() => navigation.navigate('Settings')}
            />
          </View>
          <View style={styles.introduction}>
            <AppText accessibilityRole="header" variant="display">
              {t('home.greeting')}
            </AppText>
            <AppText style={{ color: palette.muted }}>
              {t('home.intro')}
            </AppText>
          </View>
          <ServerCard
            deviceName={
              snapshot.status === 'stopped'
                ? (selectedDevice?.name ?? null)
                : (snapshot.device?.name ?? null)
            }
            error={snapshot.lastError}
            ipAddress={
              snapshot.status === 'stopped'
                ? controller.deviceIp
                : snapshot.localIp
            }
            port={
              snapshot.status === 'stopped'
                ? controller.port
                : (snapshot.port?.toString() ?? null)
            }
            queuedJobs={snapshot.queuedJobs}
            status={snapshot.status}
          />
          {Platform.OS !== 'android' ? (
            <Notice error title={t('home.unsupported_title')}>
              {t('home.unsupported_detail')}
            </Notice>
          ) : null}
          {isRunning &&
          controller.deviceIp &&
          snapshot.localIp &&
          controller.deviceIp !== snapshot.localIp ? (
            <Notice title={t('home.network_section')}>
              {t('print_server.network_changed')}
            </Notice>
          ) : null}
          <Surface>
            <View style={styles.sectionHeading}>
              <View
                style={[
                  styles.iconTile,
                  { backgroundColor: palette.primarySoft },
                ]}
              >
                <Icon color={palette.primary} name="printer" />
              </View>
              <View style={styles.flex}>
                <AppText accessibilityRole="header" variant="heading">
                  {t('home.device_section')}
                </AppText>
                <AppText style={{ color: palette.muted }} variant="caption">
                  {t('home.device_hint')}
                </AppText>
              </View>
            </View>
            {controller.devices.length > 0 ? (
              <View>
                <AppText
                  nativeID="printer-label"
                  style={styles.fieldLabel}
                  variant="label"
                >
                  {t('home.choose_printer')}
                </AppText>
                <View
                  style={[
                    styles.picker,
                    {
                      borderColor: palette.controlBorder,
                      backgroundColor: palette.background,
                    },
                  ]}
                >
                  <Picker
                    accessibilityHint={t('home.select_device_hint')}
                    accessibilityLabel={t('print_server.device_label')}
                    dropdownIconColor={palette.text}
                    enabled={!configLocked}
                    onValueChange={(id: string | null) =>
                      controller.selectPrinter(id)
                    }
                    selectedValue={selectedDevice?.id ?? null}
                    style={{ color: palette.text }}
                  >
                    <Picker.Item
                      color={palette.muted}
                      label={t('print_server.select_printer')}
                      value={null}
                    />
                    {controller.devices.map((device) => (
                      <Picker.Item
                        key={device.id}
                        label={`${t(device.transport === 'usb' ? 'home.transport_usb' : 'home.transport_bluetooth')} · ${device.name}`}
                        value={device.id}
                      />
                    ))}
                  </Picker>
                </View>
                <AppText
                  style={{ color: palette.muted, marginTop: 8 }}
                  variant="caption"
                >
                  {t('home.paired_count', {
                    count: controller.devices.filter(
                      (device) => device.transport !== 'usb',
                    ).length,
                  })}
                  {' · '}
                  {t('home.usb_count', {
                    count: controller.devices.filter(
                      (device) => device.transport === 'usb',
                    ).length,
                  })}
                </AppText>
              </View>
            ) : !controller.deviceError ? (
              <View
                style={[styles.emptyState, { borderColor: palette.border }]}
              >
                <Icon color={palette.muted} name="printer" size={28} />
                <View style={styles.flex}>
                  <AppText variant="label">
                    {controller.isScanning || controller.isScanningUsb
                      ? t('home.loading_printers')
                      : t('home.no_printers')}
                  </AppText>
                  <AppText style={{ color: palette.muted }} variant="caption">
                    {t('home.no_printers_help')}
                  </AppText>
                </View>
              </View>
            ) : null}
            {controller.deviceError ? (
              <>
                <Notice error title={t('home.printer_issue')}>
                  {t('home.printer_issue_help')}
                </Notice>
                <AppButton
                  icon="external"
                  label={t('home.open_settings')}
                  onPress={controller.openSettings}
                  variant="secondary"
                />
              </>
            ) : null}
            {controller.usbError ? (
              <Notice error title={t('home.usb_issue')}>
                {t('home.usb_issue_help')}
              </Notice>
            ) : null}
            <AppButton
              disabled={configLocked || Platform.OS !== 'android'}
              icon="refresh"
              label={
                controller.devices.some((device) => device.transport !== 'usb')
                  ? t('home.refresh_printers')
                  : t('home.find_printers')
              }
              loading={controller.isScanning}
              onPress={() => {
                void controller.scan();
              }}
              variant="secondary"
            />
            <AppButton
              disabled={configLocked || Platform.OS !== 'android'}
              icon="refresh"
              label={
                controller.devices.some((device) => device.transport === 'usb')
                  ? t('home.refresh_usb_printers')
                  : t('home.find_usb_printers')
              }
              loading={controller.isScanningUsb}
              onPress={() => {
                void controller.scanUsb();
              }}
              variant="secondary"
            />
            <AppText style={{ color: palette.muted }} variant="caption">
              {t('home.usb_bulk_hint')}
            </AppText>
          </Surface>
          <Surface>
            <View style={styles.sectionHeading}>
              <View
                style={[
                  styles.iconTile,
                  { backgroundColor: palette.primarySoft },
                ]}
              >
                <Icon color={palette.primary} name="wifi" />
              </View>
              <View style={styles.flex}>
                <AppText accessibilityRole="header" variant="heading">
                  {t('print_server.configuration')}
                </AppText>
                <AppText style={{ color: palette.muted }} variant="caption">
                  {t('home.network_hint')}
                </AppText>
              </View>
            </View>
            <View
              style={[
                styles.networkRow,
                { backgroundColor: palette.background },
              ]}
            >
              <AppText
                style={{ color: palette.muted, flex: 1 }}
                variant="label"
              >
                {t('home.local_address')}
              </AppText>
              <AppText
                selectable
                style={{
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                  flexShrink: 1,
                }}
                variant="label"
              >
                {controller.deviceIp ?? t('print_server.unavailable')}
              </AppText>
            </View>
            {controller.ipError ? (
              <Notice error title={t('print_server.ip_unavailable')} />
            ) : null}
            <View>
              <AppText
                nativeID="port-label"
                style={styles.fieldLabel}
                variant="label"
              >
                {t('print_server.port_label')}
              </AppText>
              <TextInput
                accessibilityHint={controller.portError ?? t('home.port_hint')}
                accessibilityLabel={t('print_server.port_label')}
                accessibilityLabelledBy="port-label"
                autoCorrect={false}
                editable={!configLocked}
                keyboardType="number-pad"
                onChangeText={controller.updatePort}
                placeholder="9100"
                placeholderTextColor={palette.muted}
                selectionColor={palette.primary}
                style={[
                  styles.portInput,
                  {
                    backgroundColor: palette.background,
                    borderColor: controller.portError
                      ? palette.danger
                      : palette.controlBorder,
                    color: palette.text,
                  },
                ]}
                value={controller.port}
              />
              <AppText
                accessibilityLiveRegion="polite"
                style={{
                  color: controller.portError ? palette.danger : palette.muted,
                  marginTop: 8,
                }}
                variant="caption"
              >
                {controller.portError ?? t('home.port_hint')}
              </AppText>
            </View>
          </Surface>
          <View style={styles.trustNote}>
            <Icon color={palette.muted} name="shield" size={18} />
            <View style={styles.flex}>
              <AppText variant="caption">{t('home.network_safety')}</AppText>
              <AppText style={{ color: palette.muted }} variant="caption">
                {t('home.network_safety_detail')}
              </AppText>
            </View>
          </View>
        </ScrollView>
        <View
          style={[
            styles.actionDock,
            {
              backgroundColor: palette.surface,
              borderTopColor: palette.border,
            },
          ]}
        >
          <View style={styles.actionContent}>
            <AppButton
              disabled={Platform.OS !== 'android'}
              hint={t('home.start_hint')}
              icon={canStop ? 'stop' : 'play'}
              label={
                isBusy
                  ? snapshot.status === 'stopping'
                    ? t('home.stop_busy')
                    : t('home.start_busy')
                  : canStop
                    ? t('print_server.stop_server')
                    : t('print_server.start_server')
              }
              loading={isBusy}
              onPress={() => {
                void (canStop ? controller.stop() : controller.start());
              }}
              variant={canStop ? 'danger' : 'primary'}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  actionDock: { borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 12 },
  actionContent: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  introduction: { gap: 8, marginTop: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  picker: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 54,
  },
  fieldLabel: { marginBottom: 8 },
  networkRow: {
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  portInput: {
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 17,
    lineHeight: 24,
  },
  trustNote: { flexDirection: 'row', gap: 10, paddingHorizontal: 4 },
});
