import fs from "node:fs";
import { registerHooks } from "node:module";

import type { TextDocument, Uri, WorkspaceEdit } from "vscode";

/** Scripted native prompts preserve the production order while making cancellation and stale replies deterministic. */
export interface Prompt {
  readonly title?: string;
  readonly value?: string;
  readonly validateInput?: (value: string) => unknown;
}
export type Pick = (items: readonly unknown[], options: Prompt) => unknown;
export interface TestPanel {
  readonly webview: { html: string };
  readonly options: object;
  visible: boolean;
  disposed: boolean;
  dispose(): void;
  visibility(visible: boolean): void;
}
export const host = {
  trusted: true,
  picks: [] as (Pick | undefined)[],
  inputs: [] as (string | undefined)[],
  prompts: [] as Prompt[],
  openFiles: undefined as { fsPath: string }[] | undefined,
  errors: [] as string[],
  infos: [] as string[],
  documents: [] as TextDocument[],
  shown: [] as unknown[],
  edits: [] as WorkspaceEdit[],
  acceptEdit: true,
  panels: [] as TestPanel[],
  initiallyVisible: false,
  activeEditor: undefined as { viewColumn: number } | undefined,
  commandResults: new Map<string, unknown>(),
  commands: [] as unknown[][],
  projects: [] as string[],
  requests: [] as unknown[][],
  analysisRequest: async (..._args: unknown[]): Promise<unknown> => undefined,
};

/** Each test owns its prompt script and observed publications; source files are never saved by this host. */
export function resetHost(): void {
  Object.assign(host, {
    trusted: true,
    picks: [],
    inputs: [],
    prompts: [],
    openFiles: undefined,
    errors: [],
    infos: [],
    documents: [],
    shown: [],
    edits: [],
    acceptEdit: true,
    panels: [],
    initiallyVisible: false,
    activeEditor: undefined,
    commandResults: new Map(),
    commands: [],
    projects: [],
    requests: [],
    analysisRequest: async () => undefined,
  });
}

export function pick(label: string): Pick {
  return (items) => {
    const selected = items.find(
      (item) =>
        item === label ||
        (item !== null && typeof item === "object" && "label" in item && item.label === label),
    );
    if (selected === undefined) {
      throw new Error(`Missing scripted picker choice: ${label}`);
    }
    return selected;
  };
}

Object.assign(globalThis, { __w18EditorHost: host });
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "w18-editor:vscode" };
    }
    if (
      context.parentURL?.includes("/analysis/evidence-inspector.") &&
      ["./project-discovery.js", "./worker-client.js"].includes(specifier)
    ) {
      return { shortCircuit: true, url: "w18-editor:evidence" };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === "w18-editor:evidence") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
      const host=globalThis.__w18EditorHost;
      export const findAnalysisProjectDirectories=async()=>host.projects;
      export const analysisWorker=()=>({request:async(...args)=>{host.requests.push(args);return host.analysisRequest(...args);}});
    `,
      };
    }
    if (url !== "w18-editor:vscode") {
      return next(url, context);
    }
    return {
      shortCircuit: true,
      format: "module",
      source: `
      import {pathToFileURL,fileURLToPath} from 'node:url';
      const host=globalThis.__w18EditorHost;
      export class Uri {
        constructor(value){Object.assign(this,value);this.scheme??='file';this.path??='';this.query??='';this.fragment??='';this.authority??='';this.fsPath=this.path;}
        static file(file){const url=pathToFileURL(file);return new Uri({scheme:'file',path:fileURLToPath(url)});}
        static from(value){return new Uri(value);}
        static parse(value){const url=new URL(value);return new Uri({scheme:url.protocol.slice(0,-1),path:decodeURIComponent(url.pathname),query:url.search.slice(1)});}
        with(change){return new Uri({...this,...change});}
        toString(){return this.scheme+':'+(this.scheme==='file'?'//':'')+this.path+(this.query?'?'+this.query:'');}
      }
      export class EventEmitter {
        listeners=new Set();event=(callback)=>{this.listeners.add(callback);return {dispose:()=>this.listeners.delete(callback)};};
        fire(value){for(const callback of this.listeners)callback(value);}dispose(){this.listeners.clear();}
      }
      export class Position {constructor(line,character){this.line=line;this.character=character;}}
      export class Range {constructor(a,b,c,d){this.start=typeof a==='number'?new Position(a,b):a;this.end=typeof a==='number'?new Position(c,d):b;}}
      export class WorkspaceEdit {
        changes=[];replace(uri,range,newText){this.changes.push([uri,{range,newText}]);}
        get size(){return this.changes.length;}entries(){return this.changes.map(([uri,edit])=>[uri,[edit]]);}
      }
      export const TreeItemCollapsibleState={None:0,Collapsed:1,Expanded:2};
      export class TreeItem {constructor(label,collapsibleState){Object.assign(this,{label,collapsibleState});}}
      export const FileType={File:1,Directory:2};
      export class FileSystemError extends Error {static NoPermissions(message){return new this(message);}}
      export const ViewColumn={Active:1,Beside:2};
      export const ProgressLocation={Notification:15};
      export const env={};
      export const languages={createDiagnosticCollection:()=>({dispose(){},clear(){},set(){}})};
      export class MarkdownString {
        value='';appendMarkdown(value){this.value+=value;return this;}appendText(value){this.value+=value;return this;}
      }
      export class Hover {constructor(contents){this.contents=Array.isArray(contents)?contents:[contents];}}
      export const workspace={
        get isTrusted(){return host.trusted;},get textDocuments(){return host.documents;},
        openTextDocument:async value=>host.openDocument(value),
        applyEdit:async edit=>{host.edits.push(edit);return host.acceptEdit;},
      };
      export const commands={executeCommand:async(...args)=>{host.commands.push(args);const value=host.commandResults.get(args[0]);return typeof value==='function'?value(...args.slice(1)):value;}};
      export const window={
        get activeTextEditor(){return host.activeEditor;},
        showQuickPick:async(items,options={})=>{host.prompts.push(options);return host.picks.shift()?.(items,options);},
        showInputBox:async(options={})=>{host.prompts.push(options);return host.inputs.shift();},
        showOpenDialog:async()=>host.openFiles,
        showErrorMessage:async value=>{host.errors.push(value);},showInformationMessage:async value=>{host.infos.push(value);},
        showTextDocument:async value=>{host.shown.push(value);},
        createWebviewPanel:(_type,_title,_column,options)=>{
          const disposed=new EventEmitter(),changed=new EventEmitter();
          const panel={webview:{html:''},options,visible:host.initiallyVisible,disposed:false,
            onDidDispose:disposed.event,onDidChangeViewState:changed.event,
            dispose(){if(!this.disposed){this.disposed=true;disposed.fire();}},
            visibility(value){this.visible=value;changed.fire({webviewPanel:this});}};
          host.panels.push(panel);return panel;
        },
      };
    `,
    };
  },
});

const { Uri: NativeUri, Position, Range } = await import("vscode");

/** A minimal real text-document contract, with mutable version/text to model an edit during a worker reply. */
export function document(
  file: string,
  text = "",
  languageId = "uttori-snes",
): TextDocument & { text: string; version: number } {
  const doc = {
    uri: NativeUri.file(file),
    fileName: file,
    languageId,
    version: 1,
    isUntitled: false,
    isDirty: false,
    isClosed: false,
    eol: 1,
    encoding: "utf8",
    text,
    get lineCount() {
      return this.text.split("\n").length;
    },
    save: async () => false,
    getText() {
      return this.text;
    },
    positionAt(offset: number) {
      const parts = this.text.slice(0, offset).split("\n");
      return new Position(parts.length - 1, parts.at(-1)!.length);
    },
    offsetAt(position: { line: number; character: number }) {
      return (
        this.text
          .split("\n")
          .slice(0, position.line)
          .reduce((sum, line) => sum + line.length + 1, 0) + position.character
      );
    },
    lineAt(value: number | { line: number }) {
      const line = typeof value === "number" ? value : value.line;
      const lineText = this.text.split("\n")[line];
      const range = new Range(line, 0, line, lineText.length);
      return {
        text: lineText,
        lineNumber: line,
        range,
        rangeIncludingLineBreak: range,
        firstNonWhitespaceCharacterIndex: lineText.search(/\S/),
        isEmptyOrWhitespace: !lineText.trim(),
      };
    },
    getWordRangeAtPosition: () => undefined,
    validateRange: (range: InstanceType<typeof Range>) => range,
    validatePosition: (position: InstanceType<typeof Position>) => position,
  };
  host.documents.push(doc);
  return doc;
}

Object.assign(host, {
  openDocument(value: Uri | { language: string; content: string }) {
    if ("content" in value) {
      return document(`/inspection/${host.documents.length}.md`, value.content, value.language);
    }
    return (
      host.documents.find((doc) => doc.uri.toString() === value.toString()) ??
      document(
        value.fsPath,
        fs.existsSync(value.fsPath) ? fs.readFileSync(value.fsPath, "utf8") : "",
      )
    );
  },
});
