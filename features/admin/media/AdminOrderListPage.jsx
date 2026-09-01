import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/features/admin/api/client.js';
import { AdminButton } from '@/features/admin/shared/AdminShared.jsx';

const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const money = (value) => `${Number(value || 0).toLocaleString('zh-TW')} G`;
const statusLabels = {
  waiting: '等待確認', submitted: '等待確認', partially_confirmed: '部分確認',
  needs_reschedule: '需重新排程', confirmed: '已成立', in_service: '服務中',
  completed: '已完成', cancelled: '已取消', expired: '已失效', rejected: '已退回',
};

export function AdminOrderListPage() {
  const [businessDate, setBusinessDate] = useState(today);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const sessions = await adminApi.getOrderSessions({ businessDate });
      const groups = await Promise.all((sessions || []).map(async (item) => {
        const sessionOrders = await adminApi.getSessionOrders(item.session.id);
        return sessionOrders.map((order) => ({
          ...order,
          sessionId: item.session.id,
          customerName: item.session.customerName,
          gameId: item.session.gameId,
        }));
      }));
      const next = groups.flat().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      setOrders(next);
      setSelectedId((current) => next.some((order) => order.id === current) ? current : '');
    } catch (reason) {
      setError(reason.message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, [businessDate]);

  const visibleOrders = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase('zh-TW');
    return orders.filter((order) => {
      if (status !== 'all' && order.status !== status) return false;
      if (!normalized) return true;
      return `${order.orderNumber || ''} ${order.customerName || ''} ${order.gameId || ''}`
        .toLocaleLowerCase('zh-TW').includes(normalized);
    });
  }, [keyword, orders, status]);

  const selected = orders.find((order) => order.id === selectedId);

  return <section className="adminPage adminOrderListPage">
    <header className="adminPageHeading">
      <div><p className="eyebrow">ORDER HISTORY</p><h1>訂單列表</h1><p>依營業日查詢所有顧客訂單，快速核對狀態、金額與明細。</p></div>
      <div className="adminPageActions"><AdminButton variant="secondary" disabled={loading} onClick={loadOrders}>重新整理</AdminButton></div>
    </header>

    <section className="adminOrderListFilters" aria-label="訂單查詢條件">
      <label><span>營業日</span><input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} /></label>
      <label className="adminOrderListKeyword"><span>關鍵字</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="訂單編號、顧客名稱或遊戲 ID" /></label>
      <label><span>訂單狀態</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">全部狀態</option><option value="submitted">等待確認</option><option value="partially_confirmed">部分確認</option><option value="needs_reschedule">需重新排程</option><option value="confirmed">已成立</option><option value="in_service">服務中</option><option value="completed">已完成</option><option value="cancelled">已取消</option><option value="expired">已失效</option><option value="rejected">已退回</option></select></label>
      <div className="adminOrderListCount"><span>查詢結果</span><strong>{visibleOrders.length}</strong><small>筆訂單</small></div>
    </section>

    {error ? <div className="adminOrderMessage isError" role="alert">{error}</div> : null}
    <div className="adminOrderListLayout">
      <section className="adminOrderListTableWrap" aria-busy={loading}>
        <table className="adminOrderListTable">
          <thead><tr><th>訂單編號</th><th>顧客</th><th>送出時間</th><th>狀態</th><th>金額</th><th aria-label="開啟訂單明細" /></tr></thead>
          <tbody>{visibleOrders.map((order) => <tr key={order.id} className={order.id === selectedId ? 'isSelected' : ''} onClick={() => setSelectedId(order.id)}><td data-label="訂單編號"><strong>{order.orderNumber || '附掛加購服務單'}</strong></td><td data-label="顧客"><strong>{order.customerName}</strong><small>ID {order.gameId}</small></td><td data-label="送出時間">{new Date(order.submittedAt).toLocaleString('zh-TW')}</td><td data-label="狀態"><span className={`adminOrderStatus is-${order.status}`}>{statusLabels[order.status] || order.status}</span></td><td data-label="金額"><strong>{money(order.totalAmount)}</strong></td><td><button type="button" aria-label={`查看訂單 ${order.orderNumber || ''}`} onClick={(event) => { event.stopPropagation(); setSelectedId(order.id); }}><span aria-hidden="true">›</span></button></td></tr>)}</tbody>
        </table>
        {!loading && !visibleOrders.length ? <div className="adminOrderListEmpty"><strong>沒有符合條件的訂單</strong><p>請調整營業日、關鍵字或狀態。</p></div> : null}
        {loading ? <div className="adminOrderListEmpty"><strong>正在載入訂單…</strong></div> : null}
      </section>

      <aside className="adminOrderListDetail">
        {selected ? <OrderDetail order={selected} onClose={() => setSelectedId('')} /> : <div className="adminOrderListDetailEmpty"><span>訂單明細</span><strong>選擇一筆訂單</strong><p>點選左側資料列即可核對內容。</p></div>}
      </aside>
    </div>
  </section>;
}

function OrderDetail({ order, onClose }) {
  return <>
    <header><div><span>訂單明細</span><h2>{order.orderNumber || '附掛加購服務單'}</h2></div><button type="button" aria-label="關閉訂單明細" onClick={onClose}>×</button></header>
    <dl className="adminOrderDetailSummary"><div><dt>顧客</dt><dd>{order.customerName}<small>ID {order.gameId}</small></dd></div><div><dt>狀態</dt><dd><span className={`adminOrderStatus is-${order.status}`}>{statusLabels[order.status] || order.status}</span></dd></div><div><dt>送出時間</dt><dd>{new Date(order.submittedAt).toLocaleString('zh-TW')}</dd></div><div><dt>訂單金額</dt><dd>{money(order.totalAmount)}</dd></div></dl>
    <section className="adminOrderDetailItems"><h3>訂購項目</h3>{order.items?.length ? order.items.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.quantity > 1 ? `數量 ${item.quantity}` : item.itemType}</small></span><b>{money(item.lineTotal)}</b></div>) : <p>此訂單沒有一般品項。</p>}</section>
    {order.nominees?.length ? <section className="adminOrderDetailItems"><h3>指名服務</h3>{order.nominees.map((item) => <div key={item.id}><span><strong>{item.staffName} · {item.serviceName}</strong><small>{new Date(item.requestedStartsAt).toLocaleString('zh-TW')} · {item.segmentCount} 節</small></span><b>{statusLabels[item.confirmationStatus] || item.confirmationStatus}</b></div>)}</section> : null}
    <footer><span>小計 {money(order.subtotal)}</span><span>信物折抵 −{money(order.mealCreditApplied)}</span><strong>應付 {money(order.totalAmount)}</strong></footer>
  </>;
}
