import assert from "node:assert/strict";

/** Exercise packaged editors in Chromium under their actual CSP and inspect the generated intents. */
export function romWorkbenchSmokeHtml(html: string): string {
  const nonce = /script nonce="([^"]+)"/.exec(html)?.[1];
  assert.ok(nonce);
  const script = `
    (() => {
      const emit = (data) => window.dispatchEvent(new MessageEvent("message", {data}));
      const get = (id) => document.getElementById(id);
      const entry = {id:"prices",kind:"binary",offset:64,expected:"01000200",input:"inputs/prices.bin"};
      const clickText = (root, text) => [...root.querySelectorAll("button")].find(b => b.textContent === text).click();
      try {
        emit({type:"project",project:{baseline:{rom:{contentSize:65536}},replacements:[entry]},manifestSha256:"manifest",file:"fixture/modification.json"});
        emit({type:"document",entry,manifestSha256:"manifest",inputSha256:"input",document:{kind:"bytes",values:[1,0,2,0]}});
        const encoding=get("editor").querySelector("select");encoding.value="2";encoding.dispatchEvent(new Event("change"));
        const cell=get("editor").querySelector("input");cell.value="513";cell.dispatchEvent(new Event("change"));get("preview").click();
        emit({type:"review",review:{changedBytes:2,before:"01000200",after:"01020200"}});
        if (get("save").disabled) throw new Error("Validated preview did not enable Save.");
        cell.value="514";cell.dispatchEvent(new Event("change"));
        if (!get("save").disabled) throw new Error("Edited draft retained stale Save.");
        get("undo").click();get("preview").click();
        emit({type:"busy",value:true});if(!get("editor").inert) throw new Error("Pending operation allows edits to be overwritten.");emit({type:"busy",value:false});
        const tile={...entry,id:"tile",kind:"asset",expected:"00".repeat(32)};
        emit({type:"document",entry:tile,manifestSha256:"manifest",inputSha256:"pixels",document:{kind:"indexed",width:8,height:8,palette:[[0,0,0,0],[255,0,0,255],[255,0,0,255]],values:Array(64).fill(0)}});
        const slots=get("editor").querySelectorAll(".swatches button");if(slots.length!==3) throw new Error("Duplicate palette slots collapsed.");slots[2].click();
        clickText(get("editor"),"Set pixel");get("preview").click();
        emit({type:"document",entry:{...entry,kind:"asset"},document:{kind:"model",value:{kind:"snes-palette-bgr555",colors:[{red:1,green:2,blue:3,unusedHighBit:1}]}},manifestSha256:"manifest",inputSha256:"palette"});
        const red=get("editor").querySelector("input");red.value="31";red.dispatchEvent(new Event("change"));get("preview").click();
        get("placement").elements.offset.value="0x100";get("placement").elements.size.value="4";get("placement").dispatchEvent(new Event("submit",{cancelable:true}));get("placement-save").click();
        emit({type:"rebase",review:{candidateManifest:"candidate",conflicts:[{id:"prices",offset:64,reason:"Bytes differ",base:"0100",incoming:"0200",owned:"0300"}],resolutions:{}}});
        const decision=get("conflicts").querySelector("select");decision.value="take-baseline";decision.dispatchEvent(new Event("change"));get("rebase-save").click();
        emit({type:"migration",review:{sourceRevision:"revision",excluded:{targetHints:1},items:[{id:"labels:name",label:"Name",kind:"labels",status:"unchanged",before:{address:64},after:{address:128},reason:"Reviewed"},{id:"blocked",label:"Blocked",kind:"labels",status:"blocked",reason:"Out of bounds"}]}});
        const choices=get("migration-controls").querySelectorAll("input[type=checkbox]");if(!choices[1].disabled) throw new Error("Blocked migration is selectable.");choices[0].checked=true;choices[0].dispatchEvent(new Event("change"));clickText(get("migration-controls"),"Create verified workspace with selected metadata");
        emit({type:"retention",inventory:{scope:"fixture",totalBytes:100,eligibleBytes:50,items:[{id:"active",path:"build/current",category:"build",bytes:50,protected:["Last successful build"],pinned:false},{id:"old",path:"build/old",category:"build",bytes:50,protected:[],pinned:false}]}});
        const retained=get("retention-controls").querySelectorAll("input[type=checkbox]");if(!retained[0].disabled) throw new Error("Protected build is selectable.");retained[1].checked=true;retained[1].dispatchEvent(new Event("change"));clickText(get("retention-controls"),"Review deletion of selected history");
        vscode.postMessage({type:"rom-workbench-smoke-complete"});
      } catch(error) { vscode.postMessage({type:"rom-workbench-smoke-complete",error:String(error)}); }
    })();
  `;
  return html.replace("</body>", `<script nonce="${nonce}">${script}</script></body>`);
}

/** Verify concrete ownership intents, byte order, slot identity and protected-item behavior. */
export function assertRomWorkbenchSmoke(messages: readonly any[]): void {
  assert.equal(messages.find((m) => m.type === "rom-workbench-smoke-complete")?.error, undefined);
  const previews = messages.filter((m) => m.type === "preview");
  assert.deepEqual(previews[0].document.values, [1, 2, 2, 0]);
  assert.deepEqual(previews[1].document.values, [1, 2, 2, 0]);
  assert.equal(previews[2].document.values[0], 2);
  assert.equal(previews[3].document.value.colors[0].red, 31);
  assert.equal(previews[3].document.value.colors[0].unusedHighBit, 1);
  assert.equal(messages.find((m) => m.type === "allocation").plan.offset, 256);
  assert.deepEqual(messages.find((m) => m.type === "rebase-save").resolutions, {
    prices: "take-baseline",
  });
  assert.deepEqual(messages.find((m) => m.type === "migration-apply").selected, ["labels:name"]);
  assert.deepEqual(messages.find((m) => m.type === "retention-prune").selected, ["old"]);
  assert.ok(messages.some((m) => m.type === "draft"));
}
