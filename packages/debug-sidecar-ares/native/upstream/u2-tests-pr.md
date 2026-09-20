# Native regression tests for the GDB polling-window fix

Follow-up for [PR #2625](https://github.com/ares-emulator/ares/pull/2625): add a C++ test executable under `tests/gdb-polling`, built with `ARES_BUILD_OPTIONAL_TARGETS` and launched by `run-tests.sh`/CTest like the existing ares processor tests.

CMake compiles the actual `Server::updateLoop()` method against a deterministic transport fixture, without duplicating the algorithm or adding a production test API. Eleven scenarios cover running/halted idle budgets, queued requests, a packet arriving at the idle boundary, the continuous-traffic reset guard, immediate resume, and disconnect acknowledgements. Explicit checks stay active in release builds. A poll limit and CTest timeout catch hangs.

Validated on macOS arm64 with RelWithDebInfo: restoring the original `i = loopCount` assignment fails five scenarios, while the fix passes all eleven. Packet parsing and desktop/client interoperability remain separate checks.

```sh
cmake -S . -B build -DARES_BUILD_OPTIONAL_TARGETS=ON
tests/gdb-polling/run-tests.sh /absolute/path/to/build --verbose
```

The local `codex/ares-upstream-u2-tests` branch starts at the submitted PR head. `u2-tests-followup.patch` is the standalone follow-up. The numbered series contains its desktop integration counterpart. Neither the PR branch nor its public description has been updated remotely.
