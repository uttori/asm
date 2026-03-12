type LabelEntry = {
  value: number;
  isStatic: boolean;
  isMacroLabel?: boolean;
  macroInstance?: number;
  modifiesHierarchy?: boolean;
};

type StructDefinition = {
  name: string;
  base: number;
  offset: number;
  size: number;
  labels: Map<string, number>;
  align?: number;
  parent?: string;
  extensionSize?: number;
};

export interface SymbolScopeHost {
  pass: number;
  snespos: number;
  currentNamespace: string;
  namespaceNestingEnabled: boolean;
  namespaceNestingPath: string[];
  inMacroExpansion: boolean;
  macroLabelInstance: number;
  labelTable: Map<string, LabelEntry>;
  forwardLabels: { [depth: number]: { addr: number; macroInstance?: number }[] };
  backwardLabels: { [depth: number]: { addr: number; macroInstance?: number }[] };
  currentParentLabel: string;
  currentParentIsGlobal: boolean;
  structs: Map<string, StructDefinition>;
}

export class SymbolScopeService {
  constructor(private readonly host: SymbolScopeHost) {}

  hasLabelInScope(identifier: string): boolean {
    return this.host.labelTable.has(identifier) ||
      (this.host.currentNamespace ? this.host.labelTable.has(`${this.host.currentNamespace}_${identifier}`) : false);
  }

  handleRelativeLabel(label: string): number {
    const isPositive = label.includes("+");
    const depth = isPositive ? (label.match(/\+/g) || []).length : (label.match(/-/g) || []).length;
    const snesAddress = this.host.snespos;
    const isMacroLocal = label.startsWith("?");

    if (this.host.pass === 2) {
      if (isPositive) {
        if (!this.host.forwardLabels[depth] || this.host.forwardLabels[depth].length === 0) {
          throw new Error(`Error: Undefined forward label '${label}'.`);
        }
      } else if (!this.host.backwardLabels[depth] || this.host.backwardLabels[depth].length === 0) {
        throw new Error(`Error: Undefined backward label '${label}'.`);
      }
      return snesAddress;
    }

    if (isPositive) {
      if (!this.host.forwardLabels[depth]) this.host.forwardLabels[depth] = [];
      if (isMacroLocal && this.host.inMacroExpansion) {
        this.host.forwardLabels[depth].push({ addr: snesAddress, macroInstance: this.host.macroLabelInstance });
      } else {
        this.host.forwardLabels[depth].push({ addr: snesAddress });
      }
    } else {
      if (!this.host.backwardLabels[depth]) this.host.backwardLabels[depth] = [];
      if (isMacroLocal && this.host.inMacroExpansion) {
        this.host.backwardLabels[depth].push({ addr: snesAddress, macroInstance: this.host.macroLabelInstance });
      } else {
        this.host.backwardLabels[depth].push({ addr: snesAddress });
      }
    }

    return snesAddress;
  }

  findNextLabel(label: string, currentAddressOverride?: number): number {
    const isPositive = label.includes("+");
    const depth = isPositive ? (label.match(/\+/g) || []).length : (label.match(/-/g) || []).length;
    const currentAddress = currentAddressOverride ?? this.host.snespos;
    const isMacroLocal = label.startsWith("?");

    if (this.host.pass < 2) {
      return 0;
    }

    if (!this.host.forwardLabels[depth] || this.host.forwardLabels[depth].length === 0) {
      throw new Error(`Error: No + label '${label}' found after ${currentAddress.toString(16)}.`);
    }

    const possibleTargets = this.host.forwardLabels[depth]
      .filter((entry) => {
        if (isMacroLocal && this.host.inMacroExpansion) {
          return entry.addr > currentAddress && entry.macroInstance === this.host.macroLabelInstance;
        }
        return entry.addr > currentAddress && !entry.macroInstance;
      })
      .map((entry) => entry.addr);

    if (possibleTargets.length === 0) {
      throw new Error(`Error: No + label '${label}' found after ${currentAddress.toString(16)}.`);
    }

    return Math.min(...possibleTargets);
  }

  findPreviousLabel(label: string, currentAddressOverride?: number): number {
    const isPositive = label.includes("+");
    const depth = isPositive ? (label.match(/\+/g) || []).length : (label.match(/-/g) || []).length;
    const currentAddress = currentAddressOverride ?? this.host.snespos;
    const isMacroLocal = label.startsWith("?");

    if (this.host.pass === 0) {
      return 0;
    }

    if (!this.host.backwardLabels[depth] || this.host.backwardLabels[depth].length === 0) {
      throw new Error(`Error: No - label '${label}' found before ${currentAddress.toString(16)}.`);
    }

    const possibleTargets = this.host.backwardLabels[depth]
      .filter((entry) => {
        if (isMacroLocal && this.host.inMacroExpansion) {
          return entry.addr < currentAddress && entry.macroInstance === this.host.macroLabelInstance;
        }
        return entry.addr < currentAddress && !entry.macroInstance;
      })
      .map((entry) => entry.addr);

    if (possibleTargets.length === 0) {
      throw new Error(`Error: No - label '${label}' found before ${currentAddress.toString(16)}.`);
    }

    return Math.max(...possibleTargets);
  }

  setLabel(label: string, value?: number, isStatic = false, isMacroLabel = false, isGlobal = false, modifiesHierarchy = true): void {
    let fullLabel = label;
    let directScopeLabel: string | null = null;

    if (isMacroLabel && (label.startsWith("?") || label.startsWith("#"))) {
      const prefix = label.charAt(0);
      const labelName = label.substring(1);
      const macroModifiesHierarchy = prefix !== "#";

      if (prefix === "?") {
        if (labelName.startsWith(".")) {
          let recentMainLabel = "";
          for (const [key, entry] of this.host.labelTable.entries()) {
            if (
              entry.isMacroLabel &&
              key.startsWith(`:macro_${this.host.macroLabelInstance}_`) &&
              !key.includes("_SubLabel_")
            ) {
              const labelPart = key.substring(`:macro_${this.host.macroLabelInstance}_`.length);
              if (!labelPart.startsWith(".")) {
                recentMainLabel = labelPart;
              }
            }
          }

          fullLabel = `:macro_${this.host.macroLabelInstance}_${labelName}`;

          if (recentMainLabel) {
            const subLabelWithoutDot = labelName.substring(1);
            const parentChildLabel = `:macro_${this.host.macroLabelInstance}_${recentMainLabel}_${subLabelWithoutDot}`;
            const subAddr = value !== undefined ? value : this.host.snespos;
            this.host.labelTable.set(parentChildLabel, {
              value: subAddr,
              isStatic,
              isMacroLabel: true,
              macroInstance: this.host.macroLabelInstance,
              modifiesHierarchy: macroModifiesHierarchy,
            });
          }
        } else {
          fullLabel = `:macro_${this.host.macroLabelInstance}_${labelName}`;
        }
      } else {
        fullLabel = this.host.currentNamespace && !isGlobal ? `${this.host.currentNamespace}_${labelName}` : labelName;
      }
    } else if (!label.includes(":")) {
      const namespacePrefix = this.host.namespaceNestingEnabled ? this.host.namespaceNestingPath.join("_") : this.host.currentNamespace;

      if (this.host.currentNamespace && !isGlobal) {
        if (!label.startsWith(`${namespacePrefix}_`)) {
          fullLabel = `${namespacePrefix}_${label}`;

          if (this.host.namespaceNestingEnabled && this.host.namespaceNestingPath.length > 0 && modifiesHierarchy) {
            const leafNamespace = this.host.namespaceNestingPath[this.host.namespaceNestingPath.length - 1];
            const leafLabel = `${leafNamespace}_${label}`;
            const addr = value !== undefined ? value : this.host.snespos;

            this.host.labelTable.set(leafLabel, {
              value: addr,
              isStatic,
              isMacroLabel,
              macroInstance: isMacroLabel ? this.host.macroLabelInstance : undefined,
              modifiesHierarchy,
            });

            for (let i = this.host.namespaceNestingPath.length - 2; i >= 0; i--) {
              const partialPath = this.host.namespaceNestingPath.slice(i);
              const partialLabel = `${partialPath.join("_")}_${label}`;
              this.host.labelTable.set(partialLabel, {
                value: addr,
                isStatic,
                isMacroLabel,
                macroInstance: isMacroLabel ? this.host.macroLabelInstance : undefined,
                modifiesHierarchy,
              });
            }
          }
        }

        if (label.includes("_") && !label.startsWith(`${namespacePrefix}_`)) {
          directScopeLabel = label;
        }
      } else {
        fullLabel = label;
      }
    }

    const addr = value !== undefined ? value : this.host.snespos;

    if (this.host.pass === 0) {
      this.host.labelTable.set(fullLabel, {
        value: addr,
        isStatic,
        isMacroLabel,
        macroInstance: isMacroLabel ? this.host.macroLabelInstance : undefined,
        modifiesHierarchy,
      });

      if (directScopeLabel) {
        this.host.labelTable.set(directScopeLabel, {
          value: addr,
          isStatic,
          isMacroLabel,
          macroInstance: isMacroLabel ? this.host.macroLabelInstance : undefined,
          modifiesHierarchy: false,
        });
      }

      return;
    }

    if (this.host.pass === 2) {
      const existingEntry = this.host.labelTable.get(fullLabel);
      if (existingEntry) {
        if (existingEntry.isStatic !== isStatic) {
          throw new Error(`Label '${fullLabel}' is not static and cannot be used in conditionals.`);
        }

        if (!isStatic && existingEntry.value !== addr && !isMacroLabel) {
          throw new Error(`Label "${fullLabel}" changed from $${existingEntry.value.toString(16)} to $${addr.toString(16)}`);
        }
      }
    }

    if (this.host.pass === 3) {
      throw new Error(`Label '${fullLabel}' used in pass 3.`);
    }

    if (modifiesHierarchy && !label.startsWith(".")) {
      this.host.currentParentLabel = fullLabel;
      this.host.currentParentIsGlobal = isGlobal;
    }

    this.host.labelTable.set(fullLabel, {
      value: addr,
      isStatic,
      isMacroLabel,
      macroInstance: isMacroLabel ? this.host.macroLabelInstance : undefined,
      modifiesHierarchy,
    });

    if (directScopeLabel) {
      this.host.labelTable.set(directScopeLabel, {
        value: addr,
        isStatic,
        isMacroLabel,
        macroInstance: isMacroLabel ? this.host.macroLabelInstance : undefined,
        modifiesHierarchy: false,
      });
    }
  }

  resolveStructMember(compoundId: string): number {
    const firstId = compoundId.trim().match(/^([A-Z_a-z]\w*)/)?.[1];
    if (!firstId || !this.host.structs.has(firstId)) throw new Error(`Struct not found: ${compoundId}`);

    let rest = compoundId.substring(firstId.length).trim();
    let base = 0;
    let currentStruct = this.host.structs.get(firstId)!;

    while (rest.length > 0) {
      if (rest.startsWith(".")) {
        rest = rest.substring(1).trim();
        const memberMatch = rest.match(/^([A-Z_a-z]\w*)/);
        if (!memberMatch) throw new Error(`Invalid struct member: ${compoundId}`);
        const memberName = memberMatch[1];
        rest = rest.substring(memberName.length).trim();

        const memberOffset = currentStruct.labels.get(memberName);
        if (memberOffset !== undefined) {
          return base + memberOffset;
        }

        const childStruct = this.host.structs.get(memberName);
        if (childStruct && childStruct.parent === currentStruct.name) {
          currentStruct = childStruct;
        } else {
          throw new Error(`Struct member not found: ${currentStruct.name}.${memberName}`);
        }
      } else if (rest.startsWith("[")) {
        const bracketEnd = rest.indexOf("]");
        if (bracketEnd === -1) throw new Error(`Unclosed [ in struct ref: ${compoundId}`);
        const indexStr = rest.substring(1, bracketEnd).trim();
        const index = Number.parseInt(indexStr, 10);
        if (Number.isNaN(index) || index < 0) throw new Error(`Invalid struct index: ${indexStr}`);
        rest = rest.substring(bracketEnd + 1).trim();
        base += index * currentStruct.size;
      } else {
        break;
      }
    }

    return base;
  }

  getLabelValue(label: string, requireStatic: boolean): number {
    if (label.startsWith(".") && this.host.currentParentLabel) {
      const localName = label.substring(1);
      const parentParts = this.host.currentParentLabel.split("_").filter(Boolean);
      const candidates: string[] = [];

      if (parentParts[parentParts.length - 1] === localName) {
        candidates.push(this.host.currentParentLabel);
      }

      candidates.push(`${this.host.currentParentLabel}_${localName}`);

      for (let i = parentParts.length - 1; i > 0; i--) {
        candidates.push(`${parentParts.slice(0, i).join("_")}_${localName}`);
      }

      for (const candidate of candidates) {
        try {
          return this.getLabelValueDirect(candidate, requireStatic);
        } catch {}
      }
    }

    const isMacroLabelRef = label.startsWith("?");
    if (isMacroLabelRef && this.host.inMacroExpansion) {
      const labelName = label.substring(1);

      if (labelName.includes("_")) {
        const [parentPart, subPart] = labelName.split("_", 2);
        const childLabel = `:macro_${this.host.macroLabelInstance}_.${subPart}`;
        if (this.host.labelTable.has(childLabel)) {
          const entry = this.host.labelTable.get(childLabel)!;
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
          }
          return entry.value;
        }

        const parentChildLabel = `:macro_${this.host.macroLabelInstance}_${parentPart}_${subPart}`;
        if (this.host.labelTable.has(parentChildLabel)) {
          const entry = this.host.labelTable.get(parentChildLabel)!;
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
          }
          return entry.value;
        }
      }

      const macroLabel = `:macro_${this.host.macroLabelInstance}_${labelName}`;
      if (this.host.labelTable.has(macroLabel)) {
        const entry = this.host.labelTable.get(macroLabel)!;
        if (requireStatic && !entry.isStatic) {
          throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
        }
        return entry.value;
      }

      if (labelName.startsWith(".")) {
        const macroLabelNoDot = `:macro_${this.host.macroLabelInstance}_${labelName}`;
        if (this.host.labelTable.has(macroLabelNoDot)) {
          const entry = this.host.labelTable.get(macroLabelNoDot)!;
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
          }
          return entry.value;
        }
      }
    }

    if (label.includes(":") || label.includes("_")) {
      return this.getLabelValueDirect(label, requireStatic);
    }

    if (this.host.namespaceNestingEnabled && this.host.namespaceNestingPath.length > 0) {
      for (let i = this.host.namespaceNestingPath.length; i >= 0; i--) {
        const namespacePath = this.host.namespaceNestingPath.slice(0, i);
        const namespacePrefix = namespacePath.join("_");
        const fullLabel = namespacePrefix ? `${namespacePrefix}_${label}` : label;

        try {
          return this.getLabelValueDirect(fullLabel, requireStatic);
        } catch {
          continue;
        }
      }
    }

    return this.getLabelValueDirect(
      this.host.currentNamespace ? `${this.host.currentNamespace}_${label}` : label,
      requireStatic,
    );
  }

  getLabelValueDirect(label: string, requireStatic: boolean): number {
    if (label.includes("_") && !label.includes(":")) {
      const parts = label.split("_");
      if (parts.length === 2) {
        const parentLabel = parts[0];
        const localLabel = `.${parts[1]}`;
        const combinedLabel = `${parentLabel}_${localLabel.replace(/^\./, "")}`;

        if (this.host.labelTable.has(combinedLabel)) {
          const entry = this.host.labelTable.get(combinedLabel)!;
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static label '${combinedLabel}' used in conditional.`);
          }
          return entry.value;
        }

        if (this.host.labelTable.has(localLabel)) {
          const entry = this.host.labelTable.get(localLabel)!;
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static label '${localLabel}' used in conditional.`);
          }
          return entry.value;
        }

        if (this.host.pass === 0) {
          return 0;
        }
      }
    }

    if (!this.host.labelTable.has(label)) {
      if (this.host.pass === 0) {
        return 0;
      }
      throw new Error(`Error: Label '${label}' not found.`);
    }

    const entry = this.host.labelTable.get(label)!;
    if (requireStatic && !entry.isStatic) {
      throw new Error(`Error: Non-static label '${label}' used in conditional.`);
    }

    return entry.value;
  }

  getObjectSize(identifier: string, baseOnly = false): number {
    let workingIdentifier = identifier;
    if (workingIdentifier.startsWith('"') && workingIdentifier.endsWith('"')) {
      workingIdentifier = workingIdentifier.substring(1, workingIdentifier.length - 1);
    }

    if (this.host.structs.has(workingIdentifier)) {
      const def = this.host.structs.get(workingIdentifier)!;
      if (baseOnly) {
        return def.size;
      }
      return !def.parent ? def.size + (def.extensionSize || 0) : def.size;
    }

    if (workingIdentifier.includes(".")) {
      const parts = workingIdentifier.split(".").filter(Boolean);
      let current = parts[0];
      if (!this.host.structs.has(current)) {
        throw new Error(`Struct '${workingIdentifier}' doesn't exist.`);
      }
      for (let i = 1; i < parts.length; i++) {
        const child = parts[i];
        const childDef = this.host.structs.get(child);
        if (!childDef || childDef.parent !== current) {
          throw new Error(`Struct '${workingIdentifier}' doesn't exist.`);
        }
        current = child;
      }
      workingIdentifier = current;
    }

    if (!this.host.structs.has(workingIdentifier)) {
      throw new Error(`Struct '${workingIdentifier}' doesn't exist.`);
    }

    const def = this.host.structs.get(workingIdentifier)!;
    if (baseOnly) {
      return def.size;
    }

    return !def.parent ? def.size + (def.extensionSize || 0) : def.size;
  }

  handleLabelDefinition(labelName: string): void {
    if (labelName.startsWith(".") || labelName.startsWith("#.")) {
      if (!this.host.currentParentLabel) {
        throw new Error("Sublabel without parent label");
      }

      const isHashLabel = labelName.startsWith("#");
      const modifiesHierarchy = !isHashLabel;

      let dotCount = 0;
      while (labelName[dotCount] === ".") {
        dotCount++;
      }

      const subLabelName = labelName.substring(dotCount);

      if (dotCount === 1) {
        const directScopeLabel = `${this.host.currentParentLabel}_${subLabelName}`;
        this.setLabel(directScopeLabel, undefined, false, false, this.host.currentParentIsGlobal, modifiesHierarchy);

        if (this.host.currentNamespace) {
          const namespacePrefix = this.host.namespaceNestingEnabled ? this.host.namespaceNestingPath.join("_") : this.host.currentNamespace;
          if (!directScopeLabel.startsWith(`${namespacePrefix}_`)) {
            const namespacedLabel = `${namespacePrefix}_${directScopeLabel}`;
            this.setLabel(namespacedLabel, undefined, false, false, false, modifiesHierarchy);
          }
        }
      } else {
        const namespacePrefix = this.host.namespaceNestingEnabled ? this.host.namespaceNestingPath.join("_") : this.host.currentNamespace;
        const namespacedParent = this.host.currentNamespace ? `${namespacePrefix}_${this.host.currentParentLabel}` : this.host.currentParentLabel;

        let fullParentPath = this.host.currentParentLabel;
        for (const [key, entry] of this.host.labelTable.entries()) {
          if (entry.modifiesHierarchy && key.includes("_") && (key === namespacedParent || key.startsWith(`${namespacedParent}_`))) {
            const localPart = key.substring(key.indexOf(this.host.currentParentLabel));
            if (localPart.split("_").length > fullParentPath.split("_").length) {
              fullParentPath = localPart;
            }
          }
        }

        const parentParts = fullParentPath.split("_");
        let relevantParent = parentParts[0];
        for (let i = 1; i < parentParts.length; i++) {
          if (i < dotCount) {
            relevantParent += `_${parentParts[i]}`;
          }
        }

        const directScopeLabel = `${relevantParent}_${subLabelName}`;
        this.setLabel(directScopeLabel, undefined, false, false, this.host.currentParentIsGlobal, modifiesHierarchy);

        if (this.host.currentNamespace) {
          if (!directScopeLabel.startsWith(`${namespacePrefix}_`)) {
            const namespacedLabel = `${namespacePrefix}_${directScopeLabel}`;
            this.setLabel(namespacedLabel, undefined, false, false, false, modifiesHierarchy);
          }
        }
      }

      return;
    }

    const isHashLabel = labelName.startsWith("#");
    const modifiesHierarchy = !isHashLabel;

    if (modifiesHierarchy) {
      this.host.currentParentLabel = labelName;
      this.host.currentParentIsGlobal = false;
    }

    this.setLabel(labelName, undefined, false, false, false, modifiesHierarchy);

    if (this.host.currentNamespace) {
      const namespacePrefix = this.host.namespaceNestingEnabled ? this.host.namespaceNestingPath.join("_") : this.host.currentNamespace;
      if (!labelName.startsWith(`${namespacePrefix}_`)) {
        const namespacedLabel = `${namespacePrefix}_${labelName}`;
        this.setLabel(namespacedLabel, undefined, false, false, false, modifiesHierarchy);
      }
    }
  }
}
