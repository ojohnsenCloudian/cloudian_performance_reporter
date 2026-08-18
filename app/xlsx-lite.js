// Minimal browser-side XLSX + CSV parser (no dependencies).
function readUint16(b, o) { return b[o] | (b[o + 1] << 8); }
function readUint32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

async function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) { if (readUint32(buf, i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('Not a valid .xlsx file');
  const cdOffset = readUint32(buf, eocd + 16);
  const cdSize = readUint32(buf, eocd + 12);
  const entries = [];
  let p = cdOffset;
  while (p < cdOffset + cdSize) {
    if (readUint32(buf, p) !== 0x02014b50) break;
    const compMethod = readUint16(buf, p + 10);
    const compSize = readUint32(buf, p + 20);
    const nameLen = readUint16(buf, p + 28);
    const extraLen = readUint16(buf, p + 30);
    const commentLen = readUint16(buf, p + 32);
    const localOffset = readUint32(buf, p + 42);
    const name = new TextDecoder().decode(buf.slice(p + 46, p + 46 + nameLen));
    entries.push({ name, compMethod, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const files = {};
  for (const entry of entries) {
    const lp = entry.localOffset;
    const nameLen = readUint16(buf, lp + 26);
    const extraLen = readUint16(buf, lp + 28);
    const dataStart = lp + 30 + nameLen + extraLen;
    const compData = buf.slice(dataStart, dataStart + entry.compSize);
    let out;
    if (entry.compMethod === 0) out = compData;
    else {
      const stream = new Blob([compData]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      out = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    files[entry.name] = out;
  }
  return files;
}

function xmlDoc(text) { return new DOMParser().parseFromString(text, 'application/xml'); }

function parseSharedStrings(text) {
  if (!text) return [];
  const doc = xmlDoc(text);
  return [...doc.getElementsByTagName('si')].map(si =>
    [...si.getElementsByTagName('t')].map(t => t.textContent).join('')
  );
}

function colToIndex(ref) {
  const m = ref.match(/^([A-Z]+)/);
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return col - 1;
}

function parseSheetGrid(text, sharedStrings) {
  const doc = xmlDoc(text);
  const grid = [];
  for (const rowEl of [...doc.getElementsByTagName('row')]) {
    const rowIdx = parseInt(rowEl.getAttribute('r'), 10) - 1;
    const row = [];
    for (const c of [...rowEl.getElementsByTagName('c')]) {
      const ci = colToIndex(c.getAttribute('r'));
      const type = c.getAttribute('t');
      const vEl = c.getElementsByTagName('v')[0];
      const isEl = c.getElementsByTagName('is')[0];
      let val = null;
      if (type === 's' && vEl) val = sharedStrings[parseInt(vEl.textContent, 10)] ?? '';
      else if (type === 'inlineStr' && isEl) val = isEl.textContent;
      else if (type === 'str' && vEl) val = vEl.textContent;
      else if (type === 'b' && vEl) val = vEl.textContent === '1';
      else if (vEl) { const n = parseFloat(vEl.textContent); val = isNaN(n) ? vEl.textContent : n; }
      row[ci] = val;
    }
    grid[rowIdx] = row;
  }
  return grid;
}

function gridToTable(grid) {
  let headerRowIdx = -1;
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i]; if (!row) continue;
    const nonEmpty = row.filter(v => v !== undefined && v !== null && v !== '');
    if (nonEmpty.length >= 2 && nonEmpty.every(v => typeof v === 'string')) { headerRowIdx = i; break; }
  }
  if (headerRowIdx < 0) return { headers: [], rows: [] };
  const headerRow = grid[headerRowIdx];
  const width = headerRow.length;
  const headers = [];
  for (let c = 0; c < width; c++) headers.push(headerRow[c] != null ? String(headerRow[c]).trim() : `Column ${c + 1}`);
  const rows = [];
  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const rowArr = grid[r]; if (!rowArr) continue;
    const obj = {}; let filled = 0;
    headers.forEach((h, ci) => { const v = rowArr[ci]; obj[h] = (v === undefined ? null : v); if (v != null && v !== '') filled++; });
    if (filled > 0) rows.push(obj);
  }
  return { headers, rows };
}

export async function parseXlsx(arrayBuffer) {
  const buf = new Uint8Array(arrayBuffer);
  const files = await unzip(buf);
  const dec = new TextDecoder();
  const wbXml = dec.decode(files['xl/workbook.xml']);
  const relsXml = files['xl/_rels/workbook.xml.rels'] ? dec.decode(files['xl/_rels/workbook.xml.rels']) : '';
  const wbDoc = xmlDoc(wbXml);
  const relsDoc = relsXml ? xmlDoc(relsXml) : null;
  const relMap = {};
  if (relsDoc) [...relsDoc.getElementsByTagName('Relationship')].forEach(r => { relMap[r.getAttribute('Id')] = r.getAttribute('Target'); });
  const sharedStrings = files['xl/sharedStrings.xml'] ? parseSharedStrings(dec.decode(files['xl/sharedStrings.xml'])) : [];
  const sheetNames = [];
  const sheets = {};
  for (const s of [...wbDoc.getElementsByTagName('sheet')]) {
    const name = s.getAttribute('name');
    const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let target = relMap[rid];
    if (!target) continue;
    target = target.replace(/^\//, '');
    if (!target.startsWith('xl/')) target = 'xl/' + target;
    const sheetFile = files[target];
    if (!sheetFile) continue;
    const grid = parseSheetGrid(dec.decode(sheetFile), sharedStrings);
    sheets[name] = gridToTable(grid);
    sheetNames.push(name);
  }
  return { sheetNames, sheets };
}

export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') {}
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  const headers = (rows[0] || []).map(h => h.trim());
  const dataRows = rows.slice(1).filter(r => r.some(v => v !== undefined && v.trim() !== ''));
  const out = dataRows.map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      let v = r[i];
      if (v === undefined || v.trim() === '') v = null;
      else { const n = parseFloat(v); if (!isNaN(n) && String(n) === v.trim()) v = n; }
      obj[h] = v;
    });
    return obj;
  });
  return { headers, rows: out };
}

const ROLE_SYNONYMS = {
  category: ['configuration', 'config', 'group', 'label'],
  protocol: ['protocol'],
  operation: ['operation', 'op'],
  objectSize: ['object size', 'part size', 'size'],
  threads: ['threads', 'concurrency', 'clients'],
  throughput: ['throughput', 'mib/s', 'mb/s', 'bandwidth'],
  latency: ['latency', 'response time'],
  objectsPerSec: ['objects/s', 'ops/s', 'iops', 'objects per'],
  cpuMin: ['cpu min'],
  cpuMax: ['cpu max'],
  cpuAvg: ['cpu avg', 'cpu %', 'cpu percent', 'cpu'],
  state: ['state', 'scenario'],
};
export const ROLES = Object.keys(ROLE_SYNONYMS);
export const ROLE_LABELS = {
  category: 'Category / Configuration', protocol: 'Protocol', operation: 'Operation (Read/Write)',
  objectSize: 'Object / Part Size', threads: 'Threads / Concurrency', throughput: 'Throughput',
  latency: 'Latency', objectsPerSec: 'Objects per Second', cpuMin: 'CPU Min', cpuMax: 'CPU Max',
  cpuAvg: 'CPU Avg', state: 'State / Scenario (e.g. Initial vs Cached)',
};

export function autoDetectMapping(headers) {
  const mapping = {}; const used = new Set();
  for (const role of ROLES) {
    let best = null, bestScore = 0;
    headers.forEach(h => {
      if (used.has(h)) return;
      const hl = h.toLowerCase();
      ROLE_SYNONYMS[role].forEach(syn => {
        const score = hl === syn ? 10 : (hl.includes(syn) ? 5 : 0);
        if (score > bestScore) { bestScore = score; best = h; }
      });
    });
    if (best) { mapping[role] = best; used.add(best); }
  }
  return mapping;
}

export function pickMainSheet(sheets, sheetNames) {
  let best = null, bestScore = -1;
  sheetNames.forEach(name => {
    const t = sheets[name];
    const score = t.rows.length * Math.max(t.headers.length, 1);
    if (score > bestScore) { bestScore = score; best = name; }
  });
  return best;
}
