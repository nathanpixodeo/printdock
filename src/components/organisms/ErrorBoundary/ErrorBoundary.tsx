import type { ErrorInfo } from 'react';
import type { ErrorBoundaryPropsWithFallback } from 'react-error-boundary';

import { useCallback } from 'react';
import { ErrorBoundary as DefaultErrorBoundary } from 'react-error-boundary';

import { DefaultError } from '@/components/molecules';

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

type Props = Optional<ErrorBoundaryPropsWithFallback, 'fallback'> & {
  onReset?: () => void;
};

function ErrorBoundary({ fallback, onReset, onError, ...props }: Props) {
  const onErrorReport = useCallback(
    (error: Error, info: ErrorInfo) => {
      onError?.(error, info);
    },
    [onError],
  );

  return (
    <DefaultErrorBoundary
      {...props}
      fallback={fallback ?? <DefaultError onReset={onReset} />}
      onError={onErrorReport}
    />
  );
}

export default ErrorBoundary;
