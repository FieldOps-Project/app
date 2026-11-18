import { act } from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';

import { Button } from '@/design-system/components/button';
import { Input } from '@/design-system/components/input';
import { fail, ok, type Result } from '@/domain/result';
import { LoginScreen } from '@/features/auth/screens/login-screen';
import type { ApiFailure } from '@/infrastructure/api';
import { render, renderedText } from '@/testing/render';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/config/env', () => ({ env: { apiUrl: 'http://api.test', appEnv: 'development' } }));

const mockSignIn = jest.fn();
const mockSession = { sessionExpired: false };

jest.mock('@/application/session/session-context', () => ({
  useSession: () => ({ signIn: mockSignIn, sessionExpired: mockSession.sessionExpired }),
}));

function field(renderer: ReactTestRenderer, label: string) {
  const found = renderer.root.findAllByType(Input).find((input) => input.props.label === label);
  if (found === undefined) {
    throw new Error(`Campo ${label} não encontrado.`);
  }
  return found;
}

function submitButton(renderer: ReactTestRenderer) {
  return renderer.root.findByType(Button);
}

function type(renderer: ReactTestRenderer, label: string, value: string) {
  act(() => {
    field(renderer, label).props.onChangeText(value);
  });
}

async function submit(renderer: ReactTestRenderer) {
  await act(async () => {
    submitButton(renderer).props.onPress();
  });
}

function filled(email = 'tecnico@fieldops.com', password = 'segredo-123') {
  const renderer = render(<LoginScreen />);
  type(renderer, 'E-mail', email);
  type(renderer, 'Senha', password);
  return renderer;
}

function answer(result: Result<void, ApiFailure>) {
  mockSignIn.mockResolvedValue(result);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.sessionExpired = false;
  answer(ok(undefined));
});

describe('LoginScreen', () => {
  it('keeps the button off until both fields hold something', () => {
    const renderer = render(<LoginScreen />);
    expect(submitButton(renderer).props.disabled).toBe(true);

    type(renderer, 'E-mail', 'tecnico@fieldops.com');
    expect(submitButton(renderer).props.disabled).toBe(true);

    type(renderer, 'Senha', 'segredo-123');
    expect(submitButton(renderer).props.disabled).toBe(false);
  });

  it('does not count a blank e-mail as filled', () => {
    const renderer = filled('   ', 'segredo-123');

    expect(submitButton(renderer).props.disabled).toBe(true);
  });

  it('sends the e-mail trimmed and the password exactly as typed', async () => {
    const renderer = filled('  tecnico@fieldops.com  ', ' segredo ');

    await submit(renderer);

    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'tecnico@fieldops.com',
      password: ' segredo ',
    });
  });

  it('says the credentials are wrong without saying which one', async () => {
    answer(fail({ kind: 'unauthorized' }));
    const renderer = filled();

    await submit(renderer);

    expect(renderedText(renderer)).toContain('E-mail ou senha inválidos.');
  });

  it('tells the person to check the internet when the API cannot be reached', async () => {
    answer(fail({ kind: 'network' }));
    const renderer = filled();

    await submit(renderer);

    expect(renderedText(renderer)).toContain('Sem conexão com a API');
  });

  it('shows a server fault in plain words, never a code', async () => {
    answer(fail({ kind: 'server' }));
    const renderer = filled();

    await submit(renderer);

    expect(renderedText(renderer)).toContain('O servidor está com problemas no momento');
  });

  it('clears the previous failure when trying again', async () => {
    answer(fail({ kind: 'unauthorized' }));
    const renderer = filled();
    await submit(renderer);

    answer(ok(undefined));
    await submit(renderer);

    expect(renderedText(renderer)).not.toContain('E-mail ou senha inválidos.');
  });

  it('refuses a second attempt while the first is still running', async () => {
    let finish: (result: Result<void, ApiFailure>) => void = () => undefined;
    mockSignIn.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const renderer = filled();

    await submit(renderer);

    expect(submitButton(renderer).props.disabled).toBe(true);
    expect(submitButton(renderer).props.loading).toBe(true);
    expect(field(renderer, 'E-mail').props.editable).toBe(false);
    await act(async () => finish(ok(undefined)));
    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });

  it('explains why the person was signed out when the session expired', () => {
    mockSession.sessionExpired = true;

    const renderer = render(<LoginScreen />);

    expect(renderedText(renderer)).toContain('Sua sessão expirou');
  });
});
