'use client';

import { useCallback, useEffect, useState } from 'react';

const API = '/api/backend';

interface Status {
  profile: { id: string; username: string } | null;
  searchBudgetLeft: number;
  repliesToday: number;
  maxRepliesPerDay: number;
  keywords: string[];
}

interface Candidate {
  _id: string;
  threadsPostId: string;
  source: string;
  matchedKeyword?: string;
  authorUsername?: string;
  text?: string;
  permalink?: string;
  status: string;
  relevanceScore?: number;
  relevanceReason?: string;
  draftReply?: string;
  updatedAt?: string;
}

interface Mention {
  id: string;
  text?: string;
  username?: string;
  permalink?: string;
  timestamp?: string;
}

interface PlannedPost {
  _id: string;
  text: string;
  scheduledAt: string;
  status: string;
  publishedMediaId?: string;
  error?: string;
}

const STATUS_TABS = ['PENDING_APPROVAL', 'NEW', 'RELEVANT', 'REPLIED', 'IRRELEVANT', 'REJECTED', 'FAILED', 'ALL'];
const STATUS_BADGE: Record<string, string> = {
  PENDING_APPROVAL: 'amber',
  NEW: 'blue',
  RELEVANT: 'blue',
  REPLIED: 'green',
  APPROVED: 'green',
  IRRELEVANT: 'gray',
  REJECTED: 'gray',
  FAILED: 'red',
  SCHEDULED: 'blue',
  PUBLISHED: 'green',
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export default function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState('PENDING_APPROVAL');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [planned, setPlanned] = useState<PlannedPost[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [newPostAt, setNewPostAt] = useState('');
  const [mentions, setMentions] = useState<Mention[] | null>(null);
  const [webhookMentions, setWebhookMentions] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const refresh = useCallback(async () => {
    try {
      const [s, c, cand, pp] = await Promise.all([
        api('/admin/status'),
        api('/candidates/counts'),
        api(`/candidates?status=${tab}`),
        api('/planned-posts'),
      ]);
      setStatus(s);
      setCounts(c);
      setCandidates(cand);
      setPlanned(pp);
    } catch (e) {
      notify(`Load error: ${(e as Error).message.slice(0, 120)}`);
    }
  }, [tab]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [refresh]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      await refresh();
    } catch (e) {
      notify(`Error: ${(e as Error).message.slice(0, 160)}`);
    } finally {
      setBusy(null);
    }
  };

  const discover = () =>
    run('discover', async () => {
      await api('/admin/discover', { method: 'POST' });
      notify('Discovery started — new candidates will appear in the New tab within a couple of minutes');
    });

  const processQueue = () =>
    run('process', async () => {
      await api('/admin/process-queue', { method: 'POST' });
      notify('Processing started — watch the Pending approval tab');
    });

  const approve = (c: Candidate) =>
    run(c._id, async () => {
      const text = drafts[c._id] ?? c.draftReply;
      const r = await api(`/candidates/${c._id}/approve`, { method: 'POST', body: JSON.stringify({ text }) });
      notify(r.result);
    });

  const reject = (c: Candidate) =>
    run(c._id, async () => {
      await api(`/candidates/${c._id}/reject`, { method: 'POST' });
      notify('Rejected');
    });

  const fetchMentions = () =>
    run('mentions', async () => {
      const [r, wh] = await Promise.all([
        api('/admin/mentions'),
        api('/candidates?source=MENTION'),
      ]);
      setMentions(r.mentions ?? []);
      setWebhookMentions(wh ?? []);
      notify(
        r.error
          ? `Mentions edge error: ${r.error.slice(0, 120)}`
          : `Edge: ${r.mentions?.length ?? 0} · webhook: ${wh?.length ?? 0}`,
      );
    });

  const createPlanned = () =>
    run('newpost', async () => {
      if (!newPostText.trim() || !newPostAt) return notify('Fill in text and time');
      await api('/planned-posts', {
        method: 'POST',
        body: JSON.stringify({ text: newPostText.trim(), scheduledAt: new Date(newPostAt).toISOString() }),
      });
      setNewPostText('');
      setNewPostAt('');
      notify('Post scheduled');
    });

  const deletePlanned = (id: string) =>
    run(id, async () => {
      await api(`/planned-posts/${id}`, { method: 'DELETE' });
      notify('Deleted');
    });

  const tabLabel: Record<string, string> = {
    PENDING_APPROVAL: 'Pending approval',
    NEW: 'New',
    RELEVANT: 'Relevant',
    REPLIED: 'Replied',
    IRRELEVANT: 'Irrelevant',
    REJECTED: 'Rejected',
    FAILED: 'Failed',
    ALL: 'All',
  };

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>Tagme Threads Agent</h1>
          <div className="sub">
            {status?.profile ? (
              <>Account: <b>@{status.profile.username}</b></>
            ) : (
              'Account: no data (check the access token)'
            )}
            {status?.keywords?.length ? <> · keywords: {status.keywords.join(', ')}</> : null}
          </div>
        </div>
        <div className="row">
          <button className="primary" onClick={discover} disabled={busy !== null}>
            {busy === 'discover' ? 'Searching…' : '🔍 Run discovery'}
          </button>
          <button className="primary" onClick={processQueue} disabled={busy !== null}>
            {busy === 'process' ? 'Processing…' : '🤖 Process queue'}
          </button>
        </div>
      </div>

      <div className="statgrid">
        <div className="stat">
          <div className="label">Search budget (24h)</div>
          <div className="value">{status ? status.searchBudgetLeft : '—'}</div>
        </div>
        <div className="stat">
          <div className="label">Replies today</div>
          <div className="value">
            {status ? `${status.repliesToday} / ${status.maxRepliesPerDay}` : '—'}
          </div>
        </div>
        <div className="stat">
          <div className="label">Pending approval</div>
          <div className="value">{counts.PENDING_APPROVAL ?? 0}</div>
        </div>
        <div className="stat">
          <div className="label">Total replied</div>
          <div className="value">{counts.REPLIED ?? 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Mentions (threads_manage_mentions)</h2>
          <button className="primary" onClick={fetchMentions} disabled={busy !== null}>
            {busy === 'mentions' ? 'Fetching…' : '@ Fetch mentions'}
          </button>
        </div>
        {mentions === null ? (
          <div className="empty">Click “Fetch mentions” to read posts that @-mention the account.</div>
        ) : (
          <>
            <div className="sub" style={{ marginTop: 8 }}>
              Mentions edge (<code>/mentions</code>)
            </div>
            {mentions.length === 0 ? (
              <div className="empty">Edge returned no mentions.</div>
            ) : (
              mentions.map((m) => (
                <div className="candidate" key={m.id}>
                  <div className="meta">
                    <span>@{m.username ?? 'unknown'}</span>
                    {m.timestamp && <span>· {new Date(m.timestamp).toLocaleString('en-GB')}</span>}
                    {m.permalink && (
                      <a href={m.permalink} target="_blank" rel="noreferrer">
                        open in Threads ↗
                      </a>
                    )}
                  </div>
                  <div className="post">{m.text}</div>
                </div>
              ))
            )}

            <div className="sub" style={{ marginTop: 14 }}>
              Received via webhook (real-time)
            </div>
            {webhookMentions.length === 0 ? (
              <div className="empty">No webhook mentions ingested yet.</div>
            ) : (
              webhookMentions.map((m) => (
                <div className="candidate" key={m._id}>
                  <div className="meta">
                    <span className={`badge ${STATUS_BADGE[m.status] ?? 'gray'}`}>{m.status}</span>
                    <span>@{m.authorUsername ?? 'unknown'}</span>
                    {m.updatedAt && <span>· {new Date(m.updatedAt).toLocaleString('en-GB')}</span>}
                    {m.permalink && (
                      <a href={m.permalink} target="_blank" rel="noreferrer">
                        open in Threads ↗
                      </a>
                    )}
                  </div>
                  <div className="post">{m.text}</div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      <div className="card">
        <h2>Discovered candidates</h2>
        <div className="tabs">
          {STATUS_TABS.map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {tabLabel[t]}
              {t !== 'ALL' && counts[t] ? ` (${counts[t]})` : ''}
            </button>
          ))}
        </div>

        {candidates.length === 0 && <div className="empty">Empty</div>}

        {candidates.map((c) => (
          <div className="candidate" key={c._id}>
            <div className="meta">
              <span className={`badge ${STATUS_BADGE[c.status] ?? 'gray'}`}>{c.status}</span>
              {typeof c.relevanceScore === 'number' && (
                <span className="score">score {c.relevanceScore.toFixed(2)}</span>
              )}
              <span>@{c.authorUsername ?? 'unknown'}</span>
              {c.matchedKeyword && <span>· «{c.matchedKeyword}»</span>}
              <span>· {c.source === 'MENTION' ? 'mention' : 'keyword search'}</span>
              {c.permalink && (
                <a href={c.permalink} target="_blank" rel="noreferrer">
                  open in Threads ↗
                </a>
              )}
            </div>
            <div className="post">{c.text}</div>
            {c.relevanceReason && (
              <div className="meta">
                <span>💡 {c.relevanceReason}</span>
              </div>
            )}
            {c.status === 'PENDING_APPROVAL' && (
              <>
                <textarea
                  value={drafts[c._id] ?? c.draftReply ?? ''}
                  onChange={(e) => setDrafts({ ...drafts, [c._id]: e.target.value })}
                />
                <div className="row">
                  <button className="approve" onClick={() => approve(c)} disabled={busy !== null}>
                    ✅ Approve & publish reply
                  </button>
                  <button className="reject" onClick={() => reject(c)} disabled={busy !== null}>
                    🚫 Reject
                  </button>
                </div>
              </>
            )}
            {c.status === 'REPLIED' && c.draftReply && (
              <div className="meta">
                <span>💬 Published reply: {c.draftReply}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Content plan (scheduled posts)</h2>
        <div style={{ marginBottom: 14 }}>
          <textarea
            className="newpost"
            placeholder="Post text…"
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
          />
          <div className="row" style={{ marginTop: 8 }}>
            <input
              type="datetime-local"
              value={newPostAt}
              onChange={(e) => setNewPostAt(e.target.value)}
            />
            <button
              onClick={() => {
                const d = new Date(Date.now() + 5 * 60 * 1000);
                d.setSeconds(0, 0);
                // format as local datetime-local value
                const pad = (n: number) => String(n).padStart(2, '0');
                setNewPostAt(
                  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
                );
              }}
            >
              +5 min
            </button>
            <button className="primary" onClick={createPlanned} disabled={busy !== null}>
              📅 Schedule
            </button>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>
              Your timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </span>
          </div>
        </div>

        {planned.length === 0 ? (
          <div className="empty">No scheduled posts</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Text</th>
                <th>When</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {planned.map((p) => (
                <tr key={p._id}>
                  <td>{p.text.slice(0, 80)}{p.text.length > 80 ? '…' : ''}</td>
                  <td>{new Date(p.scheduledAt).toLocaleString('en-GB')}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[p.status] ?? 'gray'}`}>{p.status}</span>
                    {p.error && <span title={p.error}> ⚠️</span>}
                  </td>
                  <td>
                    {p.status === 'SCHEDULED' && (
                      <button onClick={() => deletePlanned(p._id)} disabled={busy !== null}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
