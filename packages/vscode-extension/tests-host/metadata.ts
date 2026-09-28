import * as assert from "node:assert/strict";

/** Run real DOM controls under the packaged CSP; assertions remain in the extension host. */
export const metadataSmokeHtml = (html: string): string => {
  const nonce = /script nonce="([^"]+)"/.exec(html)?.[1];
  assert.ok(nonce);
  const script = `
    (() => {
      const emit = (data) => window.dispatchEvent(new MessageEvent("message", {data}));
      const el = (id) => document.getElementById(id);
      const idle = () => emit({type:"idle"});
      try {
        const label = {id:"imported.candy",name:"Item_Price_Candy",addressSpace:"snes.cpu",address:0x400020,comment:"Keep this comment",evidence:[]};
        const page = {records:[label],selected:label,total:1,history:[],addressSpaces:[{id:"snes.cpu",name:"CPU"},{id:"rom.file",name:"ROM"}]};
        emit({type:"page",page,shard:"labels"}); idle();
        if (el("field-name").value !== label.name) { throw new Error("Selected label was not rendered."); }
        el("remove").click(); idle();
        emit({type:"review",result:{receipt:{description:"reviewed"}}});
        if (el("save").disabled) { throw new Error("Reviewed operation did not enable Save."); }
        el("field-comment").value="Changed draft";
        el("field-comment").dispatchEvent(new Event("input"));
        if (!el("save").disabled) { throw new Error("Typing retained a stale Save action."); }
        emit({type:"page",page:{...page,selected:{...label,comment:"Changed elsewhere"}},shard:"labels"});idle();
        if (el("field-comment").value !== "Changed draft") { throw new Error("Reload discarded a stale form draft."); }
        emit({type:"page",page:{...page,selected:undefined,records:[]},shard:"comments",anchor:{addressSpace:"rom.file",address:0x30}});idle();
        el("field-text").value="Standalone data comment";el("preview").click();idle();
        el("collection").value="struct-map.json";el("collection").dispatchEvent(new Event("change"));idle();
        emit({type:"map",result:{name:"struct-map.json",sha256:"before",text:JSON.stringify({format:"uttori-asm-snes-struct-map",schemaVersion:1,structures:[{id:"Price",size:2,fields:[{name:"value",offset:0,size:2}]}],bindings:[]})}});
        const entry=JSON.parse(el("map-entry").value);entry.fields[0].description="Reviewed price field";
        el("map-entry").value=JSON.stringify(entry);el("map-entry").dispatchEvent(new Event("input"));
        if (document.querySelector('#map-fields input[aria-label="description"]').value !== "Reviewed price field") throw new Error("Structured map editor did not synchronize advanced JSON.");
        el("map-apply").click();el("preview").click();idle();
        emit({type:"map-history",result:[{id:"receipt-1",name:"struct-map.json",createdAt:"now",status:"applied"}]});
        el("map-receipts").value="receipt-1";el("map-restore").click();idle();
        emit({type:"drafts",drafts:[{id:"saved-draft",savedAt:"yesterday",value:{form:{collection:"comments"}}}]});
        el("drafts").value="saved-draft";el("recover-draft").click();idle();
        emit({type:"recovered-draft",form:{collection:"comments",selected:undefined,anchor:{addressSpace:"rom.file",address:0x30},fields:{id:"recovered",addressSpace:"rom.file",address:"$30",text:"Text retained across restart"}},reviewed:false});
        if (el("field-text").value !== "Text retained across restart" || !el("save").disabled) { throw new Error("Draft recovery lost text or enabled an unreviewed save."); }
        emit({type:"error",text:"Worker response lost",retry:true});
        if (el("save").disabled) { throw new Error("Uncertain save did not retain retry."); }
        vscode.postMessage({type:"metadata-smoke-complete"});
      } catch(error) { vscode.postMessage({type:"metadata-smoke-complete",error:String(error)}); }
    })();
  `;
  return html.replace("</body>", `<script nonce="${nonce}">${script}</script></body>`);
};

/** Validate intent messages produced by the real controls, including draft invalidation. */
export const assertMetadataSmoke = (messages: readonly any[]): void => {
  const complete = messages.find((message) => message.type === "metadata-smoke-complete");
  assert.equal(complete?.error, undefined);
  const native = messages.filter((message) => message.type === "preview");
  assert.deepEqual(native[0]?.request.operations, [
    {
      kind: "remove-label",
      id: "imported.candy",
      preserveComments: true,
      preserveEntryPoint: true,
    },
  ]);
  assert.equal(native[1]?.request.operations[0].record.text, "Standalone data comment");
  assert.equal(native[1]?.request.operations[0].shard, "comments");
  const map = messages.find((message) => message.type === "map-preview");
  assert.equal(
    JSON.parse(map.map.text).structures[0].fields[0].description,
    "Reviewed price field",
  );
  assert.equal(
    messages.find((message) => message.type === "map-restore-preview")?.receiptId,
    "receipt-1",
  );
  assert.ok(messages.some((message) => message.type === "invalidate"));
  assert.ok(messages.some((message) => message.type === "draft-save"));
  assert.equal(
    messages.find((message) => message.type === "recover-draft")?.draftId,
    "saved-draft",
  );
};
