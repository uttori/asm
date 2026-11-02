import type { AssemblyLinkRecipe } from "../relocatable.js";
import { assertLinkExpression } from "./validation.js";
import { integer, list, record, textValue } from "./value.js";

/** Validate a caller/JSON recipe before allocation, expression traversal, or image allocation. */
export function assertLinkRecipe(input: unknown): asserts input is AssemblyLinkRecipe {
  const recipe = record(input, "Link recipe");
  textValue(recipe.target, "Link target");
  if (recipe.targetOptions !== undefined) {
    record(recipe.targetOptions, "Link target options");
  }
  if (
    recipe.checksumPolicy !== undefined &&
    recipe.checksumPolicy !== "preserve" &&
    recipe.checksumPolicy !== "recompute"
  ) {
    throw new Error("Unknown checksum policy.");
  }
  for (const value of list(recipe.regions, "Memory regions")) {
    const region = record(value, "Memory region");
    textValue(region.name, "Region name");
    integer(region.start, "Region start");
    integer(region.size, "Region size");
    if (region.outputOffset !== undefined) {
      integer(region.outputOffset, "Region output offset");
    }
    if (region.fillByte !== undefined) {
      integer(region.fillByte, "Region fill byte", 0, 255);
    }
    if (region.addressSpace !== undefined) {
      textValue(region.addressSpace, "Region address space");
    }
    if (region.initialBytes !== undefined) {
      list(region.initialBytes, "Container bytes").forEach((byte) =>
        integer(byte, "Container byte", 0, 255),
      );
    }
  }
  for (const value of list(recipe.placements, "Section placements")) {
    const placement = record(value, "Section placement");
    for (const key of ["section", "load", "run"]) {
      textValue(placement[key], `Placement ${key}`);
    }
    if (placement.start !== undefined) {
      integer(placement.start, "Placement start");
    }
    for (const key of ["alignment", "bankSize"]) {
      if (placement[key] !== undefined) {
        integer(placement[key], key, 1, 0x1000000);
      }
    }
  }
  for (const value of list(recipe.symbols ?? [], "Recipe symbols")) {
    const symbol = record(value, "Recipe symbol");
    textValue(symbol.name, "Recipe symbol name");
    if (symbol.expression !== undefined) {
      assertLinkExpression(symbol.expression);
    } else {
      textValue(symbol.section, "Derived section");
      if (!["load", "run", "size", "runEnd"].includes(String(symbol.property))) {
        throw new Error("Unknown derived symbol property.");
      }
    }
  }
  for (const value of list(recipe.assumptions ?? [], "Link assumptions")) {
    const assumption = record(value, "Link assumption");
    textValue(assumption.section, "Assumption section");
    if (assumption.module !== undefined) {
      textValue(assumption.module, "Assumption module");
    }
    if (assumption.dataBank !== undefined && assumption.dataBank !== "program") {
      integer(assumption.dataBank, "Data bank", 0, 255);
    }
    if (assumption.directPage !== undefined) {
      integer(assumption.directPage, "Direct page", 0, 65535);
    }
    if (assumption.state !== undefined) {
      for (const expected of Object.values(record(assumption.state, "Processor assumptions"))) {
        if (typeof expected !== "boolean") {
          integer(expected, "Processor assumption", -Number.MAX_SAFE_INTEGER);
        }
      }
    }
  }
  for (const value of list(recipe.assertions ?? [], "Link assertions")) {
    const assertion = record(value, "Link assertion");
    textValue(assertion.message, "Assertion message");
    assertLinkExpression(assertion.expression);
  }
}
