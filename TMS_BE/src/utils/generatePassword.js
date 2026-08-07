import crypto from 'crypto';

const LOWER = 'abcdefghijkmnopqrstuvwxyz';     // omit ambiguous 'l'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';      // omit ambiguous 'I','O'
const DIGITS = '23456789';                     // omit ambiguous '0','1'
const SYMBOLS = '!@#$%&*?';

const pick = (charset) => charset[crypto.randomInt(charset.length)];

/**
 * Generate a random password that contains at least one of each character class.
 * Default length 12. Suitable for one-time delivery via welcome email.
 */
export const generatePassword = (length = 12) => {
  if (length < 8) length = 8;

  const required = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];

  const ALL = LOWER + UPPER + DIGITS + SYMBOLS;
  const remaining = Array.from({ length: length - required.length }, () => pick(ALL));

  // Fisher-Yates shuffle with crypto random.
  const chars = [...required, ...remaining];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

export default generatePassword;
