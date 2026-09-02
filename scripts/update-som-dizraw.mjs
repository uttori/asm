#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const markdownPath = path.join(root, 'som.md');
const projectPath = path.join(root, 'Secret of Mana (USA).dizraw');
const markdown = fs.readFileSync(markdownPath, 'utf8');
const originalXml = fs.readFileSync(projectPath, 'utf8');
const newline = originalXml.includes('\r\n') ? '\r\n' : '\n';

const pcToSnes = (pc) => pc | 0x400000;
const hex = (value) => value.toString(16).toUpperCase().padStart(6, '0');
const escapeXml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const cleanMarkdown = (value) => value
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replaceAll('`', '')
  .replace(/\s+/g, ' ')
  .trim();

const slug = (value) => cleanMarkdown(value)
  .normalize('NFKD')
  .replace(/&/g, ' And ')
  .replace(/[’']/g, '')
  .replace(/[^A-Za-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .replace(/_+/g, '_');

const sections = new Map();
let section = '';
for (const [index, line] of markdown.split(/\r?\n/).entries()) {
  const heading = line.match(/^###\s+(.+)$/);
  if (heading) section = heading[1].trim();
  if (!sections.has(section)) sections.set(section, []);
  sections.get(section).push({ line, lineNumber: index + 1 });
}

const tableRows = (sectionName) => (sections.get(sectionName) ?? [])
  .filter(({ line }) => line.startsWith('|') && !/^\|\s*[-:]+/.test(line))
  .map(({ line, lineNumber }) => ({
    lineNumber,
    cells: line.split('|').slice(1, -1).map((cell) => cleanMarkdown(cell)),
  }));

const parseRange = (value) => {
  const values = [...value.matchAll(/\b([0-9A-Fa-f]{6})\b/g)].map((match) => Number.parseInt(match[1], 16));
  return { start: values[0], end: values[1] };
};

const labels = new Map();
const addLabel = (pc, name, comment, priority = 0) => {
  assert(Number.isInteger(pc) && pc >= 0 && pc < 0x200000, `Invalid PC offset: ${pc}`);
  const cleanName = slug(name) || `Data_${hex(pc)}`;
  const cleanComment = cleanMarkdown(comment);
  const existing = labels.get(pc);
  if (!existing) {
    labels.set(pc, { pc, name: cleanName, comments: new Set([cleanComment]), priority });
    return;
  }
  if (cleanComment) existing.comments.add(cleanComment);
  if (priority > existing.priority) {
    existing.name = cleanName;
    existing.priority = priority;
  }
};

const romMapRows = markdown.split(/\r?\n/).slice(5, 69)
  .filter((line) => line.startsWith('|'))
  .map((line) => line.split('|').slice(1, -1).map((cell) => cleanMarkdown(cell)));

const mapNameOverrides = new Map([
  [0x033d39, 'Audio_SPC_Pointers'],
  [0x033df9, 'Audio_BRR_Pointers'],
  [0x033e5c, 'Audio_Waveform_Loop_Starts'],
  [0x033e9e, 'Audio_Waveform_Pitch_Corrections'],
  [0x033ee0, 'Audio_Waveform_ADSR'],
  [0x033f22, 'Audio_Sample_Indexes'],
  [0x150000, 'Graphics_Boy'],
  [0x158000, 'Graphics_Girl'],
  [0x160000, 'Graphics_Sprite'],
  [0x168000, 'Graphics_Elementals'],
  [0x169540, 'Graphics_Neko'],
  [0x169e00, 'Graphics_Watts_Blacksmith'],
  [0x1c0000, 'Graphics_Images'],
]);

for (const [rangeCell, category, description] of romMapRows) {
  const { start, end } = parseRange(rangeCell);
  if (start === undefined) continue;
  const categoryName = slug(category.split('/')[0]);
  const descriptionName = slug(description.split('/')[0])
    .replace(/_(?:1|2|4|8)BPP(?:_|$)/, '_')
    .replace(/_(?:[0-9]+_bytes.*|Filled_with_0xFF.*)$/i, '');
  const generated = `${categoryName}_${descriptionName || hex(start)}_${hex(start)}`;
  const name = mapNameOverrides.get(start) ?? generated;
  const rangeText = end === undefined ? `${hex(start)} onward (end not specified)` : `${hex(start)}-${hex(end)}`;
  addLabel(start, name, `som.md ROM Map ${rangeText}: ${category}; ${description}`, 10);
}

const waveformRows = tableRows('Audio Waveforms').filter(({ cells }) => /^0[0-9A-F]{5}/i.test(cells[0] ?? ''));
for (const [index, { cells }] of waveformRows.entries()) {
  const { start, end } = parseRange(cells[0]);
  addLabel(start, `Audio_Waveform_${(index + 1).toString(16).toUpperCase().padStart(2, '0')}`,
    `som.md Audio Waveforms ${hex(start)}-${hex(end)}: ${cells[1]}`, 40);
}

const trackRows = tableRows('Audio Tracks').filter(({ cells }) => /^0[0-9A-F]{5}/i.test(cells[0] ?? ''));
for (const { cells } of trackRows) {
  const { start, end } = parseRange(cells[0]);
  const id = cells[1]?.match(/\(([0-9A-F]{2})\)/i)?.[1] ?? hex(start);
  const english = cells[1]?.replace(/^.*?\([0-9A-F]{2}\)\s*/i, '').split('/')[0].trim();
  const title = english && /[A-Za-z]/.test(english) ? english : `Track_${id}`;
  addLabel(start, `Audio_Track_${id}_${slug(title)}`, `som.md Audio Tracks ${hex(start)}-${hex(end)}: ${cells[1]}`, 40);
}

const itemNames = tableRows('Items')
  .filter(({ cells }) => /^[0-9A-F]{2}$/i.test(cells[0] ?? ''))
  .map(({ cells }) => cells[2].split('/')[0].trim());
const armorNames = tableRows('Armors')
  .filter(({ cells }) => /^[0-9A-F]{2}$/i.test(cells[0] ?? ''))
  .map(({ cells }) => cells[1].split('/')[0].trim());
const priceRows = tableRows('Item Prices / アイテムの値段')
  .filter(({ cells }) => /^0[0-9A-F]{5}$/i.test(cells[0] ?? ''));
for (const [index, { cells }] of priceRows.entries()) {
  const pc = Number.parseInt(cells[0], 16);
  const isItem = index < itemNames.length;
  const entryIndex = isItem ? index : index - itemNames.length;
  const englishName = (isItem ? itemNames[entryIndex] : armorNames[entryIndex]) || `${cells[1]}_${entryIndex.toString(16).toUpperCase()}`;
  addLabel(pc, `${isItem ? 'Item' : 'Armor'}_Price_${englishName}`,
    `som.md Item Prices ${hex(pc)}: ${cells[1]}; ${cells[2]}; price ${cells[3]}`, 40);
}

for (const { cells } of tableRows('Color Palettes').filter(({ cells }) => /^0[0-9A-F]{5}/i.test(cells[0] ?? ''))) {
  const { start, end } = parseRange(cells[0]);
  addLabel(start, `Graphics_Palette_${cells[2].split('/')[0]}`, `som.md Color Palettes ${hex(start)}-${hex(end)}: ${cells[1]}; ${cells[2]}`, 40);
}

for (const { cells } of tableRows('Store Inventory / 店データ').filter(({ cells }) => /^0[0-9A-F]{5}/i.test(cells[0] ?? ''))) {
  let { start, end } = parseRange(cells[0]);
  // som.md says 0A814E, but the preceding end (0A7F4D), following start (0A7F57),
  // and stated 7-items-plus-terminator length establish 0A7F4E as the intended value.
  if (start === 0x0a814e) start = 0x0a7f4e;
  addLabel(start, `Store_Inventory_${cells[1].split('/')[0]}`, `som.md Store Inventory ${hex(start)}-${hex(end)}: ${cells[1]}; ${cells[2]}`, 40);
}

for (const { cells } of tableRows('Experience to Level Up').filter(({ cells }) => /^1[0-9A-F]{5}/i.test(cells[0] ?? ''))) {
  const { start, end } = parseRange(cells[0]);
  addLabel(start, `Experience_${cells[1]}`, `som.md Experience to Level Up ${hex(start)}-${hex(end)}: ${cells[1]}; ${cells[2]}`, 40);
}

const iconRows = tableRows('Menu Icons').filter(({ cells }) => /^1[0-9A-F]{5}/i.test(cells[0] ?? ''));
for (const { cells } of iconRows) {
  const { start, end } = parseRange(cells[0]);
  addLabel(start, `Graphics_Menu_Icon_${cells[1]}`, `som.md Menu Icons ${hex(start)}-${hex(end)}: ${cells[1]}`, 40);
}

// The SPC Songs table stores 24-bit SNES pointers in little-endian byte order.
for (const { cells } of tableRows('SPC Songs').filter(({ cells }) => /^[0-9A-F]{6}$/i.test(cells[0] ?? ''))) {
  const raw = cells[0];
  const snes = Number.parseInt(`${raw.slice(4, 6)}${raw.slice(2, 4)}${raw.slice(0, 2)}`, 16);
  const pc = snes & 0x3fffff;
  if (pc >= 0x200000) continue;
  addLabel(pc, `Audio_Track_${cells[1]}`, `som.md SPC Songs pointer ${raw}: ${cells[1]}`, 60);
}

addLabel(0x10ca8b, 'Load_Menu_Icons_Routine', 'som.md Menu Icons: routine at SNES D0CA8B-D0CAB6', 40);

// Ensure labels are legal and globally unique. DiztinGUIsh does not catch duplicates itself.
const labelsByName = new Map();
for (const label of [...labels.values()].sort((a, b) => a.pc - b.pc)) {
  const prior = labelsByName.get(label.name);
  if (prior !== undefined && prior !== label.pc) label.name = `${label.name}_${hex(label.pc)}`;
  labelsByName.set(label.name, label.pc);
  assert(/^[A-Za-z0-9_]+$/.test(label.name), `Invalid label: ${label.name}`);
}

const substitutionTable = [
  ['0001E', 'ZQ'], ['B0001', 'Zq'], ['C0001', 'ZX'], ['B7E', 'Zx'], ['07F01', 'ZY'],
  ['0001D', 'Zy'], ['C7E', 'ZZ'], ['07E', 'Zz'], ['00001', 'ZS'], ['0001', 'Zs'],
];

const decodeSubstitutions = (line) => {
  let output = line;
  for (const [long, short] of [...substitutionTable].reverse()) output = output.replaceAll(short, long);
  return output;
};
const encodeSubstitutions = (line) => {
  let output = line;
  for (const [long, short] of substitutionTable) output = output.replaceAll(long, short);
  return output;
};

const romBytesMatch = originalXml.match(/<RomBytes>([\s\S]*?)<\/RomBytes>/);
assert(romBytesMatch, 'RomBytes element not found');
const originalRomBytesContent = romBytesMatch[1].replaceAll('\r\n', '\n');
const serializedLines = originalRomBytesContent.split('\n');
const headerIndex = serializedLines.findIndex((line) => line.startsWith('version:'));
assert(headerIndex >= 0, 'RomBytes format header not found');
const header = serializedLines[headerIndex];
const compressedLines = serializedLines.slice(headerIndex + 1).filter((line, index, all) => line || index < all.length - 1);
const decompressed = [];
for (const encodedLine of compressedLines) {
  const line = decodeSubstitutions(encodedLine);
  if (line.startsWith('r')) {
    const parts = line.split(' ');
    assert.equal(parts.length, 3, `Invalid repeater command: ${line}`);
    for (let count = Number.parseInt(parts[1], 10); count > 0; count--) decompressed.push(parts[2]);
  } else {
    decompressed.push(line);
  }
}
const romBytes = decompressed
  .map((line) => line.includes(';') ? line.slice(0, line.indexOf(';')).trimEnd() : line)
  .filter((line) => line.trim());
assert.equal(romBytes.length, 0x200000, 'Unexpected ROM byte metadata length');

const audioRanges = [
  ...romMapRows.slice(2, 8).map(([range]) => parseRange(range)),
  ...waveformRows.map(({ cells }) => parseRange(cells[0])),
  ...trackRows.map(({ cells }) => parseRange(cells[0])),
];

const graphicsCoverageRanges = romMapRows
  .map(([range, category]) => ({ ...parseRange(range), category }))
  .filter(({ category, end }) => cleanMarkdown(category).startsWith('Graphics') && end !== undefined);
// The tilemap row has an open end marker. Bound it at the next documented ROM-map
// range (0C0C00) so it can be marked/exported without consuming the following map data.
graphicsCoverageRanges.push({ start: 0x0b4000, end: 0x0c0bff, category: 'Graphics / Tilemaps 16x16' });

for (const { start, end } of audioRanges) {
  assert(start !== undefined && end !== undefined && start <= end);
  for (let pc = start; pc <= end; pc++) romBytes[pc] = `M${romBytes[pc].slice(1)}`;
}
for (const { start, end } of graphicsCoverageRanges) {
  assert(start !== undefined && end !== undefined && start <= end);
  for (let pc = start; pc <= end; pc++) romBytes[pc] = `G${romBytes[pc].slice(1)}`;
}

const compressRepeats = (lines) => {
  if (lines.length < 8) return lines;
  const output = [];
  let lastLine = lines[0];
  let consecutive = 1;
  for (let index = 1; index < lines.length; index++) {
    const line = lines[index];
    const different = line !== lastLine;
    const finalLine = index === lines.length - 1;
    if (!different) {
      consecutive++;
      if (!finalLine) continue;
    }
    if (consecutive >= 8) output.push(`r ${consecutive} ${lastLine}`);
    else for (let count = 0; count < consecutive; count++) output.push(lastLine);
    if (finalLine && different) output.push(line);
    lastLine = line;
    consecutive = 1;
  }
  return output;
};

const serializeRomBytes = (bytes) => {
  const lines = [];
  for (let pc = 0; pc < bytes.length; pc++) {
    lines.push(bytes[pc]);
    if (pc > 0 && pc % 2048 === 0) lines.push(`;pos=${hex(pc)}`);
  }
  return `\n${header}\n${compressRepeats(lines).map(encodeSubstitutions).join('\n')}\n`;
};

const newRomBytesContent = serializeRomBytes(romBytes);

const existingLabelItems = [...originalXml.matchAll(/\s*<sys:Item Key="(\d+)">\s*<Value exs:type="ns1:Label" Name="([^"]*)" Comment="([^"]*)" \/>\s*<\/sys:Item>/g)]
  .map((match) => ({
    key: Number.parseInt(match[1], 10),
    xml: `<sys:Item Key="${match[1]}">${newline}          <Value exs:type="ns1:Label" Name="${match[2]}" Comment="${match[3]}" />${newline}        </sys:Item>`,
  }));
const allLabelItems = new Map(existingLabelItems.map((item) => [item.key, item.xml]));
for (const label of labels.values()) {
  const key = pcToSnes(label.pc);
  const comment = [...label.comments].filter(Boolean).join(' | ');
  allLabelItems.set(key,
    `<sys:Item Key="${key}">${newline}          <Value exs:type="ns1:Label" Name="${escapeXml(label.name)}" Comment="${escapeXml(comment)}" />${newline}        </sys:Item>`);
}
const labelsXml = [...allLabelItems.entries()]
  .sort(([a], [b]) => a - b)
  .map(([, item]) => `        ${item.replaceAll('\r\n', '\n').replaceAll('\n', newline).replace(/^\s*/, '')}`)
  .join(newline);

const regions = [];
const addRegion = (start, end, name, kind) => {
  assert(start <= end && start >= 0 && end < 0x200000, `Invalid region ${name}`);
  const firstBank = start >>> 16;
  const lastBank = end >>> 16;
  for (let bank = firstBank; bank <= lastBank; bank++) {
    const partStart = Math.max(start, bank << 16);
    const partEnd = Math.min(end, (bank << 16) | 0xffff);
    const snesBank = (pcToSnes(partStart) >>> 16).toString(16).toUpperCase().padStart(2, '0');
    const partName = firstBank === lastBank ? name : `${name}_bank_${snesBank}`;
    regions.push({ start: partStart, end: partEnd, name: slug(partName), kind });
  }
};

for (const [index, range] of audioRanges.entries()) {
  const label = labels.get(range.start);
  addRegion(range.start, range.end, label?.name ?? `Audio_${index.toString().padStart(3, '0')}`, 'audio');
}

const graphicsRegions = [
  [0x014e00, 0x014fff, 'Graphics_Ball_Object'],
  [0x02b8d6, 0x02bad5, 'Graphics_Floating_Mana_Fortress'],
  [0x062000, 0x062fff, 'Graphics_Clouds'],
  [0x063000, 0x063fff, 'Graphics_Flamie'],
  [0x066700, 0x0669ff, 'Graphics_Explosion'],
  [0x066c00, 0x0673ff, 'Graphics_Unknown_066C00'],
  [0x07fb00, 0x07fb9f, 'Graphics_Map_Directions'],
  [0x081000, 0x08101d, 'Graphics_Palette_Rabbite'],
  [0x08101e, 0x081eff, 'Graphics_Palettes_Uncatalogued'],
  [0x081f00, 0x081f1d, 'Graphics_Palette_Boy'],
  [0x081f1e, 0x081f3b, 'Graphics_Palette_Princess'],
  [0x081f3c, 0x081f59, 'Graphics_Palette_Sprite'],
  [0x0b4000, 0x0c0bff, 'Graphics_Tilemaps_16x16'],
  [0x100000, 0x1007ff, 'Graphics_Monster_Structure'],
  [0x127e80, 0x1281ff, 'Graphics_Power_Meter_And_UI'],
  [0x128760, 0x1287bf, 'Graphics_Menu_Icon_Equip'],
  [0x1287c0, 0x12c35f, 'Graphics_Menu_Icons_Uncatalogued'],
  ...iconRows.slice(1).map(({ cells }) => {
    const { start, end } = parseRange(cells[0]);
    return [start, end, `Graphics_Menu_Icon_${cells[1]}`];
  }),
  [0x12c680, 0x12c8ff, 'Graphics_Character_Icons'],
  [0x12d080, 0x12d47f, 'Graphics_Message_Boxes'],
  [0x12d480, 0x12d87f, 'Graphics_Menu_4BPP'],
  [0x12d880, 0x12db7f, 'Graphics_Menu_2BPP'],
  [0x14fdc0, 0x14ffff, 'Graphics_14FDC0_14FFFF'],
  [0x150000, 0x157fff, 'Graphics_Boy'],
  [0x158000, 0x15ffff, 'Graphics_Girl'],
  [0x160000, 0x167fff, 'Graphics_Sprite'],
  [0x168000, 0x16953f, 'Graphics_Elementals'],
  [0x169540, 0x169dff, 'Graphics_Neko'],
  [0x169e00, 0x1877df, 'Graphics_Watts_Blacksmith'],
  [0x1877e0, 0x187d3f, 'Graphics_Characters_Uncatalogued_1'],
  [0x187d40, 0x18fd3f, 'Graphics_187D40_18FD3F'],
  [0x18fd40, 0x197fff, 'Graphics_Characters_Uncatalogued_2'],
  [0x198000, 0x19fbff, 'Graphics_198000_19FBFF'],
  [0x19fc00, 0x19febf, 'Graphics_Characters_Uncatalogued_3'],
  [0x19fec0, 0x19ffff, 'Graphics_Hexadecimal_Font'],
  [0x1a0000, 0x1a0fff, 'Graphics_1A0000_1A0FFF'],
  [0x1c0000, 0x1fffff, 'Graphics_Images'],
];
for (const [start, end, name] of graphicsRegions) addRegion(start, end, name, 'graphics');

regions.sort((a, b) => a.start - b.start || a.end - b.end);
for (let index = 1; index < regions.length; index++) {
  assert(regions[index - 1].end < regions[index].start,
    `Export regions overlap: ${regions[index - 1].name} and ${regions[index].name}`);
}
const regionNames = new Set();
for (const region of regions) {
  assert(!regionNames.has(region.name), `Duplicate region name: ${region.name}`);
  assert((region.start >>> 16) === (region.end >>> 16), `Region crosses a bank: ${region.name}`);
  regionNames.add(region.name);
}
const regionsXml = regions.map((region) =>
  `        <ns2:Region StartSnesAddress="${pcToSnes(region.start)}" EndSnesAddress="${pcToSnes(region.end)}" RegionName="${escapeXml(region.name)}" ContextToApply="" Priority="0" ExportSeparateFile="true" />`)
  .join(newline);

let xml = originalXml.replace(/<Labels>[\s\S]*?<\/Labels>/,
  `<Labels>${newline}${labelsXml}${newline}      </Labels>`);
xml = xml.replace(/<RomBytes>[\s\S]*?<\/RomBytes>/,
  `<RomBytes>${newRomBytesContent.replaceAll('\n', newline)}</RomBytes>`);
xml = xml.replace(/<Regions>[\s\S]*?<\/Regions>/,
  `<Regions>${newline}${regionsXml}${newline}      </Regions>`);

fs.writeFileSync(projectPath, xml, 'utf8');

const musicBytes = romBytes.filter((line) => line.startsWith('M')).length;
const graphicsBytes = romBytes.filter((line) => line.startsWith('G')).length;
console.log(JSON.stringify({
  labelsAddedOrUpdated: labels.size,
  labelsTotal: allLabelItems.size,
  exportRegions: regions.length,
  audioExportRegions: regions.filter((region) => region.kind === 'audio').length,
  graphicsExportRegions: regions.filter((region) => region.kind === 'graphics').length,
  musicBytes,
  graphicsBytes,
  correctedMandalaOffset: '0A814E -> 0A7F4E',
}, null, 2));
