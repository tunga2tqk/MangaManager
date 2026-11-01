#!/usr/bin/env node
/**
 * fix-mojibake.js
 *
 * Sửa lỗi tiếng Việt bị mojibake do từng bị đọc UTF-8 như Windows-1252 rồi ghi lại.
 *
 * Cách chạy:
 *   node scripts/fix-mojibake.js          # chế độ chỉ xem (dry-run)
 *   node scripts/fix-mojibake.js --write  # ghi file thật
 *
 * Chỉ duyệt các thư mục: app, components, styles, constants, utils, hooks,
 * contexts, types, services (các file .ts/.tsx/.js/.jsx).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['app', 'components', 'styles', 'constants', 'utils', 'hooks', 'contexts', 'types', 'services'];
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);

// Ánh xạ ngược Windows-1252 -> byte cho các ký tự in được trong dải 0x80-0x9F.
// Các mã 0x81/0x8D/0x8F/0x90/0x9D không được định nghĩa (round-trip về C1 control,
// có mã < 0x100 nên được xử lý ở nhánh "mã < 0x100").
const CP1252_SPECIAL = new Map([
  [0x20ac, 0x80], // €
  [0x201a, 0x82], // ‚
  [0x0192, 0x83], // ƒ
  [0x201e, 0x84], // „
  [0x2026, 0x85], // …
  [0x2020, 0x86], // †
  [0x2021, 0x87], // ‡
  [0x02c6, 0x88], // ˆ
  [0x2030, 0x89], // ‰
  [0x0160, 0x8a], // Š
  [0x2039, 0x8b], // ‹
  [0x0152, 0x8c], // Œ
  [0x017d, 0x8e], // Ž
  [0x2018, 0x91], // ‘
  [0x2019, 0x92], // ’
  [0x201c, 0x93], // “
  [0x201d, 0x94], // ”
  [0x2022, 0x95], // •
  [0x2013, 0x96], // –
  [0x2014, 0x97], // —
  [0x02dc, 0x98], // ˜
  [0x2122, 0x99], // ™
  [0x0161, 0x9a], // š
  [0x203a, 0x9b], // ›
  [0x0153, 0x9c], // œ
  [0x017e, 0x9e], // ž
  [0x0178, 0x9f], // Ÿ
]);

// Dấu hiệu mojibake còn sót lại: Ã, Ä, Æ, á», áº, â€
const MOJIBAKE_PATTERN = /[\u00c3\u00c4\u00c6]|\u00e1\u00bb|\u00e1\u00ba|\u00e2\u20ac/;

/**
 * Thử đảo lỗi cho một dòng (không kèm ký tự xuống dòng).
 * Trả về chuỗi đã sửa, hoặc null nếu không thể sửa (giữ nguyên dòng).
 */
function tryFixLine(line) {
  const bytes = [];
  for (const ch of line) {
    const code = ch.codePointAt(0);
    if (code < 0x100) {
      bytes.push(code);
    } else if (CP1252_SPECIAL.has(code)) {
      bytes.push(CP1252_SPECIAL.get(code));
    } else {
      // Ký tự ngoài phạm vi (ví dụ chữ Việt đã đúng: ộ, ế, ư, ...) -> bỏ qua dòng.
      return null;
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch (err) {
    // Byte không phải UTF-8 hợp lệ -> giữ nguyên dòng.
    return null;
  }
}

/** Tách văn bản thành các dòng, giữ nguyên ký tự xuống dòng gốc. */
function splitWithEndings(text) {
  const result = [];
  const re = /\r\n|\n|\r/g;
  let lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    result.push({ text: text.slice(lastIndex, match.index), ending: match[0] });
    lastIndex = match.index + match[0].length;
  }
  result.push({ text: text.slice(lastIndex), ending: '' });
  return result;
}

/** Gom các file .ts/.tsx/.js/.jsx trong các thư mục quy định. */
function collectFiles(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, out);
    } else if (entry.isFile() && EXTS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
}

function main() {
  const write = process.argv.includes('--write');
  const verbose = process.argv.includes('--verbose');

  const files = [];
  for (const dir of DIRS) {
    collectFiles(path.join(ROOT, dir), files);
  }
  files.sort();

  let filesWithChanges = 0;
  let totalChangedLines = 0;
  let filesWithSuspicious = 0;
  let totalSuspiciousLines = 0;

  const changes = []; // { file, line, before, after }
  const suspicious = []; // { file, line, text }
  const bomFiles = [];
  const nonUtf8Files = [];

  for (const file of files) {
    const buffer = fs.readFileSync(file);
    const rel = path.relative(ROOT, file);

    // Kiểm tra BOM.
    let body = buffer;
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      body = buffer.subarray(3);
      bomFiles.push(rel);
    }

    // Kiểm tra UTF-8 hợp lệ.
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(body);
    } catch (err) {
      nonUtf8Files.push(rel);
      continue;
    }

    const lines = splitWithEndings(text);
    const fileChanges = [];
    const fileSuspicious = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const original = lines[i].text;
      const fixed = tryFixLine(original);

      if (fixed !== null && fixed !== original) {
        lines[i].text = fixed;
        fileChanges.push({ line: lineNum, before: original, after: fixed });
        changes.push({ file: rel, line: lineNum, before: original, after: fixed });
      } else if (MOJIBAKE_PATTERN.test(original)) {
        fileSuspicious.push({ line: lineNum, text: original });
        suspicious.push({ file: rel, line: lineNum, text: original });
      }
    }

    if (fileChanges.length > 0) {
      filesWithChanges++;
      totalChangedLines += fileChanges.length;
    }
    if (fileSuspicious.length > 0) {
      filesWithSuspicious++;
      totalSuspiciousLines += fileSuspicious.length;
    }

    if (write && fileChanges.length > 0) {
      const output = lines.map((l) => l.text + l.ending).join('');
      // Ghi UTF-8 không BOM (bỏ BOM nếu có).
      fs.writeFileSync(file, Buffer.from(output, 'utf8'));
    }
  }

  // ---- In kết quả ----
  const modeLabel = write ? 'Ghi thật (--write)' : 'Chỉ xem (dry-run)';
  console.log('===== ' + modeLabel + ' =====');

  if (changes.length > 0) {
    console.log('\n--- CÁC DÒNG SẼ SỬA ---');
    const byFile = new Map();
    for (const c of changes) {
      if (!byFile.has(c.file)) byFile.set(c.file, []);
      byFile.get(c.file).push(c);
    }
    for (const [file, list] of byFile) {
      console.log('\n[' + file + ']');
      const shown = verbose ? list : list.slice(0, 3);
      for (const c of shown) {
        console.log('  #' + c.line + ' - ' + c.before);
        console.log('       + ' + c.after);
      }
      if (list.length > 3) {
        console.log('  ... (còn ' + (list.length - 3) + ' dòng nữa)');
      }
    }
  }

  if (suspicious.length > 0) {
    console.log('\n--- NGHI NGỜ (chưa sửa, còn dấu hiệu mojibake) ---');
    const byFile = new Map();
    for (const s of suspicious) {
      if (!byFile.has(s.file)) byFile.set(s.file, []);
      byFile.get(s.file).push(s);
    }
    for (const [file, list] of byFile) {
      console.log('\n[' + file + ']');
      for (const s of list) {
        console.log('  #' + s.line + ' - ' + s.text);
      }
    }
  }

  console.log('\n--- THỐNG KÊ ---');
  console.log('File đã quét: ' + files.length);
  console.log('File có dòng sẽ sửa: ' + filesWithChanges);
  console.log('Tổng dòng sẽ sửa: ' + totalChangedLines);
  console.log('File nghi ngờ: ' + filesWithSuspicious);
  console.log('Tổng dòng nghi ngờ: ' + totalSuspiciousLines);

  if (bomFiles.length > 0) {
    console.log('\n--- CẢNH BÁO: file có BOM (UTF-8 BOM) ---');
    for (const f of bomFiles) console.log('  ' + f);
  }
  if (nonUtf8Files.length > 0) {
    console.log('\n--- CẢNH BÁO: file không phải UTF-8 hợp lệ ---');
    for (const f of nonUtf8Files) console.log('  ' + f);
  }
  if (bomFiles.length === 0 && nonUtf8Files.length === 0) {
    console.log('\nKhông có file BOM hoặc không phải UTF-8.');
  }
}

main();

