import { useState } from 'react';

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
