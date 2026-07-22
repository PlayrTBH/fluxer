// SPDX-License-Identifier: AGPL-3.0-or-later

import AdminApiConsole from '@app/features/user/components/modals/tabs/admin/AdminApiConsole';
import AdminUsersPanel from '@app/features/user/components/modals/tabs/admin/AdminUsersPanel';
import Users from '@app/features/user/state/Users';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useState} from 'react';

// Phase 1 admin view. The tab is only shown to accounts that actually carry admin ACLs
// (`hasAdminAccess()`, sourced from the same ACL set the server authorizes against), and every
// endpoint the sub-panels call is independently enforced server-side by those ACLs (a non-admin
// account that somehow reached these calls is rejected with 403). So this UI only surfaces power
// the server already grants the signed-in account. Sections are added incrementally; the API
// console remains as a power-user escape hatch for endpoints without a dedicated panel yet.

const GOLD = 'hsl(44 72% 55%)';

type Section = 'users' | 'console';

const SECTIONS: ReadonlyArray<{id: Section; label: string}> = [
	{id: 'users', label: 'Users'},
	{id: 'console', label: 'API console'},
];

const AdminTab: React.FC = observer(() => {
	const hasAdminAccess = Users.getCurrentUser()?.hasAdminAccess() ?? false;
	const [section, setSection] = useState<Section>('users');

	if (!hasAdminAccess) {
		return (
			<div style={{padding: 24, color: 'var(--text-muted, #9a9aa7)'}}>
				Admin tools are only available to administrator accounts.
			</div>
		);
	}

	return (
		<div style={{padding: '4px 4px 32px', maxWidth: 820}}>
			<h2 style={{fontSize: 20, fontWeight: 700, margin: '0 0 4px'}}>Admin</h2>
			<p style={{color: 'var(--text-muted, #9a9aa7)', fontSize: 14, margin: '0 0 6px'}}>
				Instance administration for administrator accounts. Every action is authorized server-side by your
				account's permissions.
			</p>
			<div
				style={{
					fontSize: 12.5,
					color: GOLD,
					background: 'hsl(44 72% 55% / .08)',
					border: '1px solid hsl(44 72% 55% / .25)',
					borderRadius: 8,
					padding: '8px 12px',
					margin: '0 0 18px',
				}}
			>
				These are live instance operations — actions like ban, delete, and set-ACLs take effect immediately.
			</div>

			<div
				style={{
					display: 'inline-flex',
					gap: 4,
					padding: 4,
					borderRadius: 10,
					background: 'var(--background-tertiary, #0f0f14)',
					border: '1px solid rgba(255,255,255,.09)',
					marginBottom: 20,
				}}
			>
				{SECTIONS.map((s) => (
					<button
						key={s.id}
						type="button"
						onClick={() => setSection(s.id)}
						style={{
							background: section === s.id ? GOLD : 'transparent',
							color: section === s.id ? 'hsl(45 85% 8%)' : 'var(--text-default, #eeeef3)',
							border: 'none',
							borderRadius: 7,
							padding: '7px 16px',
							fontSize: 13.5,
							fontWeight: 600,
							cursor: 'pointer',
						}}
					>
						{s.label}
					</button>
				))}
			</div>

			{section === 'users' ? <AdminUsersPanel /> : <AdminApiConsole />}
		</div>
	);
});

export default AdminTab;
