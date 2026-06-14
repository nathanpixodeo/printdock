import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NetworkInfo } from 'react-native-network-info';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import type { BluetoothDevice } from '@/services/printServer';
import { printServerService } from '@/services/printServer';

import ServerCard from '@/components/molecules/ServerCard/ServerCard';

const POLL_INTERVAL = 5000;

export default function HomeScreen() {
  const { t } = useTranslation();
  const { backgrounds, borders, fonts, gutters, layout } = useTheme();
  const navigation = useNavigation();

  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(
    null,
  );
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [port, setPort] = useState('9100');
  const [deviceIp, setDeviceIp] = useState('Fetching...');
  const [serverRunning, setServerRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buttonScale = useSharedValue(1);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    contentOpacity.value = withTiming(1, { duration: 400 });
  }, [contentOpacity]);

  const animatedContent = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const animatedButton = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const fetchDeviceList = useCallback(async () => {
    try {
      const paired = await printServerService.listDevices();
      setDevices(paired);
    } catch {
      // silently retry on next poll
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshIp = useCallback(() => {
    NetworkInfo.getIPV4Address()
      .then((ip: string) => {
        setDeviceIp(ip);
      })
      .catch(() => {
        setDeviceIp('Unavailable');
      });
  }, []);

  useEffect(() => {
    refreshIp();
    fetchDeviceList();

    pollRef.current = setInterval(() => {
      refreshIp();
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [fetchDeviceList, refreshIp]);

  useEffect(() => {
    printServerService.setListener({
      onStatusChange: (running) => {
        setServerRunning(running);
        setIsToggling(false);
      },
      onError: (error) => {
        setIsToggling(false);
        Alert.alert('Error', error);
      },
      onPrintJobSent: () => {
        // could show a brief toast notification
      },
    });

    return () => {
      printServerService.removeListener();
    };
  }, []);

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    try {
      const paired = await printServerService.listDevices();
      setDevices(paired);
    } catch {
      Alert.alert(
        t('airprint:print_server.permission_denied'),
        t('airprint:print_server.permission_required'),
      );
    } finally {
      setIsScanning(false);
    }
  }, [t]);

  const handleStart = useCallback(async () => {
    if (!selectedDevice) {
      Alert.alert('Error', t('airprint:print_server.please_select_device'));
      return;
    }

    buttonScale.value = withSpring(0.95, undefined, () => {
      buttonScale.value = withSpring(1);
    });

    setIsToggling(true);
    try {
      await printServerService.start(
        selectedDevice,
        Number.parseInt(port, 10) || 9100,
        deviceIp,
      );
      Alert.alert('Success', t('airprint:print_server.server_started'));
    } catch (error) {
      setIsToggling(false);
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', message);
    }
  }, [selectedDevice, port, deviceIp, t, buttonScale]);

  const handleStop = useCallback(async () => {
    buttonScale.value = withSpring(0.95, undefined, () => {
      buttonScale.value = withSpring(1);
    });

    setIsToggling(true);
    try {
      await printServerService.stop();
      Alert.alert('Success', t('airprint:print_server.server_stopped'));
    } catch {
      setIsToggling(false);
      Alert.alert('Error', t('airprint:print_server.failed_to_stop'));
    }
  }, [t, buttonScale]);

  const handleSettings = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  if (isLoading) {
    return (
      <View style={[layout.flex_1, layout.justifyCenter, layout.itemsCenter]}>
        <ActivityIndicator size="large" color="#44427D" />
      </View>
    );
  }

  return (
    <View style={[layout.flex_1, backgrounds.gray50]}>
      {/* Header */}
      <View
        style={[
          gutters.paddingHorizontal_24,
          gutters.paddingTop_16,
          gutters.paddingBottom_12,
          layout.row,
          layout.justifyBetween,
          layout.itemsCenter,
        ]}
      >
        <View>
          <Text style={[fonts.size_24, fonts.purple500, fonts.bold]}>
            AirPrint
          </Text>
          <Text style={[fonts.size_12, fonts.gray400]}>
            {t('airprint:print_server.subtitle')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleSettings}
          style={[
            gutters.padding_8,
            backgrounds.purple100,
            borders.rounded_8,
          ]}
        >
          <Text style={[fonts.size_20]}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[gutters.padding_24]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={animatedContent}>
          {/* Server Status Card */}
          <ServerCard
            isRunning={serverRunning}
            ipAddress={deviceIp}
            port={port}
            deviceName={selectedDevice?.name ?? null}
          />

          {/* Configuration Section */}
          <View style={[gutters.marginTop_24]}>
            <Text style={[fonts.size_18, fonts.gray800, fonts.bold, gutters.marginBottom_16]}>
              Configuration
            </Text>

            {/* Port Input */}
            <View style={[gutters.marginBottom_16]}>
              <Text style={[fonts.size_14, fonts.gray400, gutters.marginBottom_4]}>
                {t('airprint:print_server.port_label')}
              </Text>
              <TextInput
                keyboardType="number-pad"
                placeholder={t('airprint:print_server.port_placeholder')}
                placeholderTextColor="#9CA3AF"
                style={[
                  gutters.paddingHorizontal_16,
                  gutters.paddingVertical_12,
                  borders.rounded_12,
                  borders.w_1,
                  borders.gray200,
                  backgrounds.white,
                  fonts.size_16,
                  fonts.gray800,
                  { borderColor: '#D1D5DB' },
                ]}
                value={port}
                onChangeText={setPort}
                editable={!serverRunning}
              />
            </View>

            {/* Device Picker */}
            <View style={[gutters.marginBottom_16]}>
              <View style={[layout.row, layout.justifyBetween, layout.itemsCenter, gutters.marginBottom_4]}>
                <Text style={[fonts.size_14, fonts.gray400]}>
                  {t('airprint:print_server.device_label')}
                </Text>
                <TouchableOpacity
                  onPress={handleScan}
                  disabled={isScanning}
                  style={[layout.row, layout.itemsCenter]}
                >
                  {isScanning ? (
                    <ActivityIndicator size="small" color="#44427D" />
                  ) : (
                    <Text style={[fonts.size_12, fonts.purple500]}>
                      {t('airprint:print_server.scan')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
              <View
                style={[
                  borders.rounded_12,
                  borders.w_1,
                  backgrounds.white,
                  { borderColor: '#D1D5DB', overflow: 'hidden' },
                ]}
              >
                <Picker
                  selectedValue={selectedDevice}
                  onValueChange={(item: BluetoothDevice | null) =>
                    setSelectedDevice(item)
                  }
                  enabled={!serverRunning}
                >
                  <Picker.Item
                    label={t('airprint:print_server.select_printer')}
                    value={null}
                    color="#9CA3AF"
                  />
                  {devices.map((device) => (
                    <Picker.Item
                      key={device.id}
                      label={device.name}
                      value={device}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          {/* Control Button */}
          <Animated.View style={[gutters.marginTop_8, animatedButton]}>
            <TouchableOpacity
              onPress={serverRunning ? handleStop : handleStart}
              disabled={isToggling}
              activeOpacity={0.8}
              style={[
                gutters.paddingVertical_16,
                borders.rounded_16,
                {
                  backgroundColor: serverRunning ? '#EF4444' : '#44427D',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: serverRunning ? '#EF4444' : '#44427D',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                },
              ]}
            >
              {isToggling ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[fonts.size_18, fonts.white, fonts.bold]}>
                  {serverRunning
                    ? t('airprint:print_server.stop_server')
                    : t('airprint:print_server.start_server')}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Footer */}
          <View style={[layout.itemsCenter, gutters.marginTop_32]}>
            <Text style={[fonts.size_12, fonts.gray200]}>
              {t('airprint:print_server.footer')}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
