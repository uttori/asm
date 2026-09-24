import type { Assembler } from "../assembler.js";
import type { ParsedAssetCall, AssetValueNode } from "../ir/asset-call.js";
import type {
  AssetFormatResult,
  AssetSource,
  AssetTransformContribution,
} from "../plugin/contracts.js";

/** One build owns its bytes and conversions across all three passes. */
export class AssetAssemblyService {
  /** A single asset stage may not allocate or emit more than this many bytes. */
  static readonly MAX_STAGE_BYTES = 16 * 1024 * 1024;
  readonly dependencies = new Map<string, "binary" | "resource">();
  readonly #files = new Map<string, Uint8Array>();
  readonly #conversions = new Map<string, AssetFormatResult>();
  readonly #emissions = new Map<string, Uint8Array>();
  /** Descriptor of the most recent successful statement, consumed immediately by emission metadata. */
  lastEmission?: Readonly<{
    sourcePath: string;
    format: string;
    part: string;
    size: number;
    transforms: readonly string[];
  }>;

  constructor(readonly session: Assembler) {}

  /** Drop all snapshots before the next build; disk changes then become visible. */
  beginBuild(): void {
    this.dependencies.clear();
    this.#files.clear();
    this.#conversions.clear();
    this.#emissions.clear();
    this.lastEmission = undefined;
  }

  /** Return the exact bytes consumed by this build for dependency fingerprints.
   * @param {string} path Provider identity.
   * @returns {Uint8Array | undefined} Owned snapshot copy, when the path was read.
   */
  snapshot(path: string): Uint8Array | undefined {
    return this.#files.get(path)?.slice();
  }

  /** Evaluate a typed literal. Numeric expressions may use defines but no layout symbols.
   * @param {AssetValueNode} node Typed source value.
   * @returns {unknown} Plain value passed to a format or transform.
   */
  #value(node: AssetValueNode): unknown {
    if (node.kind === "string") {
      return this.session.defineEngine.resolveDefinesInStringLiteral(node.value);
    }
    if (node.kind === "boolean") {
      return node.value;
    }
    if (node.kind === "array") {
      return node.items.map((item) => this.#value(item));
    }
    if (node.kind === "object") {
      return Object.fromEntries(
        Object.entries(node.entries).map(([key, item]) => [key, this.#value(item)]),
      );
    }
    let expanded = node.expression;
    // General symbol replacement can reinterpret numeric tokens as relative
    // labels during definition collection. Expand only explicit !defines here.
    for (let depth = 0; depth < 32; depth++) {
      const next = this.session.defineEngine.resolveRegularDefines(expanded);
      if (next === expanded) {
        break;
      }
      expanded = next;
      if (depth === 31) {
        throw new Error("includeAsset numeric define expansion is recursive.");
      }
    }
    const withoutLiterals = expanded.replace(/\$[\da-f]+|0x[\da-f]+|%[01]+/gi, "0");
    if (/[!?A-Z_a-z]/.test(withoutLiterals)) {
      throw new Error(
        `includeAsset numeric option '${node.expression}' must be layout-independent.`,
      );
    }
    const value = this.session.mathCore.math(expanded);
    if (!Number.isFinite(value)) {
      throw new Error(`includeAsset numeric option '${node.expression}' is not finite.`);
    }
    return value;
  }

  /** Resolve a provider path using the current source, macro and include search order.
   * @param {string} path Source-relative path.
   * @returns {string} Stable provider identity.
   */
  #resolve(path: string): string {
    const resolved = this.session.fileProvider.resolvePath(
      path,
      this.session.includeSource.resolutionOptions,
    );
    if (!resolved) {
      throw new Error(`includeAsset cannot find '${path}'.`);
    }
    return resolved;
  }

  /** Snapshot each dependency once, even if a provider changes during later passes.
   * @param {string} path Provider identity.
   * @param {"binary" | "resource"} kind Dependency role.
   * @returns {Uint8Array} Build-owned bytes.
   */
  #read(path: string, kind: "binary" | "resource"): Uint8Array {
    const cached = this.#files.get(path);
    if (cached) {
      return cached;
    }
    const bytes = this.session.fileProvider.readFile(path).slice();
    this.#files.set(path, bytes);
    this.dependencies.set(path, kind);
    return bytes;
  }

  /** Media type is inferred only from a declared, supported input extension.
   * @param {string} path Provider identity.
   * @returns {string} Portable media type.
   */
  #mediaType(path: string): string {
    const extension = path.toLowerCase().split(".").pop();
    if (extension === "png") {
      return "image/png";
    }
    if (extension === "wav" || extension === "wave") {
      return "audio/wav";
    }
    if (extension === "json") {
      return "application/json";
    }
    return "application/octet-stream";
  }

  /** Canonical serialization makes equivalent option objects share one conversion.
   * @param {unknown} value JSON-compatible request value.
   * @returns {string} Stable identity fragment.
   */
  #stable(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.#stable(item)).join(",")}]`;
    }
    if (value && typeof value === "object") {
      return `{${Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.#stable(item)}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  /** Apply a transform's closed scalar schema before it can read resources.
   * @param {AssetTransformContribution} provider Registered transform.
   * @param {Readonly<Record<string, unknown>>} options Source options.
   * @returns {string[]} Resource-valued option paths.
   */
  #validateTransformOptions(
    provider: Readonly<AssetTransformContribution>,
    options: Readonly<Record<string, unknown>>,
  ): string[] {
    const schema = provider.optionSchema;
    if (!schema) {
      return [];
    }
    for (const key of Object.keys(options)) {
      if (!Object.hasOwn(schema, key)) {
        throw new Error(`Asset transform '${provider.id}' has unknown option '${key}'.`);
      }
    }
    const resources: string[] = [];
    for (const [key, field] of Object.entries(schema)) {
      const value = options[key];
      if (value === undefined) {
        if (field.required) {
          throw new Error(`Asset transform '${provider.id}' requires option '${key}'.`);
        }
        continue;
      }
      let validType = false;
      if (field.type === "integer") {
        validType = Number.isSafeInteger(value);
      } else if (field.type === "enum") {
        validType = Array.isArray(field.enum) && field.enum.some((item) => item === value);
      } else {
        validType = typeof value === field.type;
      }
      const matchesEnum = !field.enum || field.enum.some((item) => item === value);
      const withinRange =
        typeof value !== "number" ||
        ((field.minimum === undefined || value >= field.minimum) &&
          (field.maximum === undefined || value <= field.maximum));
      if (!validType || !matchesEnum || !withinRange) {
        throw new Error(`Asset transform '${provider.id}' has invalid option '${key}'.`);
      }
      if (field.resource) {
        if (typeof value !== "string" || !value) {
          throw new Error(`Asset transform '${provider.id}' requires a resource path in '${key}'.`);
        }
        resources.push(value);
      }
    }
    return resources;
  }

  /** Resolve input and declared resource paths for tooling without reading or converting bytes.
   * @param {ParsedAssetCall} call Typed source directive.
   */
  discoverDependencies(call: ParsedAssetCall): void {
    const options = Object.fromEntries(
      Object.entries(call.options).map(([key, node]) => [key, this.#value(node)]),
    );
    const sourcePath = this.#resolve(this.#value(call.path) as string);
    const formatName = this.#value(call.format) as string;
    const format = this.session.environment.getAssetFormat(formatName, this.session.targetId);
    if (!format) {
      throw new Error(
        `includeAsset format '${formatName}' is unavailable on '${this.session.targetId}'.`,
      );
    }
    this.dependencies.set(sourcePath, "binary");
    const transformSpec = options.compress;
    delete options.output;
    delete options.compress;
    delete options.compressOptions;
    delete options.maxSize;
    for (const resourceName of format.resourcePaths?.(options) ?? []) {
      this.dependencies.set(this.#resolve(resourceName), "resource");
    }
    // Compression dictionaries and other schema-declared inputs also invalidate analysis.
    let transforms: unknown[] = [];
    if (typeof transformSpec === "string") {
      const compressOptions = call.options.compressOptions;
      transforms = [
        { id: transformSpec, options: compressOptions ? this.#value(compressOptions) : {} },
      ];
    } else if (Array.isArray(transformSpec)) {
      transforms = transformSpec;
    }
    for (const item of transforms) {
      if (!item || typeof item !== "object" || !("id" in item) || typeof item.id !== "string") {
        continue;
      }
      const transform = this.session.environment.getAssetTransform(item.id, this.session.targetId);
      if (!transform) {
        continue;
      }
      const suppliedOptions = "options" in item ? item.options : undefined;
      const transformOptions =
        suppliedOptions && typeof suppliedOptions === "object"
          ? (suppliedOptions as Record<string, unknown>)
          : {};
      const names = [
        ...this.#validateTransformOptions(transform, transformOptions),
        ...(transform.resourcePaths?.(transformOptions) ?? []),
      ];
      for (const name of new Set(names)) {
        this.dependencies.set(this.#resolve(name), "resource");
      }
    }
  }

  /** Convert and select one complete byte stream before touching output state.
   * @param {ParsedAssetCall} call Typed source directive.
   * @returns {Uint8Array} Snapshot-owned bytes shared across assembly passes.
   */
  materialize(call: ParsedAssetCall): Uint8Array {
    const options = Object.fromEntries(
      Object.entries(call.options).map(([key, node]) => [key, this.#value(node)]),
    );
    const sourcePath = this.#resolve(this.#value(call.path) as string);
    const formatName = this.#value(call.format) as string;
    const format = this.session.environment.getAssetFormat(formatName, this.session.targetId);
    if (!format) {
      throw new Error(
        `includeAsset format '${formatName}' is unavailable on '${this.session.targetId}'.`,
      );
    }
    const output = options.output;
    const compress = options.compress;
    const compressOptions = options.compressOptions;
    const maxSize = options.maxSize;
    delete options.output;
    delete options.compress;
    delete options.compressOptions;
    delete options.maxSize;
    if (output !== undefined && typeof output !== "string") {
      throw new Error("includeAsset output must be a string.");
    }
    if (maxSize !== undefined && (!Number.isSafeInteger(maxSize) || (maxSize as number) < 0)) {
      throw new Error("includeAsset maxSize must be a non-negative integer.");
    }
    const resources: Record<string, AssetSource> = {};
    const resourceIdentities: string[] = [];
    const declaredResources = format.resourcePaths?.(options) ?? [];
    if (
      !Array.isArray(declaredResources) ||
      declaredResources.some((path) => typeof path !== "string" || !path)
    ) {
      throw new Error(`Asset format '${format.id}' returned invalid resource paths.`);
    }
    for (const resourceName of declaredResources as readonly string[]) {
      const resourcePath = this.#resolve(resourceName);
      resources[resourceName] = {
        bytes: this.#read(resourcePath, "resource"),
        mediaType: this.#mediaType(resourcePath),
      };
      resourceIdentities.push(`${resourceName}\u0000${resourcePath}`);
    }
    const source = {
      bytes: this.#read(sourcePath, "binary"),
      mediaType: this.#mediaType(sourcePath),
    };
    const conversionKey = this.#stable([
      sourcePath,
      format.id,
      format.version,
      options,
      resourceIdentities,
    ]);
    let converted = this.#conversions.get(conversionKey);
    if (!converted) {
      // Converter ownership is external. Pass copies so a misbehaving provider
      // cannot change the build snapshot used by a later asset statement.
      const borrowedResources = Object.fromEntries(
        Object.entries(resources).map(([name, item]) => [
          name,
          { ...item, bytes: item.bytes.slice() },
        ]),
      );
      converted = format.convert(
        { ...source, bytes: source.bytes.slice() },
        options,
        borrowedResources,
      );
      if (!converted.primaryOutput || !Object.hasOwn(converted.outputs, converted.primaryOutput)) {
        throw new Error(`Asset format '${format.id}' omitted its primary output.`);
      }
      const owned = Object.fromEntries(
        Object.entries(converted.outputs).map(([name, part]) => {
          if (!(part.bytes instanceof Uint8Array)) {
            throw new Error(`Asset output '${name}' is not bytes.`);
          }
          return [name, { bytes: part.bytes.slice() }];
        }),
      );
      converted = { primaryOutput: converted.primaryOutput, outputs: owned };
      this.#conversions.set(conversionKey, converted);
    }
    const selected = output ?? converted.primaryOutput;
    if (!Object.hasOwn(converted.outputs, selected)) {
      throw new Error(`Asset format '${format.id}' has no output '${selected}'.`);
    }
    const part = converted.outputs[selected];
    let transformSpecs: unknown = [];
    if (typeof compress === "string") {
      transformSpecs = [{ id: compress, options: compressOptions ?? {} }];
    } else if (compress !== undefined) {
      transformSpecs = compress;
    }
    if (!Array.isArray(transformSpecs)) {
      throw new Error("includeAsset compress must be an ID or array of { id, options }.");
    }
    if (typeof compress !== "string" && compressOptions !== undefined) {
      throw new Error("includeAsset compressOptions requires a single compress ID.");
    }
    const transforms: Array<{
      provider: Readonly<AssetTransformContribution>;
      options: Record<string, unknown>;
      resources: Record<string, AssetSource>;
      resourceIdentities: string[];
    }> = [];
    for (const unknownItem of transformSpecs as unknown[]) {
      if (
        !unknownItem ||
        typeof unknownItem !== "object" ||
        !("id" in unknownItem) ||
        typeof unknownItem.id !== "string"
      ) {
        throw new Error("includeAsset transform entries require an id.");
      }
      const item = unknownItem as { id: string; options?: unknown };
      const transform = this.session.environment.getAssetTransform(item.id, this.session.targetId);
      if (!transform) {
        throw new Error(
          `includeAsset transform '${item.id}' is unavailable on '${this.session.targetId}'.`,
        );
      }
      const transformOptions = item.options ?? {};
      if (
        !transformOptions ||
        typeof transformOptions !== "object" ||
        Array.isArray(transformOptions)
      ) {
        throw new Error(`includeAsset transform '${item.id}' options must be an object.`);
      }
      const validatedOptions = transformOptions as Record<string, unknown>;
      const schemaResources = this.#validateTransformOptions(transform, validatedOptions);
      transform.validateOptions?.(validatedOptions);
      const transformResources: Record<string, AssetSource> = {};
      const transformResourceIdentities: string[] = [];
      const declared = transform.resourcePaths?.(validatedOptions) ?? [];
      const resourcePaths: readonly string[] = declared;
      if (!Array.isArray(declared) || declared.some((name) => typeof name !== "string" || !name)) {
        throw new Error(`Asset transform '${transform.id}' returned invalid resource paths.`);
      }
      const names = [...new Set([...schemaResources, ...resourcePaths])];
      for (const name of names) {
        const path = this.#resolve(name);
        transformResources[name] = {
          bytes: this.#read(path, "resource"),
          mediaType: this.#mediaType(path),
        };
        transformResourceIdentities.push(`${name}\u0000${path}`);
      }
      transforms.push({
        provider: transform,
        options: validatedOptions,
        resources: transformResources,
        resourceIdentities: transformResourceIdentities,
      });
    }
    const emissionKey = this.#stable([
      conversionKey,
      selected,
      transforms.map(({ provider, options: transformOptions, resourceIdentities: identities }) => [
        provider.id,
        provider.version,
        transformOptions,
        identities,
      ]),
    ]);
    let bytes = this.#emissions.get(emissionKey);
    if (!bytes) {
      bytes = part.bytes.slice();
      for (const {
        provider,
        options: transformOptions,
        resources: transformResources,
      } of transforms) {
        const previousBytes = bytes;
        if (previousBytes.length > AssetAssemblyService.MAX_STAGE_BYTES) {
          throw new Error(`Asset '${sourcePath}' exceeds the transform stage byte limit.`);
        }
        const borrowedResources = Object.fromEntries(
          Object.entries(transformResources).map(([name, item]) => [
            name,
            { ...item, bytes: item.bytes.slice() },
          ]),
        );
        try {
          const encoded = provider.encode(
            previousBytes.slice(),
            transformOptions,
            borrowedResources,
          );
          if (
            !(encoded instanceof Uint8Array) ||
            encoded.length > AssetAssemblyService.MAX_STAGE_BYTES
          ) {
            throw new Error("produced invalid or oversized bytes");
          }
          // The expected previous length is the decoder's bound, including for BRR.
          const decoded = provider.decode(
            encoded.slice(),
            transformOptions,
            previousBytes.length,
            borrowedResources,
          );
          if (
            !(decoded instanceof Uint8Array) ||
            decoded.length !== previousBytes.length ||
            !decoded.every((value, index) => value === previousBytes[index])
          ) {
            throw new Error("failed exact decode verification");
          }
          bytes = encoded.slice();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Asset '${sourcePath}' transform '${provider.id}' with options ${this.#stable(transformOptions)}: ${message}`,
          );
        }
      }
      this.#emissions.set(emissionKey, bytes);
    }
    if (maxSize !== undefined && bytes.length > (maxSize as number)) {
      throw new Error(
        `includeAsset output is ${bytes.length} bytes, above maxSize ${maxSize as number}.`,
      );
    }
    this.lastEmission = {
      sourcePath,
      format: format.id,
      part: selected,
      size: bytes.length,
      transforms: transforms.map((item) => item.provider.id),
    };
    return bytes;
  }
}
