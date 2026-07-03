import { useMemo, useState } from 'react';
import { PageFrame } from '../components/PageFrame.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { guestbookMessages } from '../mockData.js';

function formatMessageTime(value) {
  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function getSortedMessages(messages) {
  return [...messages]
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return Number(b.isPinned) - Number(a.isPinned);
      return new Date(b.createdAt) - new Date(a.createdAt);
    })
    .slice(0, 50);
}

export function GuestbookPage() {
  const [loginForm, setLoginForm] = useState({ id: '', password: '' });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState(() => new Set());
  const [replyDrafts, setReplyDrafts] = useState({});
  const [messageDraft, setMessageDraft] = useState('');
  const [messages, setMessages] = useState(() => getSortedMessages(guestbookMessages));
  const sortedMessages = useMemo(() => getSortedMessages(messages), [messages]);
  const pinnedCount = sortedMessages.filter((message) => message.isPinned).length;

  const handleLogin = (event) => {
    event.preventDefault();
    if (!loginForm.id.trim() || !loginForm.password.trim()) return;
    setIsLoggedIn(true);
  };

  const toggleReplies = (messageId) => {
    setExpandedReplies((current) => {
      const next = new Set(current);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const updateReplyDraft = (messageId, value) => {
    setReplyDrafts((current) => ({ ...current, [messageId]: value }));
  };

  const submitReply = (event, messageId) => {
    event.preventDefault();

    const draft = replyDrafts[messageId]?.trim();
    if (!draft) return;

    const now = new Date();
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              replies: [
                ...(message.replies ?? []),
                {
                  id: `${messageId}-DEMO-${now.getTime()}`,
                  authorId: loginForm.id.trim(),
                  message: draft,
                  createdAt: now.toISOString(),
                },
              ],
            }
          : message,
      ),
    );
    setReplyDrafts((current) => ({ ...current, [messageId]: '' }));
    setExpandedReplies((current) => new Set(current).add(messageId));
  };

  const submitMessage = (event) => {
    event.preventDefault();

    const draft = messageDraft.trim();
    if (!draft) return;

    const now = new Date();
    setMessages((current) => [
      {
        id: `MSG-DEMO-${now.getTime()}`,
        authorId: loginForm.id.trim(),
        message: draft,
        createdAt: now.toISOString(),
        isPinned: false,
        replies: [],
      },
      ...current,
    ]);
    setMessageDraft('');
  };

  return (
    <PageFrame eyebrow="Guestbook" title="留聲機" intro="旅人留下的短箋會在此排列，置頂訊息優先顯示。">
      <section className="guestbookPanel">
        <div className="guestbookToolbar">
          <div>
            <p className="eyebrow">Guestbook</p>
            <h2>留言板</h2>
          </div>
          <div className="guestbookSummary">
            <StatusBadge tone="accent">置頂 {pinnedCount}</StatusBadge>
            <StatusBadge tone="muted">最新 50</StatusBadge>
          </div>
        </div>

        <div className="guestbookContent">
          <div className="guestbookAuthCard">
            {isLoggedIn ? (
              <form className="guestbookMessageComposer" onSubmit={submitMessage}>
                <div className="guestbookComposerHeader">
                  <div>
                    <p className="eyebrow">New Message</p>
                    <h3>新增留言</h3>
                  </div>
                  <div className="guestbookComposerIdentity">
                    <span>已登入</span>
                    <strong>{loginForm.id}</strong>
                  </div>
                </div>
                <label>
                  留言內容
                  <textarea
                    maxLength={200}
                    value={messageDraft}
                    placeholder="留下給店內或店員的短箋，最多 200 字"
                    onChange={(event) => setMessageDraft(event.target.value)}
                  />
                  <small>{messageDraft.length} / 200</small>
                </label>
                <div className="guestbookComposerActions">
                  <button className="btnPrimary" type="submit">
                    新增留言
                  </button>
                </div>
              </form>
            ) : (
              <form className="guestbookLoginForm" onSubmit={handleLogin}>
                <div>
                  <p className="eyebrow">Login</p>
                  <h3>登入後留言</h3>
                </div>
                <label>
                  ID
                  <input
                    type="text"
                    value={loginForm.id}
                    placeholder="例如：月下旅人"
                    onChange={(event) => setLoginForm((current) => ({ ...current, id: event.target.value }))}
                  />
                </label>
                <label>
                  密碼
                  <input
                    type="password"
                    value={loginForm.password}
                    placeholder="demo 可任意輸入"
                    onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  />
                </label>
                <button className="btnPrimary" type="submit">
                  登入
                </button>
              </form>
            )}
          </div>

          <div className="guestbookReplyList" aria-label="留言回覆列表">
            {sortedMessages.map((message) => {
              const replies = message.replies ?? [];
              const isExpanded = expandedReplies.has(message.id);

              return (
                <article className={message.isPinned ? 'guestbookThread pinned' : 'guestbookThread'} key={message.id}>
                  <div className="guestbookThreadHeader">
                    <div>
                      <div className="messageMeta">
                        {message.isPinned ? <StatusBadge tone="accent">置頂</StatusBadge> : null}
                        <span>{message.authorId}</span>
                        <time>{formatMessageTime(message.createdAt)}</time>
                      </div>
                      <p>{message.message}</p>
                    </div>
                    {replies.length > 0 ? (
                      <button className="replyToggle" type="button" onClick={() => toggleReplies(message.id)}>
                        {isExpanded ? '收合回覆' : `展開 ${replies.length} 則回覆`}
                      </button>
                    ) : (
                      <span className="replyEmpty">尚無回覆</span>
                    )}
                  </div>

                  {isExpanded ? (
                    <div className="replyStack">
                      {replies.map((reply) => (
                        <div className="replyItem" key={reply.id}>
                          <div className="messageMeta">
                            <span>{reply.authorId}</span>
                            <time>{formatMessageTime(reply.createdAt)}</time>
                          </div>
                          <p>{reply.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {isLoggedIn ? (
                    <form className="replyComposer" onSubmit={(event) => submitReply(event, message.id)}>
                      <input
                        type="text"
                        value={replyDrafts[message.id] ?? ''}
                        placeholder="回覆這則留言"
                        onChange={(event) => updateReplyDraft(message.id, event.target.value)}
                      />
                      <button type="submit">回覆</button>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
