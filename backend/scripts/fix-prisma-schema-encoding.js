/**
 * Fixes Prisma "This line is invalid" on generator/datasource when schema.prisma
 * was saved as UTF-8 with BOM (common after PowerShell Set-Content -Encoding utf8)
 * or other editors. Rewrites the file as UTF-8 without BOM.
 *
 * Usage (from backend folder): node scripts/fix-prisma-schema-encoding.js
 */
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

let buf = fs.readFileSync(schemaPath);
// UTF-8 BOM
if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
  buf = buf.subarray(3);
  console.log('Removed UTF-8 BOM from schema.prisma');
}
// UTF-16 LE BOM (if someone saved wrong encoding)
if (buf[0] === 0xff && buf[1] === 0xfe) {
  const text = buf.toString('utf16le').replace(/^\uFEFF/, '');
  fs.writeFileSync(schemaPath, text, { encoding: 'utf8' });
  console.log('Converted UTF-16 LE schema.prisma to UTF-8 (no BOM)');
  process.exit(0);
}
// UTF-16 BE BOM
if (buf[0] === 0xfe && buf[1] === 0xff) {
  console.error(
    'schema.prisma appears to be UTF-16 BE. Re-save as UTF-8 in your editor, or open in VS Code and use "Save with Encoding" -> UTF-8.'
  );
  process.exit(1);
}

fs.writeFileSync(schemaPath, buf, { encoding: 'utf8' });
console.log('Wrote schema.prisma as UTF-8 (no BOM). Run: npx prisma generate');
