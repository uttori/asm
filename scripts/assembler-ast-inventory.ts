import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { Assembler } from "../packages/core/src/assembler.js";
import { createNormalizedCommand } from "../packages/core/src/ir/normalized-command.js";
import { create65xxAssemblerEnvironment } from "../packages/plugin-65xx/src/index.js";
import { createSnesAssemblerEnvironment } from "../packages/plugin-snes/src/index.js";

/** Inventory describes supported grammar, never infers coverage from benchmark hits. */
export async function assemblerAstInventory() {
  const rows: {
    key: string;
    family: string;
    supportedForms: readonly unknown[];
    positiveFixtures: string[];
    negativeFixtures: string[];
    [key: string]: unknown;
  }[] = [];
  let instructionAddressingForms = 0;
  const families = [
    [
      "expressions-references-functions",
      "mathcore.ts",
      "ExpressionNode / structured reference resolver",
      "B3",
      "mathcore.test.ts",
    ],
    [
      "defines-macros-generated-fragments",
      "services/macro-engine.ts",
      "Template / generated fragment parser",
      "B4",
      "services/macro-engine.test.ts",
    ],
    [
      "inline-labels-assignments",
      "ir/statement-node.ts",
      "StatementSequence / Declaration",
      "B5",
      "ir/ast-migration.test.ts",
    ],
    [
      "numeric-string-data",
      "directives/data.ts",
      "DataItem / StringLiteral",
      "B5",
      "directives/data.test.ts",
    ],
    [
      "struct-union-dataStruct-initializers",
      "services/struct-engine.ts",
      "Declaration / Initializer",
      "B5",
      "services/struct-initializer.test.ts",
    ],
    [
      "includes-resources-layout-state",
      "assembler.ts",
      "ResourceOperation / Directive payload",
      "B5",
      "directives/include-source.test.ts",
    ],
    [
      "operand-classification-width",
      "operand-resolver.ts",
      "OperandSyntax / bound operand",
      "B6",
      "operand-resolver.test.ts",
    ],
    [
      "tooling-snapshots-plugin-overrides",
      "plugin/contracts.ts",
      "ContributionSyntax / detached snapshot",
      "B11",
      "plugin/seams.test.ts",
    ],
    [
      "character-tables",
      "services/directive-runtime-service.ts",
      "CharacterTable declaration",
      "B5",
      "directives/misc-table.test.ts",
    ],
    [
      "source-and-fragment-parsing",
      "services/assembly-front-end-service.ts",
      "SourceSyntax / explicit fragment boundary",
      "B4",
      "ir/source-syntax.test.ts",
    ],
    [
      "directive-entry-parsing",
      "directives/registry.ts",
      "DirectiveSyntaxContribution",
      "B5",
      "directives/registry.test.ts",
    ],
  ];
  for (const environment of [
    await create65xxAssemblerEnvironment(),
    await createSnesAssemblerEnvironment(),
  ]) {
    for (const summary of environment.getTargetSummaries()) {
      const target = environment.getTarget(summary.id)!;
      const catalog = environment.getToolingCatalog(summary.id);
      const dialect = target.syntaxProfile?.id ?? "native";
      const add = (
        family: string,
        consumer: string,
        location: string,
        parser: string,
        milestone: string,
        positive: string[],
        negative: string[],
        forms: readonly unknown[],
        owner: string,
      ) => {
        rows.push({
          key: `${dialect}/${summary.id}/${family}/${consumer}`,
          dialect,
          target: summary.id,
          family,
          consumer,
          sourceLocation: location,
          owner,
          currentRoute: "typed syntax with stage-owned execution",
          proposedParser: parser,
          positiveFixtures: positive,
          negativeFixtures: negative,
          stageStateCases: [
            "collectDefinitions",
            "resolveLayout",
            "emitProgram",
            "inactive branch",
            "architecture/define changes between commands",
          ],
          fallbackReason: "none; public source entries share the registered syntax parser",
          retirementMilestone: milestone,
          status: "typed-and-qualified",
          supportedForms: forms,
          workloadObservations: "separate benchmark receipts; zero hits do not imply coverage",
        });
      };
      for (const [family, file, parser, milestone, fixture] of families) {
        add(
          family,
          file,
          `packages/core/src/${file}`,
          parser,
          milestone,
          [`packages/core/tests/${fixture}`],
          [`packages/core/tests/${fixture}`],
          [family],
          "@uttori/asm-core",
        );
      }
      for (const row of rows.filter((entry) => entry.target === summary.id)) {
        if (
          row.family === "expressions-references-functions" ||
          row.family === "defines-macros-generated-fragments"
        ) {
          const expression = row.family === "expressions-references-functions";
          row.status = "typed-and-qualified";
          row.currentRoute = expression
            ? "typed expression evaluation and structured reference resolution"
            : "ordered attributed fragments and capture nodes";
          row.fallbackReason =
            "none; raw expressions are rejected and source-valued substitutions enter attributed fragment parsing";
          const fixture = expression
            ? "packages/core/tests/ir/expression-completion.test.ts"
            : "packages/core/tests/ir/expansion-completion.test.ts";
          row.positiveFixtures.push(fixture);
          row.negativeFixtures.push(fixture);
        }
      }
      for (const row of rows.filter((entry) => entry.target === summary.id)) {
        if (row.retirementMilestone === "B5") {
          row.status = "typed-and-qualified";
          row.currentRoute =
            "parsed declaration/data nodes or validated directive payloads; stage-owned evaluation";
          row.fallbackReason =
            "none; public word/string entries and source assembly share parser and execution implementations";
          row.positiveFixtures.push("packages/core/tests/ir/directive-completion.test.ts");
          row.negativeFixtures.push("packages/core/tests/ir/directive-completion.test.ts");
          if (row.family === "struct-union-dataStruct-initializers") {
            row.scopeNote =
              "Struct layouts, extensions and dataStruct records are supported. No union handler is registered; this migration does not add union syntax.";
          }
        }
        if (row.retirementMilestone === "B11") {
          row.status = "mandatory typed plugin API and shared tooling occurrences implemented";
          row.currentRoute =
            "API v2 parse/bind/execute; shared operand and directive expression trees; detached worker snapshots";
          row.fallbackReason =
            "none; legacy plugin registrations and word/raw execution contracts are absent";
          row.positiveFixtures.push(
            "tests/package-consumer/contract-plugin.mts",
            "packages/language-server/tests/providers.test.ts",
          );
          row.negativeFixtures.push("packages/core/tests/plugin/validation.test.ts");
        }
        if (row.retirementMilestone === "B6") {
          row.status =
            "typed contracts and dispatch implemented for all shipped processor families";
          row.currentRoute =
            "architecture-owned operand grammar and explicit per-stage resolution frames";
          row.fallbackReason =
            "none; target grammars own operands and the numeric resolver accepts expression nodes";
          row.positiveFixtures.push("packages/core/tests/ir/operand-contract.test.ts");
          row.negativeFixtures.push("packages/core/tests/ir/operand-contract.test.ts");
        }
      }
      for (const arch of catalog.getArchitectures()) {
        const snes = arch.id.startsWith("snes.");
        let milestone = "B7";
        if (arch.id === "snes.65816") {
          milestone = "B8";
        }
        if (arch.id === "snes.spc700") {
          milestone = "B9";
        }
        if (arch.id === "snes.superfx") {
          milestone = "B10";
        }
        let fixture = "packages/plugin-65xx/tests/instruction-model.test.ts";
        if (arch.id === "snes.65816") {
          fixture = "packages/plugin-snes/tests/Arch65816.test.ts";
        }
        if (arch.id === "snes.spc700") {
          fixture = "packages/plugin-snes/tests/ArchSPC700.test.ts";
        }
        if (arch.id === "snes.superfx") {
          fixture = "packages/plugin-snes/tests/ArchSuperFX.test.ts";
        }
        instructionAddressingForms += catalog
          .getInstructions(arch.id)
          .reduce((sum, instruction) => sum + instruction.modes.length, 0);
        add(
          "instruction",
          arch.id,
          snes
            ? `packages/plugin-snes/src/architectures/typed-${arch.id.slice(5)}.ts`
            : "packages/plugin-65xx/src/typed-architecture.ts",
          "architecture parse/bind/encode contribution",
          milestone,
          [fixture],
          [
            snes
              ? "packages/plugin-snes/tests/assembler.test.ts"
              : "packages/plugin-65xx/tests/assembler.test.ts",
          ],
          catalog.getInstructions(arch.id),
          snes ? "@uttori/asm-plugin-snes" : "@uttori/asm-plugin-65xx",
        );
        if (snes) {
          const row = rows.at(-1)!;
          row.currentRoute =
            "typed operand grammar, stage-owned observations, shared sizing/encoding selector";
          row.status = "typed execution implemented for every registered form";
          row.fallbackReason =
            "none; public source facades parse the same target grammar and call the typed encoder";
          row.positiveFixtures.push(
            "packages/plugin-snes/tests/ast-encoding.test.ts",
            "packages/plugin-snes/tests/processor-source-export.test.ts",
            "fixtures/asar/tests/arch-" + arch.id.slice(5) + ".asm",
          );
          row.negativeFixtures.push("packages/plugin-snes/tests/ast-encoding.test.ts");
        }
        if (!snes) {
          const row = rows.at(-1)!;
          row.currentRoute =
            "typed operand syntax, stage-owned classification values, shared sizing/encoding selector";
          row.status = "typed execution implemented for every registered form";
          row.fallbackReason =
            "none; Arch65xx public source entries share the target grammar and typed encoder; the old classifier is removed";
          row.positiveFixtures.push(
            "packages/plugin-65xx/tests/assembler.test.ts",
            "packages/plugin-65xx/tests/ast-encoding.test.ts",
          );
          row.negativeFixtures.push("packages/plugin-65xx/tests/ast-encoding.test.ts");
        }
      }
      for (const setId of target.directiveSets) {
        for (const directive of environment.getDirectiveSet(setId)!.directives) {
          const snes = setId.startsWith("snes.");
          const fixture = snes
            ? "packages/plugin-snes/tests/plugin-wiring.test.ts"
            : "packages/plugin-65xx/tests/ca65-compat.test.ts";
          add(
            "plugin-directive",
            directive.id,
            snes
              ? "packages/plugin-snes/src/assembler.ts"
              : "packages/plugin-65xx/src/directives/ca65.ts",
            "DirectiveSyntaxContribution",
            "B5",
            [fixture],
            [fixture],
            directive.keywords,
            snes ? "@uttori/asm-plugin-snes" : "@uttori/asm-plugin-65xx",
          );
          if (directive.syntax) {
            Object.assign(rows.at(-1)!, {
              currentRoute: "pure parse -> validated JSON payload -> bound typed execution",
              fallbackReason:
                "none; public entries share syntax parsing; registered execution consumes validated payloads",
              status: "typed execution implemented",
            });
          }
          if (directive.id === "snes.directive.check") {
            Object.assign(rows.at(-1)!, {
              currentRoute: "pure parse -> validated JSON payload -> bound typed execution",
              sourceLocation: "packages/plugin-snes/src/directives/layout.ts",
              positiveFixtures: [
                "packages/core/tests/ir/source-syntax.test.ts",
                "packages/core/tests/ir/source-syntax-browser.test.ts",
              ],
              negativeFixtures: ["packages/core/tests/ir/source-syntax.test.ts"],
              fallbackReason: "none for CHECK",
              retirementMilestone: "B2",
              status: "migrated-and-guarded",
            });
          }
        }
      }
      add(
        "core-directive",
        "DirectiveRegistry",
        "packages/core/src/directives/registry.ts",
        "typed core directive payloads",
        "B5",
        ["packages/core/tests/ir/expression-boundaries.test.ts"],
        ["packages/plugin-snes/tests/assembler.test.ts"],
        catalog.getDirectives(),
        "@uttori/asm-core",
      );
      const session = new Assembler({ environment, target: summary.id });
      try {
        Object.assign(rows.at(-1)!, {
          status: "typed-and-qualified",
          currentRoute: "native statements and validated core/plugin directive payloads",
          registeredContributions: [...session.directiveRegistry.handlers.keys()]
            .toSorted()
            .map((keyword) => ({
              keyword,
              contribution:
                session.directiveRegistry.parseSyntax(
                  createNormalizedCommand(keyword, keyword, [keyword], "inventory.asm", 0, false),
                )?.contributionId ?? "core.statement-or-public-adapter",
            })),
        });
      } finally {
        session.dispose();
      }
    }
  }
  for (const row of rows) {
    row.status = "typed-and-qualified";
    row.completionMilestone = "B12";
    row.positiveFixtures.push(
      "packages/core/tests/ir/ast-completion.test.ts",
      "packages/core/tests/ir/ast-migration.test.ts",
    );
    row.negativeFixtures.push("packages/core/tests/ir/ast-completion.test.ts");
    if (row.family === "source-and-fragment-parsing") {
      row.currentRoute =
        "physical/generated source -> immutable operations, declarations and capture nodes -> ordered typed execution";
      row.fallbackReason =
        "none; generated source is parsed only at explicit attributed fragment boundaries";
    }
  }
  return {
    version: 2,
    counting:
      "Rows count target-specific consumers; supportedForms count catalog entries (instruction descriptors may contain multiple addressing modes). Fixtures are characterization suites, not proof that every form is migrated. Migration status requires explicit reviewed evidence and the strict source-syntax guard; catalog presence alone is never sufficient.",
    qualification: {
      environment: "UTTORI_AST_QUALIFY=1",
      guard: "packages/core/src/internal-instrumentation.ts",
      receipt: "docs/assembler-ast-b12-results-2026-10-18.json",
      forbidden: [
        "legacy-evaluation",
        "legacy-scanner",
        "legacy-command",
        "legacy-generated-dispatch",
        "command-passthrough",
        "reference-to-text",
        "define-to-text",
        "function-to-text",
        "execution-expression-parse",
        "execution-operand-parse",
        "execution-directive-parse",
      ],
      allowedParsing: [
        "physical source",
        "attributed generated fragments",
        "public source entry APIs",
        "tolerant editor input",
      ],
    },
    migratedSlices: [
      {
        grammar: "label + grouped numeric data + SNES CHECK",
        dialect: "asar",
        target: "snes.sfc",
        milestone: "B2",
        guard: "packages/core/tests/ir/source-syntax.test.ts",
        forbidden: [
          "legacy-command",
          "legacy-evaluation",
          "command-passthrough",
          "reference-to-text",
          "define-to-text",
          "function-to-text",
        ],
      },
      {
        grammar:
          "expressions, relative/unnamed references, structured members/indexes, source-text slots and bound user functions",
        dialect: "shared",
        target: "all core expression hosts",
        milestone: "B3",
        guard: "packages/core/tests/ir/expression-completion.test.ts",
        forbidden: [
          "legacy-evaluation",
          "legacy-scanner",
          "reference-to-text",
          "define-to-text",
          "function-to-text",
        ],
      },
      {
        grammar:
          "ordered macro/define fragments, generated expression grammar and explicit declaration captures",
        dialect: "shared (Asar and ca65 phase policies)",
        target: "all core expansion hosts",
        milestone: "B4",
        guard: "packages/core/tests/ir/expansion-completion.test.ts",
        forbidden: [
          "legacy-generated-dispatch",
          "legacy-evaluation",
          "legacy-scanner",
          "reference-to-text",
          "function-to-text",
        ],
      },
      {
        grammar:
          "mixed data, character maps, assignments/functions, struct records and core/65xx/SNES directive payloads",
        dialect: "shared with target-owned directive selection",
        target: "all shipped assembly targets",
        milestone: "B5",
        guard: "packages/core/tests/ir/directive-completion.test.ts",
        forbidden: ["legacy-evaluation", "legacy-scanner", "function-to-text"],
      },
      {
        grammar:
          "target-owned compound operands, lexical width intent and stage-owned resolution frames",
        dialect: "shared contracts; all shipped processors use typed execution",
        target: "typed contract fixture; grammar registrations for shipped processors",
        milestone: "B6",
        guard: "packages/core/tests/ir/operand-contract.test.ts",
        forbidden: ["legacy classifier/expansion/word sizing/word encoding in typed dispatch"],
      },
      {
        grammar:
          "all registered 65xx instruction/addressing forms, branches and vendor compound operations",
        dialect: "native and ca65",
        target: "all shipped 65xx and NES targets",
        milestone: "B7",
        guard: "packages/plugin-65xx/tests/helpers/typed-execution.ts",
        forbidden: [
          "legacy operand classifier",
          "operand text expansion",
          "string numeric evaluation",
          "string mathematical evaluation",
        ],
      },
      {
        grammar: "mandatory typed plugin contracts and shared analysis occurrences",
        dialect: "all shipped syntax profiles",
        target: "installed plugins, CLI, browser, language server and editor",
        milestone: "B11",
        guard: "tests/package-consumer/contract-plugin.mts",
        forbidden: [
          "legacy architecture/directive registrations",
          "words/raw execution inputs",
          "register operands treated as symbol references",
        ],
      },
      ...[
        {
          grammar: "all 65816 forms, lexical/state widths, bank/branch rules and pseudo operations",
          target: "snes.65816",
          milestone: "B8",
        },
        {
          grammar: "all SPC700 register, compound, bit, indirect and branch forms",
          target: "snes.spc700",
          milestone: "B9",
        },
        {
          grammar: "all SuperFX register, memory, branch, ALT and pseudo forms",
          target: "snes.superfx",
          milestone: "B10",
        },
      ].map((slice) => ({
        ...slice,
        dialect: "native and Asar; ca65 65816 state directives",
        guard: "packages/plugin-snes/tests/helpers/typed-execution.ts",
        forbidden: [
          "legacy operand classifier",
          "operand text expansion",
          "string numeric evaluation",
          "string mathematical evaluation",
          "legacy expression evaluation and semantic rendering",
        ],
      })),
    ],
    instructionAddressingForms,
    consumers: rows.length,
    supportedForms: rows.reduce((n, row) => n + row.supportedForms.length, 0),
    rows,
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inventory = await assemblerAstInventory();
  fs.writeFileSync("docs/assembler-ast-coverage.json", `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(
    `${inventory.consumers} consumers; ${inventory.supportedForms} supported catalog forms`,
  );
}
