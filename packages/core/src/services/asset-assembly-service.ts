import type { AssetEmissionConversion } from "../addressToLine.js";
import type { Assembler } from "../assembler.js";
import type { ParsedAssetCall, AssetValueNode } from "../ir/asset-call.js";
import type { ExpressionNode } from "../ir/expression-node.js";
import { sourceFragment, fragmentText } from "../ir/source-fragment.js";
import type {
  AssetFormatContribution,
  AssetFormatResult,
  AssetSource,
  AssetTransformContribution,
} from "../plugin/contracts.js";
import { assetSourceMediaType, resolveAssetResourceSnapshot } from "./asset-resource-snapshot.js";

/** Narrows unknown JSON values to plain records for asset option validation. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Asset options cannot read layout state, symbols, files or effectful functions. */
function isConstantExpression(node: ExpressionNode): boolean {
  if (node.type === "literal") {
    return true;
  }
  if (node.type === "unary") {
    return isConstantExpression(node.argument);
  }
  if (node.type === "binary") {
    return isConstantExpression(node.left) && isConstantExpression(node.right);
  }
  return false;
}

/** Narrows unknown JSON values to arrays for asset metadata validation. */
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** Narrows unknown values to non-empty strings. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Narrows unknown values to arrays of non-empty strings. */
function isNonEmptyStringArray(value: unknown): value is readonly string[] {
  return isUnknownArray(value) && value.every(isNonEmptyString);
}

/** Each provider callback receives owned resource bytes; encoding cannot mutate the decoder's verification inputs. */
function copyAssetResources(
  resources: Readonly<Record<string, AssetSource>>,
): Record<string, AssetSource> {
  return Object.fromEntries(
    Object.entries(resources).map(([name, item]) => [
      name,
      { ...item, bytes: Uint8Array.from(item.bytes) },
    ]),
  );
}

/** One build owns its bytes and conversions across all three passes. */
export class AssetAssemblyService {
  /** A single asset stage may not allocate or emit more than this many bytes. */
  static readonly MAX_STAGE_BYTES = 16 * 1024 * 1024;
  /** Paths recorded as binary or resource dependencies during asset conversion. */
  readonly dependencies = new Map<string, "binary" | "resource">();
  readonly #files = new Map<string, Uint8Array>();
  #snapshotBytes = 0;
  readonly #conversions = new Map<string, AssetFormatResult>();
  readonly #emissions = new Map<string, Uint8Array>();
  /** Descriptor of the most recent successful statement, consumed immediately by emission metadata. */
  lastEmission?: Readonly<{
    sourcePath: string;
    format: string;
    part: string;
    size: number;
    transforms: readonly string[];
    conversion: AssetEmissionConversion;
  }>;

  constructor(readonly session: Assembler) {}

  /** Drop all snapshots before the next build; disk changes then become visible. */
  beginBuild(): void {
    this.dependencies.clear();
    this.#files.clear();
    this.#snapshotBytes = 0;
    this.#conversions.clear();
    this.#emissions.clear();
    this.lastEmission = undefined;
  }

  /**
   * Return the exact bytes consumed by this build for dependency fingerprints.
   * @param path Provider identity.
   * @returns Owned snapshot copy, when the path was read.
   */
  snapshot(path: string): Uint8Array | undefined {
    return this.#files.get(path)?.slice();
  }

  /**
   * Resolve a string operand after define expansion.
   * @param node Quoted path or format operand.
   * @returns Expanded text.
   */
  #text(node: Extract<AssetValueNode, { kind: "string" }>): string {
    return this.session.defineEngine.resolveDefinesInStringLiteral(node.value);
  }

  /**
   * Evaluate a typed literal. Numeric expressions may use defines but no layout symbols.
   * @param node Typed source value.
   * @returns Plain value passed to a format or transform.
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
    if (expanded.type === "template" && expanded.form === "source") {
      let fragment = sourceFragment(expanded.text, [
        {
          file: this.session.currentFile,
          line: this.session.currentLine,
          text: node.text,
          span: node.span,
        },
      ]);
      // Resource options preserve their bounded, unbraced-define policy before constant validation.
      // In particular, symbol lookup and effectful calls must not run to decide layout independence.
      for (let depth = 0; depth < 32; depth++) {
        const next = this.session.defineEngine.resolveRegularFragment(fragment);
        if (fragmentText(next) === fragmentText(fragment)) {
          break;
        }
        fragment = next;
        if (depth === 31) {
          throw new Error("includeAsset numeric define expansion is recursive.");
        }
      }
      expanded = this.session.frontEndService.parseFragmentExpression(fragmentText(fragment));
    }
    if (!isConstantExpression(expanded)) {
      throw new Error(`includeAsset numeric option '${node.text}' must be layout-independent.`);
    }
    const value = this.session.mathCore.math(expanded);
    if (!Number.isFinite(value)) {
      throw new Error(`includeAsset numeric option '${node.text}' is not finite.`);
    }
    return value;
  }

  /**
   * Resolve a provider path using the current source, macro and include search order.
   * @param path Source-relative path.
   * @returns Stable provider identity.
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

  /**
   * Snapshot each dependency once, even if a provider changes during later passes.
   * @param path Provider identity.
   * @param kind Dependency role.
   * @returns Build-owned bytes.
   */
  #read(path: string, kind: "binary" | "resource"): Uint8Array {
    const cached = this.#files.get(path);
    if (cached) {
      return cached;
    }
    const supplied = this.session.fileProvider.readFile(path);
    this.#snapshotBytes += supplied.length;
    if (this.#snapshotBytes > 256 * 1024 * 1024) {
      throw new Error("Asset dependency snapshot exceeds 256 MiB.");
    }
    const bytes = Uint8Array.from(supplied);
    this.#files.set(path, bytes);
    this.dependencies.set(path, kind);
    return bytes;
  }

  /**
   * Media type is inferred only from a declared, supported input extension.
   * @param path Provider identity.
   * @returns Portable media type.
   */
  #mediaType(path: string, format?: Readonly<AssetFormatContribution>): string {
    return assetSourceMediaType(path, format);
  }

  /**
   * Canonical serialization makes equivalent option objects share one conversion.
   * @param value JSON-compatible request value.
   * @returns Stable identity fragment.
   */
  #stable(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.#stable(item)).join(",")}]`;
    }
    if (value && typeof value === "object") {
      return `{${Object.entries(value)
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.#stable(item)}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  /**
   * Apply a transform's closed scalar schema before it can read resources.
   * @param provider Registered transform.
   * @param options Source options.
   * @returns Resource-valued option paths.
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

  /** Resolve a bounded resource closure once per build. Provider callbacks cannot mutate cached bytes. */
  #resources(
    format: Readonly<AssetFormatContribution>,
    source: AssetSource,
    options: Readonly<Record<string, unknown>>,
  ): { resources: Record<string, AssetSource>; paths: Record<string, string> } {
    return resolveAssetResourceSnapshot(format, source, options, {
      resolve: (path, declaringResource) => {
        if (declaringResource) {
          return this.session.fileProvider.resolvePath(path, { currentFile: declaringResource });
        }
        return this.#resolve(path);
      },
      read: (path) => this.#read(path, "resource"),
      mediaType: (path) => this.#mediaType(path, format),
    });
  }

  /**
   * Resolve input and declared resource paths for tooling without encoding bytes.
   * @param call Typed source directive.
   */
  discoverDependencies(call: ParsedAssetCall): void {
    const options = Object.fromEntries(
      Object.entries(call.options).map(([key, node]) => [key, this.#value(node)]),
    );
    const sourcePath = this.#resolve(this.#text(call.path));
    const formatName = this.#text(call.format);
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
    // Source sidecars can declare further inputs. Tooling snapshots the same closure as normal builds.
    this.#resources(
      format,
      {
        bytes: this.#read(sourcePath, "binary"),
        mediaType: this.#mediaType(sourcePath, format),
      },
      options,
    );
    // Compression dictionaries and other schema-declared inputs also invalidate analysis.
    let transforms: unknown[] = [];
    if (typeof transformSpec === "string") {
      const compressOptions = Object.hasOwn(call.options, "compressOptions")
        ? call.options.compressOptions
        : undefined;
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
      const transformOptions = isRecord(suppliedOptions) ? suppliedOptions : {};
      const names = [
        ...this.#validateTransformOptions(transform, transformOptions),
        ...(transform.resourcePaths?.(structuredClone(transformOptions)) ?? []),
      ];
      for (const name of new Set(names)) {
        this.dependencies.set(this.#resolve(name), "resource");
      }
    }
  }

  /**
   * Convert and select one complete byte stream before touching output state.
   * @param call Typed source directive.
   * @returns Snapshot-owned bytes shared across assembly passes.
   */
  materialize(call: ParsedAssetCall): Uint8Array {
    const options = Object.fromEntries(
      Object.entries(call.options).map(([key, node]) => [key, this.#value(node)]),
    );
    const sourcePath = this.#resolve(this.#text(call.path));
    const formatName = this.#text(call.format);
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
    let boundedSize: number | undefined;
    if (maxSize !== undefined) {
      if (typeof maxSize !== "number" || !Number.isSafeInteger(maxSize) || maxSize < 0) {
        throw new Error("includeAsset maxSize must be a non-negative integer.");
      }
      boundedSize = maxSize;
    }
    const source = {
      bytes: this.#read(sourcePath, "binary"),
      mediaType: this.#mediaType(sourcePath, format),
    };
    const { resources, paths: resourcePaths } = this.#resources(format, source, options);
    // Preserve legacy dependency ordering while source-aware discovery still sees one immutable source snapshot.
    this.dependencies.delete(sourcePath);
    this.dependencies.set(sourcePath, "binary");
    const resourceIdentities = Object.entries(resourcePaths);
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
      try {
        converted = format.convert(
          { ...source, bytes: source.bytes.slice() },
          structuredClone(options),
          copyAssetResources(resources),
        );
      } catch (error) {
        throw new Error(
          `Asset '${sourcePath}' format '${format.id}': ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
      if (!converted.primaryOutput || !Object.hasOwn(converted.outputs, converted.primaryOutput)) {
        throw new Error(`Asset format '${format.id}' omitted its primary output.`);
      }
      const owned = Object.fromEntries(
        Object.entries(converted.outputs).map(([name, part]) => {
          if (!(part.bytes instanceof Uint8Array)) {
            throw new Error(`Asset output '${name}' is not bytes.`);
          }
          return [name, { bytes: Uint8Array.from(part.bytes) }];
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
    if (!isUnknownArray(transformSpecs)) {
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
      resourcePaths: Record<string, string>;
    }> = [];
    for (const unknownItem of transformSpecs) {
      if (!isRecord(unknownItem) || typeof unknownItem.id !== "string") {
        throw new Error("includeAsset transform entries require an id.");
      }
      const id = unknownItem.id;
      const transform = this.session.environment.getAssetTransform(id, this.session.targetId);
      if (!transform) {
        throw new Error(
          `includeAsset transform '${id}' is unavailable on '${this.session.targetId}'.`,
        );
      }
      const transformOptions = unknownItem.options ?? {};
      if (!isRecord(transformOptions)) {
        throw new Error(`includeAsset transform '${id}' options must be an object.`);
      }
      const schemaResources = this.#validateTransformOptions(transform, transformOptions);
      transform.validateOptions?.(structuredClone(transformOptions));
      const transformResources: Record<string, AssetSource> = {};
      const transformResourceIdentities: string[] = [];
      const transformResourcePaths: Record<string, string> = {};
      const declared = transform.resourcePaths?.(structuredClone(transformOptions)) ?? [];
      if (!isNonEmptyStringArray(declared)) {
        throw new Error(`Asset transform '${transform.id}' returned invalid resource paths.`);
      }
      const names = [...new Set([...schemaResources, ...declared])];
      for (const name of names) {
        const path = this.#resolve(name);
        transformResourcePaths[name] = path;
        transformResources[name] = {
          bytes: this.#read(path, "resource"),
          mediaType: this.#mediaType(path),
        };
        transformResourceIdentities.push(`${name}\u0000${path}`);
      }
      transforms.push({
        provider: transform,
        options: transformOptions,
        resources: transformResources,
        resourceIdentities: transformResourceIdentities,
        resourcePaths: transformResourcePaths,
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
        try {
          const supplied = provider.encode(
            previousBytes.slice(),
            structuredClone(transformOptions),
            copyAssetResources(transformResources),
          );
          if (
            !(supplied instanceof Uint8Array) ||
            supplied.length > AssetAssemblyService.MAX_STAGE_BYTES
          ) {
            throw new Error("produced invalid or oversized bytes");
          }
          // Buffer.slice() borrows storage. Own the encoder result before passing a separate copy to decode.
          const encoded = Uint8Array.from(supplied);
          // The expected previous length is the decoder's bound, including for BRR.
          const decoded = provider.decode(
            encoded.slice(),
            structuredClone(transformOptions),
            previousBytes.length,
            copyAssetResources(transformResources),
          );
          if (
            !(decoded instanceof Uint8Array) ||
            decoded.length !== previousBytes.length ||
            !decoded.every((value, index) => value === previousBytes[index])
          ) {
            throw new Error("failed exact decode verification");
          }
          bytes = encoded;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Asset '${sourcePath}' transform '${provider.id}' with options ${this.#stable(transformOptions)}: ${message}`,
            { cause: error },
          );
        }
      }
      this.#emissions.set(emissionKey, bytes);
    }
    if (boundedSize !== undefined && bytes.length > boundedSize) {
      throw new Error(
        `includeAsset output is ${bytes.length} bytes, above maxSize ${boundedSize}.`,
      );
    }
    this.lastEmission = {
      sourcePath,
      format: format.id,
      part: selected,
      size: bytes.length,
      transforms: transforms.map((item) => item.provider.id),
      // Capture evaluated source declarations rather than re-parsing grammar or guessing filename conventions.
      conversion: {
        version: format.version,
        options: structuredClone(options),
        resources: { ...resourcePaths },
        ...(boundedSize === undefined ? {} : { maxSize: boundedSize }),
        transforms: transforms.map((item) => ({
          id: item.provider.id,
          version: item.provider.version,
          options: structuredClone(item.options),
          resources: { ...item.resourcePaths },
        })),
      },
    };
    return bytes;
  }
}
