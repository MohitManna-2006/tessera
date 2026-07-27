import { assertSafeArchivePath } from "./archive-safety";

const LOCAL_FILE_SIGNATURE = 0x04034b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const UTF8_FLAG = 0x0800;
const DOS_DATE_1980_01_01 = 0x0021;

export type ZipEntry = {
  path: string;
  content: Uint8Array;
};

const CRC_TABLE = Array.from({ length: 256 }, (_, tableIndex) => {
  let value = tableIndex;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function comparePaths(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function crc32(content: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of content) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: readonly Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function createDeterministicZip(entries: readonly ZipEntry[]) {
  const sortedEntries = [...entries].sort((left, right) =>
    comparePaths(left.path, right.path),
  );
  const seenPaths = new Set<string>();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of sortedEntries) {
    assertSafeArchivePath(entry.path);
    if (seenPaths.has(entry.path)) {
      throw new Error("Duplicate ZIP entry.");
    }
    seenPaths.add(entry.path);

    const filename = new TextEncoder().encode(entry.path);
    const checksum = crc32(entry.content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(LOCAL_FILE_SIGNATURE, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(UTF8_FLAG, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(DOS_DATE_1980_01_01, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(entry.content.length, 18);
    localHeader.writeUInt32LE(entry.content.length, 22);
    localHeader.writeUInt16LE(filename.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localPart = concatBytes([localHeader, filename, entry.content]);
    localParts.push(localPart);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(CENTRAL_FILE_SIGNATURE, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(UTF8_FLAG, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(DOS_DATE_1980_01_01, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(entry.content.length, 20);
    centralHeader.writeUInt32LE(entry.content.length, 24);
    centralHeader.writeUInt16LE(filename.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(concatBytes([centralHeader, filename]));

    localOffset += localPart.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_SIGNATURE, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(sortedEntries.length, 8);
  end.writeUInt16LE(sortedEntries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  return concatBytes([...localParts, centralDirectory, end]);
}

export function inspectDeterministicZip(archive: Uint8Array) {
  if (archive.length < 22) {
    throw new Error("ZIP archive is incomplete.");
  }

  const view = Buffer.from(archive);
  const endOffset = archive.length - 22;
  if (view.readUInt32LE(endOffset) !== END_SIGNATURE) {
    throw new Error("ZIP end record is missing.");
  }

  const entryCount = view.readUInt16LE(endOffset + 10);
  const centralSize = view.readUInt32LE(endOffset + 12);
  const centralOffset = view.readUInt32LE(endOffset + 16);
  if (centralOffset + centralSize !== endOffset) {
    throw new Error("ZIP central directory is inconsistent.");
  }

  const entries = new Map<string, Uint8Array>();
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (view.readUInt32LE(cursor) !== CENTRAL_FILE_SIGNATURE) {
      throw new Error("ZIP central entry is invalid.");
    }

    const method = view.readUInt16LE(cursor + 10);
    const checksum = view.readUInt32LE(cursor + 16);
    const compressedSize = view.readUInt32LE(cursor + 20);
    const uncompressedSize = view.readUInt32LE(cursor + 24);
    const nameLength = view.readUInt16LE(cursor + 28);
    const extraLength = view.readUInt16LE(cursor + 30);
    const commentLength = view.readUInt16LE(cursor + 32);
    const localOffset = view.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    const entryPath = view.subarray(nameStart, nameEnd).toString("utf8");

    assertSafeArchivePath(entryPath);
    if (entries.has(entryPath)) {
      throw new Error("ZIP archive contains a duplicate entry.");
    }
    if (method !== 0 || compressedSize !== uncompressedSize) {
      throw new Error("ZIP archive uses an unsupported compression method.");
    }
    if (view.readUInt32LE(localOffset) !== LOCAL_FILE_SIGNATURE) {
      throw new Error("ZIP local entry is invalid.");
    }

    const localNameLength = view.readUInt16LE(localOffset + 26);
    const localExtraLength = view.readUInt16LE(localOffset + 28);
    const localNameStart = localOffset + 30;
    const localNameEnd = localNameStart + localNameLength;
    const localPath = view
      .subarray(localNameStart, localNameEnd)
      .toString("utf8");
    if (localPath !== entryPath) {
      throw new Error("ZIP entry names do not match.");
    }

    const contentStart = localNameEnd + localExtraLength;
    const contentEnd = contentStart + uncompressedSize;
    if (contentEnd > centralOffset) {
      throw new Error("ZIP entry exceeds its data section.");
    }
    const content = new Uint8Array(view.subarray(contentStart, contentEnd));
    if (crc32(content) !== checksum) {
      throw new Error("ZIP entry checksum is invalid.");
    }
    entries.set(entryPath, content);

    cursor = nameEnd + extraLength + commentLength;
  }

  if (cursor !== centralOffset + centralSize) {
    throw new Error("ZIP central directory has trailing data.");
  }

  return entries;
}
