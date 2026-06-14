import type { AssetType } from '@/theme/assets/getAssetsContext';

type MockContext = {
  (key: string): unknown;
  keys: () => string[];
  id: string;
  resolve: (id: string) => string;
};

const mockImage = { uri: 'mock-image' };
const mockIcon = { default: () => null };

jest.mock('@/theme/assets/getAssetsContext', () =>
  jest.fn((type: AssetType) => {
    const context: MockContext = ((key: string) => {
      if (type === 'images') {
        return mockImage;
      }
      if (type === 'icons') {
        return mockIcon;
      }
      return key;
    }) as MockContext;

    context.keys = () => {
      if (type === 'images') {
        return ['images/logo.png'];
      }
      if (type === 'icons') {
        return ['icons/send.svg'];
      }
      return [];
    };

    context.id = 'mock-context';
    context.resolve = (id: string) => id;

    return context;
  }),
);
