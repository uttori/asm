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
  mode: "layout" | "emit";
  enforceResolvedLabels: boolean;
  isDefinitionCollectionStage: boolean;
  currentTargetAddress: number;
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
  currentGlobalParentLabel: string;
  labelParents: Map<string, string | null>;
  structs: Map<string, StructDefinition>;
}

export class SymbolScopeService {
  constructor(readonly host: SymbolScopeHost) {}

  isMissingLabelError(error: unknown): boolean {
    return error instanceof Error && error.message.startsWith("Error: Label '");
  }

  findNearestHierarchyAncestor(label: string): string | null {
    for (let i = label.length - 1; i >= 0; i--) {
      if (label[i] !== "_") {
        continue;
      }
      const candidate = label.slice(0, i);
      if (!candidate) {
        continue;
      }
      const entry = this.host.labelTable.get(candidate);
      if (entry?.modifiesHierarchy) {
        return candidate;
      }
    }

    return null;
  }

  getHierarchyChain(label: string): string[] {
    const rootLabel = this.host.currentGlobalParentLabel;
    const rootApplies = Boolean(rootLabel) && (label === rootLabel || label.startsWith(`${rootLabel}_`));
    const chain = [label];
    let cursor = label;
    while (true) {
      const explicitParent = this.host.labelParents.get(cursor);
      const parent = explicitParent === undefined ? this.findNearestHierarchyAncestor(cursor) : explicitParent;
      if (!parent) {
        break;
      }
      chain.unshift(parent);
      // Labels such as `arthur_sprites` can coexist with unrelated globals like
      // `arthur`. Once we have climbed back to the active global root, stop so
      // shorter prefix labels do not hijack nested local ancestry.
      if (rootApplies && parent === rootLabel) {
        break;
      }
      cursor = parent;
    }
    return chain;
  }

  getAncestorPrefixes(label: string): string[] {
    const prefixes: string[] = [];
    for (let i = label.length - 1; i >= 0; i--) {
      if (label[i] !== "_") {
        continue;
      }
      const candidate = label.slice(0, i);
      if (candidate) {
        prefixes.push(candidate);
      }
    }
    return prefixes;
  }

  getScopedParentLabel(dotCount: number): string {
    const current = this.host.currentParentLabel;
    if (dotCount === 1) {
      if (this.host.currentGlobalParentLabel) {
        return this.host.currentGlobalParentLabel;
      }
      if (this.host.currentParentIsGlobal) {
        // Global labels such as `stage1_earthquake_tiles` legitimately contain
        // underscores. Preserve the full global label as the parent for `.child`
        // definitions instead of treating those underscores as hierarchy breaks.
        return current;
      }
      const chain = this.getHierarchyChain(current);
      return chain[0] ?? current;
    }

    if (this.host.currentParentIsGlobal) {
      return current;
    }

    const chain = this.getHierarchyChain(current);
    const targetDepth = dotCount - 1;
    return chain[targetDepth] ?? current;
  }

  /**
   * Checks if a label is in scope.
   * @param {string} identifier The label to check.
   * @returns {boolean} `true` if the label is in scope, `false` otherwise.
   */
  hasLabelInScope(identifier: string): boolean {
    return this.host.labelTable.has(identifier) ||
      (this.host.currentNamespace ? this.host.labelTable.has(`${this.host.currentNamespace}_${identifier}`) : false);
  }

  /**
   * Handles a relative label.
   * @param {string} label The label to handle.
   * @returns {number} The address of the label.
   */
  handleRelativeLabel(label: string): number {
    const isPositive = label.includes("+");
    const depth = isPositive ? (label.match(/\+/g) || []).length : (label.match(/-/g) || []).length;
    const snesAddress = this.host.currentTargetAddress;
    const isMacroLocal = label.startsWith("?");

    if (this.host.enforceResolvedLabels) {
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

  /**
   * Finds the next label.
   * @param {string} label The label to find.
   * @param {number} currentAddressOverride The current address to override.
   * @returns {number} The address of the next label.
   */
  findNextLabel(label: string, currentAddressOverride?: number): number {
    const isPositive = label.includes("+");
    const depth = isPositive ? (label.match(/\+/g) || []).length : (label.match(/-/g) || []).length;
    const currentAddress = currentAddressOverride ?? this.host.currentTargetAddress;
    const isMacroLocal = label.startsWith("?");

    if (!this.host.enforceResolvedLabels) {
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
        // Inline constructs such as `bcs + : +:` define the target label at the
        // branch reference address itself (right after the branch instruction),
        // so treat same-address forward labels as valid next targets.
        return entry.addr >= currentAddress && !entry.macroInstance;
      })
      .map((entry) => entry.addr);

    if (possibleTargets.length === 0) {
      throw new Error(`Error: No + label '${label}' found after ${currentAddress.toString(16)}.`);
    }

    return Math.min(...possibleTargets);
  }

  /**
   * Finds the previous label.
   * @param {string} label The label to find.
   * @param {number} currentAddressOverride The current address to override.
   * @returns {number} The address of the previous label.
   */
  findPreviousLabel(label: string, currentAddressOverride?: number): number {
    const isPositive = label.includes("+");
    const depth = isPositive ? (label.match(/\+/g) || []).length : (label.match(/-/g) || []).length;
    const currentAddress = currentAddressOverride ?? this.host.currentTargetAddress;
    const isMacroLocal = label.startsWith("?");

    if (this.host.isDefinitionCollectionStage) {
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

  /**
   * Sets a label.
   * @param {string} label The label to set.
   * @param {number} value The value of the label.
   * @param {boolean} isStatic Whether the label is static.
   * @param {boolean} isMacroLabel Whether the label is a macro label.
   * @param {boolean} isGlobal Whether the label is global.
   * @param {boolean} modifiesHierarchy Whether the label modifies the hierarchy.
   */
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
            const subAddr = value !== undefined ? value : this.host.currentTargetAddress;
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
            const addr = value !== undefined ? value : this.host.currentTargetAddress;

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

    const addr = value !== undefined ? value : this.host.currentTargetAddress;

    if (this.host.isDefinitionCollectionStage) {
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

      return;
    }

    if (this.host.enforceResolvedLabels) {
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

  /**
   * Resolves a struct member.
   * @param {string} compoundId The compound ID of the struct member.
   * @returns {number} The address of the struct member.
   */
  resolveStructMember(compoundId: string): number {
    const firstId = compoundId.trim().match(/^([A-Z_a-z]\w*)/)?.[1];
    if (!firstId || !this.host.structs.has(firstId)) throw new Error(`Struct not found: ${compoundId}`);

    let rest = compoundId.substring(firstId.length).trim();
    let base = 0;
    let currentStruct = this.host.structs.get(firstId);

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
        if (Number.isNaN(index)) throw new Error(`Invalid struct index: ${indexStr}`);
        rest = rest.substring(bracketEnd + 1).trim();
        base += index * currentStruct.size;
      } else {
        break;
      }
    }

    return base;
  }

  /**
   * Gets the value of a label.
   * @param {string} label The label to get the value of.
   * @param {boolean} requireStatic Whether the label must be static.
   * @returns {number} The value of the label.
   */
  getLabelValue(label: string, requireStatic: boolean): number {
    if (label.startsWith(".") && this.host.currentParentLabel) {
      let dotCount = 0;
      while (label[dotCount] === ".") {
        dotCount++;
      }
      const localName = label.substring(dotCount);
      const candidates = new Set<string>();
      const nestedLocalParts = localName.split("_").filter(Boolean);
      const hierarchyChain = this.getHierarchyChain(this.host.currentParentLabel);

      if (dotCount === 1 && this.host.currentParentLabel.endsWith(`_${localName}`)) {
        candidates.add(this.host.currentParentLabel);
      }

      const addExactLocalCandidate = (parentPrefix: string): void => {
        candidates.add(`${parentPrefix}_${localName}`);
      };

      const addShortenedLocalCandidates = (parentPrefix: string): void => {
        // Local labels such as `.idx_beginner` are used to reference nested
        // multi-dot labels defined under `.idx` as `..beginner`. Since `_` is
        // both a legal label character and our hierarchy separator, also try
        // progressively shorter local tails against ancestor prefixes.
        for (let i = 1; i < nestedLocalParts.length; i++) {
          candidates.add(`${parentPrefix}_${nestedLocalParts.slice(i).join("_")}`);
        }
      };

      // Prefer labels nested directly under the current local block. Source
      // trees such as `.underwear` -> `..idle` rely on this producing
      // `parent_underwear_idle` rather than collapsing back to an ancestor.
      addExactLocalCandidate(this.host.currentParentLabel);

      for (const ancestorPrefix of this.getAncestorPrefixes(this.host.currentParentLabel)) {
        addExactLocalCandidate(ancestorPrefix);
      }

      for (let i = hierarchyChain.length - 2; i >= 0; i--) {
        addExactLocalCandidate(hierarchyChain[i]);
      }

      addShortenedLocalCandidates(this.host.currentParentLabel);

      for (const ancestorPrefix of this.getAncestorPrefixes(this.host.currentParentLabel)) {
        addShortenedLocalCandidates(ancestorPrefix);
      }

      for (let i = hierarchyChain.length - 2; i >= 0; i--) {
        addShortenedLocalCandidates(hierarchyChain[i]);
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
          const entry = this.host.labelTable.get(childLabel);
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
          }
          return entry.value;
        }

        const parentChildLabel = `:macro_${this.host.macroLabelInstance}_${parentPart}_${subPart}`;
        if (this.host.labelTable.has(parentChildLabel)) {
          const entry = this.host.labelTable.get(parentChildLabel);
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
          }
          return entry.value;
        }
      }

      const macroLabel = `:macro_${this.host.macroLabelInstance}_${labelName}`;
      if (this.host.labelTable.has(macroLabel)) {
        const entry = this.host.labelTable.get(macroLabel);
        if (requireStatic && !entry.isStatic) {
          throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
        }
        return entry.value;
      }

      if (labelName.startsWith(".")) {
        const macroLabelNoDot = `:macro_${this.host.macroLabelInstance}_${labelName}`;
        if (this.host.labelTable.has(macroLabelNoDot)) {
          const entry = this.host.labelTable.get(macroLabelNoDot);
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
        } catch (error) {
          if (!this.isMissingLabelError(error)) {
            throw error;
          }
          continue;
        }
      }
    }

    if (this.host.currentNamespace) {
      try {
        return this.getLabelValueDirect(`${this.host.currentNamespace}_${label}`, requireStatic);
      } catch (error) {
        if (!this.isMissingLabelError(error)) {
          throw error;
        }
        // Object namespaces frequently reference shared globals such as
        // `difficulty`. If the namespaced symbol is absent, fall back to the
        // unqualified global label before reporting an error.
      }
    }

    return this.getLabelValueDirect(label, requireStatic);
  }

  /**
   * Gets the value of a label directly.
   * @param {string} label The label to get the value of.
   * @param {boolean} requireStatic Whether the label must be static.
   * @returns {number} The value of the label.
   */
  getLabelValueDirect(label: string, requireStatic: boolean): number {
    if (label.includes("_") && !label.includes(":")) {
      const parts = label.split("_");
      if (parts.length === 2) {
        const parentLabel = parts[0];
        const localLabel = `.${parts[1]}`;
        const combinedLabel = `${parentLabel}_${localLabel.replace(/^\./, "")}`;

        if (this.host.labelTable.has(combinedLabel)) {
          const entry = this.host.labelTable.get(combinedLabel);
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static label '${combinedLabel}' used in conditional.`);
          }
          return entry.value;
        }

        if (this.host.labelTable.has(localLabel)) {
          const entry = this.host.labelTable.get(localLabel);
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static label '${localLabel}' used in conditional.`);
          }
          return entry.value;
        }

        if (this.host.isDefinitionCollectionStage) {
          return 0;
        }
      }
    }

    if (!this.host.labelTable.has(label)) {
      if (this.host.isDefinitionCollectionStage) {
        return 0;
      }
      throw new Error(`Error: Label '${label}' not found.`);
    }

    const entry = this.host.labelTable.get(label);
    if (requireStatic && !entry.isStatic) {
      throw new Error(`Error: Non-static label '${label}' used in conditional.`);
    }

    return entry.value;
  }

  /**
   * Gets the size of a struct or extension.
   * @param {string} identifier The identifier of the struct or extension.
   * @param {boolean} [baseOnly] If true, returns only the base size without extensions.
   * @returns {number} The size of the struct or extension.
   * @throws {Error} If the struct or extension doesn't exist.
   */
  getObjectSize(identifier: string, baseOnly = false): number {
    let workingIdentifier = identifier;
    if (workingIdentifier.startsWith('"') && workingIdentifier.endsWith('"')) {
      workingIdentifier = workingIdentifier.substring(1, workingIdentifier.length - 1);
    }

    if (this.host.structs.has(workingIdentifier)) {
      const def = this.host.structs.get(workingIdentifier);
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

    const def = this.host.structs.get(workingIdentifier);
    if (baseOnly) {
      return def.size;
    }

    return !def.parent ? def.size + (def.extensionSize || 0) : def.size;
  }

  /**
   * Handles a label definition.
   * @param {string} labelName The name of the label.
   */
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
      const parentLabel = this.getScopedParentLabel(dotCount);
      const directScopeLabel = `${parentLabel}_${subLabelName}`;
      this.host.labelParents.set(directScopeLabel, parentLabel);
      this.setLabel(directScopeLabel, undefined, false, false, false, modifiesHierarchy);

      if (modifiesHierarchy) {
        this.host.currentParentLabel = directScopeLabel;
        // Single-dot labels become the local root for following `..` labels even
        // when their names contain underscores, e.g. `.stage1_boss` -> `..ch8`.
        this.host.currentParentIsGlobal = dotCount === 1;
      }

      if (this.host.currentNamespace) {
        const namespacePrefix = this.host.namespaceNestingEnabled ? this.host.namespaceNestingPath.join("_") : this.host.currentNamespace;
        if (!directScopeLabel.startsWith(`${namespacePrefix}_`)) {
          const namespacedLabel = `${namespacePrefix}_${directScopeLabel}`;
          this.setLabel(namespacedLabel, undefined, false, false, false, modifiesHierarchy);
        }
      }

      return;
    }

    const isHashLabel = labelName.startsWith("#");
    const modifiesHierarchy = !isHashLabel;

    if (modifiesHierarchy) {
      this.host.currentParentLabel = labelName;
      this.host.currentParentIsGlobal = true;
      this.host.currentGlobalParentLabel = labelName;
    }

    this.host.labelParents.set(labelName, null);
    this.setLabel(labelName, undefined, false, false, false, modifiesHierarchy);

    if (modifiesHierarchy) {
      this.host.currentParentLabel = labelName;
      this.host.currentParentIsGlobal = true;
      this.host.currentGlobalParentLabel = labelName;
    }

    if (this.host.currentNamespace) {
      const namespacePrefix = this.host.namespaceNestingEnabled ? this.host.namespaceNestingPath.join("_") : this.host.currentNamespace;
      if (!labelName.startsWith(`${namespacePrefix}_`)) {
        const namespacedLabel = `${namespacePrefix}_${labelName}`;
        this.setLabel(namespacedLabel, undefined, false, false, false, modifiesHierarchy);
      }
    }
  }
}
