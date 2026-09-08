/** In-product instructions; bundled with the extension, available without a project or runtime. */
export const BEHAVIOR_CAPTURE_GUIDE = `# Idle-subtracted behavior capture

## Try it now: no ROM or emulator required

Run **Assembly: Run Idle Capture Demo** from the Command Palette, or **Idle demo** in the Assembly Project panel.
It runs synthetic CPU steps through the same trace recorder, comparison, and comment merger used by live capture.
The report opens in an editor. Nothing is written to your project.

Expected result:

- Idle trace: $808000 → $808010 → $808000 → $808010.
- Action trace: $808000 → $808020 → $808030 → $808020 → $808000.
- $808020 and $808030 are **action-only** candidates, with score 1.000.
- $808000 is **shared** code and remains visible for context.
- $808010 is idle-only and does not appear in the action candidates.
- The preview adds “Open Menu (synthetic)” association comments, keeps a handwritten comment, and proves that applying the same selection twice makes no further changes.

This tests the analysis workflow, not Secret of Mana or a graphical emulator.

## What the current ares launch does

The Secret of Mana workspace selects the patched **ares desktop** runtime: the game appears in a separate native window with video, audio, and controller input. The same core supplies VS Code debugging and instruction traces.
Runtime manifests select the frontend. Older manifests without a frontend field still launch headless, with no game window; check **Output → Uttori Emulator** if your saved runtime binding overrides the workspace launch.
Launching pauses at entry. Look in **Run and Debug → CALL STACK / VARIABLES**, and **Output → Uttori Emulator** for connection status or errors.
Click the stopped frame to open mapped assembly or a live virtual disassembly. Use **Step Into (F11)** for one CPU instruction, or **Continue (F5)** to run.
Step Over and Step Out are not supported by this ares bridge.

A paused CPU is not an “idle baseline”: idle means the game is running without player input.
Configure the controller in **ares Settings → Input → Super Famicom → Controller Port 1 → Gamepad**, then focus the game window to play. Keyboard bindings are not assigned automatically. The debugger runtime allows execution while ares is unfocused so VS Code capture dialogs do not pause the game.

## Capture a live observation window

1. Build with **Assembly: Build Binary** and launch the matching ROM/debug map with **Assembly: Debug in Emulator** or **Secret of Mana (ares)**. Resolve any errors in Uttori Emulator output first. Continue (F5) past the initial debugger stop.
2. Play to a repeatable state, such as standing in a quiet room with no menu open. Leave the game running and release the controls.
3. Run **Assembly: Capture Idle Baseline**. Choose a label, time/event limits, and a new JSON file. If paused, choose **Start and Continue** to arm tracing and resume together; **Start Paused** requires you to step or continue before the time limit expires.
4. For a meaningful behavior comparison, return to the same starting state and keep the same ROM, debug map, project revision, processor, and emulator revision. Recapture idle after rebuilding. The current integration does not automatically restore save states.
5. Run **Assembly: Capture Behavior**. Select one to eight idle capture files, name the behavior (for example Open Menu), choose a stopping point and limits, and save to a new file. Focus ares and press the mapped menu button. For the first attempt, use a short time window and stop once the menu is open; later refine it with an address or breakpoint.
6. Run **Assembly: Stop Behavior Capture** to stop early, or let the chosen limit end the recording. Stopping a recording does not itself pause the CPU. Address/label/source stops trim observations; use an existing CPU breakpoint if execution must halt there.
7. Run **Assembly: Review and Apply Capture** and open the action JSON. Review action-only, enriched, and shared instructions, event loss, warnings, and ordered transitions. Select candidates and confirm **Apply Capture** to persist association comments and execution evidence. The completion message reports exactly how many runtime facts, comments, and evidence records changed.
8. Choose **Analyze and Regenerate** in that completion message. Selected observed PCs become conservative code observations; analysis and source export run, a byte-identical rebuild is verified, and a Markdown report shows static-instruction and emitted-code byte deltas. A runtime observation proves reachability but does not invent a function boundary. A zero delta means the selected PCs were already code or could not be decoded without conflicts—it no longer means the workflow silently did nothing.

Existing comments, labels, and hand-authored source are preserved. Applying the capture changes only the analysis project; it marks generated source stale until you explicitly choose **Analyze and Regenerate**. Source-only projects can capture and review but cannot persist analysis comments without a matching native analysis project.

At any time, run **Assembly: Show Disassembly Update Status** to compare the current analysis revision with the revision recorded in generated source. For a general saved runtime trace, use **Assembly: Import Runtime Trace and Update Disassembly** instead of the behavior-capture review command.

## How to interpret a result

This is differential execution tracing / feature location, not proof that every selected instruction implements the menu. Interrupt handlers and common engine routines can appear in both windows. “Enriched” means more frequent in the action window after normalization; it is a lead to inspect, not a causal claim.

Check the saved event count and dropped-event warnings. Zero events usually means execution stayed paused. Shorten windows or use a tighter stop if trace loss is high. Repeat the idle and action captures to distinguish repeatable behavior from unrelated activity.
`;
