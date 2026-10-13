"use client";

import { AdminRefreshButton } from "@/features/admin/shared/AdminRefreshButton";
import { useAdminToast } from "@/features/admin/shared/AdminToastProvider.jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "@/features/admin/api/client.js";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext.jsx";
import { adminGuestbookPath, adminGuestbookRequest as request } from "@/features/admin/guestbook/api";
import { AdminGuestbookMessage } from "@/features/admin/guestbook/AdminGuestbookMessage";
import {
  AdminGuestbookComposer,
  AdminGuestbookEditor,
  AdminGuestbookHistoryPanel,
  AdminGuestbookSettingsPanel,
} from "@/features/admin/guestbook/AdminGuestbookPanels";
import { SECONDARY_BUTTON_CLASS } from "@/features/admin/guestbook/presentation";
import { AdminField, AdminPage, AdminPanel } from "@/features/admin/shared/AdminShared.jsx";
import type {
  GuestbookAuthor,
  GuestbookHistoryEntry,
  GuestbookList,
  GuestbookMessage,
  GuestbookReplies,
  GuestbookSettings,
} from "@/features/guestbook/types";
import {
  parseGuestbookHistory,
  parseGuestbookList,
  parseGuestbookMessage,
  parseGuestbookReplies,
  parseGuestbookSettings,
  parseTrue,
} from "@/features/guestbook/validation";

type StaffRole = Exclude<GuestbookAuthor, "customer">;
type ModerationChange = Partial<Pick<GuestbookMessage, "isVisible" | "isPinned" | "allowReplies">>;

function errorText(cause: unknown, fallback: string) {
  if (cause instanceof ApiError) {
    const suffix = cause.traceId ? `（追蹤碼：${cause.traceId}）` : "";
    const message = cause.code === "VERSION_CONFLICT" ? fallback : cause.message;
    return `${message}${suffix}`;
  }
  return cause instanceof Error ? cause.message : fallback;
}

export function AdminGuestbookPage() {
  const { user } = useAdminAuth();
  const toast = useAdminToast();
  const [list, setList] = useState<GuestbookList | null>(null);
  const [settings, setSettings] = useState<GuestbookSettings | null>(null);
  const [mascotName, setMascotName] = useState("");
  const [filter, setFilter] = useState("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [hasImage, setHasImage] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pinsDirty, setPinsDirty] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replies, setReplies] = useState<GuestbookReplies | null>(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [editor, setEditor] = useState<GuestbookMessage | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [composeTarget, setComposeTarget] = useState<GuestbookMessage | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [history, setHistory] = useState<{ thread: string; items: GuestbookHistoryEntry[] } | null>(null);
  const loadController = useRef<AbortController | null>(null);
  const replyController = useRef<AbortController | null>(null);
  const mutationController = useRef<AbortController | null>(null);
  const loadRequestId = useRef(0);
  const mutationBusy = useRef(false);
  const mascotDirty = useRef(false);
  const canReorderPins = filter === "all" && !search && hasImage === "all";

  const applyLoadedData = useCallback((data: GuestbookList, config: GuestbookSettings) => {
    setList(data);
    setPinsDirty(false);
    if (!mascotDirty.current) {
      setSettings(config);
      setMascotName(config.mascotName);
    }
  }, []);

  const load = useCallback(async (discardPins = false) => {
    if (pinsDirty && !discardPins) {
      setError("請先儲存或放棄置頂排序，再重新整理。");
      return;
    }
    loadController.current?.abort();
    const controller = new AbortController();
    const requestId = ++loadRequestId.current;
    loadController.current = controller;
    setLoading(true);
    try {
      const [data, config] = await Promise.all([
        request(adminGuestbookPath("/threads", { page, filter, search, hasImage }), parseGuestbookList, { signal: controller.signal }),
        request("/settings", parseGuestbookSettings, { signal: controller.signal }),
      ]);
      if (controller.signal.aborted || requestId !== loadRequestId.current) return;
      setError("");
      applyLoadedData(data, config);
    } catch (cause) {
      if (!controller.signal.aborted && requestId === loadRequestId.current) setError(errorText(cause, "無法讀取留言。"));
    } finally {
      if (!controller.signal.aborted && requestId === loadRequestId.current) setLoading(false);
    }
  }, [applyLoadedData, filter, hasImage, page, pinsDirty, search]);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++loadRequestId.current;
    loadController.current = controller;
    Promise.all([
      request(adminGuestbookPath("/threads", { page, filter, search, hasImage }), parseGuestbookList, { signal: controller.signal }),
      request("/settings", parseGuestbookSettings, { signal: controller.signal }),
    ]).then(([data, config]) => {
      if (controller.signal.aborted || requestId !== loadRequestId.current) return;
      setError("");
      applyLoadedData(data, config);
    }).catch((cause) => {
      if (!controller.signal.aborted && requestId === loadRequestId.current) setError(errorText(cause, "無法讀取留言。"));
    }).finally(() => {
      if (!controller.signal.aborted && requestId === loadRequestId.current) setLoading(false);
    });
    return () => controller.abort();
  }, [applyLoadedData, filter, hasImage, page, search]);

  useEffect(() => () => {
    loadController.current?.abort();
    replyController.current?.abort();
    mutationController.current?.abort();
  }, []);

  const loadReplies = async (id: string, next = 1, cursor?: string | null) => {
    replyController.current?.abort();
    const controller = new AbortController();
    replyController.current = controller;
    setExpanded(id);
    setReplyLoading(true);
    setReplyError("");
    if (next === 1) setReplies(null);
    try {
      const result = await request(
        adminGuestbookPath(`/threads/${encodeURIComponent(id)}/replies`, { page: next, cursor }),
        parseGuestbookReplies,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setReplies((previous) => ({
        ...result,
        items: next === 1
          ? result.items
          : [
              ...(previous?.items ?? []),
              ...result.items.filter((item) => !previous?.items.some((old) => old.id === item.id)),
            ],
      }));
    } catch (cause) {
      if (!controller.signal.aborted) setReplyError(errorText(cause, "無法讀取回覆。"));
    } finally {
      if (!controller.signal.aborted) setReplyLoading(false);
    }
  };

  const mutate = async (
    operation: (signal: AbortSignal) => Promise<unknown>,
    success: string,
    after?: () => void,
    savingPins = false,
  ): Promise<boolean> => {
    if (pinsDirty && !savingPins) {
      setError("請先儲存或放棄置頂排序，再進行其他操作。");
      return false;
    }
    if (mutationBusy.current) return false;
    mutationBusy.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    mutationController.current = controller;
    try {
      await operation(controller.signal);
      if (controller.signal.aborted) return false;
      after?.();
      toast.add({ title: success, type: "success" });
      await load(true);
      if (expanded) await loadReplies(expanded);
      return true;
    } catch (cause) {
      if (!controller.signal.aborted) {
        const fallback = cause instanceof ApiError && cause.code === "VERSION_CONFLICT"
          ? "資料已被其他店員更新，請重新整理後再試。"
          : "操作失敗。";
        setError(errorText(cause, fallback));
      }
      return false;
    } finally {
      mutationBusy.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const messagePath = (message: GuestbookMessage) => {
    const threadPath = `/threads/${encodeURIComponent(message.threadId)}`;
    return message.id === message.threadId ? threadPath : `${threadPath}/replies/${encodeURIComponent(message.id)}`;
  };
  const moderate = (message: GuestbookMessage, change: ModerationChange) => void mutate(
    (signal) => request(messagePath(message), parseGuestbookMessage, {
      method: "PATCH",
      body: JSON.stringify({ version: message.version, ...change }),
      signal,
    }),
    "留言狀態已更新。",
  );
  const removeImage = (message: GuestbookMessage) => {
    if (!message.imageId || !window.confirm("確定永久移除這張圖片？客戶端將不再顯示，並會留下操作紀錄。")) return;
    void mutate(
      (signal) => request(adminGuestbookPath(messagePath(message) + "/image", { version: message.version }), parseGuestbookMessage, {
        method: "DELETE",
        signal,
      }),
      "留言圖片已移除。",
    );
  };
  const movePin = (index: number, direction: number) => {
    if (!list || loading) return;
    const pins = [...list.pinnedItems];
    [pins[index], pins[index + direction]] = [pins[index + direction], pins[index]];
    setList({ ...list, pinnedItems: pins });
    setPinsDirty(true);
  };
  const startEdit = (message: GuestbookMessage) => {
    setError("");
    setEditor(message);
    setEditName(message.displayName);
    setEditContent(message.content);
  };
  const openReplyComposer = (target: GuestbookMessage) => {
    setComposeTarget(target);
    setError("");
    setComposerOpen(true);
  };
  const toggleReplies = (target: GuestbookMessage) => {
    if (expanded === target.id) {
      replyController.current?.abort();
      setExpanded(null);
      return;
    }
    void loadReplies(target.id);
  };
  const showHistory = (target: GuestbookMessage) => void mutate(async (signal) => {
    const items = await request(`/threads/${encodeURIComponent(target.id)}/history`, parseGuestbookHistory, { signal });
    setHistory({ thread: target.id, items });
  }, "已讀取最近 100 筆操作紀錄。");
  const messageView = (message: GuestbookMessage, pinControls?: ReactNode) => (
    <AdminGuestbookMessage
      key={message.id}
      message={message}
      busy={busy || pinsDirty}
      pinControls={pinControls}
      loading={loading}
      expanded={expanded}
      replies={replies}
      replyLoading={replyLoading}
      replyError={replyError}
      onEdit={startEdit}
      onModerate={moderate}
      onRemoveImage={removeImage}
      onReply={openReplyComposer}
      onToggleReplies={toggleReplies}
      onReloadReplies={(target) => void loadReplies(target.id)}
      onLoadMoreReplies={(target) => {
        if (replies?.nextCursor) void loadReplies(target.id, replies.page + 1, replies.nextCursor);
      }}
      onHistory={showHistory}
    />
  );

  return (
    <AdminPage eyebrow="GUESTBOOK" title="留言板管理" description="檢視與回覆留言，管理顯示狀態、置頂順序與附件圖片。">
      <div className="adminGuestbook" aria-busy={busy || loading}>
        {error && !composerOpen && !settingsOpen && !editor ? (
          <p className="adminGuestbookFeedback" role="alert">
            {error}
          </p>
        ) : null}
        {pinsDirty ? (
          <p className="adminGuestbookFeedback" role="status">
            置頂排序尚未儲存，請先儲存或放棄，才可進行其他操作。
            <button className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => { setError(""); void load(true); }}>放棄排序變更</button>
          </p>
        ) : null}
        <AdminGuestbookComposer
          key={composeTarget?.id ?? "new-thread"}
          open={composerOpen}
          error={error}
          onClose={() => setComposerOpen(false)}
          target={composeTarget}
          settings={settings}
          staffDisplayName={user?.displayName}
          hasStaff={Boolean(user?.staffMemberId)}
          role={role}
          content={content}
          busy={busy || pinsDirty}
          onRoleChange={setRole}
          onContentChange={setContent}
          onCancelReply={() => setComposeTarget(null)}
          onSubmit={(imageBase64) => {
            const endpoint = composeTarget ? `/threads/${encodeURIComponent(composeTarget.id)}/replies` : "/threads";
            return mutate(
              (signal) => request(endpoint, parseGuestbookMessage, { method: "POST", body: JSON.stringify({ authorType: role, content, ...(imageBase64 ? { imageBase64 } : {}) }), signal }),
              "店家留言已公開。",
              () => { setContent(""); setComposerOpen(false); setComposeTarget(null); },
            );
          }}
        />
        <AdminGuestbookEditor
          message={editor}
          name={editName}
          content={editContent}
          error={error}
          busy={busy}
          onNameChange={setEditName}
          onContentChange={setEditContent}
          onClose={() => { if (!busy) setEditor(null); }}
          onSubmit={(event) => {
            event.preventDefault();
            if (!editor) return;
            void mutate(
              (signal) => request(messagePath(editor), parseGuestbookMessage, {
                method: "PUT",
                body: JSON.stringify({ displayName: editName, content: editContent, version: editor.version }),
                signal,
              }),
              "留言已更新。",
              () => setEditor(null),
            );
          }}
        />
        <AdminPanel
          title="留言清單"
          className="adminGuestbookListPanel"
          actions={<>
            <button type="button" className="adminButton adminButton-primary" disabled={busy || loading || pinsDirty} onClick={() => { setError(""); setComposeTarget(null); setComposerOpen(true); }}><Plus size={16} aria-hidden="true" />新增留言</button>
            <button type="button" className={`${SECONDARY_BUTTON_CLASS} iconActionButton`} disabled={busy || loading || pinsDirty} aria-label="留言板設定" title="留言板設定" onClick={() => { setError(""); setSettingsOpen(true); }}><Settings aria-hidden="true" /></button>
            <AdminRefreshButton disabled={busy || loading} onClick={() => void load()} />
          </>}
        >
          <form
            className="adminGuestbookFilters"
            onSubmit={(event) => {
              event.preventDefault();
              const nextSearch = searchDraft.trim();
              setLoading(true);
              setPage(1);
              setExpanded(null);
              replyController.current?.abort();
              if (nextSearch === search && page === 1) void load(true);
              else setSearch(nextSearch);
            }}
          >
            <AdminField label="搜尋">
              <input
                placeholder="姓名、內容或 UID"
                maxLength={100}
                value={searchDraft}
                disabled={busy || loading || pinsDirty}
                onChange={(event) => setSearchDraft(event.target.value)}
              />
            </AdminField>
            <AdminField label="顯示範圍">
              <select disabled={busy || loading || pinsDirty} value={filter} onChange={(event) => {
                setLoading(true);
                setFilter(event.target.value);
                setPage(1);
                setExpanded(null);
                replyController.current?.abort();
              }}>
                <option value="all">全部（含隱藏）</option>
                <option value="hidden">隱藏留言串</option>
                <option value="locked">關閉回覆</option>
                <option value="hidden-replies">含隱藏回覆</option>
              </select>
            </AdminField>
            <AdminField label="圖片">
              <select disabled={busy || loading || pinsDirty} value={hasImage} onChange={(event) => {
                setLoading(true);
                setHasImage(event.target.value);
                setPage(1);
                setExpanded(null);
                replyController.current?.abort();
              }}>
                <option value="all">不限</option>
                <option value="yes">含圖片</option>
                <option value="no">無圖片</option>
              </select>
            </AdminField>
            <div className="adminGuestbookActions">
              <button className="adminButton adminButton-primary" type="submit" disabled={busy || loading || pinsDirty}>搜尋</button>
              <button
                className={SECONDARY_BUTTON_CLASS}
                type="button"
                disabled={busy || loading || pinsDirty || (!search && !searchDraft)}
                onClick={() => {
                  setSearchDraft("");
                  setLoading(true);
                  setPage(1);
                  setExpanded(null);
                  replyController.current?.abort();
                  if (!search && page === 1) void load(true);
                  else setSearch("");
                }}
              >
                清除
              </button>
            </div>
          </form>
          <p className="adminGuestbookFilterHint">姓名、內容、UID 與圖片均檢查整串留言及回覆，結果以留言串顯示。</p>
          {loading ? <p role="status">正在讀取留言…</p> : null}
          {list?.pinnedItems.length ? (
            <section className="adminGuestbookPins">
              <h3 className="adminGuestbookSectionTitle">置頂 <span>{list.pinnedItems.length}</span></h3>
              {list.pinnedItems.map((message, index) => (
                <div key={message.id}>
                  {messageView(message, canReorderPins ? (
                    <div className="adminGuestbookPinControls">
                      <span title="置頂順序">#{index + 1}</span>
                      <button type="button" className={`${SECONDARY_BUTTON_CLASS} iconActionButton`} disabled={busy || loading || index === 0} aria-label={`將 ${message.displayName} 的留言上移`} title="上移" onClick={() => movePin(index, -1)}><ArrowUp aria-hidden="true" /></button>
                      <button type="button" className={`${SECONDARY_BUTTON_CLASS} iconActionButton`} disabled={busy || loading || index === list.pinnedItems.length - 1} aria-label={`將 ${message.displayName} 的留言下移`} title="下移" onClick={() => movePin(index, 1)}><ArrowDown aria-hidden="true" /></button>
                    </div>
                  ) : null)}
                </div>
              ))}
              {canReorderPins && pinsDirty ? (
                <button
                  className="adminButton adminButton-primary"
                  disabled={busy || !pinsDirty}
                  onClick={() => void mutate(
                    (signal) => request("/pins", parseTrue, {
                      method: "PUT",
                      body: JSON.stringify({ items: list.pinnedItems.map(({ id, version }) => ({ id, version })) }),
                      signal,
                    }),
                    "置頂排序已儲存。",
                    undefined,
                    true,
                  )}
                >
                  儲存置頂排序
                </button>
              ) : null}
            </section>
          ) : null}
          <h3 className="adminGuestbookSectionTitle">一般留言</h3>
          {list?.items.map((message) => messageView(message))}
          {list && !list.items.length && !list.pinnedItems.length ? <p>目前沒有符合條件的留言。</p> : null}
          <div className="adminGuestbookActions adminGuestbookPagination">
            <button className={SECONDARY_BUTTON_CLASS} disabled={busy || loading || pinsDirty || page === 1} onClick={() => { setLoading(true); setPage(page - 1); setExpanded(null); }}>上一頁</button>
            <span>第 {page} 頁</span>
            <button className={SECONDARY_BUTTON_CLASS} disabled={busy || loading || pinsDirty || !list || page * list.pageSize >= list.totalCount} onClick={() => { setLoading(true); setPage(page + 1); setExpanded(null); }}>下一頁</button>
          </div>
        </AdminPanel>
        <AdminGuestbookSettingsPanel
          open={settingsOpen}
          error={error}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          name={mascotName}
          busy={busy || pinsDirty}
          loading={loading}
          pinsDirty={pinsDirty}
          onNameChange={(value) => { mascotDirty.current = true; setMascotName(value); }}
          onDiscard={() => { mascotDirty.current = false; void load(); }}
          onSubmit={(event) => {
            event.preventDefault();
            if (!settings) return;
            void mutate(
              (signal) => request("/settings", parseTrue, { method: "PUT", body: JSON.stringify({ mascotName, version: settings.version }), signal }),
              "吉祥物名稱已儲存。",
              () => { mascotDirty.current = false; },
            );
          }}
        />
        <AdminGuestbookHistoryPanel history={history} onClose={() => setHistory(null)} />
      </div>
    </AdminPage>
  );
}
