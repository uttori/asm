/** Native Node object/archive codecs and deterministic section linker. No CLI or source-file reads occur here. */
export { OBJECT_FORMAT_VERSION, encodeObject, decodeObject } from "./linker/object.js";
export { LIBRARY_FORMAT_VERSION, encodeLibrary, decodeLibrary, } from "./linker/library.js";
export { LINKER_VERSION, linkObjects } from "./linker/driver.js";
export { LinkError, } from "./linker/types.js";
export { artifactHash } from "./linker/value.js";
export { assertLinkRecipe } from "./linker/recipe.js";
//# sourceMappingURL=linker.js.map