import { act } from 'react';

import { useStableCallback } from '@/hooks/use-stable-callback';
import { render } from '@/testing/render';

function Probe({ value, onRender }: { value: string; onRender: (callback: () => string) => void }) {
  onRender(useStableCallback(() => value));
  return null;
}

describe('useStableCallback', () => {
  it('keeps the same function across renders and calls the latest closure', () => {
    const seen: (() => string)[] = [];
    const renderer = render(<Probe value="first" onRender={(callback) => seen.push(callback)} />);

    act(() => {
      renderer.update(<Probe value="second" onRender={(callback) => seen.push(callback)} />);
    });

    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]?.()).toBe('second');
  });
});
