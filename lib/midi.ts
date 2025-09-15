export function writeMidi(
  notes: {
    id: string;
    tick: number;
    length: number;
    midi: number;
    vel: number;
  }[],
  ppq = 480,
  bpm = 120
) {
  // We'll use a tiny dependency-free midi writer producing a single-track MIDI (format 0) — binary builder.
  // This is a compact implementation suitable for quick exports. For production, use @tonejs/midi.

  function writeUint32BE(n: number) {
    return new Uint8Array([
      (n >> 24) & 0xff,
      (n >> 16) & 0xff,
      (n >> 8) & 0xff,
      n & 0xff,
    ]);
  }
  function writeUint16BE(n: number) {
    return new Uint8Array([(n >> 8) & 0xff, n & 0xff]);
  }

  // header
  const headerChunk = new Uint8Array([
    ...new TextEncoder().encode("MThd"),
    ...writeUint32BE(6),
    ...writeUint16BE(0),
    ...writeUint16BE(1),
    ...writeUint16BE(ppq),
  ]);

  // track events: set tempo, then note on/off sorted by tick
  const events: { tick: number; bytes: number[] }[] = [];
  // tempo meta: set microseconds per quarter
  const mpq = Math.round(60000000 / bpm);
  events.push({
    tick: 0,
    bytes: [
      0x00,
      0xff,
      0x51,
      0x03,
      (mpq >> 16) & 0xff,
      (mpq >> 8) & 0xff,
      mpq & 0xff,
    ],
  });

  notes.forEach((n) => {
    // note on
    events.push({
      tick: n.tick,
      bytes: [0x00, 0x90, n.midi & 0x7f, n.vel & 0x7f],
    });
    // note off
    events.push({
      tick: n.tick + n.length,
      bytes: [0x00, 0x80, n.midi & 0x7f, 0x40],
    });
  });

  // sort by tick
  events.sort((a, b) => a.tick - b.tick);

  // build delta-times and bytes
  let lastTick = 0;
  const outBytes: number[] = [];
  events.forEach((ev) => {
    const delta = ev.tick - lastTick;
    lastTick = ev.tick;
    // write variable length quantity
    let v = delta;
    const vl: number[] = [];
    do {
      vl.unshift(v & 0x7f);
      v = v >> 7;
    } while (v > 0);
    for (let i = 0; i < vl.length; i++) {
      const val = vl[i];
      if (i !== vl.length - 1) outBytes.push(val | 0x80);
      else outBytes.push(val);
    }
    outBytes.push(...ev.bytes.slice(1)); // we already wrote delta; ev.bytes include a leading 0x00 placeholder
  });

  // end of track
  outBytes.push(0x00, 0xff, 0x2f, 0x00);

  const trackChunkHeader = new TextEncoder().encode("MTrk");
  const trackLen = writeUint32BE(outBytes.length);
  const trackChunk = new Uint8Array([
    ...trackChunkHeader,
    ...trackLen,
    ...outBytes,
  ]);

  const full = new Uint8Array([...headerChunk, ...trackChunk]);
  return full;
}
