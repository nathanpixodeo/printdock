import type { PrintDevice, UsbPrinterDevice } from '@/services/printServer';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState, Linking } from 'react-native';
import { NetworkInfo } from 'react-native-network-info';

import { validateEndpoint } from '@/services/printLimits';
import { printServerService } from '@/services/printServer';

import { MAX_PORT, MIN_PORT, parsePort, parsePrintServerLink } from './config';
import { getPort, getPrinterId, savePort, savePrinterId } from './preferences';

let initialLinkHandled = false;

export function usePrintController() {
  const { t } = useTranslation();
  const snapshot = useSyncExternalStore(
    printServerService.subscribe,
    printServerService.getSnapshot,
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    getPrinterId,
  );
  const [bluetoothDevices, setBluetoothDevices] = useState<PrintDevice[]>([]);
  const [usbDevices, setUsbDevices] = useState<UsbPrinterDevice[]>([]);
  const [port, setPort] = useState(getPort);
  const [deviceIp, setDeviceIp] = useState<string | null>(null);
  const [ipError, setIpError] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [usbError, setUsbError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(selectedDeviceId));
  const [isScanning, setIsScanning] = useState(false);
  const [isScanningUsb, setIsScanningUsb] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const mounted = useRef(true);
  const scanning = useRef(false);
  const scanningUsb = useRef(false);
  const toggling = useRef(false);
  const selectedOnMount = useRef(selectedDeviceId);
  const linkHandler = useRef<((url: string | null) => void) | null>(null);
  const pendingLink = useRef<string | null>(null);
  const devices: PrintDevice[] = useMemo(
    () => [...bluetoothDevices, ...usbDevices],
    [bluetoothDevices, usbDevices],
  );
  const selectedDevice =
    devices.find((device) => device.id === selectedDeviceId) ?? null;
  const isRunning = snapshot.running;
  const canStop = isRunning || snapshot.status === 'failed';
  const isBusy =
    isToggling ||
    snapshot.status === 'starting' ||
    snapshot.status === 'stopping';
  const portError =
    parsePort(port) === null
      ? t('print_server.port_invalid', { min: MIN_PORT, max: MAX_PORT })
      : null;

  const refreshIp = useCallback(() => {
    void NetworkInfo.getIPV4Address()
      .then((ip: string | null) => {
        if (ip) {
          validateEndpoint(9100, ip);
        }
        if (mounted.current) {
          setDeviceIp(ip || null);
          setIpError(!ip);
        }
      })
      .catch(() => {
        if (mounted.current) {
          setDeviceIp(null);
          setIpError(true);
        }
      });
  }, []);

  const scan = useCallback(async () => {
    if (scanning.current) {
      return;
    }
    scanning.current = true;
    setIsScanning(true);
    setDeviceError(null);
    try {
      const paired = await printServerService.listDevices();
      if (mounted.current) {
        setBluetoothDevices(paired);
      }
    } catch (error) {
      if (mounted.current) {
        setBluetoothDevices([]);
        setDeviceError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      scanning.current = false;
      if (mounted.current) {
        setIsScanning(false);
        setIsLoading(false);
      }
    }
  }, []);

  const scanUsb = useCallback(async () => {
    if (scanningUsb.current) {
      return;
    }
    scanningUsb.current = true;
    setIsScanningUsb(true);
    setUsbError(null);
    try {
      const attached = await printServerService.listUsbDevices();
      if (mounted.current) {
        setUsbDevices(attached);
        setSelectedDeviceId((current) =>
          current?.startsWith('usb:') &&
          !attached.some((device) => device.id === current)
            ? null
            : current,
        );
      }
    } catch (error) {
      if (mounted.current) {
        setUsbDevices([]);
        setSelectedDeviceId((current) =>
          current?.startsWith('usb:') ? null : current,
        );
        setUsbError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      scanningUsb.current = false;
      if (mounted.current) {
        setIsScanningUsb(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refreshIp();
    // First-time permission requests follow the explicit discovery action.
    if (selectedOnMount.current) {
      void scan();
    }
    const poll = setInterval(refreshIp, 30_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshIp();
      }
    });
    return () => {
      mounted.current = false;
      clearInterval(poll);
      subscription.remove();
    };
  }, [refreshIp, scan]);

  useEffect(() => {
    if (!selectedDeviceId?.startsWith('usb:')) {
      return;
    }
    const poll = setInterval(() => {
      void scanUsb();
    }, 10_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void scanUsb();
      }
    });
    return () => {
      clearInterval(poll);
      subscription.remove();
    };
  }, [scanUsb, selectedDeviceId]);

  const updatePort = useCallback((value: string) => {
    setPort(value);
    if (parsePort(value) !== null) {
      savePort(value);
    }
  }, []);
  const selectPrinter = useCallback(
    (id: string | null) => {
      const device = devices.find((candidate) => candidate.id === id);
      setSelectedDeviceId(device?.id ?? null);
      savePrinterId(device?.transport === 'usb' ? null : (device?.id ?? null));
    },
    [devices],
  );

  const start = useCallback(async () => {
    if (toggling.current || isBusy) {
      return;
    }
    if (!selectedDevice) {
      Alert.alert(
        t('print_server.error'),
        t('print_server.please_select_device'),
      );
      return;
    }
    toggling.current = true;
    setIsToggling(true);
    try {
      if (selectedDevice.transport === 'usb') {
        const attached = await printServerService.listUsbDevices();
        if (
          !attached.some(
            (device) =>
              device.id === selectedDevice.id &&
              device.vendorId === selectedDevice.vendorId &&
              device.productId === selectedDevice.productId,
          )
        ) {
          setUsbDevices(attached);
          setSelectedDeviceId(null);
          Alert.alert(t('print_server.error'), t('home.usb_detached'));
          return;
        }
      }
      const portNumber = parsePort(port);
      if (portNumber === null) {
        Alert.alert(
          t('print_server.error'),
          t('print_server.port_invalid', { min: MIN_PORT, max: MAX_PORT }),
        );
        return;
      }
      if (!deviceIp) {
        Alert.alert(t('print_server.error'), t('print_server.ip_unavailable'));
        return;
      }
      await printServerService.start(selectedDevice, portNumber, deviceIp);
    } catch (error) {
      Alert.alert(
        t('print_server.error'),
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      toggling.current = false;
      if (mounted.current) {
        setIsToggling(false);
      }
    }
  }, [deviceIp, isBusy, port, selectedDevice, t]);

  const stop = useCallback(async () => {
    if (toggling.current || isBusy) {
      return;
    }
    toggling.current = true;
    setIsToggling(true);
    try {
      await printServerService.stop();
    } catch (error) {
      Alert.alert(
        t('print_server.error'),
        error instanceof Error
          ? error.message
          : t('print_server.failed_to_stop'),
      );
    } finally {
      toggling.current = false;
      if (mounted.current) {
        setIsToggling(false);
      }
    }
  }, [isBusy, t]);

  const handleDeepLink = useCallback(
    (url: string | null) => {
      const action = url ? parsePrintServerLink(url) : null;
      if (!action || !url) {
        return;
      }
      if (action === 'start' && (isLoading || (!deviceIp && !ipError))) {
        pendingLink.current = url;
        return;
      }
      if (action === 'stop') {
        pendingLink.current = null;
      }
      if (isBusy) {
        return;
      }
      if (action === 'stop') {
        if (!canStop) {
          return;
        }
        Alert.alert(
          t('print_server.confirm_stop_title'),
          t('print_server.confirm_stop'),
          [
            { text: t('print_server.cancel'), style: 'cancel' },
            {
              text: t('print_server.stop_server'),
              style: 'destructive',
              onPress: () => {
                void stop();
              },
            },
          ],
        );
        return;
      }
      if (isRunning) {
        return;
      }
      const portNumber = parsePort(port);
      if (!selectedDevice || portNumber === null || !deviceIp) {
        Alert.alert(
          t('print_server.error'),
          t('print_server.invalid_start_config'),
        );
        return;
      }
      Alert.alert(
        t('print_server.confirm_start_title'),
        t('print_server.confirm_start', {
          name: selectedDevice.name,
          port: portNumber,
        }),
        [
          { text: t('print_server.cancel'), style: 'cancel' },
          {
            text: t('print_server.start_server'),
            onPress: () => {
              void start();
            },
          },
        ],
      );
    },
    [
      canStop,
      deviceIp,
      ipError,
      isBusy,
      isLoading,
      isRunning,
      port,
      selectedDevice,
      start,
      stop,
      t,
    ],
  );
  linkHandler.current = handleDeepLink;

  useEffect(() => {
    if (isLoading || (!deviceIp && !ipError)) {
      return;
    }
    const pending = pendingLink.current;
    pendingLink.current = null;
    if (pending) {
      linkHandler.current?.(pending);
    }
  }, [deviceIp, ipError, isLoading]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) =>
      linkHandler.current?.(event.url),
    );
    if (!initialLinkHandled) {
      initialLinkHandled = true;
      void Linking.getInitialURL()
        .then((url) => linkHandler.current?.(url))
        .catch(() => {
          // An unavailable initial intent must not prevent using the main screen.
        });
    }
    return () => subscription.remove();
  }, []);

  const openSettings = useCallback(() => {
    void Linking.openSettings().catch(() =>
      Alert.alert(t('print_server.error'), t('home.settings_unavailable')),
    );
  }, [t]);

  return {
    snapshot,
    devices,
    selectedDevice,
    port,
    portError,
    deviceIp,
    ipError,
    deviceError,
    usbError,
    isLoading,
    isScanning,
    isScanningUsb,
    isRunning,
    isBusy,
    canStop,
    updatePort,
    selectPrinter,
    scan,
    scanUsb,
    start,
    stop,
    openSettings,
  };
}
