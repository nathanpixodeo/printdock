import Svg, { Path } from 'react-native-svg';

const paths = {
  alert: 'M12 3 2 21h20L12 3Zm0 6v5m0 3v.1',
  arrowLeft: 'm14 5-7 7 7 7M7 12h14',
  bluetooth: 'm7 7 10 10-5 4V3l5 4L7 17',
  check: 'm5 12 4 4L19 6',
  chevronDown: 'm6 9 6 6 6-6',
  chevronRight: 'm9 5 7 7-7 7',
  external:
    'M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5',
  globe:
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v6m0-10v.1',
  link: 'm10 13 4-4m-6 6-2 2a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0m4 0 2-2a3 3 0 0 1 4 4l-4 4a3 3 0 0 1-4 0',
  moon: 'M20 15.2A9 9 0 0 1 8.8 4 9 9 0 1 0 20 15.2Z',
  play: 'm8 4 12 8-12 8V4Z',
  printer:
    'M7 8V3h10v5M7 17H4a1 1 0 0 1-1-1v-5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v5a1 1 0 0 1-1 1h-3M7 14h10v7H7v-7Zm10-3h1',
  refresh:
    'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2l1 4M4 12l1 4a8 8 0 0 0 13 2',
  settings:
    'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Zm7 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  stop: 'M6 6h12v12H6V6Z',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',
  wifi: 'M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20v.1',
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  color,
  size = 22,
}: {
  name: IconName;
  color: string;
  size?: number;
}) {
  return (
    <Svg
      accessible={false}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <Path
        d={paths[name]}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}
