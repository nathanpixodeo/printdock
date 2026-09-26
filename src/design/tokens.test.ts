import { darkPalette, lightPalette } from './tokens';

function linearChannel(hexChannel: string): number {
  const channel = Number.parseInt(hexChannel, 16) / 255;
  return channel <= 0.040_45
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string): number {
  const hex = color.replace('#', '');
  return (
    0.2126 * linearChannel(hex.slice(0, 2)) +
    0.7152 * linearChannel(hex.slice(2, 4)) +
    0.0722 * linearChannel(hex.slice(4, 6))
  );
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe.each([
  ['light', lightPalette],
  ['dark', darkPalette],
] as const)('%s semantic palette', (_name, palette) => {
  it.each(['surface', 'background'] as const)(
    'control outline on %s reaches 3:1',
    (background) => {
      expect(
        contrastRatio(palette.controlBorder, palette[background]),
      ).toBeGreaterThanOrEqual(3);
    },
  );
  it.each([
    ['text', 'background'],
    ['text', 'surface'],
    ['muted', 'background'],
    ['muted', 'surface'],
    ['onPrimary', 'primary'],
    ['onHero', 'hero'],
    ['heroMuted', 'hero'],
  ] as const)(
    '%s on %s reaches 4.5:1 for normal text',
    (foreground, background) => {
      expect(
        contrastRatio(palette[foreground], palette[background]),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
});
