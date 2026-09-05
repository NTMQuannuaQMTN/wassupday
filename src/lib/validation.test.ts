import {
  normalizeEmail,
  sanitizeDisplayName,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from '@/lib/validation';

describe('validation', () => {
  describe('normalizeEmail', () => {
    it('trims and lowercases', () => {
      expect(normalizeEmail('  Alice@Wassup.Day \n')).toBe('alice@wassup.day');
    });
  });

  describe('validateEmail', () => {
    it.each(['a@b.co', 'first.last@sub.example.com', 'x+tag@gmail.com'])('accepts %s', (e) => {
      expect(validateEmail(e).ok).toBe(true);
    });

    it.each([
      '',
      'no-at-sign',
      'two@@at.com',
      'space in@email.com',
      'trailing@dot.',
      'nodot@example',
      `has${String.fromCharCode(0)}null@x.com`,
      `${'a'.repeat(300)}@x.com`,
    ])('rejects %j', (e) => {
      expect(validateEmail(e).ok).toBe(false);
    });

    it('rejects a newline-injection attempt in the local part', () => {
      expect(validateEmail('victim@x.com\nBcc: attacker@evil.com').ok).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('accepts a 10+ char password with a letter and a number', () => {
      expect(validatePassword('correct-horse-7').ok).toBe(true);
    });

    it('rejects short passwords', () => {
      expect(validatePassword('ab1').ok).toBe(false);
    });

    it('rejects letters-only or digits-only', () => {
      expect(validatePassword('abcdefghijkl').ok).toBe(false);
      expect(validatePassword('1234567890123').ok).toBe(false);
    });

    it('rejects control characters', () => {
      expect(validatePassword(`abcdef123${String.fromCharCode(9)}`).ok).toBe(false);
    });

    it('rejects passwords longer than 72 bytes (bcrypt truncation)', () => {
      expect(validatePassword('a1' + 'x'.repeat(80)).ok).toBe(false);
    });

    it('counts bytes, not code points, for the max', () => {
      // 24 emoji * 4 bytes = 96 bytes > 72, even though length is < 72.
      expect(validatePassword('ab1' + '😀'.repeat(24)).ok).toBe(false);
    });
  });

  describe('sanitizeDisplayName', () => {
    it('trims, collapses whitespace and strips control chars', () => {
      expect(sanitizeDisplayName('  Ada   Lovelace\t\n')).toBe('Ada Lovelace');
      expect(sanitizeDisplayName(`Ev${String.fromCharCode(0)}il`)).toBe('Evil');
    });

    it('caps length at 60', () => {
      expect(sanitizeDisplayName('n'.repeat(200))).toHaveLength(60);
    });

    it('validateDisplayName rejects whitespace-only input', () => {
      expect(validateDisplayName('   ').ok).toBe(false);
      expect(validateDisplayName('Sam').ok).toBe(true);
    });
  });
});
