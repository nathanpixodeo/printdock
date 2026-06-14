import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MMKV } from 'react-native-mmkv';

import { ThemeProvider } from '@/theme';

import '@/translations';

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const testStorage = new MMKV();

function TestAppWrapper({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView>
      <QueryClientProvider client={testQueryClient}>
        <ThemeProvider storage={testStorage}>{children}</ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default TestAppWrapper;
