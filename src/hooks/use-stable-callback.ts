import { useCallback, useEffect, useRef } from 'react';

export function useStableCallback<TArgs extends unknown[], TResult>(
  callback: (...args: TArgs) => TResult
): (...args: TArgs) => TResult {
  const latest = useRef(callback);

  useEffect(() => {
    latest.current = callback;
  });

  return useCallback((...args: TArgs) => latest.current(...args), []);
}
