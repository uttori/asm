import type { AresRuntimeManifest } from "../../src/ares-process-host.js";

/** Local-only proof identity. Paths and private ROM bytes are deliberately not part of this file. */
export const aresLiveManifest = Object.freeze<AresRuntimeManifest>({
  schemaVersion: 1,
  emulator: "ares",
  upstreamRevision: "7b51c8ab719e403a150aa700e0933d9e93a06851",
  headlessBaseRevision: "fc44d4542557e69421b2609b74b5aa7cb57bac2d",
  forkRevision: "d87030d70a9c0bf51b5de99f56a5a94a00d16e4c",
  headlessPatchSha256: "8ce2373d63f7ec4b18e204b9e39c532fa65eca028072efa98ea508fbfb9a7b0f",
  patchSha256: "ebf137b334335fc42d8ee3c22739734bda3a3d67b06aa376de97cc74f0ee238d",
  executableSha256: "4a6e4ab960c282c16f1688f86aa49d9a992bd5a418cd74a6666412060c6389cd",
  romSha256: "4c15013131351e694e05f22e38bb1b3e4031dedac77ec75abecebe8520d82d5f",
  platform: "darwin",
  architecture: "arm64",
  buildConfiguration: "RelWithDebInfo; ares-headless; SNES-only; CLT SDK fallback",
  resources: Object.freeze([
    Object.freeze({
      path: "Database/Arcade.bml",
      sha256: "04149da6ebad3de0ec184f810b621c371dc57e1ecb19d1bf35343d66e7215a13",
    }),
    Object.freeze({
      path: "Database/BS Memory.bml",
      sha256: "ecd5eec3961aee7a43342ddf173b1b3a3585ccaa5e76f7563acebc87de88ebe9",
    }),
    Object.freeze({
      path: "Database/Famicom.bml",
      sha256: "fef99a7dda8c01793ca1102f537be3d0f793942bde2e0b6f3e9bc7b7b31245d4",
    }),
    Object.freeze({
      path: "Database/MSX.bml",
      sha256: "17f50175b7d745017c9c460ec03a6c5686810c15194047a344892837ea0e6bb9",
    }),
    Object.freeze({
      path: "Database/MSX2.bml",
      sha256: "d85c5f75b507d67b9e5add46974e066da11b77d1b1e3a46c4467d4f1705fc8fd",
    }),
    Object.freeze({
      path: "Database/Neo Geo.bml",
      sha256: "f7f2bc677784adac7f3d3249f8b39a4a51b9c46e542b35d4a53180fb8347fbb7",
    }),
    Object.freeze({
      path: "Database/Sufami Turbo.bml",
      sha256: "3ca7d0b28e4f128a4093b86d608bf202273f1573fc1b75ba0e4827d108054b59",
    }),
    Object.freeze({
      path: "Database/Super Famicom Boards.bml",
      sha256: "f6ebe91c645c338cd408b44d8e7022f6e8ced13e1f1c12f765f4f2694149ad4e",
    }),
    Object.freeze({
      path: "Database/Super Famicom.bml",
      sha256: "7167f5f8b86786639829ee67769d2959553261938bf896ce28db8f39a3cc08dc",
    }),
  ]),
});
