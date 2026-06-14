import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

import StatusBadge from '@/components/atoms/StatusBadge/StatusBadge';

type Props = {
  isRunning: boolean;
  ipAddress: string;
  port: string;
  deviceName: string | null;
};

function ServerCard({
  isRunning,
  ipAddress,
  port,
  deviceName,
}: Props) {
  const { backgrounds, borders, fonts, gutters, layout } = useTheme();

  return (
    <View
      style={[
        gutters.padding_24,
        borders.rounded_16,
        backgrounds.purple100,
        {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 4,
        },
      ]}
    >
      {/* Header */}
      <View style={[layout.row, layout.justifyBetween, layout.itemsCenter]}>
        <Text style={[fonts.size_20, fonts.purple500, fonts.bold]}>
          Print Server
        </Text>
        <StatusBadge
          isActive={isRunning}
          label={isRunning ? 'Running' : 'Stopped'}
        />
      </View>

      {/* Divider */}
      <View
        style={[
          gutters.marginVertical_16,
          { height: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
        ]}
      />

      {/* Info rows */}
      <InfoRow
        label="IP Address"
        value={ipAddress}
        icon="🌐"
      />
      <InfoRow
        label="Port"
        value={port}
        icon="🔌"
      />
      <InfoRow
        label="Device"
        value={deviceName ?? 'Not selected'}
        icon="🖨️"
      />
    </View>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
  icon: string;
};

function InfoRow({ label, value, icon }: InfoRowProps) {
  const { fonts, gutters, layout } = useTheme();

  return (
    <View
      style={[
        layout.row,
        layout.itemsCenter,
        gutters.marginBottom_12,
      ]}
    >
      <Text style={[fonts.size_16, { marginRight: 8 }]}>{icon}</Text>
      <View style={[layout.flex_1]}>
        <Text style={[fonts.size_12, fonts.gray400]}>{label}</Text>
        <Text style={[fonts.size_16, fonts.gray800, fonts.bold]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default ServerCard;
