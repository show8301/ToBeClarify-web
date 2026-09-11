"use client";

import { useRef, useState, type ReactNode } from 'react';
import { Menu } from '@base-ui/react/menu';
import { ArrowDown, ArrowUp, Bell, ChevronDown, ChevronRight, Clock3, Copy, ListFilter, Megaphone, Plus, Search, ShoppingCart, Trash2, UserRound, Volume2, Wine } from 'lucide-react';
import { AdminButton, AdminToggle } from '@/features/admin/shared/AdminShared.jsx';
import type { NotificationCenterValue, NotificationRule, NotificationSettings } from '@/features/admin/notifications/types';

const ruleIcons = {
  order_received: ShoppingCart,
  designated_order_received: UserRound,
  nomination_starting: Clock3,
  nomination_ending: Clock3,
  nomination_ended: Clock3,
  business_opening_soon: Clock3,
  business_closing_soon: Clock3,
  champagne_order_received: Wine,
  order_backlog: Megaphone,
};

function ruleDescription(rule: NotificationRule, staff: { id: string; displayName: string }[]) {
  const target = rule.targetMode === 'all' ? '所有人' : rule.targetMode === 'staff'
    ? staff.find(person => person.id === rule.targetStaffId)?.displayName || '指定店員' : '自己';
  const minutes = rule.offsetMinutes ?? 0;
  switch (rule.ruleType) {
    case 'order_received': return '顧客送出點餐訂單時通知';
    case 'designated_order_received': return `收到${target}的指名訂單時通知`;
    case 'nomination_starting': return `${target}的指名時段開始前 ${minutes} 分鐘`;
    case 'nomination_ending': return `${target}的指名時段結束前 ${minutes} 分鐘`;
    case 'nomination_ended': return `${target}的指名時段結束後 ${minutes} 分鐘`;
    case 'business_opening_soon': return `預定開店前 ${minutes} 分鐘提醒`;
    case 'business_closing_soon': return `預定關店前 ${minutes} 分鐘提醒`;
    case 'champagne_order_received': return '收到含香檳塔的訂單時通知';
    case 'order_backlog': return `待處理達 ${rule.backlogThreshold ?? 1} 筆，持續 ${rule.backlogDurationMinutes ?? 5} 分鐘`;
    default: return '選取以查看通知條件';
  }
}

export function NotificationDeviceCard({ center }: { center: NotificationCenterValue | null }) {
  const connected = center?.state === '已連線';
  return (
    <section className="notification-device-card" aria-labelledby="notification-device-title">
      <h2 id="notification-device-title">本裝置</h2>
      <div className="notification-device-status" role="status">
        <span className={`notification-status-dot ${connected ? 'is-enabled' : 'is-unavailable'}`} />
        <div><strong>{center?.state || '通知服務連線中'}</strong><p>登入後台時接收即時提醒；首次載入不重播歷史通知。</p></div>
      </div>
      <div className="notification-device-actions">
        <AdminButton disabled={!center} onClick={center?.enableAudio}><Volume2 size={20} aria-hidden="true" />{center?.enabled ? '音效已啟用' : '啟用音效'}</AdminButton>
        <AdminButton variant="ghost" disabled={!center} onClick={center?.enableDesktop}><Bell size={20} aria-hidden="true" />{center?.desktop ? '桌面通知已允許' : '允許桌面通知'}</AdminButton>
      </div>
      {center?.audioError && <p className="notification-device-error" role="alert">{center.audioError}</p>}
    </section>
  );
}

type WorkspaceProps = {
  settings: NotificationSettings;
  broadcast: boolean;
  busy: boolean;
  dirty: boolean;
  labels: Record<NotificationRule['ruleType'], string>;
  availableTypes: NotificationRule['ruleType'][];
  staff: { id: string; displayName: string }[];
  makeRule: (type: NotificationRule['ruleType']) => NotificationRule;
  onRulesChange: (mutator: (rules: NotificationRule[]) => NotificationRule[]) => void;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  renderFields: (rule: NotificationRule, index: number) => ReactNode;
  soundLibrary: ReactNode;
};

export function NotificationWorkspace({ settings, broadcast, busy, dirty, labels, availableTypes, staff, makeRule, onRulesChange, onSave, onDiscard, renderFields, soundLibrary }: WorkspaceProps) {
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const editor = useRef<HTMLElement>(null);
  const selectedIndex = Math.max(0, settings.rules.findIndex(rule => rule.id === selectedId));
  const selected = settings.rules[selectedIndex];
  const visibleRules = settings.rules.filter(rule =>
    (filter === 'all' || rule.isEnabled === (filter === 'enabled')) &&
    `${rule.name || ''} ${labels[rule.ruleType] || rule.ruleType} ${ruleDescription(rule, staff)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const select = (id: string) => {
    setSelectedId(id);
    if (window.matchMedia('(max-width: 1100px)').matches) editor.current?.scrollIntoView({ block: 'start' });
    editor.current?.focus({ preventScroll: true });
  };
  const add = (type: NotificationRule['ruleType']) => {
    if (busy || settings.rules.length >= 20) return;
    const rule = makeRule(type);
    onRulesChange(rules => [...rules, rule]);
    setQuery(''); setFilter('all'); select(rule.id);
  };
  const duplicate = () => {
    if (!selected || busy || settings.rules.length >= 20) return;
    const copy = { ...selected, id: crypto.randomUUID(), schemaVersion: undefined, ruleRevision: undefined, fingerprint: undefined };
    onRulesChange(rules => [...rules.slice(0, selectedIndex + 1), copy, ...rules.slice(selectedIndex + 1)]);
    setQuery(''); setFilter('all'); select(copy.id);
  };
  const remove = () => {
    if (!selected || busy) return;
    onRulesChange(rules => rules.filter(rule => rule.id !== selected.id));
    setSelectedId(settings.rules[selectedIndex + 1]?.id || settings.rules[selectedIndex - 1]?.id || '');
  };
  const move = (direction: number) => {
    if (!selected || busy) return;
    const nextIndex = selectedIndex + direction;
    if (nextIndex < 0 || nextIndex >= settings.rules.length) return;
    setSelectedId(selected.id);
    onRulesChange(rules => {
      const next = [...rules];
      [next[selectedIndex], next[nextIndex]] = [next[nextIndex], next[selectedIndex]];
      return next;
    });
  };

  return (
    <div className="notification-workspace" aria-busy={busy}>
      <section className="notification-card notification-rule-list-panel" aria-labelledby="notification-rules-title">
        <header className="notification-card-heading">
          <h2 id="notification-rules-title">{broadcast ? '店內廣播規則' : '我的規則'}</h2>
          <span className="notification-rule-count">{settings.rules.length} / 20</span>
          <Menu.Root>
            <Menu.Trigger className="adminButton adminButton-primary notification-add-rule" disabled={busy || settings.rules.length >= 20 || !availableTypes.length}>
              <Plus size={19} aria-hidden="true" />新增規則<ChevronDown size={16} aria-hidden="true" />
            </Menu.Trigger>
            <Menu.Portal><Menu.Positioner sideOffset={8} align="end" className="notification-menu-positioner"><Menu.Popup className="notification-action-menu" aria-label="新增通知規則">
              {availableTypes.map(type => <Menu.Item key={type} disabled={busy} onClick={() => add(type)}>{labels[type] || type}</Menu.Item>)}
            </Menu.Popup></Menu.Positioner></Menu.Portal>
          </Menu.Root>
        </header>
        <div className="notification-list-filters">
          <label className="notification-search"><Search size={18} aria-hidden="true" /><input aria-label="搜尋規則名稱" placeholder="搜尋規則名稱…" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <select aria-label="篩選規則狀態" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">全部</option><option value="enabled">已啟用</option><option value="disabled">未啟用</option></select>
        </div>
        <ul className="notification-rule-list" aria-label={broadcast ? '店內廣播規則清單' : '我的規則清單'}>
          {visibleRules.map(rule => {
            const Icon = ruleIcons[rule.ruleType] || Bell;
            return <li key={rule.id} className={`notification-rule-row ${selected?.id === rule.id ? 'is-selected' : ''}`}>
              <button type="button" className="notification-rule-select" disabled={busy} aria-pressed={selected?.id === rule.id} aria-controls="notification-rule-editor" onClick={() => select(rule.id)}>
                <span className="notification-rule-icon"><Icon size={22} strokeWidth={1.8} aria-hidden="true" /></span>
                <span className="notification-rule-copy"><strong>{rule.name || labels[rule.ruleType] || rule.ruleType}</strong><small>{ruleDescription(rule, staff)}</small></span>
              </button>
              <span className="notification-rule-status"><span className={`notification-status-dot ${rule.isEnabled ? 'is-enabled' : ''}`} />{rule.isEnabled ? '已啟用' : '未啟用'}</span>
              <AdminToggle label="" ariaLabel={`${rule.name || labels[rule.ruleType]}（規則 ${settings.rules.indexOf(rule) + 1}）啟用`} checked={rule.isEnabled} disabled={busy} onChange={(enabled: boolean) => onRulesChange(rules => rules.map(item => item.id === rule.id ? { ...item, isEnabled: enabled } : item))} />
              <ChevronRight className="notification-rule-chevron" size={18} aria-hidden="true" />
            </li>;
          })}
        </ul>
        {!visibleRules.length && <div className="notification-empty"><ListFilter size={30} aria-hidden="true" /><strong>{busy ? '載入通知規則中…' : settings.rules.length ? '找不到符合的規則' : '尚未設定通知規則'}</strong><p>{settings.rules.length ? '試著調整搜尋文字或篩選條件。' : '按「＋新增規則」開始設定提醒。'}</p>{settings.rules.length > 0 && <AdminButton variant="ghost" onClick={() => { setQuery(''); setFilter('all'); }}>清除篩選</AdminButton>}</div>}
        <p className="notification-list-note">{settings.rules.length >= 20 ? '已達 20 條上限；請編輯或移除現有規則。' : broadcast ? '套用至廣播受眾；僅經理與開發者可管理。' : '只影響自己的通知，可新增同類型、不同條件的規則。'}</p>
      </section>
      <div className="notification-editor-column">
        <section className="notification-card notification-editor" id="notification-rule-editor" aria-labelledby="notification-editor-title" tabIndex={-1} ref={editor}>
          <header className="notification-card-heading">
            <h2 id="notification-editor-title">編輯規則</h2>
            {selected && <span className={`notification-editor-status ${selected.isEnabled ? 'is-enabled' : ''}`}><span className={`notification-status-dot ${selected.isEnabled ? 'is-enabled' : ''}`} />{selected.isEnabled ? '已啟用' : '未啟用'}</span>}
            <span className="notification-editor-position">{selected ? `規則 ${selectedIndex + 1} / ${settings.rules.length}` : '尚未選取'}</span>
          </header>
          {selected ? <>
            <div className="notification-event"><span>通知事件</span><strong>{labels[selected.ruleType] || selected.ruleType}</strong></div>
            <fieldset disabled={busy} className="notification-editor-fields" key={selected.id}><legend className="adminVisuallyHidden">{selected.name || labels[selected.ruleType]}的通知條件</legend>{renderFields(selected, selectedIndex)}</fieldset>
          </> : <div className="notification-empty"><Bell size={32} aria-hidden="true" /><strong>選擇一個通知事件</strong><p>新增規則後，在這裡設定彈窗方式、音效與提醒時間。</p></div>}
          <footer className="notification-editor-footer">
            <div className="notification-editor-tools">
              <AdminButton variant="ghost" disabled={busy || !selected || settings.rules.length >= 20} onClick={duplicate}><Copy size={17} aria-hidden="true" />複製規則</AdminButton>
              <AdminButton variant="danger" disabled={busy || !selected} onClick={remove}><Trash2 size={17} aria-hidden="true" />移除規則</AdminButton>
              {!broadcast && selected && <div className="notification-reorder"><button type="button" aria-label="規則上移" title="規則上移" disabled={busy || selectedIndex === 0} onClick={() => move(-1)}><ArrowUp size={17} /></button><button type="button" aria-label="規則下移" title="規則下移" disabled={busy || selectedIndex === settings.rules.length - 1} onClick={() => move(1)}><ArrowDown size={17} /></button></div>}
            </div>
            <div className="notification-save-actions"><AdminButton variant="ghost" disabled={busy || !dirty} onClick={onDiscard}>放棄變更</AdminButton><AdminButton disabled={busy || !dirty} onClick={onSave}>{busy && dirty ? '儲存中…' : '儲存設定'}</AdminButton></div>
            <p className="notification-save-note" role="status">{dirty ? '有未儲存的變更；儲存會套用此頁籤的所有規則變更。' : '啟用狀態與規則調整，按「儲存設定」後生效。'}</p>
          </footer>
        </section>
        {soundLibrary}
      </div>
    </div>
  );
}
