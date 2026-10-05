# Native-saved structure fixtures

These retain the original pixels from the Aseprite 1.3.18.6 arm64 saves in
`.verification/aseprite-tilemap-spike-2026-10-04`. That historical receipt remains unchanged;
its production-import rejection applies to the earlier raster-only host.

The production structure tests read the saved files independently of the new writer and
compare every rendered frame with the editor PNG/sheet. The transform fixture also keeps
rectangular 3x5 tiles, duplicate-looking native identities, blank native tiles and a separate
empty sentinel. These are codec/render oracles; their descriptive prototype IDs do not grant
production import authority and they do not prove actual Manual/Auto/Stack painting behavior.
