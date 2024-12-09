import React, { useState, useEffect } from 'react';
import {
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  ScrollView,
  Platform,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import TcpSocket from 'react-native-tcp-socket';
import { NetworkInfo } from 'react-native-network-info';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { Buffer } from 'buffer';
import BluetoothSerial from 'react-native-bluetooth-serial';
import RNXprinter from "react-native-esc-pos-xprinter";

export default function PrintServerScreen() {
  const [devices, setDevices] = useState([]);
  const [device, setDevice] = useState(null);
  const [port, setPort] = useState('9100');
  const [deviceIp, setDeviceIp] = useState('Fetching...');
  const [serverRunning, setServerRunning] = useState(false);
  const [server, setServer] = useState(null);


  useEffect(() => {
    NetworkInfo.getIPV4Address().then((ipv4Address: any) => { setDeviceIp(ipv4Address) });
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

      // List paired devices
      const pairedDevices = await BluetoothSerial.list();
      console.log('pairedDevices', pairedDevices);
      setDevices(pairedDevices);
    } catch (error) {
      console.error('Error listing Bluetooth devices:', error);
      Alert.alert('Error', 'Failed to list Bluetooth devices.');
    }
  };


  const printText = async (textData: any) => {
    await RNXprinter.connectPrinter(device.id);
    RNXprinter.pushText(textData, 0);
  }


  // Print binary data
  const printBinary = async (binaryData: any) => {
    try {
      // Check if Bluetooth is enabled
      const isEnabled = await BluetoothSerial.isEnabled();
      if (!isEnabled) {
        console.error("Bluetooth is not enabled.");
        return;
      }

      // Connect to the printer
      await BluetoothSerial.connect(device.id);

      // Send binary data to the printer
      const buffer = Buffer.from(binaryData, "binary"); // Ensure data is handled as raw binary
      await BluetoothSerial.write(buffer);

      console.log("Print job sent successfully!");
    } catch (error) {
      console.error("Error printing:", error);
    }
  };

  const startPrintServer = () => {
    if (serverRunning) {
      Alert.alert('Print Server', 'Server is already running.');
      return;
    }

    if (!device) {
      Alert.alert('Print Server', 'Please select a Bluetooth device first.');
      return;
    }

    const newServer = TcpSocket.createServer((socket) => {
      let binaryData = Buffer.alloc(0);

      socket.on('data', async (chunk) => {
        if (Buffer.isBuffer(chunk)) {
          binaryData = Buffer.concat([binaryData, chunk]);
        } else {
          const textData = chunk.toString('utf8');
          await printText(textData).catch((error) => {
            console.error('Error printing text:', error);
          });
        }
      });

      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      socket.on('close', async () => {
        if (binaryData.length > 0) {
          await printBinary(binaryData);
        } else {
          console.log('No data received to send to printer.');
        }
      });
    });

    newServer.listen({ port: parseInt(port, 10), host: '0.0.0.0' }, () => {
      console.log(`Server running on ${deviceIp}:${port}`);
      setServerRunning(true);
      setServer(newServer);
      Alert.alert('Print Server', `Server started on ${deviceIp}:${port}`);
    });
  };

  const stopPrintServer = () => {
    if (!serverRunning) {
      Alert.alert('Print Server', 'Server is not running.');
      return;
    }

    if (server) {
      server.close(() => {
        console.log('Server stopped.');
        setServerRunning(false);
        setServer(null);
        Alert.alert('Print Server', 'Server stopped successfully.');
      });
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Network Print Server</Text>

      <Text style={styles.label}>LAN IP Address:</Text>
      <Text style={styles.ipAddress}>{deviceIp}</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter Port"
        value={port}
        keyboardType="numeric"
        onChangeText={setPort}
      />

      <Text style={styles.label}>Select Bluetooth Device:</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={device}
          style={styles.picker}
          onValueChange={(itemValue) => {
            if (itemValue !== "placeholder") {
              setDevice(itemValue);
            }
          }}
        >
          <Picker.Item label="Choose a printer" value="placeholder" />
          {devices.map((device) => (
            <Picker.Item key={device.id} label={device.name} value={device} />
          ))}
        </Picker>
      </View>
      {!serverRunning ? (
        <Button title="Enable Print Server" onPress={startPrintServer} />
      ) : (
        <Button title="Disable Print Server" color="red" onPress={stopPrintServer} />
      )}
      <Text style={styles.footer}>© Nhat Nguyen (Nathan Pixodeo)</Text>
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
  pickerContainer: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 20,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  footer: {
    fontSize: 14,
    textAlign: 'center',
    color: '#888',
    marginTop: 20,
    paddingVertical: 10,
  },
});