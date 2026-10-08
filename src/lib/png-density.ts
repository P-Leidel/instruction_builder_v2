/** Set print density on a native canvas PNG without re-encoding its pixels. */
export async function setPngDensity(png: Blob, dpi: 150 | 300): Promise<Blob> {
  const bytes = new Uint8Array(await png.arrayBuffer()), view = new DataView(bytes.buffer);
  const malformed = () => { throw new Error("Invalid canvas PNG"); };
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 45 || !signature.every((value, index) => bytes[index] === value)
    || view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) malformed();

  // W3C PNG: one pHYs before IDAT, uint32 pixels/metre on both axes, unit 1.
  // One inch is 0.0254 metres; the integer field needs nearest-unit rounding.
  const density = new Uint8Array(21), fields = new DataView(density.buffer);
  fields.setUint32(0, 9); fields.setUint32(4, 0x70485973);
  const pixelsPerMetre = Math.round(dpi / 0.0254);
  fields.setUint32(8, pixelsPerMetre); fields.setUint32(12, pixelsPerMetre); density[16] = 1;
  // CRC covers chunk type and data only, with the PNG CRC-32 polynomial.
  let crc = 0xffffffff;
  for (const byte of density.subarray(4, 17)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  fields.setUint32(17, (crc ^ 0xffffffff) >>> 0);

  const parts: BlobPart[] = [png.slice(0, 33), density];
  let start = 33, offset = 33, hasImageData = false, hasEnd = false;
  // Walk native chunk boundaries solely to remove pre-existing pHYs chunks.
  // Bounds checks prevent truncated/native encoding failures yielding a file.
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) malformed();
    const length = view.getUint32(offset), end = offset + length + 12;
    if (length > 0x7fffffff || end > bytes.length) malformed();
    const type = view.getUint32(offset + 4);
    if (type === 0x70485973) { parts.push(png.slice(start, offset)); start = end; }
    if (type === 0x49444154) hasImageData = true;
    if (type === 0x49454e44) {
      if (length !== 0 || end !== bytes.length) malformed();
      hasEnd = true;
    }
    offset = end;
  }
  if (!hasImageData || !hasEnd) malformed();
  parts.push(png.slice(start));
  return new Blob(parts, { type: "image/png" });
}
