import { useEffect, useState } from 'react';
import { adminApi } from '@/features/admin/api/client.js';
import { customerApi } from '@/features/admin/customers/api';
import { AdminButton } from '@/features/admin/shared/AdminShared.jsx';

export function CreateSessionPanel({ canManage, onClose, onIssued }) {
  const [form, setForm] = useState({ gameId: '', customerName: '', customerUid: '', maxNominatedStaff: 1 });
  const [candidates, setCandidates] = useState([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const gameId = form.gameId.trim();
    if (!gameId) {
      setCandidates([]);
      setCandidateError('');
      return undefined;
    }
    const controller = new AbortController();
    setCandidateLoading(true);
    customerApi.candidates(gameId, controller.signal).then((result) => {
      setCandidates(result.items || []);
      setCandidateError('');
    }).catch((reason) => {
      if (reason?.name !== 'AbortError') setCandidateError(reason.message || '無法查詢歷史 UID。');
    }).finally(() => setCandidateLoading(false));
    return () => controller.abort();
  }, [form.gameId]);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      onIssued(await adminApi.createOrderSession({ ...form, customerName: form.customerName || null }));
    } catch (reason) {
      setError(reason.message);
      setLoading(false);
    }
  };

  return <div className="adminOrderInlinePanel">
    <header>
      <div><span>NEW ORDER PASS</span><h2>開立今日點餐碼</h2></div>
      <button type="button" aria-label="關閉發點餐碼" onClick={onClose}>×</button>
    </header>
    <form onSubmit={submit}>
      <label>顧客遊戲 ID<input value={form.gameId} onChange={(event) => setForm({ ...form, gameId: event.target.value, customerUid: '' })} required /></label>
      {candidateLoading ? <small>正在查詢相同遊戲 ID 的歷史 UID…</small> : null}
      {candidateError ? <p className="adminFormError">{candidateError}</p> : null}
      {candidates.length ? <fieldset className="adminIdentityCandidates">
        <legend>歷史 UID 候選</legend>
        <p>選擇既有 UID 會把本次入場歸戶；不選則沿用唯一候選，或在多候選時先不歸戶。</p>
        {canManage ? candidates.map((candidate) => <label key={candidate.uid}>
          <input type="radio" name="customerUid" checked={form.customerUid === candidate.uid} onChange={() => setForm({ ...form, customerUid: candidate.uid })} />
          <span><strong>{candidate.uid}</strong> · {candidate.displayName || '未命名'}<small>最近來店 {candidate.lastVisitAt ? new Date(candidate.lastVisitAt).toLocaleDateString('zh-TW') : '—'} · {candidate.visitCount} 次入場 · {candidate.orderCount} 張訂單</small></span>
        </label>) : <p className="adminCustomerHint">此帳號可查看候選，但既有 UID 歸戶需由店經理核對。唯一候選會由系統自動沿用。</p>}
        {canManage ? <button type="button" className="adminButton adminButton-ghost" onClick={() => setForm({ ...form, customerUid: '' })}>不選 UID，稍後由歷史顧客核對</button> : null}
      </fieldset> : form.gameId.trim() && !candidateLoading ? <p className="adminCustomerHint">尚無相同遊戲 ID 的 UID；建立後會產生新的 UID。</p> : null}
      <label>顧客顯示名稱（選填）<input value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} /></label>
      <label>可同時指名人數<input type="number" min="0" max="100" value={form.maxNominatedStaff} onChange={(event) => setForm({ ...form, maxNominatedStaff: Number(event.target.value) })} /></label>
      <AdminButton type="submit" disabled={loading}>{loading ? '開立中…' : '產生點餐網址'}</AdminButton>
    </form>
    {error ? <p className="adminFormError">{error}</p> : null}
  </div>;
}

export function IssuedPanel({ issued, onClose }) {
  const [copied, setCopied] = useState('');
  const copy = async (value, key) => {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => current === key ? '' : current), 1800);
    } catch { setCopied(''); }
  };
  const orderUrl = publicOrderUrl(issued.orderUrl);
  const compactUrl = compactOrderUrl(orderUrl);
  return <div className="adminIssuedPanel">
    <header>
      <div><span>ORDER PASS READY</span><h2>{issued.session.customerName} 的今日點餐資料</h2></div>
      <button type="button" aria-label="關閉點餐資料" onClick={onClose}>×</button>
    </header>
    <div className="adminIssuedFields">
      <div className="adminIssuedField adminIssuedUrlField"><div className="adminIssuedFieldLabel"><strong>點餐網址</strong><small>複製可直接分享給顧客</small></div><code title={orderUrl}>{compactUrl}</code><button className="adminCopyIconButton" type="button" aria-label="複製點餐網址" title="複製點餐網址" onClick={() => copy(orderUrl, 'url')}><CopyIcon />{copied === 'url' ? <span className="adminCopyStatus">已複製</span> : null}</button></div>
      <div className="adminIssuedField adminRecoveryField"><div className="adminIssuedFieldLabel"><strong>六位數協助碼</strong><small>顧客遺失網址時提供</small></div><code>{issued.recoveryCode}</code><button className="adminCopyIconButton" type="button" aria-label="複製協助碼" title="複製協助碼" onClick={() => copy(issued.recoveryCode, 'recovery')}><CopyIcon />{copied === 'recovery' ? <span className="adminCopyStatus">已複製</span> : null}</button></div>
    </div>
    <p>重新補發會使舊網址失效；協助碼只在顧客遺失點餐碼時由店員提供。</p>
  </div>;
}

function publicOrderUrl(value) {
  if (!value || typeof window === 'undefined') return value;
  try {
    const url = new URL(value, window.location.origin);
    url.protocol = window.location.protocol;
    url.host = window.location.host;
    return url.toString();
  } catch { return value; }
}

function compactOrderUrl(value) {
  try {
    const url = new URL(value);
    const code = url.searchParams.get('code');
    if (!code) return value;
    return `${url.host}${url.pathname}?code=${code.length > 10 ? `${code.slice(0, 10)}…` : code}`;
  } catch { return value; }
}

function CopyIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>;
}
