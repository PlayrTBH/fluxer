// SPDX-License-Identifier: AGPL-3.0-or-later

import {BUILD_CHANNEL} from '@electron/common/BuildChannel';

export const DESKTOP_APP_NAME = BUILD_CHANNEL === 'canary' ? 'Speechord Canary' : 'Speechord';
export const MACOS_BUNDLE_ID = BUILD_CHANNEL === 'canary' ? 'app.speechord.canary' : 'app.speechord';
export const LINUX_DESKTOP_ENTRY_ID = BUILD_CHANNEL === 'canary' ? 'speechord-canary' : 'speechord';
export const WINDOWS_SHORTCUT_AUTHOR = 'Speechord';
const WINDOWS_VELOPACK_ID = BUILD_CHANNEL === 'canary' ? 'speechord_desktop_canary' : 'speechord_desktop';
// Match the AppUserModelID Velopack bakes into the Desktop/Start-Menu shortcuts
// (`velopack.<packId>`, see the installed sq.version <shortcutAmuid>). If the runtime
// AUMID differs from the shortcut's, Windows treats the pinned shortcut and the running
// window as two separate apps -> a duplicate taskbar icon on pin, and notifications are
// not attributed to the shortcut. We align to the shortcut here instead of rewriting it
// at runtime, because the win-shell shortcut "repair" heap-crashes on Velopack installs
// (see Bootstrap.ts) and stays disabled.
export const WINDOWS_APP_USER_MODEL_ID = `velopack.${WINDOWS_VELOPACK_ID}`;
// Older AUMIDs we may have shipped under; used only to clean up stale autostart entries.
export const WINDOWS_LEGACY_APP_USER_MODEL_IDS = ['app.speechord', 'app.speechord.canary'];
export const WINDOWS_TOAST_ACTIVATOR_CLSID =
	BUILD_CHANNEL === 'canary' ? '{9CEDB5C0-3552-43B0-A279-2232E0CDF74C}' : '{48EEF21B-F3AE-431E-8CF2-386FFB2143F2}';
