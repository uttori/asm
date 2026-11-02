import {
  LinkError,
  addressedSourceLinkRecipe,
  type LinkTargetPolicy,
  type AddressedAssemblySection,
} from "@uttori/asm-core";
import type { TargetFactoryContext } from "@uttori/asm-core/plugin";

import { nes65xxSessionStateKey } from "../session-state.js";

/** Physical Asar ORG offsets and logical BASE addresses remain distinct from the iNES prefix. */
export function createNesSourceLinkRecipe(
  context: TargetFactoryContext,
  sections: readonly AddressedAssemblySection[],
) {
  if (context.options.sourceStyle !== "asar") {
    throw new Error("The NES Asar adapter requires sourceStyle: asar in target configuration.");
  }
  const state = context.state.get(nes65xxSessionStateKey);
  return addressedSourceLinkRecipe({
    target: context.targetId,
    sections,
    outputOffset: (address) => state.header.length + address,
    prefix: state.header,
    outputSize: state.header.length + state.linker.imageSize,
    fillByte: state.fillByte,
  });
}

/** The iNES container remains recipe-owned; all module header declarations must agree before publication. */
export function createNesLinkTarget(): LinkTargetPolicy {
  return {
    target: "65xx.nes",
    revision: "nes-link-v1",
    validate(modules, recipe, allocations) {
      const header = recipe.regions.find(
        (region) => region.outputOffset === 0 && region.initialBytes,
      )?.initialBytes;
      if (
        !header ||
        header.length !== 16 ||
        header[0] !== 0x4e ||
        header[1] !== 0x45 ||
        header[2] !== 0x53 ||
        header[3] !== 0x1a
      ) {
        throw new LinkError("ines-header", "Link recipe requires a complete iNES header.");
      }
      for (const module of modules) {
        const declared = module.targetOptions.header;
        if (
          !Array.isArray(declared) ||
          declared.length !== header.length ||
          declared.some((byte: unknown, index) => byte !== header[index])
        ) {
          throw new LinkError(
            "ines-header",
            `Module '${module.id}' declares an incompatible iNES header.`,
          );
        }
      }
      for (const allocation of allocations) {
        if (allocation.runAddress < 0 || allocation.runAddress + allocation.size > 65536) {
          throw new LinkError(
            "nes-address",
            `Section '${allocation.module}:${allocation.section}' exceeds the 16-bit run address space.`,
          );
        }
      }
    },
    finalize() {
      /* iNES has no container checksum; the recipe supplies its complete header. */
    },
  };
}
