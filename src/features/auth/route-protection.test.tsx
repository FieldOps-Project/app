import { createElement, type ReactNode } from 'react';

import ProtectedLayout from '@/app/(protected)/_layout';
import PublicLayout from '@/app/(public)/_layout';
import { render, renderedText } from '@/testing/render';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const mockSession: { current: { session: object | null; isRestoring: boolean } } = {
  current: { session: null, isRestoring: false },
};

jest.mock('@/application/session/session-context', () => ({
  useSession: () => mockSession.current,
}));
jest.mock('expo-router', () => {
  const { createElement: element } = jest.requireActual<typeof import('react')>('react');
  function Stack({ children }: { children?: ReactNode }) {
    return element('Stack', null, children);
  }
  Stack.Screen = function Screen() {
    return null;
  };
  function Redirect({ href }: { href: string }) {
    return element('Redirect', { href });
  }
  return { Stack, Redirect };
});

const SIGNED_IN = { session: { user: { id: 'u-1' } }, isRestoring: false };
const SIGNED_OUT = { session: null, isRestoring: false };
const RESTORING = { session: null, isRestoring: true };

function outcomeOf(element: React.ReactElement): { redirect: string | null; stack: boolean } {
  const renderer = render(element);
  const redirect = renderer.root.findAllByType('Redirect' as never)[0];
  return {
    redirect: redirect === undefined ? null : (redirect.props as { href: string }).href,
    stack: renderer.root.findAllByType('Stack' as never).length > 0,
  };
}

describe('protected routes', () => {
  it('sends a visitor without a session to the login', () => {
    mockSession.current = SIGNED_OUT;

    expect(outcomeOf(createElement(ProtectedLayout))).toEqual({ redirect: '/login', stack: false });
  });

  it('opens the screens for a valid session', () => {
    mockSession.current = SIGNED_IN;

    expect(outcomeOf(createElement(ProtectedLayout))).toEqual({ redirect: null, stack: true });
  });

  it('waits for the stored session before deciding, never flashing the login', () => {
    mockSession.current = RESTORING;
    const renderer = render(createElement(ProtectedLayout));

    expect(renderedText(renderer)).toContain('Carregando sessão');
    expect(renderer.root.findAllByType('Redirect' as never)).toHaveLength(0);
    expect(renderer.root.findAllByType('Stack' as never)).toHaveLength(0);
  });
});

describe('public routes', () => {
  it('sends a signed-in person away from the login', () => {
    mockSession.current = SIGNED_IN;

    expect(outcomeOf(createElement(PublicLayout))).toEqual({ redirect: '/', stack: false });
  });

  it('shows the login to a visitor', () => {
    mockSession.current = SIGNED_OUT;

    expect(outcomeOf(createElement(PublicLayout))).toEqual({ redirect: null, stack: true });
  });

  it('waits for the stored session before deciding', () => {
    mockSession.current = RESTORING;
    const renderer = render(createElement(PublicLayout));

    expect(renderedText(renderer)).toContain('Carregando sessão');
    expect(renderer.root.findAllByType('Redirect' as never)).toHaveLength(0);
  });
});
