'use client';

// org.anvaya.one governance console. Bootstrap the first owner, then manage the governed
// country-specific guidance catalogue + rules and issue dedapi keys to consuming platforms.

import { useCallback, useEffect, useState } from 'react';
import { api, apiEnabled, ApiError, type OrgUserView, type GuidanceRow, type RuleRow, type DedapiKeyView, type ComplianceRow, type GovMeta, type OrgRole, type CompanyHit } from '@/lib/api';

type Phase = 'loading' | 'auth' | 'ready' | 'disabled';
type Tab = 'fabric' | 'guidance' | 'rules' | 'compliance' | 'verify' | 'keys' | 'users';

export default function ConsolePage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [me, setMe] = useState<OrgUserView | null>(null);
  const [initialised, setInitialised] = useState(true);

  const probe = useCallback(async () => {
    if (!apiEnabled()) { setPhase('disabled'); return; }
    try { setMe(await api.auth.me()); setPhase('ready'); }
    catch {
      try { const s = await api.auth.status(); setInitialised(s.initialised); } catch { /* ignore */ }
      setPhase('auth');
    }
  }, []);
  useEffect(() => { void probe(); }, [probe]);

  if (phase === 'loading') return <div className="org-shell"><p className="org-muted">Loading…</p></div>;
  if (phase === 'disabled') return (
    <div className="org-shell"><div className="org-center org-card">
      <h1 className="org-h2">org.anvaya.one</h1>
      <p className="org-lead">Set <code>NEXT_PUBLIC_ORG_API_URL</code> to the governance API to use this console.</p>
    </div></div>
  );
  if (phase === 'auth') return <AuthGate initialised={initialised} onAuthed={probe} />;
  return <Console me={me!} onSignOut={async () => { await api.auth.logout().catch(() => undefined); setMe(null); setPhase('auth'); }} />;
}

function AuthGate({ initialised, onAuthed }: { initialised: boolean; onAuthed: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    setBusy(true); setErr('');
    try {
      if (initialised) await api.auth.login(email.trim(), password);
      else await api.auth.bootstrap(email.trim(), password, name.trim() || undefined);
      onAuthed();
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not sign in.'); setBusy(false); }
  };
  return (
    <div className="org-shell">
      <div className="org-center org-card">
        <div className="org-brand" style={{ marginBottom: 4 }}>org<span>.anvaya.one</span></div>
        <p className="org-lead">{initialised ? 'Organisation governance — sign in.' : 'Set up the first administrator (owner) for this platform.'}</p>
        {!initialised && (
          <div className="org-field"><label className="org-label">Your name</label>
            <input className="org-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Admin" /></div>
        )}
        <div className="org-field"><label className="org-label">Email</label>
          <input className="org-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@org.anvaya.one" /></div>
        <div className="org-field"><label className="org-label">Password</label>
          <input className="org-input" type="password" autoComplete={initialised ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }} placeholder={initialised ? 'Your password' : 'At least 8 characters'} /></div>
        {err && <p className="org-err">{err}</p>}
        <button className="org-btn org-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} disabled={busy} onClick={() => void submit()}>
          {busy ? 'Please wait…' : initialised ? 'Sign in' : 'Create owner account'}
        </button>
      </div>
    </div>
  );
}

function Console({ me, onSignOut }: { me: OrgUserView; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>('fabric');
  const [audit, setAudit] = useState<{ valid: boolean; count: number } | null>(null);
  const canAdmin = me.role === 'owner' || me.role === 'admin';
  useEffect(() => { if (canAdmin) api.gov.auditVerify().then(setAudit).catch(() => undefined); }, [canAdmin]);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'fabric', label: 'Fabric' }, { id: 'guidance', label: 'Guidance' }, { id: 'rules', label: 'Rules' }, { id: 'compliance', label: 'Compliance' }, { id: 'verify', label: 'Verify (UK)' },
    ...(canAdmin ? [{ id: 'keys' as Tab, label: 'dedapi keys' }, { id: 'users' as Tab, label: 'Users' }] : []),
  ];
  return (
    <div className="org-shell">
      <div className="org-topbar">
        <div className="org-brand">org<span>.anvaya.one</span></div>
        <span className="org-pill">Governance</span>
        {audit && <span className="org-pill" style={{ color: audit.valid ? '#5BD08A' : '#FF8A8A', borderColor: audit.valid ? '#1F5135' : '#5F1E1E' }}>{audit.valid ? `audit ✓ ${audit.count}` : 'audit broken'}</span>}
        <div style={{ flex: 1 }} />
        <span className="org-muted" style={{ fontSize: 13 }}>{me.email} · <b style={{ color: '#9FC3FF' }}>{me.role}</b></span>
        <button className="org-btn" onClick={onSignOut}>Sign out</button>
      </div>
      <div className="org-tabs">
        {tabs.map((t) => <button key={t.id} className={`org-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      {tab === 'fabric' && <FabricTab audit={audit} />}
      {tab === 'guidance' && <GuidanceTab role={me.role} />}
      {tab === 'rules' && <RulesTab role={me.role} />}
      {tab === 'compliance' && <ComplianceTab role={me.role} />}
      {tab === 'verify' && <VerifyTab role={me.role} />}
      {tab === 'keys' && canAdmin && <KeysTab />}
      {tab === 'users' && canAdmin && <UsersTab />}
    </div>
  );
}

function FabricTab({ audit }: { audit: { valid: boolean; count: number } | null }) {
  const [cells, setCells] = useState<{ country: string; online: boolean; guidance: number; rules: number }[] | null>(null);
  useEffect(() => { api.gov.overview().then((r) => setCells(r.cells)).catch(() => setCells([])); }, []);
  const FLAG: Record<string, string> = { IN: '🇮🇳', UK: '🇬🇧', US: '🇺🇸' };
  return (
    <div className="org-card">
      <h2 className="org-h2">Fabric topology</h2>
      <p className="org-lead">org.anvaya.one runs a Common control-plane (admins · dedapi keys · audit) plus a governed fabric cell per country. Each country&apos;s guidance &amp; rules live in its own cell DB and are served over dedapi.</p>
      <div className="org-grid">
        <div className="org-card" style={{ background: '#0A1525' }}>
          <div className="org-tag" style={{ marginBottom: 8 }}>Common control-plane</div>
          <div style={{ fontSize: 13 }}>Org admins · dedapi keys</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Audit chain: {audit ? <b style={{ color: audit.valid ? '#5BD08A' : '#FF8A8A' }}>{audit.valid ? `intact · ${audit.count} entries` : 'BROKEN'}</b> : <span className="org-muted">checking…</span>}</div>
        </div>
        {(cells ?? []).map((c) => (
          <div key={c.country} className="org-card" style={{ background: '#0A1525' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>{FLAG[c.country] ?? '🏳️'}</span>
              <b>One Fabric {c.country}</b>
              <span className="org-tag" style={{ marginLeft: 'auto', color: c.online ? '#5BD08A' : '#FF8A8A' }}>{c.online ? 'online' : 'offline'}</span>
            </div>
            <div style={{ fontSize: 13 }} className="org-muted">{c.guidance} guidance · {c.rules} rules</div>
          </div>
        ))}
        {cells === null && <p className="org-muted" style={{ fontSize: 13 }}>Loading cells…</p>}
      </div>
    </div>
  );
}

function useMeta() {
  const [meta, setMeta] = useState<GovMeta | null>(null);
  useEffect(() => { api.gov.meta().then(setMeta).catch(() => undefined); }, []);
  return meta;
}

function GuidanceTab({ role }: { role: OrgRole }) {
  const meta = useMeta();
  const canWrite = role !== 'viewer';
  const [country, setCountry] = useState('UK');
  const [type, setType] = useState('passport');
  const [rows, setRows] = useState<GuidanceRow[]>([]);
  const [draft, setDraft] = useState<Partial<GuidanceRow>>({ kind: 'apply' });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const load = useCallback(() => { api.gov.guidance(country, type).then((r) => setRows(r.items)).catch(() => setRows([])); }, [country, type]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    setErr(''); setMsg('');
    try {
      await api.gov.setGuidance({ ...draft, country, entityType: type, kind: draft.kind ?? 'apply', label: draft.label ?? '' });
      setMsg('Saved.'); setDraft({ kind: 'apply' }); load();
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not save.'); }
  };
  const del = async (id: string) => { await api.gov.delGuidance(id).catch(() => undefined); load(); };
  return (
    <div className="org-card">
      <h2 className="org-h2">Country guidance</h2>
      <p className="org-lead">The governed action cards + official links the family app shows per country & type. Served via dedapi.</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <select className="org-select" style={{ width: 130 }} value={country} onChange={(e) => setCountry(e.target.value)}>
          {(meta?.countries ?? ['IN', 'UK', 'US']).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="org-input" style={{ width: 200 }} value={type} onChange={(e) => setType(e.target.value)} placeholder="type (e.g. passport)" />
      </div>
      {rows.length === 0 ? <p className="org-muted" style={{ fontSize: 13 }}>No guidance yet for {country} · {type}.</p> : (
        <div>
          {rows.map((r) => (
            <div key={r.id} className="org-row" style={{ gridTemplateColumns: '90px 1fr auto' }}>
              <span className="org-tag">{r.kind}</span>
              <span><b>{r.label}</b>{r.url && <a href={r.url} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 11.5 }}>{r.url}</a>}</span>
              {canWrite && <button className="org-btn org-btn-danger" onClick={() => void del(r.id)}>Remove</button>}
            </div>
          ))}
        </div>
      )}
      {canWrite && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--org-line)', paddingTop: 14 }}>
          <div className="org-grid">
            <div><label className="org-label">Kind</label>
              <select className="org-select" value={draft.kind ?? 'apply'} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
                {(meta?.kinds ?? ['apply', 'renew', 'lost', 'contact', 'embassy', 'emergency', 'guidance', 'support']).map((k) => <option key={k} value={k}>{k}</option>)}
              </select></div>
            <div><label className="org-label">Label</label><input className="org-input" value={draft.label ?? ''} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Apply for a passport" /></div>
            <div><label className="org-label">Link (URL)</label><input className="org-input" value={draft.url ?? ''} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://…" /></div>
            <div><label className="org-label">Summary</label><input className="org-input" value={draft.summary ?? ''} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} placeholder="Short description" /></div>
          </div>
          {err && <p className="org-err">{err}</p>}{msg && <p className="org-ok">{msg}</p>}
          <button className="org-btn org-btn-primary" style={{ marginTop: 10 }} onClick={() => void save()}>Add / update guidance</button>
        </div>
      )}
    </div>
  );
}

function RulesTab({ role }: { role: OrgRole }) {
  const meta = useMeta();
  const canWrite = role !== 'viewer';
  const [country, setCountry] = useState('UK');
  const [type, setType] = useState('passport');
  const [rows, setRows] = useState<RuleRow[]>([]);
  const [draft, setDraft] = useState<{ ruleKind: string; field: string; value: string; description: string }>({ ruleKind: 'required_field', field: '', value: '', description: '' });
  const [err, setErr] = useState('');
  const load = useCallback(() => { api.gov.rules(country, type).then((r) => setRows(r.rules)).catch(() => setRows([])); }, [country, type]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    setErr('');
    const config: Record<string, unknown> = { field: draft.field };
    if (draft.ruleKind === 'min_age') config.minAge = Number(draft.value || 0);
    if (draft.ruleKind === 'id_format') config.pattern = draft.value;
    try { await api.gov.setRule({ country, entityType: type, ruleKind: draft.ruleKind, config, description: draft.description }); setDraft({ ruleKind: 'required_field', field: '', value: '', description: '' }); load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not save.'); }
  };
  const del = async (id: string) => { await api.gov.delRule(id).catch(() => undefined); load(); };
  return (
    <div className="org-card">
      <h2 className="org-h2">Governance rules</h2>
      <p className="org-lead">Profile-creation rules (required fields, minimum age, ID format) enforced via <code>dedapi /validate-profile</code>.</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <select className="org-select" style={{ width: 130 }} value={country} onChange={(e) => setCountry(e.target.value)}>
          {(meta?.countries ?? ['IN', 'UK', 'US']).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="org-input" style={{ width: 200 }} value={type} onChange={(e) => setType(e.target.value)} placeholder="type (e.g. passport)" />
      </div>
      {rows.length === 0 ? <p className="org-muted" style={{ fontSize: 13 }}>No rules yet for {country} · {type}.</p> : rows.map((r) => (
        <div key={r.id} className="org-row" style={{ gridTemplateColumns: '120px 1fr auto' }}>
          <span className="org-tag">{r.ruleKind}</span>
          <span><b>{String((r.config as Record<string, unknown>).field ?? '')}</b> <span className="org-muted">{JSON.stringify(r.config)}</span></span>
          {canWrite && <button className="org-btn org-btn-danger" onClick={() => void del(r.id)}>Remove</button>}
        </div>
      ))}
      {canWrite && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--org-line)', paddingTop: 14 }}>
          <div className="org-grid">
            <div><label className="org-label">Rule</label>
              <select className="org-select" value={draft.ruleKind} onChange={(e) => setDraft({ ...draft, ruleKind: e.target.value })}>
                {(meta?.ruleKinds ?? ['required_field', 'min_age', 'id_format', 'note']).map((k) => <option key={k} value={k}>{k}</option>)}
              </select></div>
            <div><label className="org-label">Field</label><input className="org-input" value={draft.field} onChange={(e) => setDraft({ ...draft, field: e.target.value })} placeholder="e.g. number" /></div>
            {(draft.ruleKind === 'min_age' || draft.ruleKind === 'id_format') && (
              <div><label className="org-label">{draft.ruleKind === 'min_age' ? 'Minimum age' : 'Regex pattern'}</label><input className="org-input" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} /></div>
            )}
            <div><label className="org-label">Description</label><input className="org-input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
          </div>
          {err && <p className="org-err">{err}</p>}
          <button className="org-btn org-btn-primary" style={{ marginTop: 10 }} onClick={() => void save()}>Add / update rule</button>
        </div>
      )}
    </div>
  );
}

function ComplianceTab({ role }: { role: OrgRole }) {
  const meta = useMeta();
  const canWrite = role !== 'viewer';
  const [country, setCountry] = useState('UK');
  const [rows, setRows] = useState<ComplianceRow[]>([]);
  const [d, setD] = useState<{ entityType: string; title: string; body: string; severity: string; url: string }>({ entityType: '*', title: '', body: '', severity: 'info', url: '' });
  const [err, setErr] = useState('');
  const load = useCallback(() => { api.gov.compliance(country).then((r) => setRows(r.notes)).catch(() => setRows([])); }, [country]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    setErr('');
    try { await api.gov.setCompliance({ country, entityType: d.entityType.trim() || '*', title: d.title, body: d.body, severity: d.severity, url: d.url.trim() || undefined }); setD({ entityType: '*', title: '', body: '', severity: 'info', url: '' }); load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not save.'); }
  };
  const del = async (id: string) => { await api.gov.delCompliance(id).catch(() => undefined); load(); };
  return (
    <div className="org-card">
      <h2 className="org-h2">Compliance &amp; rights</h2>
      <p className="org-lead">Governed notices about regional law, data-protection regime and people&apos;s rights. Shown in the family app and served via dedapi. Use <code>*</code> for a country-wide notice.</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <select className="org-select" style={{ width: 130 }} value={country} onChange={(e) => setCountry(e.target.value)}>
          {(meta?.countries ?? ['IN', 'UK', 'US']).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {rows.length === 0 ? <p className="org-muted" style={{ fontSize: 13 }}>No compliance notices for {country}.</p> : rows.map((r) => (
        <div key={r.id} className="org-row" style={{ gridTemplateColumns: '90px 1fr auto' }}>
          <span className="org-tag" style={{ color: r.severity === 'legal' ? '#FF8A8A' : r.severity === 'rights' ? '#E3B341' : '#9FC3FF' }}>{r.severity}</span>
          <span><b>{r.title}</b> <span className="org-muted" style={{ fontSize: 11.5 }}>({r.entityType})</span><br /><span className="org-muted" style={{ fontSize: 12 }}>{r.body}</span></span>
          {canWrite && <button className="org-btn org-btn-danger" onClick={() => void del(r.id)}>Remove</button>}
        </div>
      ))}
      {canWrite && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--org-line)', paddingTop: 14 }}>
          <div className="org-grid">
            <div><label className="org-label">Applies to (type or *)</label><input className="org-input" value={d.entityType} onChange={(e) => setD({ ...d, entityType: e.target.value })} /></div>
            <div><label className="org-label">Severity</label>
              <select className="org-select" value={d.severity} onChange={(e) => setD({ ...d, severity: e.target.value })}>
                {(meta?.severities ?? ['info', 'rights', 'legal']).map((sv) => <option key={sv} value={sv}>{sv}</option>)}
              </select></div>
            <div><label className="org-label">Title</label><input className="org-input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></div>
            <div><label className="org-label">Link (optional)</label><input className="org-input" value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} /></div>
          </div>
          <div className="org-field" style={{ marginTop: 12 }}><label className="org-label">Body</label><textarea className="org-textarea" rows={3} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} /></div>
          {err && <p className="org-err">{err}</p>}
          <button className="org-btn org-btn-primary" onClick={() => void save()}>Add / update notice</button>
        </div>
      )}
    </div>
  );
}

function VerifyTab({ role }: { role: OrgRole }) {
  const canAdmin = role === 'owner' || role === 'admin';
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<CompanyHit[] | null>(null);
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const load = useCallback(() => { api.companies.status().then((s) => setConfigured(s.configured)).catch(() => setConfigured(false)); }, []);
  useEffect(() => { load(); }, [load]);
  const saveKey = async () => {
    setErr(''); setMsg('');
    try { await api.companies.setKey(keyInput.trim()); setMsg('Companies House key saved.'); setKeyInput(''); load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not save key.'); }
  };
  const search = async () => {
    setErr('');
    if (q.trim().length < 2) return;
    try { const r = await api.companies.search(q.trim()); setConfigured(r.configured); setItems(r.items); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Search failed.'); }
  };
  return (
    <div className="org-card">
      <h2 className="org-h2">Verify UK organisation (Companies House)</h2>
      <p className="org-lead">Look up and verify a UK company by name or number during org onboarding. Also exposed to me.anvaya over dedapi (<code>/dedapi/companies/search</code>).</p>
      {configured === false && (
        <div className="org-card" style={{ marginBottom: 14, background: '#0A1525' }}>
          <p className="org-lead" style={{ marginTop: 0 }}>Companies House isn’t connected yet. {canAdmin ? 'Enter your CH REST API key:' : 'Ask an owner/admin to add the API key.'}</p>
          {canAdmin && (
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="org-input" type="password" placeholder="Companies House API key" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} style={{ maxWidth: 360 }} />
              <button className="org-btn org-btn-primary" disabled={!keyInput.trim()} onClick={() => void saveKey()}>Save key</button>
            </div>
          )}
        </div>
      )}
      {configured && <span className="org-tag" style={{ color: '#5BD08A' }}>Companies House connected</span>}
      <div style={{ display: 'flex', gap: 10, margin: '14px 0' }}>
        <input className="org-input" placeholder="Company name or number" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search(); }} style={{ maxWidth: 360 }} />
        <button className="org-btn org-btn-primary" onClick={() => void search()} disabled={q.trim().length < 2}>Search</button>
      </div>
      {err && <p className="org-err">{err}</p>}{msg && <p className="org-ok">{msg}</p>}
      {items && items.length === 0 && <p className="org-muted" style={{ fontSize: 13 }}>No matches.</p>}
      {items && items.map((c) => (
        <div key={c.number} className="org-row" style={{ gridTemplateColumns: '1fr auto' }}>
          <span><b>{c.name}</b> <span className="org-muted" style={{ fontSize: 12 }}>#{c.number}{c.address ? ` · ${c.address}` : ''}</span></span>
          {c.status && <span className="org-tag" style={{ color: c.status === 'active' ? '#5BD08A' : '#E3B341' }}>{c.status}</span>}
        </div>
      ))}
    </div>
  );
}

function KeysTab() {
  const [keys, setKeys] = useState<DedapiKeyView[]>([]);
  const [name, setName] = useState('');
  const [issued, setIssued] = useState<{ prefix: string; plaintext: string } | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => { api.keys.list().then((r) => setKeys(r.keys)).catch(() => setKeys([])); }, []);
  useEffect(() => { load(); }, [load]);
  const create = async () => {
    setErr('');
    try { const r = await api.keys.create({ name: name.trim() }); setIssued({ prefix: r.key.prefix, plaintext: r.plaintext }); setName(''); load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not issue key.'); }
  };
  const revoke = async (id: string) => { await api.keys.revoke(id).catch(() => undefined); load(); };
  return (
    <div className="org-card">
      <h2 className="org-h2">dedapi keys</h2>
      <p className="org-lead">API keys issued to consuming platforms (me.anvaya) for the governed <code>dedapi</code> channel. The secret is shown once.</p>
      {issued && (
        <div className="org-card" style={{ marginBottom: 14, borderColor: '#1F5135' }}>
          <p className="org-ok" style={{ marginTop: 0 }}>Key issued — copy it now, it won’t be shown again.</p>
          <div className="org-code">{issued.plaintext}</div>
          <button className="org-btn" style={{ marginTop: 10 }} onClick={() => setIssued(null)}>Done</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input className="org-input" style={{ maxWidth: 320 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. me.anvaya UK)" />
        <button className="org-btn org-btn-primary" disabled={!name.trim()} onClick={() => void create()}>Issue key</button>
      </div>
      {err && <p className="org-err">{err}</p>}
      {keys.map((k) => (
        <div key={k.id} className="org-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
          <span><b>{k.name}</b><br /><span className="org-muted org-code" style={{ display: 'inline-block', marginTop: 4 }}>{k.prefix}…</span></span>
          <span className="org-tag" style={{ color: k.status === 'active' ? '#5BD08A' : '#FF8A8A' }}>{k.status}</span>
          {k.status === 'active' && <button className="org-btn org-btn-danger" onClick={() => void revoke(k.id)}>Revoke</button>}
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<OrgUserView[]>([]);
  const [roles, setRoles] = useState<OrgRole[]>(['owner', 'admin', 'editor', 'viewer']);
  const [d, setD] = useState<{ email: string; password: string; role: OrgRole; name: string }>({ email: '', password: '', role: 'viewer', name: '' });
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const load = useCallback(() => { api.auth.users().then((r) => { setUsers(r.users); setRoles(r.roles); }).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    setErr(''); setMsg('');
    try { await api.auth.addUser({ email: d.email.trim(), password: d.password, role: d.role, displayName: d.name.trim() || undefined }); setMsg('User added.'); setD({ email: '', password: '', role: 'viewer', name: '' }); load(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not add user.'); }
  };
  return (
    <div className="org-card">
      <h2 className="org-h2">Administrators</h2>
      <p className="org-lead">Who can govern the catalogue. Owners/admins manage users & keys; editors edit content; viewers read.</p>
      {users.map((u) => (
        <div key={u.id} className="org-row" style={{ gridTemplateColumns: '1fr auto' }}>
          <span><b>{u.displayName ?? u.email}</b><br /><span className="org-muted" style={{ fontSize: 12 }}>{u.email}</span></span>
          <span className="org-tag">{u.role}</span>
        </div>
      ))}
      <div style={{ marginTop: 16, borderTop: '1px solid var(--org-line)', paddingTop: 14 }}>
        <div className="org-grid">
          <div><label className="org-label">Name</label><input className="org-input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
          <div><label className="org-label">Email</label><input className="org-input" type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} /></div>
          <div><label className="org-label">Password</label><input className="org-input" type="password" value={d.password} onChange={(e) => setD({ ...d, password: e.target.value })} placeholder="≥ 8 chars" /></div>
          <div><label className="org-label">Role</label>
            <select className="org-select" value={d.role} onChange={(e) => setD({ ...d, role: e.target.value as OrgRole })}>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select></div>
        </div>
        {err && <p className="org-err">{err}</p>}{msg && <p className="org-ok">{msg}</p>}
        <button className="org-btn org-btn-primary" style={{ marginTop: 10 }} onClick={() => void add()}>Add administrator</button>
      </div>
    </div>
  );
}
