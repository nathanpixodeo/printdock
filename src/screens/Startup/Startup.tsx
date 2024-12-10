import React, { useState, useEffect } from 'react';
import {
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  ScrollView,
  View,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import TcpSocket from 'react-native-tcp-socket';
import BluetoothSerial from 'react-native-bluetooth-serial';
import RNXprinter from 'react-native-esc-pos-xprinter';
import { Buffer } from 'buffer';
import { NetworkInfo } from 'react-native-network-info';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import BackgroundService from 'react-native-background-actions';

export default function PrintServerScreen() {
  const [device, setDevice] = useState(null);
  const [devices, setDevices] = useState([]);
  const [port, setPort] = useState('9100');
  const [deviceIp, setDeviceIp] = useState('Fetching...');
  const [serverRunning, setServerRunning] = useState(false);

  useEffect(() => {
    NetworkInfo.getIPV4Address().then(setDeviceIp);
    listBluetoothDevices();
  }, []);

  const listBluetoothDevices = async () => {
    try {
      // Ensure permissions are granted before proceeding
      const hasPermissions = await requestBluetoothPermissions();
      console.log();
      if (!hasPermissions) {
        Alert.alert('Permission Denied', 'Bluetooth permissions are required to list devices.');
        return;
      }

      // Check if Bluetooth is enabled
      const isEnabled = await BluetoothSerial.isEnabled();
      if (!isEnabled) {
        await BluetoothSerial.enable();
      }
      const pairedDevices = await BluetoothSerial.list();
      setDevices(pairedDevices);
    } catch (error) {
      console.error('Error listing Bluetooth devices:', error);
    }
  };

  const requestBluetoothPermissions = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      try {
        // Check and request BLUETOOTH_SCAN permission
        const scanPermission = await check(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
        if (scanPermission !== RESULTS.GRANTED) {
          const scanRequest = await request(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
          if (scanRequest !== RESULTS.GRANTED) {
            return false; // Permission not granted
          }
        }

        // Check and request BLUETOOTH_CONNECT permission
        const connectPermission = await check(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
        if (connectPermission !== RESULTS.GRANTED) {
          const connectRequest = await request(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
          if (connectRequest !== RESULTS.GRANTED) {
            return false; // Permission not granted
          }
        }

        return true; // Permissions granted
      } catch (error) {
        console.error('Permission error:', error);
        return false; // Error in permissions check
      }
    }
    return true; // Permissions not required on this Android version
  };

  const startPrintServerInBackground = async () => {
    if (!device) {
      Alert.alert('Error', 'Please select a Bluetooth device first.');
      return;
    }

    const isEnabled = await BluetoothSerial.isEnabled();
    if (!isEnabled) {
      console.error("Bluetooth is not enabled.");
      return;
    }

    console.log(device);
    await BluetoothSerial.connect(device.id);

    const serverTask = async (taskData) => {
      const newServer = TcpSocket.createServer((socket) => {
        let binaryData = Buffer.alloc(0);

        socket.on('data', (chunk) => {
          binaryData = Buffer.concat([binaryData, chunk]);
        });

        socket.on('close', async () => {
          if (binaryData.length) {
            await sendToPrinter(binaryData);
          }
        });

        socket.on('error', (err) => console.error('Socket error:', err));
      });

      newServer.listen({ port: parseInt(port, 10), host: '0.0.0.0' }, () => {
        console.log(`Server running in background on ${deviceIp}:${port}`);
      });

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    };

    const options = {
      taskName: 'PrintServer',
      taskTitle: 'Print Server Running',
      taskDesc: `Listening on ${deviceIp}:${port}`,
      taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
      },
      color: '#007BFF',
    };

    try {
      await BackgroundService.start(serverTask, options);
      setServerRunning(true);
      Alert.alert('Success', 'Print server started in the background.');

    } catch (error) {
      console.error('Background Service Error:', error);
      Alert.alert('Error', 'Failed to start the server.');
    }
  };

  const stopPrintServer = async () => {
    try {
      await BackgroundService.stop();
      setServerRunning(false);
      Alert.alert('Print Server', 'Server stopped successfully.');
    } catch (error) {
      console.error('Error stopping background service:', error);
      Alert.alert('Error', 'Failed to stop the server.');
    }
  };

  const sendToPrinter = async (binaryData: any) => {
    try {
      const buffer = Buffer.from(binaryData, "binary");
      await BluetoothSerial.write(buffer);

      console.log("Print job sent successfully!");

    } catch (error) {
      console.error("Error printing:", error);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Background Print Server</Text>
      <Text style={styles.label}>LAN IP Address: {deviceIp}</Text>
      <TextInput
        style={styles.input}
        placeholder="Port"
        value={port}
        onChangeText={setPort}
      />
      <Picker
        selectedValue={device}
        style={styles.picker}
        onValueChange={(itemValue) => setDevice(itemValue)}
      >
        <Picker.Item label="Select Printer" value={null} />
        {devices.map((d) => (
          <Picker.Item key={d.id} label={d.name} value={d} />
        ))}
      </Picker>
      {!serverRunning ? (
        <Button title="Start Server" onPress={startPrintServerInBackground} />
      ) : (
        <Button title="Stop Server" color="red" onPress={stopPrintServer} />
      )}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© Nhat Nguyen (Nathan Pixodeo)</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  label: { marginVertical: 10 },
  input: { borderWidth: 1, padding: 10, marginBottom: 10 },
  picker: { height: 50, marginVertical: 10 },
  footer: { marginTop: 20, alignItems: 'center' },
  footerText: { fontSize: 12, color: 'gray' },
});
