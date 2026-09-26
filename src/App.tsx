import 'react-native-gesture-handler';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider } from '@/theme';
import { storage } from '@/hooks/language/storage';
import ApplicationNavigator from '@/navigation/Application';

import { ErrorBoundary } from '@/components/organisms';

import '@/translations';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

export { storage };

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider storage={storage}>
          <ErrorBoundary>
            <ApplicationNavigator />
          </ErrorBoundary>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default App;
