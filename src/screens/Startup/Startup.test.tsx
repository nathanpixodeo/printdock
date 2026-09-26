import type * as ReactNative from 'react-native';
import type { PrintServerSnapshot } from '@/services/printServer';

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, Linking, Platform } from 'react-native';

import { printServerService } from '@/services/printServer';

import Startup from './Startup';

jest.mock('@/services/printServer', () => ({
  printServerService: {
    getSnapshot: jest.fn(),
    subscribe: jest.fn(),
    listDevices: jest.fn(),
    listUsbDevices: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  },
}));

jest.mock('@/theme', () => {
  const styles = new Proxy({}, { get: () => ({}) });
  return {
    useTheme: () => ({
      backgrounds: styles,
      borders: styles,
      fonts: styles,
      gutters: styles,
      layout: styles,
    }),
  };
});

jest.mock('@/components/templates/SafeScreen/SafeScreen', () => {
  const { View } = jest.requireActual<typeof ReactNative>('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

jest.mock('@/components/molecules/ServerCard/ServerCard', () => {
  const { Text } = jest.requireActual<typeof ReactNative>('react-native');
  return {
    __esModule: true,
    default: ({ status }: { status: string }) => (
      <Text testID="server-status">{status}</Text>
    ),
  };
});

jest.mock('@react-native-picker/picker', () => {
  const { Text, View } = jest.requireActual<typeof ReactNative>('react-native');
  const MockPicker = ({
    children,
    onValueChange,
  }: {
    children: React.ReactNode;
    onValueChange?: (value: string | null) => void;
  }) => (
    <View {...{ onValueChange, testID: 'printer-picker' }}>{children}</View>
  );
  MockPicker.Item = ({ label }: { label: string }) => <Text>{label}</Text>;
  return { Picker: MockPicker };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-native-network-info', () => ({
  NetworkInfo: {
    getIPV4Address: jest.fn(() => Promise.resolve('192.168.1.10')),
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('./preferences', () => ({
  getPrinterId: () => mockSavedPrinterId,
  getPort: () => '9100',
  savePrinterId: jest.fn(),
  savePort: jest.fn(),
}));

let mockSavedPrinterId: string | null = 'printer-1';
const device = {
  id: 'printer-1',
  name: 'Paired printer',
  address: 'AA:BB',
  transport: 'bluetooth' as const,
};
const usbDevice = {
  id: 'usb:printer-2',
  name: 'OTG printer',
  deviceName: '/dev/bus/usb/001/002',
  vendorId: 1234,
  productId: 5678,
  transport: 'usb' as const,
};
let snapshot: PrintServerSnapshot;
let notifySnapshot: (() => void) | null;
let onUrl: ((event: { url: string }) => void) | null;

describe('Startup controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSavedPrinterId = 'printer-1';
    jest.useFakeTimers();
    jest.replaceProperty(Platform, 'OS', 'android');
    snapshot = {
      status: 'stopped',
      running: false,
      device: null,
      port: null,
      localIp: null,
      lastError: null,
      queuedJobs: 0,
    };
    notifySnapshot = null;
    onUrl = null;
    jest
      .mocked(printServerService.getSnapshot)
      .mockImplementation(() => snapshot);
    jest.mocked(printServerService.subscribe).mockImplementation((listener) => {
      notifySnapshot = listener;
      return () => {
        notifySnapshot = null;
      };
    });
    jest.mocked(printServerService.listDevices).mockResolvedValue([device]);
    jest
      .mocked(printServerService.listUsbDevices)
      .mockResolvedValue([usbDevice]);
    jest.mocked(printServerService.start).mockResolvedValue();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest
      .spyOn(Linking, 'addEventListener')
      .mockImplementation((_type, listener) => {
        onUrl = listener;
        return { remove: jest.fn() } as unknown as ReturnType<
          typeof Linking.addEventListener
        >;
      });
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function renderReady() {
    const screen = render(<Startup />);
    await waitFor(() =>
      expect(
        screen.getByText('home.transport_bluetooth · Paired printer'),
      ).toBeTruthy(),
    );
    return screen;
  }

  it('shows the service state while start is pending and reports a failed start', async () => {
    const screen = await renderReady();
    let rejectStart!: (error: Error) => void;
    jest.mocked(printServerService.start).mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectStart = reject;
        }),
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'print_server.start_server' }),
    );
    act(() => {
      snapshot = { ...snapshot, status: 'starting' };
      notifySnapshot?.();
    });
    expect(screen.getByTestId('server-status').children).toEqual(['starting']);
    expect(Alert.alert).not.toHaveBeenCalled();

    await act(async () => {
      rejectStart(new Error('bind failed'));
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'print_server.error',
      'bind failed',
    );
  });

  it('confirms only an exact external start link', async () => {
    await renderReady();
    act(() => {
      onUrl?.({ url: 'https://evil.example/printserver/start' });
      onUrl?.({ url: 'printdock://printserver/start?port=9100' });
    });
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(printServerService.start).not.toHaveBeenCalled();

    act(() => {
      onUrl?.({ url: 'printdock://printserver/start' });
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'print_server.confirm_start_title',
      'print_server.confirm_start',
      expect.any(Array),
    );
    expect(printServerService.start).not.toHaveBeenCalled();

    const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    await act(async () => {
      buttons?.[1]?.onPress?.();
    });
    expect(printServerService.start).toHaveBeenCalledWith(
      device,
      9100,
      '192.168.1.10',
    );
  });

  it('offers Stop to retry cleanup from a failed service state', async () => {
    const screen = await renderReady();
    act(() => {
      snapshot = { ...snapshot, status: 'failed', lastError: 'cleanup failed' };
      notifySnapshot?.();
    });
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'print_server.stop_server' }),
      );
    });
    expect(printServerService.stop).toHaveBeenCalledTimes(1);
    expect(printServerService.start).not.toHaveBeenCalled();
  });

  it('keeps the configuration visible while printer discovery is pending', async () => {
    jest
      .mocked(printServerService.listDevices)
      .mockReturnValueOnce(new Promise(() => {}));
    const screen = render(<Startup />);
    expect(screen.getByText('print_server.configuration')).toBeTruthy();
    expect(screen.getByLabelText('print_server.port_label')).toBeTruthy();
    expect(printServerService.start).not.toHaveBeenCalled();
    await act(async () => {});
  });

  it('shows a recovery action after discovery fails without hiding the form', async () => {
    jest
      .mocked(printServerService.listDevices)
      .mockRejectedValueOnce(new Error('Permission denied'));
    const screen = render(<Startup />);
    await waitFor(() =>
      expect(screen.getByText('home.printer_issue')).toBeTruthy(),
    );
    expect(
      screen.getByRole('button', { name: 'home.open_settings' }),
    ).toBeTruthy();
    expect(screen.getByText('print_server.configuration')).toBeTruthy();
    expect(printServerService.start).not.toHaveBeenCalled();
  });

  it('rejects invalid ports and never starts without valid configuration', async () => {
    const screen = await renderReady();
    for (const invalidPort of ['80', '65536', '1.5', '']) {
      fireEvent.changeText(
        screen.getByLabelText('print_server.port_label'),
        invalidPort,
      );
      expect(screen.getByText('print_server.port_invalid')).toBeTruthy();
      fireEvent.press(
        screen.getByRole('button', { name: 'print_server.start_server' }),
      );
    }
    expect(printServerService.start).not.toHaveBeenCalled();
  });

  it('discovers and selects USB without Bluetooth discovery or persisting USB', async () => {
    mockSavedPrinterId = null;
    const screen = render(<Startup />);
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'home.find_usb_printers' }),
      );
    });
    expect(printServerService.listDevices).not.toHaveBeenCalled();
    expect(printServerService.listUsbDevices).toHaveBeenCalledTimes(1);
    expect(screen.getByText('home.transport_usb · OTG printer')).toBeTruthy();

    fireEvent(
      screen.getByTestId('printer-picker'),
      'onValueChange',
      usbDevice.id,
    );
    expect(
      jest.requireMock('./preferences').savePrinterId,
    ).toHaveBeenCalledWith(null);
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'print_server.start_server' }),
      );
    });
    expect(printServerService.listDevices).not.toHaveBeenCalled();
    expect(printServerService.start).toHaveBeenCalledWith(
      usbDevice,
      9100,
      '192.168.1.10',
    );
  });

  it('clears a USB selection when the printer detaches', async () => {
    mockSavedPrinterId = null;
    const screen = render(<Startup />);
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'home.find_usb_printers' }),
      );
    });
    fireEvent(
      screen.getByTestId('printer-picker'),
      'onValueChange',
      usbDevice.id,
    );
    jest.mocked(printServerService.listUsbDevices).mockResolvedValueOnce([]);
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'home.refresh_usb_printers' }),
      );
    });
    expect(screen.queryByText('home.transport_usb · OTG printer')).toBeNull();
    fireEvent.press(
      screen.getByRole('button', { name: 'print_server.start_server' }),
    );
    expect(printServerService.start).not.toHaveBeenCalled();
  });

  it('checks USB attachment again before starting', async () => {
    mockSavedPrinterId = null;
    const screen = render(<Startup />);
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'home.find_usb_printers' }),
      );
    });
    fireEvent(
      screen.getByTestId('printer-picker'),
      'onValueChange',
      usbDevice.id,
    );
    jest.mocked(printServerService.listUsbDevices).mockResolvedValueOnce([]);

    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'print_server.start_server' }),
      );
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'print_server.error',
      'home.usb_detached',
    );
    expect(printServerService.start).not.toHaveBeenCalled();
    expect(screen.queryByText('home.transport_usb · OTG printer')).toBeNull();
  });

  it('does not start twice while USB attachment recheck is pending', async () => {
    mockSavedPrinterId = null;
    const screen = render(<Startup />);
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'home.find_usb_printers' }),
      );
    });
    fireEvent(
      screen.getByTestId('printer-picker'),
      'onValueChange',
      usbDevice.id,
    );
    let finishRecheck!: (devices: (typeof usbDevice)[]) => void;
    jest.mocked(printServerService.listUsbDevices).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRecheck = resolve;
        }),
    );

    await act(async () => {
      const start = screen.getByRole('button', {
        name: 'print_server.start_server',
      });
      fireEvent.press(start);
      fireEvent.press(start);
      finishRecheck([usbDevice]);
    });
    expect(printServerService.listUsbDevices).toHaveBeenCalledTimes(2);
    expect(printServerService.start).toHaveBeenCalledTimes(1);
  });

  it('rejects a different USB model that reuses the selected device path', async () => {
    mockSavedPrinterId = null;
    const screen = render(<Startup />);
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'home.find_usb_printers' }),
      );
    });
    fireEvent(
      screen.getByTestId('printer-picker'),
      'onValueChange',
      usbDevice.id,
    );
    jest
      .mocked(printServerService.listUsbDevices)
      .mockResolvedValueOnce([{ ...usbDevice, productId: 9999 }]);

    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'print_server.start_server' }),
      );
    });
    expect(printServerService.start).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'print_server.error',
      'home.usb_detached',
    );
  });
});
