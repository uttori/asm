# External fixtures

Optional production disassemblies used for byte-parity gates. They are **not**
initialized by `npm install` and are excluded from `npm test`.

| Fixture | Path | Pin | ROM required |
| --- | --- | --- | ---: |
| Chou Makaimura (JP) | `fixtures/external/chou` | `62e271b81d7fffa97d288462219e13b93b5976bb` | no |
| Yoshi's Island | `fixtures/external/yoshi` | `fb79f7994fb19146de35c02fb98fee8af5877372` | no |
| Super Mario RPG (USA) | `fixtures/external/smrpg` | `57cb707669d71bb55817a0f88d28b3018c8bec57` | yes |
| TMNT IV (USA) | `fixtures/external/tmnt` | `b80a727f536acb04062284678e448260cebce90b` | yes |
| Zelda 1 (U) PRG 0 | `fixtures/external/zelda` | `50a1c869a8d8e2eb8b5b60acea325f44b4341762` | yes |
| SNES ROM Framework | `fixtures/external/snes-rom-framework` | `ad99620d2695e59b6bc31923a6d05bbaf3f695ca` (V1.4.0) | no |

Upstream URLs and expected output hashes live in `fixtures/fixture-manifest.ts`.

## Initialize one fixture

```sh
git submodule update --init fixtures/external/chou
git submodule update --init fixtures/external/yoshi
git submodule update --init fixtures/external/smrpg
git submodule update --init fixtures/external/tmnt
git submodule update --init fixtures/external/snes-rom-framework
git submodule update --init fixtures/external/zelda
```

## Local ROMs

ROM-dependent fixtures read only from `Local Only/fixtures/roms/` (gitignored).
Place these filenames there; hashes are checked before extraction:

- `Super Mario RPG - Legend of the Seven Stars (USA).sfc`
- `Teenage Mutant Ninja Turtles IV - Turtles in Time (USA).sfc`
- `Legend of Zelda_ The (U) (PRG 0).nes`

Optional debug goldens for `npm run fixture:yoshi:diff`:

- `yi.sfc`
- `Chou Makaimura (Japan).sfc`

## Commands

```sh
npm run fixtures:status
UTTORI_EXTERNAL_FIXTURES=chou,yoshi npm run test:external
npm run test:external
npm run ci:external
UTTORI_FIXTURE_KEEP_WORKTREE=1 npm run test:external
```

`ci:external` runs a strict preflight, the requested tests serially, and a
clean-worktree check. Prepared trees are copied into `os.tmpdir()` (or
`Local Only/fixtures/worktrees/` when keep-worktree is set). Submodule
checkouts stay read-only.

TMNT copies tracked `Global/` sources from the SNES ROM Framework submodule
into a temporary workspace via `npm run fixture:tmnt:framework` (used
automatically by the fixture runner). The framework stays under its upstream
GPL-3.0 license; binaries, extras, and sample ROMs are not copied. Chou's
local debug config is `fixtures/configs/chou/uttori-asm.config.json`.
