import { test } from "../../../tests/ava-helper.js";
import { encodeSomDialogueCommand } from "../src/secret-of-mana/som-dialogue-command.js";
import { convertSomDialogueScript, decodeSomDialogue, encodeSomDialogue, expandSomDialogue,
  exportSomDialogueScript, packSomDialogueScript, previewSomDialogue, readSomDialogueDictionary, readSomDialogueScriptLayout,
  type SomDialogueScriptLayout } from "../src/secret-of-mana/som-dialogue.js";

/** Distinct synthetic pairs expose both code ranges and their shared dictionary indices. */
function fixture() {
  const bytes = new Uint8Array(122);
  for (let i = 0; i < 61; i++) { bytes[i * 2] = 0x81 + i % 26; bytes[i * 2 + 1] = 0x80; }
  bytes.set([0x81, 0x81], 0);
  return { bytes, dictionary: readSomDialogueDictionary(bytes) };
}

test("SoM DTE expands every valid code and retains overlapping original aliases", t => {
  const { dictionary } = fixture();
  for (let code = 0x60; code <= 0xff; code++) {
    if (code > 0x7e && code < 0xd3) continue;
    const index = code <= 0x7e ? code - 0x60 : code - 0xc3;
    t.deepEqual([...expandSomDialogue(Uint8Array.of(code), dictionary)], [...dictionary[index]]);
  }
  for (const original of [Uint8Array.of(0x70), Uint8Array.of(0xd3), Uint8Array.from(dictionary[16])]) {
    const text = decodeSomDialogue(original, dictionary);
    const encoded = encodeSomDialogue(text, dictionary, { original });
    t.deepEqual(encoded, original);
    t.not(encoded, original);
  }
  t.throws(() => readSomDialogueDictionary(new Uint8Array(120)), { message: /61 pairs/ });
  const distinct = fixture().bytes;
  distinct.set([0x80, 0xa3], 29 * 2);
  t.deepEqual(encodeSomDialogue(" I", readSomDialogueDictionary(distinct)), Uint8Array.of(0xe0));
});

test("variable script packing records moved commands while fixed includes retain their byte budgets", (t) => {
  const { bytes } = fixture();
  const layout: SomDialogueScriptLayout = {
    format: "som-dialogue-script",
    version: 1,
    dictionaryHex: Buffer.from(bytes).toString("hex"),
    segments: [
      { kind: "raw", nativeHex: "50", commands: [{ offset: 0, token: "${openDialogue}" }] },
      { kind: "text", nativeHex: "81" },
      { kind: "raw", nativeHex: "280000", commands: [{ offset: 0, token: "${wait}" }] },
    ],
  };
  const source = new TextEncoder().encode("${openDialogue}bbbb${wait:6}{raw:1:0}\n");
  t.throws(() => packSomDialogueScript(source, layout), { message: /cannot fit/ });
  const packed = packSomDialogueScript(source, layout, "variable");
  t.deepEqual(packed.bytes, Uint8Array.of(0x50, 0x82, 0x82, 0x82, 0x82, 0x28, 6, 0));
  t.deepEqual(
    packed.segments.map((s) => [s.originalOffset, s.offset, s.length, s.preserved]),
    [
      [0, 0, 1, true],
      [1, 1, 4, false],
      [2, 5, 3, false],
    ],
  );
  t.false(packed.fixedFieldOffsets);
  t.false(packed.nativePreserved);
  const resources = {
    layout: {
      mediaType: "application/json",
      bytes: new TextEncoder().encode(JSON.stringify(layout)),
    },
  };
  t.throws(
    () =>
      convertSomDialogueScript(
        { mediaType: "text/plain", bytes: source },
        { layout: "layout", sizing: "variable" },
        resources,
      ),
    { message: /cannot fit/ },
  );
});

test("variable packing preserves unchanged native aliases and enforces command ownership", (t) => {
  const { bytes } = fixture();
  const layout: SomDialogueScriptLayout = {
    format: "som-dialogue-script",
    version: 1,
    dictionaryHex: Buffer.from(bytes).toString("hex"),
    segments: [
      { kind: "text", nativeHex: "d3" },
      {
        kind: "raw",
        nativeHex: "5700",
        commands: [{ offset: 0, token: "${boy}", editable: false }],
      },
    ],
  };
  const source = new TextEncoder().encode(exportSomDialogueScript(layout));
  const packed = packSomDialogueScript(source, layout, "variable");
  t.deepEqual(packed.bytes, Uint8Array.of(0xd3, 0x57, 0));
  t.true(packed.nativePreserved);
  t.true(packed.segments.every((segment) => segment.preserved));
  t.throws(
    () => packSomDialogueScript(new TextEncoder().encode("aq ${girl}\n"), layout, "variable"),
    { message: /read-only/ },
  );
  t.throws(
    () => packSomDialogueScript(new TextEncoder().encode("aq ${wait}\n"), layout, "variable"),
    { message: /family or width/ },
  );
});

test("variable packing retains empty text boundaries and rejects a packed bank overflow", (t) => {
  const { bytes } = fixture();
  const dictionaryHex = Buffer.from(bytes).toString("hex");
  const layout: SomDialogueScriptLayout = {
    format: "som-dialogue-script",
    version: 1,
    dictionaryHex,
    segments: [
      { kind: "raw", nativeHex: "50" },
      { kind: "text", nativeHex: "81" },
      { kind: "raw", nativeHex: "00" },
    ],
  };
  const empty = packSomDialogueScript(
    new TextEncoder().encode("{raw:0}{raw:1}\n"),
    layout,
    "variable",
  );
  t.deepEqual(empty.bytes, Uint8Array.of(0x50, 0));
  t.deepEqual(
    empty.segments.map((s) => [s.offset, s.length]),
    [
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  );
  const segments: SomDialogueScriptLayout["segments"][number][] = [];
  let source = "";
  for (let index = 0; index < 17; index++) {
    segments.push({ kind: "raw", nativeHex: "50" }, { kind: "text", nativeHex: "81" });
    source += `{raw:${index}}` + "b".repeat(4096);
  }
  t.throws(
    () =>
      packSomDialogueScript(new TextEncoder().encode(source), { ...layout, segments }, "variable"),
    { message: /exceeds one ROM bank/ },
  );
});

test("SoM packing protects the second glyph when a DTE pair would straddle native capacity", t => {
  const { dictionary } = fixture();
  const unsafe = Uint8Array.of(0x60, 0x60);
  const preview = previewSomDialogue(unsafe, dictionary, { lineColumns: 3 });
  t.deepEqual(preview.lines.map(line => line.text), ["aaa"]);
  t.deepEqual(preview.dropped, [{ byteOffset: 1, glyph: 0x81 }]);
  const safe = encodeSomDialogue("aaaa", dictionary, { lineColumns: 3 });
  t.deepEqual(safe, Uint8Array.of(0x60, 0x81, 0x81));
  t.deepEqual(previewSomDialogue(safe, dictionary, { lineColumns: 3 }).lines.map(line => line.text), ["aaa", "a"]);
  t.deepEqual(previewSomDialogue(safe, dictionary, { lineColumns: 3 }).dropped, []);
  t.throws(() => encodeSomDialogue("aaaa", dictionary, { byteLength: 2, lineColumns: 3 }), { message: /cannot fit/ });
  // No-edit export keeps native identities even when a newly supplied geometry
  // exposes a historical pair boundary. The preview reports that separate issue.
  t.deepEqual(encodeSomDialogue("aaaa", dictionary, { original: unsafe, lineColumns: 3 }), unsafe);
});

test("SoM geometry follows native line breaks and an already printed prefix", t => {
  const { dictionary } = fixture();
  const bytes = encodeSomDialogue("aa\naa", dictionary, { lineColumns: 28, initialColumn: 27 });
  t.deepEqual(bytes, Uint8Array.of(0x81, 0x81, 0x7f, 0x60));
  const preview = previewSomDialogue(bytes, dictionary, { lineColumns: 28, initialColumn: 27 });
  t.deepEqual(preview.lines.map(line => [line.text, line.initialColumn, line.ending]),
    [["a", 27, "capacity"], ["a", 0, "line-break"], ["aa", 0, "end"]]);
  t.is(preview.pixelWidth, 224);
  t.is(preview.glyphHeight, 12);
  for (const options of [{ lineColumns: 0 }, { lineColumns: 33 }, { lineColumns: 1.5 },
    { lineColumns: 28, initialColumn: 28 }, { initialColumn: 1 }]) {
    t.throws(() => encodeSomDialogue("aa", dictionary, options));
  }
});

test("SoM script geometry is validated and protects fixed command offsets during edits", t => {
  const { bytes } = fixture();
  const layout: SomDialogueScriptLayout = { format: "som-dialogue-script", version: 1,
    dictionaryHex: Buffer.from(bytes).toString("hex"), segments: [
      { kind: "raw", nativeHex: "50" },
      { kind: "text", nativeHex: "818181", lineColumns: 28, initialColumn: 27 },
      { kind: "raw", nativeHex: "51" },
    ] };
  t.throws(() => readSomDialogueScriptLayout({ ...layout, segments: [{ kind: "raw", nativeHex: "50", lineColumns: 28 }] }),
    { message: /cannot carry text geometry/ });
  t.throws(() => readSomDialogueScriptLayout({ ...layout, segments: [{ kind: "text", nativeHex: "81", lineColumns: 33 }] }),
    { message: /line capacity/ });
  const source = { mediaType: "text/plain", bytes: new TextEncoder().encode("{raw:0}aaaa{raw:1}\n") };
  const resources = { layout: { mediaType: "application/json", bytes: new TextEncoder().encode(JSON.stringify(layout)) } };
  const edited = convertSomDialogueScript(source, { layout: "layout" }, resources).outputs.script.bytes;
  t.deepEqual(edited, Uint8Array.of(0x50, 0x81, 0x60, 0x81, 0x51));
  t.deepEqual(previewSomDialogue(edited.slice(1, -1), fixture().dictionary,
    { lineColumns: 28, initialColumn: 27 }).dropped, []);
});

test("SoM text exact-fit packing can leave pairs literal without moving the next field", t => {
  const { dictionary } = fixture();
  t.deepEqual(encodeSomDialogue("aaaa", dictionary), Uint8Array.of(0x60, 0x60));
  t.deepEqual(encodeSomDialogue("aaaa", dictionary, { byteLength: 3 }), Uint8Array.of(0x60, 0x81, 0x81));
  t.deepEqual(encodeSomDialogue("aaaa", dictionary, { byteLength: 4 }), Uint8Array.of(0x81, 0x81, 0x81, 0x81));
  for (const byteLength of [1, 5]) t.throws(() => encodeSomDialogue("aaaa", dictionary, { byteLength }), { message: /cannot fit/ });
  t.deepEqual(encodeSomDialogue("", dictionary), new Uint8Array());
  t.throws(() => encodeSomDialogue("a".repeat(4097), dictionary), { message: /4096-glyph/ });
  t.throws(() => encodeSomDialogue("a", dictionary, { byteLength: 4097 }), { message: /byte budget/ });
});

test("SoM ASCII preserves line breaks and unresolved glyphs without accepting event commands", t => {
  const { dictionary } = fixture();
  const bytes = Uint8Array.of(0x9b, 0x81, 0xb5, 0xbf, 0x7f, 0xc3, 0xcc);
  t.is(decodeSomDialogue(bytes, dictionary), "Aa0.\n\\xC3\\xCC");
  t.deepEqual(encodeSomDialogue("Aa0.\n\\xC3\\xCC", dictionary), bytes);
  for (const byte of [0, 0x53, 0x5f]) t.throws(() => decodeSomDialogue(Uint8Array.of(byte), dictionary), { message: /outside a text span/ });
  for (const text of ["é", '"', "\\x53", "\\xD3", "\\n"]) t.throws(() => encodeSomDialogue(text, dictionary));
});

test("ASCII script editing preserves raw command blocks and exact byte identities", t => {
  const { bytes } = fixture();
  const hex = (data: Uint8Array) => [...data].map(byte => byte.toString(16).padStart(2, "0")).join("");
  const layout: SomDialogueScriptLayout = { format: "som-dialogue-script", version: 1, dictionaryHex: hex(bytes),
    segments: [{ kind: "raw", nativeHex: "50" }, { kind: "text", nativeHex: "81d3" }, { kind: "raw", nativeHex: "280000" }] };
  const resources = { layout: { mediaType: "application/json", bytes: new TextEncoder().encode(JSON.stringify(layout)) } };
  const source = (text: string) => ({ mediaType: "text/plain", bytes: new TextEncoder().encode(text) });
  const exported = exportSomDialogueScript(layout);
  t.deepEqual(convertSomDialogueScript(source(exported), { layout: "layout" }, resources).outputs.script.bytes,
    Uint8Array.of(0x50, 0x81, 0xd3, 0x28, 0, 0));
  t.is(convertSomDialogueScript(source(exported.replaceAll("\n", "\r\n")), { layout: "layout" }, resources).outputs.script.metadata?.nativePreserved, true);
  const edited = convertSomDialogueScript(source("{raw:0}aaa{raw:1}\n"), { layout: "layout" }, resources);
  t.deepEqual(edited.outputs.script.bytes, Uint8Array.of(0x50, 0x60, 0x81, 0x28, 0, 0));
  t.is(edited.outputs.script.metadata?.nativePreserved, false);
  for (const text of ["{raw:1}aaa{raw:0}\n", "{raw:0}a{raw:1}\n", "{raw:0}aaa{raw:1}\n\n", "{raw:0}é{raw:1}\n"])
    t.throws(() => convertSomDialogueScript(source(text), { layout: "layout" }, resources));
  t.throws(() => readSomDialogueScriptLayout({ ...layout, segments: [{ kind: "text", nativeHex: "5f" }] }));
  t.throws(() => readSomDialogueScriptLayout({ ...layout, segments: [{ kind: "raw", nativeHex: "f" }] }));
  t.throws(() => readSomDialogueScriptLayout({ ...layout, segments: [{ kind: "raw", nativeHex: "00" }, { kind: "raw", nativeHex: "00" }] }));
  t.throws(() => readSomDialogueScriptLayout({ ...layout, segments: [{ kind: "text", nativeHex: "60".repeat(4096) }] }),
    { message: /4096-glyph/ });
});

test("named dialogue commands distinguish runtime party names from input and timed waits", t => {
  t.deepEqual(encodeSomDialogueCommand("${boy}").bytes, Uint8Array.of(0x57, 0));
  t.deepEqual(encodeSomDialogueCommand("${girl}").bytes, Uint8Array.of(0x57, 1));
  t.deepEqual(encodeSomDialogueCommand("${sprite}").bytes, Uint8Array.of(0x57, 2));
  t.deepEqual(encodeSomDialogueCommand("${wait}").bytes, Uint8Array.of(0x28, 0));
  t.deepEqual(encodeSomDialogueCommand("${wait:255}").bytes, Uint8Array.of(0x28, 255));
  for (const token of ["${wait:-1}", "${wait:256}", "${wait:3.5}", "${wait:01}", "${enemy}", "boy"])
    t.throws(() => encodeSomDialogueCommand(token));
});

test("reviewed name and wait slots are editable while opaque commands and field offsets stay exact", t => {
  const { bytes } = fixture();
  const layout: SomDialogueScriptLayout = { format: "som-dialogue-script", version: 1,
    dictionaryHex: Buffer.from(bytes).toString("hex"), segments: [
      { kind: "raw", nativeHex: "06505700", commands: [{ offset: 1, token: "${openDialogue}" }, { offset: 2, token: "${boy}" }] },
      { kind: "text", nativeHex: "81d3" },
      { kind: "raw", nativeHex: "280000", commands: [{ offset: 0, token: "${wait}" }] },
    ] };
  const resources = { layout: { mediaType: "application/json", bytes: new TextEncoder().encode(JSON.stringify(layout)) } };
  const convert = (text: string) => convertSomDialogueScript({ mediaType: "text/plain", bytes: new TextEncoder().encode(text) }, { layout: "layout" }, resources).outputs.script;
  const exported = exportSomDialogueScript(layout);
  t.is(exported, "{raw:0:0}${openDialogue}${boy}aq ${wait}{raw:1:0}\n");
  const original = Uint8Array.of(6, 0x50, 0x57, 0, 0x81, 0xd3, 0x28, 0, 0);
  t.deepEqual(convert(exported).bytes, original);
  t.is(convert(exported).metadata?.nativePreserved, true);
  const edited = convert(exported.replace("${boy}", "${girl}").replace("${wait}", "${wait:6}"));
  t.deepEqual(edited.bytes, Uint8Array.of(6, 0x50, 0x57, 1, 0x81, 0xd3, 0x28, 6, 0));
  t.is(edited.metadata?.nativePreserved, false);
  t.deepEqual(convert("{raw:0}aq {raw:1}\n").bytes, original);
  for (const value of [exported.replace("${boy}", "${wait:2}"), exported.replace("${wait}", "${boy}"),
    exported.replace("{raw:1:0}", ""), exported.replace("aq ", "a${boy}q ")]) t.throws(() => convert(value));
});

test("command slots cannot reinterpret text, mismatch native bytes or bypass a read-only policy", t => {
  const { bytes } = fixture();
  const layout: SomDialogueScriptLayout = { format: "som-dialogue-script", version: 1,
    dictionaryHex: Buffer.from(bytes).toString("hex"), segments: [{ kind: "raw", nativeHex: "5700",
      commands: [{ offset: 0, token: "${boy}", editable: false }] }] };
  const resources = { layout: { mediaType: "application/json", bytes: new TextEncoder().encode(JSON.stringify(layout)) } };
  t.throws(() => convertSomDialogueScript({ mediaType: "text/plain", bytes: new TextEncoder().encode("${girl}\n") },
    { layout: "layout" }, resources), { message: /read-only/ });
  for (const segment of [
    { kind: "text", nativeHex: "8181", commands: [{ offset: 0, token: "${boy}" }] },
    { kind: "raw", nativeHex: "5700", commands: [{ offset: 0, token: "${girl}" }] },
    { kind: "raw", nativeHex: "570050", commands: [{ offset: 0, token: "${boy}" }, { offset: 1, token: "${openDialogue}" }] },
    { kind: "raw", nativeHex: "5700", commands: [{ offset: 0, token: "${boy}", editable: "yes" }] },
  ]) t.throws(() => readSomDialogueScriptLayout({ ...layout, segments: [segment] }));
});
