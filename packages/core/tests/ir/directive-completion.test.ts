import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import { withAstMigrationGuard } from "../../src/internal-instrumentation.js";

const source = `lorom
org $808000
function twice(value) = value * 2
"A" = $42
struct Record $808000
.x db
.words dw[2]
endstruct count 2
dataStruct Record[0], { x = twice(1), words = [3, 4] }
!list = 5,6
db "A", !list
namespace State
Value = twice(4)
db Value
namespace off
fillbyte $ee
fill 2
assert 1, "unused"
if 0
struct Broken
endstruct align invalid()
incsrc "missing.asm"
error "inactive"
endif`;

test("data, declarations and core/target directives execute transported typed payloads", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const program = assembler.buildProgramModel(source, "directives.asm");
  const snapshot = JSON.stringify(program);
  const getnum = assembler.operandResolver.getnum.bind(assembler.operandResolver);
  assembler.operandResolver.getnum = (expression) => {
    if (typeof expression === "string") {
      throw new Error(`Unexpected numeric text adapter: ${expression}`);
    }
    return getnum(expression);
  };
  withAstMigrationGuard(["legacy-evaluation", "legacy-scanner", "function-to-text"], () =>
    assembler.assembleProgram(JSON.parse(snapshot)),
  );
  t.deepEqual([...assembler.getBinaryOutput()], [2, 3, 0, 4, 0, 0x42, 5, 6, 8, 0xee, 0xee]);
  t.is(JSON.stringify(program), snapshot);
});

test("record validation rejects a late bad field before any record byte is written", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const program = assembler.buildProgramModel(
    "org $808000\nstruct Record $808000\n.x db\n.y db[2]\nendstruct\ndataStruct Record, {x=1,y=[2]}",
    "invalid-record.asm",
  );
  t.throws(() => assembler.assembleProgram(JSON.parse(JSON.stringify(program))), {
    message: /expects|requires|count|length/i,
  });
  t.is(assembler.bytes, 0);
});

test("directive grammar identities distinguish keyword ownership and grammar versions", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const registry = assembler.directiveRegistry;
  const original = registry.grammarIdentity;
  registry.registerSyntax(
    ["one", "two"],
    "test.common.first",
    { version: "1", parse: () => null, validate: (value) => value === null },
    () => {},
  );
  const withAliases = registry.grammarIdentity;
  t.not(withAliases, original);
  registry.registerSyntax(
    ["two"],
    "test.common.second",
    { version: "1", parse: () => null, validate: (value) => value === null },
    () => {},
  );
  const replaced = registry.grammarIdentity;
  t.not(replaced, withAliases);
  registry.registerSyntax(
    ["two"],
    "test.common.second",
    { version: "2", parse: () => null, validate: (value) => value === null },
    () => {},
  );
  const versioned = registry.grammarIdentity;
  t.not(versioned, replaced);
  registry.registerTyped(
    "two",
    () => null,
    (value): value is null => value === null,
    () => {},
  );
  t.not(registry.grammarIdentity, versioned);
  registry.registerTyped(
    "one",
    () => null,
    (value): value is null => value === null,
    () => {},
  );
  t.not(registry.grammarIdentity, original);
});

test("relative declarations and empty data diagnostics avoid legacy dispatch", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  assembler.symbolScope.handleRelativeLabel = () => {
    throw new Error("Legacy relative-label parser called.");
  };
  assembler.directiveRuntime.handleDataDirective = () => {
    throw new Error("Legacy data parser called.");
  };
  assembler.assembleSource("org $808000\n+\n++:\ndb 1\n-\n--:\ndb 2", "relative.asm");
  t.deepEqual([...assembler.getBinaryOutput()], [1, 2]);
  t.throws(() => assembler.assembleSource("db", "empty.asm"), {
    message: "DB directive requires at least one parameter.",
  });
});
