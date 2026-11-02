/**
 * Native PPU decision at one completing port write. Physical byte writes retain
 * order, including repeated destinations. No source instruction or A-bus read is inferred.
 * Raster positions stay in the ordered archive instead of multiplying SQL variants.
 */
export interface RuntimePPUEffect {
  /** Destination memory region selected by the completing PPU port write. */
  readonly target: "vram" | "cgram" | "oam";
  /** Whether bytes landed, were blocked, or only latched a pending transfer. */
  readonly outcome: "written" | "blocked" | "latched";
  /** True when forced blanking prevented visible updates regardless of port data. */
  readonly forcedBlank: boolean;
  /** True when active rendering rules restricted the write even without forced blank. */
  readonly renderingRestricted: boolean;
  /** Emulator fidelity tier that produced the decision flags. */
  readonly implementation: "accurate" | "performance";
  /** Physical capacity for VRAM. Null for CGRAM/OAM. */
  readonly vramBytes: 65536 | 131072 | null;
  /** Physical byte destinations emitted for a written outcome, in port order. */
  readonly bytes: readonly { readonly address: number; readonly value: number }[];
}

/** Narrow parsed JSON to a plain object record. */
function isEffectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Accept only the supported SNES VRAM capacity constants. */
function isVramBytes(value: unknown): value is 65536 | 131072 {
  return value === 65536 || value === 131072;
}

/** Accept finite integers for address and byte value fields. */
function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/**
 * Validate a native effect independently of transport framing or stored JSON.
 * @param effect Claimed physical writes and decision flags.
 * @param access Completing bus operation.
 * @returns Fresh semantic value with canonical property order, excluding raster.
 */
export const normalizeRuntimePPUEffect = (
  effect: unknown,
  access: { readonly address: unknown; readonly direction: unknown; readonly value: unknown },
): RuntimePPUEffect => {
  const accessAddress = access.address;
  const accessValue = access.value;
  const accessDirection = access.direction;
  if (
    typeof accessAddress !== "number" ||
    typeof accessValue !== "number" ||
    typeof accessDirection !== "string"
  ) {
    throw new Error("Invalid native PPU effect identity or flags.");
  }
  const port = accessAddress & 0xffff;
  let target: RuntimePPUEffect["target"] = "vram";
  if (port === 0x2104) {
    target = "oam";
  }
  if (port === 0x2122) {
    target = "cgram";
  }
  const effectRecord = isEffectRecord(effect) ? effect : undefined;
  const outcome = effectRecord?.outcome;
  const forcedBlank = effectRecord?.forcedBlank;
  const renderingRestricted = effectRecord?.renderingRestricted;
  const implementation = effectRecord?.implementation;
  const vramBytes = effectRecord?.vramBytes;
  const rawBytes = effectRecord?.bytes;
  if (
    !effectRecord ||
    accessDirection !== "write" ||
    accessAddress & 0x400000 ||
    ![0x2104, 0x2118, 0x2119, 0x2122].includes(port) ||
    effectRecord.target !== target ||
    (outcome !== "written" && outcome !== "blocked" && outcome !== "latched") ||
    typeof forcedBlank !== "boolean" ||
    typeof renderingRestricted !== "boolean" ||
    (forcedBlank && renderingRestricted) ||
    (implementation !== "accurate" && implementation !== "performance") ||
    (target === "vram" ? !isVramBytes(vramBytes) : vramBytes !== null) ||
    !Array.isArray(rawBytes) ||
    rawBytes.length > 2
  ) {
    throw new Error("Invalid native PPU effect identity or flags.");
  }
  const count = rawBytes.length;
  const capacity = target === "vram" && isVramBytes(vramBytes) ? vramBytes : null;
  if (
    (outcome === "written" &&
      (count === 0 || (target === "vram" && count !== 1) || (target === "cgram" && count !== 2))) ||
    (outcome !== "written" && count !== 0) ||
    (outcome === "blocked" && (target !== "vram" || !renderingRestricted)) ||
    (outcome === "latched" && (target === "vram" || renderingRestricted))
  ) {
    throw new Error("Invalid native PPU outcome or write count.");
  }
  let bound = capacity ?? 0;
  if (target === "cgram") {
    bound = 512;
  }
  if (target === "oam") {
    bound = 544;
  }
  const byteEntries: readonly unknown[] = rawBytes;
  let firstAddress = 0;
  const bytes = byteEntries.map((entry, i) => {
    const byte = isEffectRecord(entry) ? entry : undefined;
    if (!byte) {
      throw new Error("Invalid native PPU byte destination or value.");
    }
    const address = byte.address;
    const byteValue = byte.value;
    if (!isInteger(address) || !isInteger(byteValue)) {
      throw new Error("Invalid native PPU byte destination or value.");
    }
    if (
      address < 0 ||
      address >= bound ||
      byteValue < 0 ||
      byteValue > 255 ||
      (target === "vram" && ((address & 1) !== (port & 1) || byteValue !== accessValue)) ||
      (target === "cgram" &&
        (i === 0
          ? (address & 1) !== 0
          : address !== firstAddress + 1 || byteValue !== (accessValue & 127))) ||
      (target === "oam" && i === count - 1 && byteValue !== accessValue)
    ) {
      throw new Error("Invalid native PPU byte destination or value.");
    }
    if (i === 0) {
      firstAddress = address;
    }
    return { address, value: byteValue };
  });
  return {
    target,
    outcome,
    forcedBlank,
    renderingRestricted,
    implementation,
    vramBytes: capacity,
    bytes,
  };
};
