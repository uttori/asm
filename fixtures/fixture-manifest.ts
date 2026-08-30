export const EXTERNAL_FIXTURE_IDS = ["chou", "yoshi", "smrpg", "tmnt", "zelda"] as const;

export type ExternalFixtureId = (typeof EXTERNAL_FIXTURE_IDS)[number];

export type ChecksumMode = "asar" | "simple";

export type LocalRomSpec = {
  filename: string;
  bytes: number;
  sha256: string;
};

export type ExternalFixtureSpec = {
  id: ExternalFixtureId;
  displayName: string;
  submodulePath: string;
  submoduleUrl: string;
  commit: string;
  entrypoint: string;
  expectedBytes: number;
  expectedSha256: string;
  selfContained: boolean;
  checksumMode: ChecksumMode;
  family: "snes" | "65xx";
  setupInstructions: string;
  localRom?: LocalRomSpec;
  optionalDiffRom?: LocalRomSpec;
  extractedAssetSentinels: readonly string[];
  frameworkPath?: string;
  frameworkVersion?: string;
  configPath?: string;
  localEntrypointOverlay?: string;
};

const ROM_SETUP =
  'Place the required ROM in "Local Only/fixtures/roms/" using the filename in the fixture manifest, then re-run. Input hashes are checked before extraction.';

export const SNES_ROM_FRAMEWORK = {
  id: "snes-rom-framework",
  displayName: "SNES ROM Framework",
  submodulePath: "fixtures/external/snes-rom-framework",
  submoduleUrl: "https://github.com/Yoshifanatic1/SNES-ROM-Framework.git",
  commit: "ad99620d2695e59b6bc31923a6d05bbaf3f695ca",
  version: "1.4.0",
  globalDir: "Global",
} as const;
export const LOCAL_ROM_DIR = "Local Only/fixtures/roms";
export const LOCAL_WORKTREE_DIR = "Local Only/fixtures/worktrees";

export const EXTERNAL_FIXTURES: Record<ExternalFixtureId, ExternalFixtureSpec> = {
  chou: {
    id: "chou",
    displayName: "Chou Makaimura (Japan)",
    submodulePath: "fixtures/external/chou",
    submoduleUrl: "https://github.com/FredYeye/Super-Ghouls-n-Ghosts-Disassembly.git",
    commit: "62e271b81d7fffa97d288462219e13b93b5976bb",
    entrypoint: "Chou.asm",
    expectedBytes: 1_048_576,
    expectedSha256: "514cfb608ef9107739795623973f18ff3aea48eb6c7509e63f957edd10e52378",
    selfContained: true,
    checksumMode: "simple",
    family: "snes",
    setupInstructions: "git submodule update --init fixtures/external/chou",
    extractedAssetSentinels: [],
    configPath: "fixtures/configs/chou/uttori-asm.config.json",
    localEntrypointOverlay: "fixtures/assets/chou-local/Chou.asm",
  },
  yoshi: {
    id: "yoshi",
    displayName: "Yoshi's Island",
    submodulePath: "fixtures/external/yoshi",
    submoduleUrl: "https://github.com/brunovalads/yoshisisland-disassembly.git",
    commit: "fb79f7994fb19146de35c02fb98fee8af5877372",
    entrypoint: "disassembly/assemble.asm",
    expectedBytes: 2_097_152,
    expectedSha256: "9b4957466798bbdb5b43a450bbb60b2591ae81d95b891430f62d53ca62e8bc7b",
    selfContained: true,
    checksumMode: "asar",
    family: "snes",
    setupInstructions: "git submodule update --init fixtures/external/yoshi",
    extractedAssetSentinels: [],
    optionalDiffRom: {
      filename: "yi.sfc",
      bytes: 2_097_152,
      sha256: "9b4957466798bbdb5b43a450bbb60b2591ae81d95b891430f62d53ca62e8bc7b",
    },
  },
  smrpg: {
    id: "smrpg",
    displayName: "Super Mario RPG (USA)",
    submodulePath: "fixtures/external/smrpg",
    submoduleUrl: "https://github.com/Yoshifanatic1/Super-Mario-RPG-Disassembly.git",
    commit: "57cb707669d71bb55817a0f88d28b3018c8bec57",
    entrypoint: "Global/AssembleFile.asm",
    expectedBytes: 4_194_304,
    expectedSha256: "740646f3535bfb365ca44e70d46ab433467b142bd84010393070bd0b141af853",
    selfContained: false,
    checksumMode: "asar",
    family: "snes",
    setupInstructions: `git submodule update --init fixtures/external/smrpg\n${ROM_SETUP}`,
    localRom: {
      filename: "Super Mario RPG - Legend of the Seven Stars (USA).sfc",
      bytes: 4_194_304,
      sha256: "740646f3535bfb365ca44e70d46ab433467b142bd84010393070bd0b141af853",
    },
    extractedAssetSentinels: ["SMRPG/Graphics/GFX_C1B100.bin"],
  },
  tmnt: {
    id: "tmnt",
    displayName: "TMNT IV (USA)",
    submodulePath: "fixtures/external/tmnt",
    submoduleUrl: "https://github.com/Yoshifanatic1/TMNT-IV---Turtles-In-Time-SNES-Disassembly.git",
    commit: "b80a727f536acb04062284678e448260cebce90b",
    entrypoint: "Global/AssembleFile.asm",
    expectedBytes: 1_048_576,
    expectedSha256: "5b82cdd6f2da56f43680d6a5021faebe2e06036d30602c1a7917aa414cf8b5f4",
    selfContained: false,
    checksumMode: "asar",
    family: "snes",
    setupInstructions: `git submodule update --init fixtures/external/tmnt fixtures/external/snes-rom-framework\n${ROM_SETUP}`,
    localRom: {
      filename: "Teenage Mutant Ninja Turtles IV - Turtles in Time (USA).sfc",
      bytes: 1_048_576,
      sha256: "5b82cdd6f2da56f43680d6a5021faebe2e06036d30602c1a7917aa414cf8b5f4",
    },
    extractedAssetSentinels: ["Teenage_Mutant_Ninja_Turtles_IV/AsarScripts/AssetsExtracted.txt"],
    frameworkPath: SNES_ROM_FRAMEWORK.submodulePath,
    frameworkVersion: SNES_ROM_FRAMEWORK.version,
  },
  zelda: {
    id: "zelda",
    displayName: "Zelda 1 (U) PRG 0",
    submodulePath: "fixtures/external/zelda",
    submoduleUrl: "https://github.com/aldonunez/zelda1-disassembly.git",
    commit: "50a1c869a8d8e2eb8b5b60acea325f44b4341762",
    entrypoint: "src/_uttori_driver.asm",
    expectedBytes: 131_088,
    expectedSha256: "8f72dc2e98572eb4ba7c3a902bca5f69c448fc4391837e5f8f0d4556280440ac",
    selfContained: false,
    checksumMode: "simple",
    family: "65xx",
    setupInstructions: `git submodule update --init fixtures/external/zelda\n${ROM_SETUP}`,
    localRom: {
      filename: "Legend of Zelda_ The (U) (PRG 0).nes",
      bytes: 131_088,
      sha256: "8f72dc2e98572eb4ba7c3a902bca5f69c448fc4391837e5f8f0d4556280440ac",
    },
    extractedAssetSentinels: ["dat"],
  },
};

export function getExternalFixture(id: string): ExternalFixtureSpec {
  if (!isExternalFixtureId(id)) {
    throw new Error(
      `Unknown external fixture '${id}'. Available: ${EXTERNAL_FIXTURE_IDS.join(", ")}.`,
    );
  }
  return EXTERNAL_FIXTURES[id];
}

export function isExternalFixtureId(id: string): id is ExternalFixtureId {
  return (EXTERNAL_FIXTURE_IDS as readonly string[]).includes(id);
}
