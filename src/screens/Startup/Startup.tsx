import React, { useState, useEffect } from 'react';
import {
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  ScrollView,
  Platform
} from 'react-native';
import TcpSocket from 'react-native-tcp-socket';
import { NetworkInfo } from 'react-native-network-info';
import RNXprinter from "react-native-esc-pos-xprinter";
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import iconv from "iconv-lite";
import { Buffer } from 'buffer';
import {BluetoothManager,BluetoothEscposPrinter,BluetoothTscPrinter} from 'react-native-bluetooth-escpos-printer';


export default function PrintServerScreen() {
  const [port, setPort] = useState('9100');
  const [deviceIp, setDeviceIp] = useState('Fetching...');
  const [serverRunning, setServerRunning] = useState(false);


  useEffect(() => {
    NetworkInfo.getIPV4Address().then((ipv4Address: any) => { setDeviceIp(ipv4Address) });
    requestBluetoothPermissions();
    getXprinterDevices();
  }, []);

  const getXprinterDevices = async () => {
    const printerList = await RNXprinter.getDeviceList();
    console.log(printerList);
    const connected = await RNXprinter.connectPrinter(printerList[0].address);
    console.log('connected', connected);
  }

  const startPrintServer = () => {

    if (serverRunning) {
      Alert.alert('Print Server', 'Server is already running.');
      return;
    }

    const server = TcpSocket.createServer((socket) => {
      // socket.setEncoding('utf8');
      let binaryData = Buffer.alloc(0);
      socket.on('data', async (chunk) => {
        binaryData = Buffer.concat([binaryData, Buffer.from(chunk)]);
      });

      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      socket.on('close', () => {
        console.log('Connection closed');
        // Decode function to extract printable text
        const decodeBuffer = (buffer:any) => {
          return buffer
            .filter((byte:any) => byte >= 32 && byte <= 126) // ASCII printable range
            .map((byte:any) => String.fromCharCode(byte))
            .join('');
        };

        const decodedTextInt = decodeBuffer(binaryData);
        console.log('Received closed data 2:', decodedTextInt);
      });
    });

    server.listen({ port: parseInt(port, 10), host: '0.0.0.0' }, () => {
      console.log(`Server running on ${deviceIp}:${port}`);
      setServerRunning(true);
      Alert.alert('Print Server', `Server started on ${deviceIp}:${port}`);
    });
  };

  const requestBluetoothPermissions = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      try {
        // Check and request BLUETOOTH_SCAN permission
        const scanPermission = await check(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
        if (scanPermission !== RESULTS.GRANTED) {
          const scanRequest = await request(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
          if (scanRequest !== RESULTS.GRANTED) {
            Alert.alert('Permission Denied', 'Bluetooth scan permission is required.');
            return;
          }
        }

        // Check and request BLUETOOTH_CONNECT permission
        const connectPermission = await check(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
        if (connectPermission !== RESULTS.GRANTED) {
          const connectRequest = await request(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
          if (connectRequest !== RESULTS.GRANTED) {
            Alert.alert('Permission Denied', 'Bluetooth connect permission is required.');
            return;
          }
        }
      } catch (error) {
        console.error('Permission error:', error);
      }
    } else {
      Alert.alert('Not Required', 'Bluetooth permissions are not required on this Android version.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Print Server</Text>

      <Text style={styles.label}>LAN IP Address:</Text>
      <Text style={styles.ipAddress}>{deviceIp}</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter Port"
        value={port}
        keyboardType="numeric"
        onChangeText={setPort}
      />

      <Button title="Enable Print Server" onPress={startPrintServer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  ipAddress: {
    fontSize: 18,
    color: '#007BFF',
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
});
