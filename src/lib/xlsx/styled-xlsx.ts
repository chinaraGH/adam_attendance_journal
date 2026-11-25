/**
 * Небольшой генератор оформленных .xlsx без внешних библиотек.
 * Нужен, потому что бесплатная версия библиотеки xlsx не умеет цвета, рамки и объединённые ячейки в заголовках.
 *
 * Работает и в браузере, и в Node: на выходе Uint8Array с готовым файлом (zip без сжатия, это допустимо для xlsx).
 * Один лист, закреплённые заголовки, ширина колонок, альбомная печать «по ширине страницы».
 */

export type StyleKey =
  | "title"
  | "subtitle"
  | "head"
  | "name"
  | "num"
  | "int"
  | "pct"
  | "dash"
  | "status"
  | "total"
  | "avgName"
  | "avg"
  | "legend";

export type XCell = { v: string | number | null; s: StyleKey };

export type XSheet = {
  /** Название листа (до 31 символа). */
  name: string;
  cells: XCell[][];
  /** Объединения: [строка1, колонка1, строка2, колонка2], нумерация с 0, границы включительно. */
  merges?: [number, number, number, number][];
  /** Ширина колонок в символах. */
  colWidths: number[];
  /** Сколько верхних строк и левых колонок закрепить. */
  freeze?: { rows: number; cols: number };
  /** Высота строк в пунктах: индекс строки (с 0) → высота. */
  rowHeights?: Record<number, number>;
};

type StyleSpec = {
  bold?: boolean;
  italic?: boolean;
  size?: number;
  color?: string; // RRGGBB
  fill?: string; // RRGGBB (в таблицах итогов не используется: при печати заливки дают «грязь»)
  border?: boolean;
  h?: "left" | "center" | "right";
  v?: "center" | "top";
  wrap?: boolean;
  /** Отступ от края в «уровнях» Excel (для выравнивания по правому полю с отступом). */
  indent?: number;
  /** Встроенный номер формата (2 = «0,00», 1 = «0») или свой код формата. */
  numFmt?: string | number;
};

const INK = "000000";

// Без заливок и цветов: таблицы печатаются на чёрно-белом принтере.
const STYLES: Record<StyleKey, StyleSpec> = {
  title: { bold: true, size: 14, color: INK, h: "center", v: "center" },
  subtitle: { size: 11, color: INK, h: "center", v: "center" },
  head: { bold: true, color: INK, border: true, h: "center", v: "top", wrap: true },
  name: { color: INK, border: true, h: "left", v: "center" },
  num: { color: INK, border: true, h: "right", v: "center", indent: 2, numFmt: 2 },
  int: { color: INK, border: true, h: "right", v: "center", indent: 2, numFmt: 1 },
  pct: { color: INK, border: true, h: "right", v: "center", indent: 2, numFmt: '0.00"%"' },
  dash: { color: INK, border: true, h: "right", v: "center", indent: 2 },
  status: { color: INK, border: true, h: "center", v: "center" },
  total: { bold: true, color: INK, border: true, h: "right", v: "center", indent: 2, numFmt: 2 },
  avgName: { bold: true, color: INK, border: true, h: "left", v: "center" },
  avg: { bold: true, color: INK, border: true, h: "right", v: "center", indent: 2, numFmt: 2 },
  legend: { italic: true, size: 9, color: INK, h: "left", v: "top", wrap: true },
};

const STYLE_KEYS = Object.keys(STYLES) as StyleKey[];

// ---------- XML ----------

const esc = (t: string) =>
  t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // запрещённые в XML управляющие символы
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

function colName(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function stylesXml(): string {
  const fonts: string[] = [];
  const fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const numFmts: string[] = [];
  const fontIndex = new Map<string, number>();
  const fillIndex = new Map<string, number>();
  const fmtIndex = new Map<string, number>();

  const fontId = (sp: StyleSpec) => {
    const xml =
      "<font>" +
      (sp.bold ? "<b/>" : "") +
      (sp.italic ? "<i/>" : "") +
      `<sz val="${sp.size ?? 11}"/><color rgb="FF${sp.color ?? INK}"/><name val="Calibri"/><family val="2"/></font>`;
    if (!fontIndex.has(xml)) {
      fontIndex.set(xml, fonts.length);
      fonts.push(xml);
    }
    return fontIndex.get(xml)!;
  };
  const fillId = (sp: StyleSpec) => {
    if (!sp.fill) return 0;
    const xml = `<fill><patternFill patternType="solid"><fgColor rgb="FF${sp.fill}"/><bgColor indexed="64"/></patternFill></fill>`;
    if (!fillIndex.has(xml)) {
      fillIndex.set(xml, fills.length);
      fills.push(xml);
    }
    return fillIndex.get(xml)!;
  };
  const fmtId = (sp: StyleSpec) => {
    if (!sp.numFmt) return 0;
    if (typeof sp.numFmt === "number") return sp.numFmt;
    if (!fmtIndex.has(sp.numFmt)) {
      const id = 164 + fmtIndex.size;
      fmtIndex.set(sp.numFmt, id);
      numFmts.push(`<numFmt numFmtId="${id}" formatCode="${esc(sp.numFmt)}"/>`);
    }
    return fmtIndex.get(sp.numFmt)!;
  };

  fonts.push(`<font><sz val="11"/><color rgb="FF${INK}"/><name val="Calibri"/><family val="2"/></font>`);
  fontIndex.set(fonts[0], 0);

  const line = '<color rgb="FF000000"/>';
  const borders = [
    "<border><left/><right/><top/><bottom/><diagonal/></border>",
    `<border><left style="thin">${line}</left><right style="thin">${line}</right><top style="thin">${line}</top><bottom style="thin">${line}</bottom><diagonal/></border>`,
  ];

  const xfs = STYLE_KEYS.map((k) => {
    const sp = STYLES[k];
    const nf = fmtId(sp);
    const align = `<alignment horizontal="${sp.h ?? "left"}" vertical="${sp.v ?? "center"}"${sp.wrap ? ' wrapText="1"' : ""}${sp.indent ? ` indent="${sp.indent}"` : ""}/>`;
    return `<xf numFmtId="${nf}" fontId="${fontId(sp)}" fillId="${fillId(sp)}" borderId="${sp.border ? 1 : 0}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${nf ? ' applyNumberFormat="1"' : ""}>${align}</xf>`;
  });

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    (numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.join("")}</numFmts>` : "") +
    `<fonts count="${fonts.length}">${fonts.join("")}</fonts>` +
    `<fills count="${fills.length}">${fills.join("")}</fills>` +
    `<borders count="${borders.length}">${borders.join("")}</borders>` +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>"
  );
}

function sheetXml(sheet: XSheet): string {
  const styleIdx = new Map(STYLE_KEYS.map((k, i) => [k, i]));
  const rows = sheet.cells.map((r) => r.slice());
  const width = Math.max(1, ...rows.map((r) => r.length), sheet.colWidths.length);

  // Ячейки внутри объединений получают стиль левой верхней, чтобы рамки и заливка были сплошными.
  for (const [r1, c1, r2, c2] of sheet.merges ?? []) {
    const head = rows[r1]?.[c1];
    if (!head) continue;
    for (let r = r1; r <= r2; r++) {
      rows[r] = rows[r] ?? [];
      for (let c = c1; c <= c2; c++) {
        if (r === r1 && c === c1) continue;
        rows[r][c] = { v: null, s: head.s };
      }
    }
  }

  const freeze = sheet.freeze ?? { rows: 0, cols: 0 };
  let pane = "";
  if (freeze.rows > 0 || freeze.cols > 0) {
    const topLeft = `${colName(freeze.cols)}${freeze.rows + 1}`;
    const active = freeze.rows > 0 && freeze.cols > 0 ? "bottomRight" : freeze.rows > 0 ? "bottomLeft" : "topRight";
    pane =
      `<pane${freeze.cols > 0 ? ` xSplit="${freeze.cols}"` : ""}${freeze.rows > 0 ? ` ySplit="${freeze.rows}"` : ""} topLeftCell="${topLeft}" activePane="${active}" state="frozen"/>` +
      `<selection pane="${active}"/>`;
  }

  const cols = Array.from({ length: width }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${sheet.colWidths[i] ?? 10}" customWidth="1"/>`).join("");

  const sheetData = rows
    .map((row, ri) => {
      const ht = sheet.rowHeights?.[ri];
      const cells = row
        .map((cell, ci) => {
          if (!cell) return "";
          const ref = `${colName(ci)}${ri + 1}`;
          const s = styleIdx.get(cell.s) ?? 0;
          if (cell.v === null || cell.v === "") return `<c r="${ref}" s="${s}"/>`;
          if (typeof cell.v === "number") {
            return Number.isFinite(cell.v) ? `<c r="${ref}" s="${s}"><v>${cell.v}</v></c>` : `<c r="${ref}" s="${s}"/>`;
          }
          return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(cell.v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}"${ht ? ` ht="${ht}" customHeight="1"` : ""}>${cells}</row>`;
    })
    .join("");

  const merges = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(([r1, c1, r2, c2]) => `<mergeCell ref="${colName(c1)}${r1 + 1}:${colName(c2)}${r2 + 1}"/>`).join("")}</mergeCells>`
    : "";

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    `<dimension ref="A1:${colName(width - 1)}${Math.max(1, rows.length)}"/>` +
    `<sheetViews><sheetView workbookViewId="0" showGridLines="0">${pane}</sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="18" customHeight="1"/>' +
    `<cols>${cols}</cols>` +
    `<sheetData>${sheetData}</sheetData>` +
    merges +
    '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
    "</worksheet>"
  );
}

// ---------- ZIP (без сжатия) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | ((now.getSeconds() >> 1) & 31);
  const dosDate = (((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);

  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // имена в UTF-8
    lv.setUint16(8, 0, true); // без сжатия
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, f.data.length, true);
    lv.setUint32(22, f.data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);

    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, f.data.length, true);
    cv.setUint32(24, f.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cen.set(name, 46);

    chunks.push(local, f.data);
    central.push(cen);
    offset += local.length + f.data.length;
  }

  const centralSize = central.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((a, c) => a + c.length, 0));
  let pos = 0;
  for (const c of all) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

// ---------- Публичная функция ----------

/** Собирает готовый файл .xlsx из описания листа. */
export function buildXlsx(sheet: XSheet): Uint8Array {
  const enc = new TextEncoder();
  const sheetName = esc(sheet.name.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Лист1");
  const files = [
    {
      name: "[Content_Types].xml",
      data: enc.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          "</Types>",
      ),
    },
    {
      name: "_rels/.rels",
      data: enc.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          "</Relationships>",
      ),
    },
    {
      name: "xl/workbook.xml",
      data: enc.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          `<sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: enc.encode(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          "</Relationships>",
      ),
    },
    { name: "xl/styles.xml", data: enc.encode(stylesXml()) },
    { name: "xl/worksheets/sheet1.xml", data: enc.encode(sheetXml(sheet)) },
  ];
  return zipStore(files);
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
