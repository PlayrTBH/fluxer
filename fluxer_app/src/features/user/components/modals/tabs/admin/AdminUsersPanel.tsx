// SPDX-License-Identifier: AGPL-3.0-or-later

import {http} from '@app/features/platform/transport/RestTransport';
import {Logger} from '@app/features/platform/utils/AppLogger';
import {getUserAvatarURL} from '@app/features/user/utils/AvatarUtils';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useState} from 'react';

// Phase 1 admin: User Management. A typed UI over the same ACL-gated /admin/users/* endpoints
// the raw console exposes — search returns cards, and each card offers the core moderation
// actions. Every call is authorized server-side by the account's ACLs (non-admins are 403'd),
// so this only surfaces power the server already grants the signed-in account.

const GOLD = 'hsl(44 72% 55%)';
const CARD_BG = 'var(--background-secondary, #16161b)';
const CARD_BORDER = '1px solid rgba(255,255,255,.09)';
const MUTED = 'var(--text-muted, #9a9aa7)';
const TEXT = 'var(--text-default, #eeeef3)';
const logger = new Logger('AdminUsersPanel');

type ActionKind =
	| 'temp-ban'
	| 'unban'
	| 'schedule-deletion'
	| 'cancel-deletion'
	| 'set-acls'
	| 'terminate-sessions'
	| 'verify-email';

interface ActionDef {
	kind: ActionKind;
	label: string;
	danger?: boolean;
	path: string;
	// Whether this action applies to the given user (hidden otherwise).
	applies: (u: UserAdminResponse) => boolean;
}

const ACTIONS: ReadonlyArray<ActionDef> = [
	{kind: 'set-acls', label: 'Set ACLs', path: '/admin/users/set-acls', applies: () => true},
	{
		kind: 'temp-ban',
		label: 'Temp ban',
		danger: true,
		path: '/admin/users/temp-ban',
		applies: (u) => !u.temp_banned_until,
	},
	{kind: 'unban', label: 'Unban', path: '/admin/users/unban', applies: (u) => Boolean(u.temp_banned_until)},
	{
		kind: 'schedule-deletion',
		label: 'Schedule deletion',
		danger: true,
		path: '/admin/users/schedule-deletion',
		applies: (u) => !u.pending_deletion_at,
	},
	{
		kind: 'cancel-deletion',
		label: 'Cancel deletion',
		path: '/admin/users/cancel-deletion',
		applies: (u) => Boolean(u.pending_deletion_at),
	},
	{
		kind: 'verify-email',
		label: 'Verify email',
		path: '/admin/users/verify-email',
		applies: (u) => Boolean(u.email) && !u.email_verified,
	},
	{
		kind: 'terminate-sessions',
		label: 'Terminate sessions',
		danger: true,
		path: '/admin/users/terminate-sessions',
		applies: () => true,
	},
];

const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '8px 10px',
	borderRadius: 7,
	border: CARD_BORDER,
	background: 'var(--background-tertiary, #0f0f14)',
	color: TEXT,
	fontSize: 13,
	marginTop: 6,
};

const formatDate = (iso: string | null): string => {
	if (!iso) return '—';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'});
};

const Badge: React.FC<{label: string; tone?: 'gold' | 'red' | 'green' | 'neutral'}> = ({label, tone = 'neutral'}) => {
	const tones: Record<string, {bg: string; fg: string; bd: string}> = {
		gold: {bg: 'hsl(44 72% 55% / .12)', fg: GOLD, bd: 'hsl(44 72% 55% / .3)'},
		red: {bg: 'hsl(0 70% 55% / .12)', fg: '#f2a5a5', bd: 'hsl(0 70% 55% / .35)'},
		green: {bg: 'hsl(145 55% 45% / .14)', fg: '#8fe0ab', bd: 'hsl(145 55% 45% / .35)'},
		neutral: {bg: 'rgba(255,255,255,.06)', fg: MUTED, bd: 'rgba(255,255,255,.12)'},
	};
	const t = tones[tone];
	return (
		<span
			style={{
				fontSize: 11,
				fontWeight: 600,
				padding: '2px 7px',
				borderRadius: 5,
				background: t.bg,
				color: t.fg,
				border: `1px solid ${t.bd}`,
				whiteSpace: 'nowrap',
			}}
		>
			{label}
		</span>
	);
};

const UserCard: React.FC<{
	user: UserAdminResponse;
	onUpdated: (user: UserAdminResponse) => void;
}> = ({user, onUpdated}) => {
	const [openAction, setOpenAction] = useState<ActionKind | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// action inputs
	const [banHours, setBanHours] = useState('24');
	const [banReason, setBanReason] = useState('');
	const [delDays, setDelDays] = useState('60');
	const [delReasonCode, setDelReasonCode] = useState('0');
	const [delPublicReason, setDelPublicReason] = useState('');
	const [aclText, setAclText] = useState(user.acls.join(', '));

	const displayName = user.global_name || user.username;
	const tag = `${user.username}#${String(user.discriminator).padStart(4, '0')}`;

	const runAction = useCallback(
		async (def: ActionDef) => {
			setBusy(true);
			setError(null);
			try {
				const body: Record<string, unknown> = {user_id: user.id};
				switch (def.kind) {
					case 'temp-ban':
						body.duration_hours = Number.parseInt(banHours, 10) || 0;
						if (banReason.trim()) body.reason = banReason.trim();
						break;
					case 'schedule-deletion':
						body.days_until_deletion = Number.parseInt(delDays, 10) || 60;
						body.reason_code = Number.parseInt(delReasonCode, 10) || 0;
						if (delPublicReason.trim()) body.public_reason = delPublicReason.trim();
						break;
					case 'set-acls':
						body.acls = aclText
							.split(',')
							.map((s) => s.trim())
							.filter(Boolean);
						break;
					default:
						break;
				}
				const r = await http.post<{user?: UserAdminResponse}>(def.path, {body});
				if (r.body?.user) {
					onUpdated(r.body.user);
				}
				setOpenAction(null);
			} catch (caught: unknown) {
				const withBody = caught as {body?: {message?: string}; message?: string};
				setError(withBody?.body?.message ?? withBody?.message ?? String(caught));
				logger.warn('User admin action failed', caught);
			} finally {
				setBusy(false);
			}
		},
		[user.id, banHours, banReason, delDays, delReasonCode, delPublicReason, aclText, onUpdated],
	);

	const toggle = (kind: ActionKind) => {
		setError(null);
		setOpenAction((cur) => (cur === kind ? null : kind));
	};

	const activeDef = ACTIONS.find((a) => a.kind === openAction);
	const needsInput = openAction === 'temp-ban' || openAction === 'schedule-deletion' || openAction === 'set-acls';

	return (
		<div style={{background: CARD_BG, border: CARD_BORDER, borderRadius: 10, padding: 14, marginBottom: 10}}>
			<div style={{display: 'flex', gap: 12, alignItems: 'flex-start'}}>
				<img
					src={getUserAvatarURL({id: user.id, avatar: user.avatar})}
					alt=""
					width={44}
					height={44}
					style={{borderRadius: '50%', flexShrink: 0, objectFit: 'cover'}}
				/>
				<div style={{flex: 1, minWidth: 0}}>
					<div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
						<span style={{fontWeight: 700, fontSize: 15, color: TEXT}}>{displayName}</span>
						<span style={{fontSize: 12.5, color: MUTED}}>{tag}</span>
					</div>
					<div style={{fontSize: 12, color: MUTED, marginTop: 2, fontFamily: 'ui-monospace, monospace'}}>
						{user.id}
					</div>
					<div style={{display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8}}>
						{user.acls.length > 0 && <Badge label={user.acls.includes('*') ? 'Owner' : 'Admin'} tone="gold" />}
						{user.system && <Badge label="System" tone="gold" />}
						{user.bot && <Badge label="Bot" />}
						{user.premium_type != null && user.premium_type > 0 && <Badge label="Premium" tone="gold" />}
						{user.temp_banned_until && <Badge label="Banned" tone="red" />}
						{user.pending_deletion_at && <Badge label="Deleting" tone="red" />}
						{user.email && (
							<Badge
								label={user.email_verified ? 'Email ✓' : 'Email unverified'}
								tone={user.email_verified ? 'green' : 'neutral'}
							/>
						)}
					</div>
					<div style={{fontSize: 12, color: MUTED, marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap'}}>
						{user.email && <span>{user.email}</span>}
						<span>Last active: {formatDate(user.last_active_at)}</span>
						{user.last_active_location && <span>{user.last_active_location}</span>}
					</div>
				</div>
				<button
					type="button"
					onClick={() => void navigator.clipboard?.writeText(user.id)}
					title="Copy user ID"
					style={{
						background: 'transparent',
						border: CARD_BORDER,
						color: MUTED,
						borderRadius: 7,
						padding: '5px 9px',
						fontSize: 12,
						cursor: 'pointer',
						flexShrink: 0,
					}}
				>
					Copy ID
				</button>
			</div>

			<div style={{display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12}}>
				{ACTIONS.filter((a) => a.applies(user)).map((a) => (
					<button
						key={a.kind}
						type="button"
						onClick={() => toggle(a.kind)}
						style={{
							background: openAction === a.kind ? (a.danger ? 'hsl(0 70% 55% / .18)' : 'hsl(44 72% 55% / .18)') : 'transparent',
							border: `1px solid ${a.danger ? 'hsl(0 70% 55% / .35)' : 'rgba(255,255,255,.14)'}`,
							color: a.danger ? '#f2a5a5' : TEXT,
							borderRadius: 7,
							padding: '6px 11px',
							fontSize: 12.5,
							fontWeight: 600,
							cursor: 'pointer',
						}}
					>
						{a.label}
					</button>
				))}
			</div>

			{activeDef && (
				<div
					style={{
						marginTop: 10,
						padding: 12,
						borderRadius: 8,
						background: 'var(--background-tertiary, #0f0f14)',
						border: CARD_BORDER,
					}}
				>
					{openAction === 'temp-ban' && (
						<>
							<label style={{fontSize: 12, color: MUTED}}>Duration (hours, 0 = permanent)</label>
							<input style={inputStyle} value={banHours} onChange={(e) => setBanHours(e.target.value)} inputMode="numeric" />
							<label style={{fontSize: 12, color: MUTED, marginTop: 10, display: 'block'}}>Reason (optional)</label>
							<input style={inputStyle} value={banReason} onChange={(e) => setBanReason(e.target.value)} />
						</>
					)}
					{openAction === 'schedule-deletion' && (
						<>
							<label style={{fontSize: 12, color: MUTED}}>Days until deletion</label>
							<input style={inputStyle} value={delDays} onChange={(e) => setDelDays(e.target.value)} inputMode="numeric" />
							<label style={{fontSize: 12, color: MUTED, marginTop: 10, display: 'block'}}>Reason code</label>
							<input
								style={inputStyle}
								value={delReasonCode}
								onChange={(e) => setDelReasonCode(e.target.value)}
								inputMode="numeric"
							/>
							<label style={{fontSize: 12, color: MUTED, marginTop: 10, display: 'block'}}>Public reason (optional)</label>
							<input style={inputStyle} value={delPublicReason} onChange={(e) => setDelPublicReason(e.target.value)} />
						</>
					)}
					{openAction === 'set-acls' && (
						<>
							<label style={{fontSize: 12, color: MUTED}}>ACLs (comma-separated; use * for full admin)</label>
							<input style={inputStyle} value={aclText} onChange={(e) => setAclText(e.target.value)} spellCheck={false} />
						</>
					)}
					{!needsInput && (
						<div style={{fontSize: 13, color: TEXT, marginBottom: 4}}>
							{activeDef.danger ? 'This is a live, immediate action. ' : ''}
							Confirm “{activeDef.label}” for {displayName}?
						</div>
					)}
					{error && <div style={{color: '#f2a5a5', fontSize: 12.5, marginTop: 8}}>{error}</div>}
					<div style={{display: 'flex', gap: 8, marginTop: 12}}>
						<button
							type="button"
							disabled={busy}
							onClick={() => {
								if (activeDef) void runAction(activeDef);
							}}
							style={{
								background: activeDef.danger ? 'hsl(0 70% 55%)' : GOLD,
								color: activeDef.danger ? '#fff' : 'hsl(45 85% 8%)',
								border: 'none',
								borderRadius: 7,
								padding: '8px 16px',
								fontSize: 13,
								fontWeight: 700,
								cursor: busy ? 'default' : 'pointer',
								opacity: busy ? 0.7 : 1,
							}}
						>
							{busy ? 'Working…' : `Confirm ${activeDef.label}`}
						</button>
						<button
							type="button"
							disabled={busy}
							onClick={() => setOpenAction(null)}
							style={{
								background: 'transparent',
								border: CARD_BORDER,
								color: MUTED,
								borderRadius: 7,
								padding: '8px 16px',
								fontSize: 13,
								cursor: 'pointer',
							}}
						>
							Cancel
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

const AdminUsersPanel: React.FC = observer(() => {
	const [query, setQuery] = useState('');
	const [users, setUsers] = useState<Array<UserAdminResponse>>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [searched, setSearched] = useState(false);

	const search = useCallback(async () => {
		const trimmed = query.trim();
		if (!trimmed) return;
		setLoading(true);
		setError(null);
		try {
			const isEmail = trimmed.includes('@');
			const body: Record<string, unknown> = isEmail ? {email: trimmed, limit: 50} : {query: trimmed, limit: 50};
			const r = await http.post<{users?: Array<UserAdminResponse>}>('/admin/users/search', {body});
			setUsers(r.body?.users ?? []);
			setSearched(true);
		} catch (caught: unknown) {
			const withBody = caught as {body?: {message?: string}; message?: string};
			setError(withBody?.body?.message ?? withBody?.message ?? String(caught));
			logger.warn('User search failed', caught);
		} finally {
			setLoading(false);
		}
	}, [query]);

	const handleUpdated = useCallback((updated: UserAdminResponse) => {
		setUsers((cur) => cur.map((u) => (u.id === updated.id ? updated : u)));
	}, []);

	return (
		<div>
			<p style={{color: MUTED, fontSize: 13.5, margin: '0 0 12px'}}>
				Search by username, display name, or email. Actions are authorized server-side by your account's
				permissions and take effect immediately.
			</p>
			<div style={{display: 'flex', gap: 8, marginBottom: 16}}>
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') void search();
					}}
					placeholder="Search users…"
					spellCheck={false}
					style={{
						flex: 1,
						padding: '10px 12px',
						borderRadius: 8,
						border: CARD_BORDER,
						background: CARD_BG,
						color: TEXT,
						fontSize: 14,
					}}
				/>
				<button
					type="button"
					onClick={() => void search()}
					disabled={loading || !query.trim()}
					style={{
						background: GOLD,
						color: 'hsl(45 85% 8%)',
						border: 'none',
						borderRadius: 8,
						padding: '10px 20px',
						fontSize: 14,
						fontWeight: 700,
						cursor: loading || !query.trim() ? 'default' : 'pointer',
						opacity: loading || !query.trim() ? 0.7 : 1,
					}}
				>
					{loading ? 'Searching…' : 'Search'}
				</button>
			</div>

			{error && (
				<div
					style={{
						padding: 12,
						borderRadius: 8,
						border: '1px solid hsl(0 70% 55% / .35)',
						background: 'hsl(0 70% 55% / .08)',
						color: '#f2b8b8',
						fontSize: 13,
						marginBottom: 14,
					}}
				>
					{error}
				</div>
			)}

			{users.map((u) => (
				<UserCard key={u.id} user={u} onUpdated={handleUpdated} />
			))}

			{searched && !loading && users.length === 0 && !error && (
				<div style={{color: MUTED, fontSize: 13.5, textAlign: 'center', padding: '32px 0'}}>No users found.</div>
			)}
		</div>
	);
});

export default AdminUsersPanel;
