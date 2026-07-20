// SPDX-License-Identifier: AGPL-3.0-or-later

import {createRequire} from 'node:module';

const requireModule = createRequire(import.meta.url);

if (process.platform === 'win32') {
	const {VelopackApp} = requireModule('velopack') as typeof import('velopack');
	// NOTE (Speechord): the Windows shortcut "repair" (repairWindowsShortcuts, backed by
	// @fluxer/win-shell) is intentionally NOT wired into these Velopack lifecycle hooks.
	// Its native createShortcut heap-corrupts (STATUS_HEAP_CORRUPTION 0xc0000374 in the
	// IShellLink::Save / IPropertyStore path) on a Velopack install, crashing the app on
	// EVERY launch before Electron initializes. The repair only runs in a Velopack install
	// (it is gated on a `current/` dir next to `Update.exe`), which is exactly why the NSIS
	// and portable builds never hit it. Velopack already lays down working Desktop +
	// Start-Menu shortcuts via `vpk pack --shortcuts`, so skipping the AUMID rewrite keeps
	// the app launching. TODO: fix @fluxer/win-shell (borrowed-pointer PROPVARIANT in
	// create_shortcut) and restore the AppUserModelID repair for correct toast attribution.
	VelopackApp.build().run();
}

await import(new URL('./MainApp.js', import.meta.url).href);
