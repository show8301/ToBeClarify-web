import type { FormEvent } from "react";
import { AdminDialog, AdminField, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import { ACTION_LABELS, SECONDARY_BUTTON_CLASS, adminGuestbookTime } from "@/features/admin/guestbook/presentation";
import type { GuestbookAuthor, GuestbookHistoryEntry, GuestbookMessage, GuestbookSettings } from "@/features/guestbook/types";

type StaffRole = Exclude<GuestbookAuthor, "customer">;

type ComposerProps = {
  target: GuestbookMessage | null;
  settings: GuestbookSettings | null;
  staffDisplayName?: string;
  hasStaff: boolean;
  role: StaffRole;
  content: string;
  busy: boolean;
  onRoleChange: (role: StaffRole) => void;
  onContentChange: (content: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancelReply: () => void;
};

export function AdminGuestbookComposer(props: ComposerProps) {
  return (
    <AdminPanel title={props.target ? `回覆 ${props.target.displayName} 的留言串` : "新增店家留言"}>
      <form id="admin-guestbook-composer" className="adminGuestbookForm" onSubmit={props.onSubmit}>
        <AdminField label="發言身分">
          <select value={props.role} onChange={(event) => props.onRoleChange(event.target.value as StaffRole)}>
            <option value="staff" disabled={!props.hasStaff}>店員本人{props.staffDisplayName ? ` · ${props.staffDisplayName}` : ""}</option>
            <option value="mascot">吉祥物 · {props.settings?.mascotName || "吉祥物"}</option>
            <option value="anonymous_staff">匿名店員</option>
          </select>
        </AdminField>
        <AdminField label="留言內容">
          <textarea required maxLength={2000} value={props.content} onChange={(event) => props.onContentChange(event.target.value)} rows={4} />
        </AdminField>
        <div className="adminGuestbookActions">
          <button
            className="adminButton adminButton-primary"
            disabled={props.busy || !props.content.trim() || (props.role === "staff" && !props.hasStaff)}
            type="submit"
          >
            {props.busy ? "處理中…" : "公開送出"}
          </button>
          {props.target ? <button className={SECONDARY_BUTTON_CLASS} type="button" disabled={props.busy} onClick={props.onCancelReply}>改為新增留言串</button> : null}
        </div>
      </form>
    </AdminPanel>
  );
}

type EditorProps = {
  message: GuestbookMessage | null;
  name: string;
  content: string;
  error: string;
  busy: boolean;
  onNameChange: (name: string) => void;
  onContentChange: (content: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AdminGuestbookEditor(props: EditorProps) {
  if (!props.message) return null;
  return (
    <AdminDialog
      open
      title="編輯留言"
      description="儲存後，客戶端會顯示「此留言曾由店家編輯」。"
      className="adminGuestbook"
      actions={null}
      onClose={props.onClose}
    >
      <form className="adminGuestbookForm" onSubmit={props.onSubmit}>
        {props.error ? <p role="alert">{props.error} 若留言已被其他店員更新，請先複製草稿，取消編輯並重新整理，再開啟最新留言。</p> : null}
        <AdminField label="顯示名字">
          <input required maxLength={60} value={props.name} onChange={(event) => props.onNameChange(event.target.value)} />
        </AdminField>
        <AdminField label="內容">
          <textarea required rows={5} maxLength={2000} value={props.content} onChange={(event) => props.onContentChange(event.target.value)} />
        </AdminField>
        <div className="adminGuestbookActions">
          <button type="submit" className="adminButton adminButton-primary" disabled={props.busy}>儲存編輯</button>
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={props.busy} onClick={props.onClose}>取消</button>
        </div>
      </form>
    </AdminDialog>
  );
}

type SettingsProps = {
  settings: GuestbookSettings | null;
  name: string;
  busy: boolean;
  loading: boolean;
  pinsDirty: boolean;
  onNameChange: (name: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDiscard: () => void;
};

export function AdminGuestbookSettingsPanel(props: SettingsProps) {
  return (
    <AdminPanel title="吉祥物名稱" description="名稱變更只套用到之後的新留言；既有留言保留當時名稱。">
      <form className="adminGuestbookForm" onSubmit={props.onSubmit}>
        <AdminField label="名稱">
          <input required maxLength={60} value={props.name} onChange={(event) => props.onNameChange(event.target.value)} />
        </AdminField>
        <div className="adminGuestbookActions">
          <button
            type="submit"
            className="adminButton adminButton-primary"
            disabled={props.busy || !props.settings || !props.name.trim() || props.name === props.settings.mascotName}
          >
            儲存名稱
          </button>
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={props.busy || props.loading || props.pinsDirty} onClick={props.onDiscard}>
            重新載入名稱（放棄修改）
          </button>
        </div>
      </form>
    </AdminPanel>
  );
}

export function AdminGuestbookHistoryPanel({ history, onClose }: {
  history: { thread: string; items: GuestbookHistoryEntry[] } | null;
  onClose: () => void;
}) {
  if (!history) return null;
  return (
    <AdminPanel title="最近操作紀錄" actions={<button className={SECONDARY_BUTTON_CLASS} onClick={onClose}>關閉紀錄</button>}>
      <p>留言串：{history.thread}</p>
      {history.items.map((item) => (
        <details className="adminGuestbookHistory" key={item.id}>
          <summary>{adminGuestbookTime(item.createdAt)} · {ACTION_LABELS[item.action] || item.action}</summary>
          <p>操作帳號：{item.actorId}</p>
          <p>留言：{item.messageId}</p>
          <pre>{item.beforeValue || "（無原始內容）"}</pre>
          <pre>{item.afterValue || "（無內容）"}</pre>
        </details>
      ))}
      {!history.items.length ? <p>尚無後台操作紀錄。</p> : null}
    </AdminPanel>
  );
}
