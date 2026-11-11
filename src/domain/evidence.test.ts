import {
  checkPhoto,
  EVIDENCE_DESCRIPTION_MAX,
  fitWithin,
  normalizeDescription,
  PHOTO_MAX_BYTES,
} from '@/domain/evidence';

describe('checkPhoto (RN-046)', () => {
  it('accepts a JPEG within the size limit', () => {
    expect(checkPhoto('image/jpeg', 350_000)).toBeNull();
  });

  it('refuses a format the server does not take', () => {
    expect(checkPhoto('image/heic', 350_000)).toBe('UNSUPPORTED_TYPE');
  });

  it('refuses a file above the limit', () => {
    expect(checkPhoto('image/jpeg', PHOTO_MAX_BYTES + 1)).toBe('TOO_LARGE');
  });

  it('refuses an empty or unreadable file', () => {
    expect(checkPhoto('image/jpeg', 0)).toBe('EMPTY');
    expect(checkPhoto('image/jpeg', null)).toBe('EMPTY');
  });
});

describe('fitWithin', () => {
  it('bounds the width of a landscape photo', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600 });
  });

  it('bounds the height of a portrait photo', () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ height: 1600 });
  });

  it('never enlarges a photo that already fits', () => {
    expect(fitWithin(1200, 900, 1600)).toBeNull();
  });
});

describe('normalizeDescription', () => {
  it('treats blank text as no description', () => {
    expect(normalizeDescription('   ')).toBeNull();
  });

  it('trims and caps the text', () => {
    expect(normalizeDescription('  Trinca na base  ')).toBe('Trinca na base');
    expect(normalizeDescription('x'.repeat(EVIDENCE_DESCRIPTION_MAX + 50))).toHaveLength(
      EVIDENCE_DESCRIPTION_MAX
    );
  });
});
