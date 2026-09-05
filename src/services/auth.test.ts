/**
 * Auth service tests. The Supabase client is mocked — we assert the service
 * validates input, calls the right Supabase method with normalized values, and
 * never leaks provider internals beyond what's necessary.
 */

const mockSignUp = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

// eslint-disable-next-line import/first -- must be imported after jest.mock() above
import { signIn, signOut, signUp } from '@/services/auth';

const authError = (message: string) => ({ name: 'AuthError', message, status: 400 });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('signUp', () => {
  it('rejects a weak password before touching the network', async () => {
    const res = await signUp({ email: 'a@b.co', password: 'short', displayName: 'Sam' });
    expect(res.ok).toBe(false);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('normalizes the email and forwards a sanitized display name', async () => {
    mockSignUp.mockResolvedValue({
      data: { session: { access_token: 't' }, user: { id: 'u1' } },
      error: null,
    });
    const res = await signUp({
      email: '  Alice@Wassup.DAY ',
      password: 'correct-horse-7',
      displayName: '  Ada   Lovelace ',
    });
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'alice@wassup.day',
      password: 'correct-horse-7',
      options: { data: { display_name: 'Ada Lovelace' } },
    });
    expect(res).toEqual({ ok: true });
  });

  it('surfaces "already registered" (no confirmation step to hide behind)', async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: authError('User already registered') });
    const res = await signUp({ email: 'taken@x.com', password: 'correct-horse-7', displayName: 'Sam' });
    expect(res).toEqual({ ok: false, message: 'User already registered' });
  });

  it('wraps unexpected provider errors', async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: authError('Database error saving new user') });
    const res = await signUp({ email: 'a@b.co', password: 'correct-horse-7', displayName: 'Sam' });
    expect(res).toEqual({ ok: false, message: 'Something went wrong. Please try again.' });
  });

  it('fails if Supabase reports no error but also no session', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null });
    const res = await signUp({ email: 'a@b.co', password: 'correct-horse-7', displayName: 'Sam' });
    expect(res.ok).toBe(false);
  });
});

describe('signIn', () => {
  it('keeps the generic "Invalid login credentials" message', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: authError('Invalid login credentials') });
    const res = await signIn({ email: 'a@b.co', password: 'whatever123' });
    expect(res).toEqual({ ok: false, message: 'Invalid login credentials' });
  });

  it('succeeds silently (AuthProvider handles navigation)', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    expect(await signIn({ email: 'a@b.co', password: 'whatever123' })).toEqual({ ok: true });
  });

  it('rejects empty input before touching the network', async () => {
    const res = await signIn({ email: '', password: '' });
    expect(res.ok).toBe(false);
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });
});

describe('signOut', () => {
  it('maps rate-limit errors', async () => {
    mockSignOut.mockResolvedValue({ error: authError('Request rate limit reached') });
    const res = await signOut();
    expect(res).toEqual({ ok: false, message: 'Too many attempts. Wait a minute and try again.' });
  });
});
