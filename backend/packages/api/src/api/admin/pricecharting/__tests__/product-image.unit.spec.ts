import { extractPcImageUrl } from '../product-image';

// Pull the card photo out of a PriceCharting offers-page body and normalize its
// size to /240.jpg (the size the ingest step's 240→1600 bump expects). The real
// page carries the product photo first, then marketplace-listing thumbnails —
// first-match must be the product photo, and any pixel size must normalize.
describe('extractPcImageUrl', () => {
  const IMG = (hash: string, size: string) =>
    `https://storage.googleapis.com/images.pricecharting.com/${hash}/${size}.jpg`;

  it('extracts the photo and normalizes the size to 240', () => {
    const html = `<div><img src="${IMG('hpgpcpsd42huitud', '120')}"></div>`;
    expect(extractPcImageUrl(html)).toBe(IMG('hpgpcpsd42huitud', '240'));
  });

  it('leaves an already-240 URL unchanged', () => {
    const html = `<img src="${IMG('abc123', '240')}">`;
    expect(extractPcImageUrl(html)).toBe(IMG('abc123', '240'));
  });

  it('normalizes a 1600 URL down to the 240 hand-off size', () => {
    const html = `<img src="${IMG('abc123', '1600')}">`;
    expect(extractPcImageUrl(html)).toBe(IMG('abc123', '240'));
  });

  it('returns the FIRST (product) photo, not a later listing thumbnail', () => {
    const html = `
      <img id="product-photo" src="${IMG('mainhash', '120')}">
      <div class="offers"><img src="${IMG('listinghash', '120')}"></div>`;
    expect(extractPcImageUrl(html)).toBe(IMG('mainhash', '240'));
  });

  it('handles a hex-style content hash', () => {
    const hash = '7f5a73ae1b86028a880208648facf9697fe87fda82d1fffb73f58a959ff40257';
    const html = `<img src="${IMG(hash, '120')}">`;
    expect(extractPcImageUrl(html)).toBe(IMG(hash, '240'));
  });

  it.each([
    ['no image on the page', '<div>no photo here</div>'],
    ['empty body', ''],
    [
      'a different googleapis bucket',
      '<img src="https://storage.googleapis.com/other-bucket/x/240.jpg">',
    ],
  ])('returns null for %s', (_label, html) => {
    expect(extractPcImageUrl(html)).toBeNull();
  });
});
