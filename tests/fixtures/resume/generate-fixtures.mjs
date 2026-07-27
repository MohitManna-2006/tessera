import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDirectory = dirname(fileURLToPath(import.meta.url));
const binary = (value) =>
  Buffer.isBuffer(value) ? value : Buffer.from(value, "binary");

function escapePdfText(value) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function textStream(lines) {
  const commands = ["BT", "/F1 12 Tf", "72 720 Td"];
  for (const [index, line] of lines.entries()) {
    if (index > 0) {
      commands.push("0 -19 Td");
    }
    commands.push(`(${escapePdfText(line)}) Tj`);
  }
  commands.push("ET");
  return binary(`${commands.join("\n")}\n`);
}

function rc4(key, input) {
  const state = Array.from({ length: 256 }, (_, index) => index);
  let swapIndex = 0;
  for (let index = 0; index < 256; index += 1) {
    swapIndex = (swapIndex + state[index] + key[index % key.length]) & 255;
    [state[index], state[swapIndex]] = [state[swapIndex], state[index]];
  }

  const output = Buffer.alloc(input.length);
  let first = 0;
  let second = 0;
  for (let index = 0; index < input.length; index += 1) {
    first = (first + 1) & 255;
    second = (second + state[first]) & 255;
    [state[first], state[second]] = [state[second], state[first]];
    output[index] = input[index] ^ state[(state[first] + state[second]) & 255];
  }
  return output;
}

const passwordPadding = Buffer.from(
  "28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a",
  "hex",
);

function paddedPassword(password) {
  return Buffer.concat([
    Buffer.from(password, "binary"),
    passwordPadding,
  ]).subarray(0, 32);
}

function createEncryption(userPassword, ownerPassword, documentId) {
  const ownerKey = createHash("md5")
    .update(paddedPassword(ownerPassword))
    .digest()
    .subarray(0, 5);
  const ownerEntry = rc4(ownerKey, paddedPassword(userPassword));
  const permissions = Buffer.alloc(4);
  permissions.writeInt32LE(-4);
  const encryptionKey = createHash("md5")
    .update(
      Buffer.concat([
        paddedPassword(userPassword),
        ownerEntry,
        permissions,
        documentId,
      ]),
    )
    .digest()
    .subarray(0, 5);
  const userEntry = rc4(encryptionKey, passwordPadding);

  return { encryptionKey, ownerEntry, userEntry };
}

function objectEncryptionKey(encryptionKey, objectNumber) {
  const objectBytes = Buffer.alloc(5);
  objectBytes.writeUIntLE(objectNumber, 0, 3);
  objectBytes.writeUIntLE(0, 3, 2);
  return createHash("md5")
    .update(Buffer.concat([encryptionKey, objectBytes]))
    .digest()
    .subarray(0, 10);
}

function createPdf({ pages, imageOnly = false, encryption }) {
  const objects = new Map();
  const pageObjectNumbers = pages.map((_, index) => 4 + index);
  const firstContentObject = 4 + pages.length;
  const imageObjectNumber = imageOnly
    ? firstContentObject + pages.length
    : null;
  const encryptObjectNumber = encryption
    ? firstContentObject + pages.length + (imageOnly ? 1 : 0)
    : null;
  const documentId = createHash("md5")
    .update("Tessera synthetic PDF fixture")
    .digest();
  const security = encryption
    ? createEncryption(encryption.user, encryption.owner, documentId)
    : null;

  objects.set(1, binary("<< /Type /Catalog /Pages 2 0 R >>"));
  objects.set(
    2,
    binary(
      `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers
        .map((number) => `${number} 0 R`)
        .join(" ")}] >>`,
    ),
  );
  objects.set(
    3,
    binary("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
  );

  pages.forEach((lines, index) => {
    const pageObjectNumber = pageObjectNumbers[index];
    const contentObjectNumber = firstContentObject + index;
    const resources = imageOnly
      ? `<< /XObject << /Im1 ${imageObjectNumber} 0 R >> >>`
      : "<< /Font << /F1 3 0 R >> >>";
    objects.set(
      pageObjectNumber,
      binary(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources ${resources} /Contents ${contentObjectNumber} 0 R >>`,
      ),
    );

    const plainStream = imageOnly
      ? binary("q\n120 0 0 120 72 600 cm\n/Im1 Do\nQ\n")
      : textStream(lines);
    const stream =
      security === null
        ? plainStream
        : rc4(
            objectEncryptionKey(security.encryptionKey, contentObjectNumber),
            plainStream,
          );
    objects.set(
      contentObjectNumber,
      Buffer.concat([
        binary(`<< /Length ${stream.length} >>\nstream\n`),
        stream,
        binary("\nendstream"),
      ]),
    );
  });

  if (imageObjectNumber) {
    const pixel = Buffer.from([47, 90, 72]);
    objects.set(
      imageObjectNumber,
      Buffer.concat([
        binary(
          `<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${pixel.length} >>\nstream\n`,
        ),
        pixel,
        binary("\nendstream"),
      ]),
    );
  }

  if (encryptObjectNumber && security) {
    objects.set(
      encryptObjectNumber,
      binary(
        `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${security.ownerEntry.toString(
          "hex",
        )}> /U <${security.userEntry.toString("hex")}> /P -4 >>`,
      ),
    );
  }

  const chunks = [binary("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  const offsets = [0];
  for (const [objectNumber, body] of objects) {
    offsets[objectNumber] = chunks.reduce(
      (total, chunk) => total + chunk.length,
      0,
    );
    chunks.push(binary(`${objectNumber} 0 obj\n`), body, binary("\nendobj\n"));
  }

  const xrefOffset = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const size = Math.max(...objects.keys()) + 1;
  chunks.push(binary(`xref\n0 ${size}\n`));
  chunks.push(binary("0000000000 65535 f \n"));
  for (let objectNumber = 1; objectNumber < size; objectNumber += 1) {
    chunks.push(
      binary(`${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`),
    );
  }

  const encryptionTrailer = encryptObjectNumber
    ? ` /Encrypt ${encryptObjectNumber} 0 R /ID [<${documentId.toString(
        "hex",
      )}><${documentId.toString("hex")}>]`
    : "";
  chunks.push(
    binary(
      `trailer\n<< /Size ${size} /Root 1 0 R${encryptionTrailer} >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    ),
  );
  return Buffer.concat(chunks);
}

const validLines = [
  "FICTIONAL RESUME",
  "Candidate: Test Persona",
  "Summary: Builds deterministic software systems for imaginary products.",
  "Skills: TypeScript, React, Node.js, testing, accessibility.",
  "Experience: Created reliable tools and documented repeatable workflows.",
  "Education: Example Technical Institute, 2026.",
];

const validPdf = createPdf({ pages: [validLines] });
const multiPagePdf = createPdf({
  pages: [
    validLines.slice(0, 3),
    [
      "FICTIONAL EXPERIENCE CONTINUED",
      ...validLines.slice(3),
      "References: Available for this synthetic test document.",
    ],
  ],
});
const longTextPdf = createPdf({
  pages: [
    [
      "FICTIONAL LONG RESUME",
      ...Array.from(
        { length: 24 },
        (_, index) =>
          `Synthetic entry ${index + 1}: Built deterministic tools, tested accessible interfaces, and documented imaginary workflows.`,
      ),
    ],
  ],
});

await mkdir(fixtureDirectory, { recursive: true });
await Promise.all([
  writeFile(join(fixtureDirectory, "valid-resume.pdf"), validPdf),
  writeFile(join(fixtureDirectory, "multi-page-resume.pdf"), multiPagePdf),
  writeFile(join(fixtureDirectory, "long-text-resume.pdf"), longTextPdf),
  writeFile(
    join(fixtureDirectory, "symbols-only-resume.pdf"),
    createPdf({ pages: [["Page 1", "---", "2", "***"]] }),
  ),
  writeFile(
    join(fixtureDirectory, "blank-resume.pdf"),
    createPdf({ pages: [[]] }),
  ),
  writeFile(
    join(fixtureDirectory, "image-only-resume.pdf"),
    createPdf({ pages: [[]], imageOnly: true }),
  ),
  writeFile(
    join(fixtureDirectory, "encrypted-resume.pdf"),
    createPdf({
      pages: [validLines],
      encryption: { user: "locked", owner: "fixture-owner" },
    }),
  ),
  writeFile(
    join(fixtureDirectory, "corrupted-resume.pdf"),
    binary("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntruncated"),
  ),
  writeFile(
    join(fixtureDirectory, "renamed-text.pdf"),
    binary("This is plain text and not a PDF document."),
  ),
  writeFile(join(fixtureDirectory, "empty-resume.pdf"), Buffer.alloc(0)),
]);
