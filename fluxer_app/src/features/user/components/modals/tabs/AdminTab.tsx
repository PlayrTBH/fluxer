// SPDX-License-Identifier: AGPL-3.0-or-later

import {http} from '@app/features/platform/transport/RestTransport';
import {Logger} from '@app/features/platform/utils/AppLogger';
import Users from '@app/features/user/state/Users';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useState} from 'react';

// Phase 1 admin console: a thin, ACL-gated UI over the instance's existing /admin/* API.
// The tab is only shown to accounts that actually carry admin ACLs (`hasAdminAccess()`, sourced
// from the same ACL set the server authorizes against), and every endpoint is independently
// enforced server-side by those ACLs (a non-admin account that somehow reached these calls is
// rejected with 403). So this UI only surfaces power the server already grants the signed-in
// account. Follow-ups will replace the raw JSON console with per-feature panels (user cards,
// server manager, message viewer) and inline right-click actions.

interface AdminEndpoint {
	label: string;
	method: 'GET' | 'POST';
	path: string;
	template: string;
}

const ADMIN_ENDPOINTS: ReadonlyArray<AdminEndpoint> = [
	{label: 'Users · Lookup by ID', method: 'POST', path: '/admin/users/lookup', template: '{\n  "user_ids": [""]\n}'},
	{label: 'Users · Search', method: 'POST', path: '/admin/users/search', template: '{\n  "query": "",\n  "limit": 25\n}'},
	{label: 'Users · List servers', method: 'POST', path: '/admin/users/list-guilds', template: '{\n  "user_id": ""\n}'},
	{label: 'Users · List DM channels', method: 'POST', path: '/admin/users/list-dm-channels', template: '{\n  "user_id": ""\n}'},
	{label: 'Users · Set ACLs', method: 'POST', path: '/admin/users/set-acls', template: '{\n  "user_id": "",\n  "acls": []\n}'},
	{label: 'Users · Schedule deletion', method: 'POST', path: '/admin/users/schedule-deletion', template: '{\n  "user_id": ""\n}'},
	{label: 'Servers · Lookup', method: 'POST', path: '/admin/guilds/lookup', template: '{\n  "guild_id": ""\n}'},
	{label: 'Servers · Search', method: 'POST', path: '/admin/guilds/search', template: '{\n  "query": "",\n  "limit": 25\n}'},
	{label: 'Servers · List members', method: 'POST', path: '/admin/guilds/list-members', template: '{\n  "guild_id": ""\n}'},
	{label: 'Servers · Update name', method: 'POST', path: '/admin/guilds/update-name', template: '{\n  "guild_id": "",\n  "name": ""\n}'},
	{label: 'Servers · Force-add user', method: 'POST', path: '/admin/guilds/force-add-user', template: '{\n  "guild_id": "",\n  "user_id": ""\n}'},
	{label: 'Messages · Lookup in channel', method: 'POST', path: '/admin/messages/lookup', template: '{\n  "channel_id": "",\n  "limit": 50\n}'},
	{label: 'Messages · Delete', method: 'POST', path: '/admin/messages/delete', template: '{\n  "channel_id": "",\n  "message_id": ""\n}'},
	{label: 'Reports · List', method: 'POST', path: '/admin/reports/list', template: '{}'},
	{label: 'Audit logs', method: 'POST', path: '/admin/audit-logs', template: '{}'},
];

const logger = new Logger('AdminTab');
const GOLD = 'hsl(44 72% 55%)';
const CARD_BORDER = '1px solid rgba(255,255,255,.09)';

const AdminTab: React.FC = observer(() => {
	const hasAdminAccess = Users.getCurrentUser()?.hasAdminAccess() ?? false;
	const [index, setIndex] = useState(0);
	const [bodyText, setBodyText] = useState(ADMIN_ENDPOINTS[0]?.template ?? '{}');
	const [result, setResult] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const endpoint = ADMIN_ENDPOINTS[index];

	if (!hasAdminAccess) {
		return (
			<div style={{padding: 24, color: 'var(--text-muted, #9a9aa7)'}}>
				Admin tools are only available to administrator accounts.
			</div>
		);
	}

	const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const next = Number(event.target.value);
		setIndex(next);
		setBodyText(ADMIN_ENDPOINTS[next]?.template ?? '{}');
		setResult(null);
		setError(null);
	};

	const run = async () => {
		if (!endpoint) return;
		setLoading(true);
		setResult(null);
		setError(null);
		try {
			let response: {body: unknown};
			if (endpoint.method === 'GET') {
				response = await http.get<unknown>(endpoint.path);
			} else {
				const parsed = bodyText.trim() ? JSON.parse(bodyText) : {};
				response = await http.post<unknown>(endpoint.path, {body: parsed as Record<string, unknown>});
			}
			setResult(JSON.stringify(response.body, null, 2));
		} catch (caught: unknown) {
			const withBody = caught as {body?: unknown; message?: string};
			if (withBody?.body !== undefined) {
				setError(JSON.stringify(withBody.body, null, 2));
			} else {
				setError(withBody?.message ?? String(caught));
			}
			logger.warn('Admin request failed', caught);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div style={{padding: '4px 4px 32px', maxWidth: 760}}>
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
				These are live instance operations — actions like delete, force-add, and set-ACLs take effect immediately.
			</div>

			<label style={{display: 'block', fontSize: 13, fontWeight: 600, margin: '0 0 6px'}}>Operation</label>
			<select
				value={index}
				onChange={handleSelect}
				style={{
					width: '100%',
					padding: '10px 12px',
					borderRadius: 8,
					border: CARD_BORDER,
					background: 'var(--background-secondary, #16161b)',
					color: 'var(--text-default, #eeeef3)',
					fontSize: 14,
					marginBottom: 14,
				}}
			>
				{ADMIN_ENDPOINTS.map((item, i) => (
					<option key={item.path + item.label} value={i}>
						{item.label} — {item.method} {item.path}
					</option>
				))}
			</select>

			{endpoint?.method === 'POST' && (
				<>
					<label style={{display: 'block', fontSize: 13, fontWeight: 600, margin: '0 0 6px'}}>
						Request body (JSON)
					</label>
					<textarea
						value={bodyText}
						onChange={(event) => setBodyText(event.target.value)}
						spellCheck={false}
						rows={7}
						style={{
							width: '100%',
							padding: 12,
							borderRadius: 8,
							border: CARD_BORDER,
							background: 'var(--background-tertiary, #0f0f14)',
							color: 'var(--text-default, #eeeef3)',
							fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
							fontSize: 13,
							lineHeight: 1.5,
							resize: 'vertical',
							marginBottom: 14,
						}}
					/>
				</>
			)}

			<button
				type="button"
				onClick={run}
				disabled={loading}
				style={{
					padding: '11px 22px',
					borderRadius: 9,
					border: 'none',
					background: GOLD,
					color: 'hsl(45 85% 8%)',
					fontWeight: 600,
					fontSize: 15,
					cursor: loading ? 'default' : 'pointer',
					opacity: loading ? 0.7 : 1,
				}}
			>
				{loading ? 'Running…' : 'Run'}
			</button>

			{error !== null && (
				<pre
					style={{
						marginTop: 18,
						padding: 14,
						borderRadius: 8,
						border: '1px solid hsl(0 70% 55% / .35)',
						background: 'hsl(0 70% 55% / .08)',
						color: '#f2b8b8',
						fontSize: 12.5,
						whiteSpace: 'pre-wrap',
						wordBreak: 'break-word',
						overflowX: 'auto',
					}}
				>
					{error}
				</pre>
			)}
			{result !== null && (
				<pre
					style={{
						marginTop: 18,
						padding: 14,
						borderRadius: 8,
						border: CARD_BORDER,
						background: 'var(--background-tertiary, #0f0f14)',
						color: 'var(--text-default, #eeeef3)',
						fontSize: 12.5,
						whiteSpace: 'pre-wrap',
						wordBreak: 'break-word',
						maxHeight: 460,
						overflow: 'auto',
					}}
				>
					{result}
				</pre>
			)}
		</div>
	);
});

export default AdminTab;
