import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDelimiter, detectTableLayout, normalizeTable, parseDelimitedText } from '../src/data/parser.js';
import { detectColumnTypes, suggestMapping, transformMappedRows } from '../src/data/mapper.js';

test('detectDelimiter distinguishes TSV, CSV, and semicolon with quoted commas', () => {
  assert.equal(detectDelimiter('Date\tShift\tOutput\n2026-11-20\tDay\t800'), '\t');
  assert.equal(detectDelimiter('Defect,Cost,Line\n"Burr, heavy",$45,Cell-1'), ',');
  assert.equal(detectDelimiter('Station;VA;BNVA\nPrep;30;10'), ';');
});

test('parseDelimitedText parses RFC-4180 quotes, escaped quotes, and CRLF', () => {
  const input = 'Name,Notes,Cost\r\n"Bracket ""A""",First line,"$1,250.50"\r\nWeld,Clean,95%\r\n\r\n';
  const res = parseDelimitedText(input);
  assert.deepEqual(res.headers, ['Name', 'Notes', 'Cost']);
  assert.equal(res.rows.length, 2);
  assert.deepEqual(res.rows[0], ['Bracket "A"', 'First line', '$1,250.50']);
  assert.deepEqual(res.rows[1], ['Weld', 'Clean', '95%']);
});

test('parseDelimitedText synthesizes Value header for headerless numeric paste', () => {
  const paste = '49.8\n50.2\n50.0\n49.7\n50.4';
  const res = parseDelimitedText(paste);
  assert.deepEqual(res.headers, ['Value']);
  assert.equal(res.rows.length, 5);
  assert.equal(res.rows[0][0], '49.8');
});

test('normalizeTable deduplicates headers and pads jagged rows', () => {
  const res = normalizeTable([
    ['Val', '', 'Val'],
    ['10', '20'],
    ['30', '40', '50'],
  ]);
  assert.deepEqual(res.headers, ['Val', 'Column 2', 'Val (2)']);
  assert.deepEqual(res.rows[0], ['10', '20', '']);
  assert.deepEqual(res.rows[1], ['30', '40', '50']);
});

test('suggestMapping and transformMappedRows handle OEE shift logs', () => {
  const tsv = 'Date\tShift\tMachine\tPlanned_Min\tLoss_Min\tIdeal_CT\tTotal_Qty\tReject_Qty\n2026-11-20\tDay\tCNC-1\t480\t30\t30\t800\t12\n2026-11-20\tNight\tCNC-2\t480\tbad\t30\t700\t10';
  const parsed = parseDelimitedText(tsv);
  const types = detectColumnTypes(parsed.headers, parsed.rows);
  assert.equal(types[0], 'date');
  assert.equal(types[3], 'number');

  const mapping = suggestMapping(parsed.headers, parsed.rows, 'oee');
  assert.equal(mapping.planned, 3);
  assert.equal(mapping.downtime, 4);
  assert.equal(mapping.output, 6);
  assert.equal(mapping.scrap, 7);

  const transformed = transformMappedRows(parsed.headers, parsed.rows, mapping, 'oee');
  assert.equal(transformed.warnings.length, 0);
  assert.equal(transformed.importedCount, 1);
  assert.equal(transformed.skippedCount, 1);
  assert.equal(transformed.data[0].line, 'CNC-1');
  assert.equal(transformed.data[0].planned, 480);
});

test('transformMappedRows cleans currency/percent strings for Pareto & VSM', () => {
  const paretoCsv = 'Defect_Reason,Scrap_Cost_USD,Line\nBurr,"$1,200.50",Cell-1\n,100,Cell-1\nScratch,$50,Cell-2';
  const p = parseDelimitedText(paretoCsv);
  const map = suggestMapping(p.headers, p.rows, 'pareto');
  const out = transformMappedRows(p.headers, p.rows, map, 'pareto');
  assert.equal(out.importedCount, 2);
  assert.equal(out.skippedCount, 1);
  assert.equal(out.data[0].weight, 1200.5);

  const vsmCsv = 'Step,Cycle_Sec,Setup_Min,Uptime_Pct,Ops,WIP\nWeld,45,12,96%,2,4.5';
  const vp = parseDelimitedText(vsmCsv);
  const vMap = suggestMapping(vp.headers, vp.rows, 'vsm');
  const vOut = transformMappedRows(vp.headers, vp.rows, vMap, 'vsm');
  assert.equal(vOut.importedCount, 1);
  assert.equal(vOut.data[0].uptime, 96);
  assert.equal(vOut.data[0].queue, 4.5);
});

test('detectTableLayout and normalizeTable handle title banners, empty leading columns, and headerless tables', () => {
  const messyMatrix = [
    ['', '', '', ''],
    ['', 'Q4 Inspection Report', '', ''],
    ['', 'Part', 'Diameter', 'Line'],
    ['', 'A1', '50.1', 'CNC-1'],
    ['', 'A2', '49.9', 'CNC-2'],
  ];
  const layout = detectTableLayout(messyMatrix);
  assert.equal(layout.headerRowIndex, 2);
  assert.equal(layout.hasHeaders, true);

  const cleaned = normalizeTable(messyMatrix, layout);
  assert.deepEqual(cleaned.headers, ['Part', 'Diameter', 'Line']);
  assert.equal(cleaned.rows.length, 2);
  assert.deepEqual(cleaned.rows[0], ['A1', '50.1', 'CNC-1']);

  const headerless = normalizeTable([['Burr', '50'], ['Scratch', '30']], { hasHeaders: false, headerRowIndex: 0 });
  assert.deepEqual(headerless.headers, ['Column 1', 'Column 2']);
  assert.equal(headerless.rows.length, 2);
  assert.deepEqual(headerless.rows[0], ['Burr', '50']);
});
