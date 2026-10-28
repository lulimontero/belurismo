import test from "node:test";
import assert from "node:assert/strict";
import {
  extractOptionImageCandidates,
  isPublicMediaAddress,
  publicMediaUrl,
  readOptionHtmlPrefix,
  resolveOptionImage,
} from "../lib/turi/option-media";

test("media rejects local, special-use and IP-encoded SSRF destinations", async () => {
  const denied = [
    "http://hotel.com/photo.jpg", "file:///etc/passwd", "data:image/png;base64,x",
    "https://user:pass@hotel.com/", "https://@hotel.com/", "https://hotel.com:444/",
    "https://localhost/", "https://service.internal/", "https://printer.local/",
    "https://127.1/", "https://2130706433/", "https://0x7f000001/", "https://%31%32%37.0.0.1/",
    "https://[::1]/", "https://[::ffff:127.0.0.1]/", "https://169.254.169.254/latest/meta-data/",
    "https://100.64.0.1/", "https://192.168.1.1/", "https://192.0.2.1/", "https://224.0.0.1/",
    "https://[fc00::1]/", "https://[fe80::1]/", "https://[2001:db8::1]/", "https://[2002:7f00:1::]/",
  ];
  for (const value of denied) {
    assert.equal(publicMediaUrl(value), undefined, value);
    assert.equal(await resolveOptionImage(value), undefined, value);
  }
  assert.equal(publicMediaUrl("https://hotel.com:443/stay#gallery")?.href, "https://hotel.com/stay");
  assert.equal(publicMediaUrl("//cdn.hotel.com/photo.jpg", "https://hotel.com/stay")?.href, "https://cdn.hotel.com/photo.jpg");
});

test("media address checks cover private ranges and IPv6 global-only policy", () => {
  for (const address of [
    "0.0.0.0", "10.1.2.3", "127.0.0.1", "100.127.255.254", "169.254.2.1",
    "172.16.0.1", "172.31.255.255", "192.0.0.9", "192.88.99.1", "192.168.0.1",
    "198.18.1.1", "198.19.2.3", "198.51.100.1", "203.0.113.1", "240.0.0.1", "255.255.255.255",
    "::", "::1", "::ffff:0808:0808", "64:ff9b::808:808", "2001::1", "2001:20::1", "3fff:0123::1", "ff02::1",
  ]) assert.equal(isPublicMediaAddress(address), false, address);
  for (const address of ["8.8.8.8", "1.1.1.1", "100.128.0.1", "172.32.0.1", "2001:4860:4860::8888", "2606:4700:4700::1111"])
    assert.equal(isPublicMediaAddress(address), true, address);
});

test("option images preserve source metadata, relative URLs and real alt text", () => {
  const html = `<!doctype html><head>
    <META content='/hotel/terrace.jpg?size=large&amp;quality=80' property='og:image'>
    <meta property="og:image:alt" content="Terraza &amp; vista al mar">
    <meta name="twitter:image" content="https://cdn.hotel.com/room.jpg">
  </head>`;
  assert.deepEqual(extractOptionImageCandidates(html, "https://hotel.com/florianopolis/stay"), [
    { url: "https://hotel.com/hotel/terrace.jpg?size=large&quality=80", alt: "Terraza & vista al mar" },
    { url: "https://cdn.hotel.com/room.jpg", alt: undefined },
  ]);
});

test("JSON-LD hotel photos are usable while publisher logos and invalid blocks are ignored", () => {
  const html = `<script type="application/ld+json">{invalid}</script>
    <script type="application/ld+json">${JSON.stringify({
      "@graph": [{ "@type": "Hotel", image: [{ "@type": "ImageObject", contentUrl: "/gallery/pool.webp", caption: "Pileta del hotel" }, "/gallery/room.jpg"],
        publisher: { image: "https://publisher.com/brand.jpg" } }],
    })}</script>`;
  assert.deepEqual(extractOptionImageCandidates(html, "https://hotel.com/stay"), [
    { url: "https://hotel.com/gallery/pool.webp", alt: "Pileta del hotel" },
    { url: "https://hotel.com/gallery/room.jpg", alt: undefined },
  ]);
});

test("missing photos stay missing; metadata never turns logos, pixels or private URLs into a photo", () => {
  const candidates = [
    "https://cdn.hotel.com/logo-hotel.png", "https://cdn.hotel.com/assets/photo.svg",
    "https://cdn.hotel.com/pixel.gif", "https://cdn.hotel.com/image?w=1&h=1",
    "https://cdn.hotel.com/image?format=svg", "https://127.0.0.1/photo.jpg",
    "data:image/jpeg;base64,invalid", "javascript:alert(1)",
  ];
  for (const url of candidates) {
    assert.deepEqual(extractOptionImageCandidates(`<meta property="og:image" content="${url}">`, "https://hotel.com/stay"), [], url);
  }
  assert.deepEqual(extractOptionImageCandidates("<img src='/unrelated-banner.jpg'><h1>Hotel</h1>", "https://hotel.com/stay"), []);
});

test("Maps sources are rejected before lookup and static maps never become property photos", async () => {
  for (const source of [
    "https://www.google.com/maps/search/?api=1&query=Hotel+Florianopolis",
    "https://google.com.ar/maps/place/Hotel",
    "https://maps.google.com/maps?query=hotel",
    "https://maps.app.goo.gl/abc123",
  ]) {
    // The synchronous guard also proves these sources cannot reach readPage/DNS.
    assert.equal(publicMediaUrl(source), undefined);
    assert.equal(await resolveOptionImage(source), undefined);
    assert.deepEqual(extractOptionImageCandidates('<meta property="og:image" content="https://hotel.com/photo.jpg">', source), []);
  }
  for (const image of [
    "https://maps.google.com/maps/api/staticmap?center=Rio&zoom=10",
    "https://maps.googleapis.com/maps/api/staticmap?center=Rio&zoom=10",
    "https://cdn.hotel.com/images/map.jpg", "https://cdn.hotel.com/static-map/location.png",
    "https://cdn.hotel.com/render?maptype=roadmap&center=Rio",
  ]) {
    assert.deepEqual(extractOptionImageCandidates(`<meta property="og:image" content="${image}">`, "https://hotel.com/stay"), [], image);
  }
  // Hotel names that happen to contain 'map' are not map resources.
  assert.equal(extractOptionImageCandidates('<meta property="og:image" content="/gallery/maputo-hotel.jpg">', "https://hotel.com/stay")[0]?.url,
    "https://hotel.com/gallery/maputo-hotel.jpg");
});

test("explicit image_src links and JSON-LD thumbnails provide real source photos", () => {
  const html = `<link rel="image_src" href="/gallery/room.jpg">
    <link rel="icon" href="/brand.jpg">
    <script type="application/ld+json">{"@type":"Hotel","thumbnailUrl":"/gallery/pool.jpg"}</script>`;
  assert.deepEqual(extractOptionImageCandidates(html, "https://hotel.com/stay"), [
    { url: "https://hotel.com/gallery/room.jpg", alt: undefined },
    { url: "https://hotel.com/gallery/pool.jpg", alt: undefined },
  ]);
});

test("large hotel pages stop reading after the metadata head, even across network chunks", async () => {
  let readBody = false;
  async function* page() {
    yield Buffer.from('<html><head><meta property="og:image" content="/hotel.jpg"></he');
    yield Buffer.from("ad><body>");
    readBody = true;
    yield Buffer.alloc(2 * 1024 * 1024, "x");
  }
  const prefix = await readOptionHtmlPrefix(page());
  assert.equal(readBody, false);
  assert.equal(extractOptionImageCandidates(prefix, "https://hotel.com/stay")[0]?.url, "https://hotel.com/hotel.jpg");
});

test("unclosed HTML stays bounded and still uses valid metadata in the prefix", async () => {
  let readBeyondLimit = false;
  async function* page() {
    yield Buffer.from('<meta property="og:image" content="/hotel.jpg">');
    yield Buffer.alloc(1024 * 1024, "x");
    readBeyondLimit = true;
    yield Buffer.from('<meta property="og:image" content="/unread.jpg">');
  }
  const prefix = await readOptionHtmlPrefix(page());
  assert.equal(Buffer.byteLength(prefix), 600 * 1024);
  assert.equal(readBeyondLimit, false);
  assert.equal(extractOptionImageCandidates(prefix, "https://hotel.com/stay")[0]?.url, "https://hotel.com/hotel.jpg");
  assert.deepEqual(extractOptionImageCandidates("<html><head>No metadata", "https://hotel.com/stay"), []);
});
