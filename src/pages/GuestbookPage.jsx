import { useMemo, useState } from 'react';
import { Modal } from '../components/Modal.jsx';
import { PageFrame } from '../components/PageFrame.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { guestbookMessages } from '../mockData.js';

const pageSize = 10;

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

export function GuestbookPage() {
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const sortedMessages = useMemo(
    () =>
      [...guestbookMessages]
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return Number(b.isPinned) - Number(a.isPinned);
          return new Date(b.createdAt) - new Date(a.createdAt);
        })
        .slice(0, 50),
    [],
  );
  const pageCount = Math.max(1, Math.ceil(sortedMessages.length / pageSize));
  const currentMessages = sortedMessages.slice((page - 1) * pageSize, page * pageSize);

  return (
    <PageFrame eyebrow="Guestbook" title="留聲機" intro="旅人留下的短箋會在此排列，置頂訊息優先顯示。">
      <section className="guestbookPanel">
        <div className="guestbookToolbar">
          <div>
            <p className="eyebrow">Latest 50</p>
            <h2>留言板</h2>
          </div>
          <button className="btnPrimary" type="button" onClick={() => setIsDialogOpen(true)}>
            新增留言
          </button>
        </div>

        <div className="messageList">
          {currentMessages.map((message) => (
            <article className={message.isPinned ? 'messageItem pinned' : 'messageItem'} key={message.id}>
              <div className="messageMeta">
                <StatusBadge tone={message.isPinned ? 'accent' : 'muted'}>
                  {message.isPinned ? '置頂' : message.id}
                </StatusBadge>
                <span>{message.id}</span>
                <time>{formatMessageTime(message.createdAt)}</time>
              </div>
              <h3>{message.authorId}</h3>
              <p>{message.message}</p>
            </article>
          ))}
        </div>

        <div className="paginationBar">
          <button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
            上一頁
          </button>
          <span>
            {page} / {pageCount}
          </span>
          <button type="button" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>
            下一頁
          </button>
        </div>
      </section>

      {isDialogOpen ? <GuestbookDialog onClose={() => setIsDialogOpen(false)} /> : null}
    </PageFrame>
  );
}

function GuestbookDialog({ onClose }) {
  const [message, setMessage] = useState('');

  return (
    <Modal title="新增留言" onClose={onClose}>
      <form className="guestbookDialog" onSubmit={(event) => event.preventDefault()}>
        <p className="eyebrow">New Message</p>
        <h2>新增留言</h2>
        <label>
          留言者 ID
          <input type="text" placeholder="例如：月下旅人" />
        </label>
        <label>
          Cloudflare Turnstile
          <div className="turnstilePlaceholder">Turnstile 驗證區塊預留</div>
        </label>
        <label>
          留言內容
          <textarea
            maxLength={200}
            value={message}
            placeholder="最多 200 字"
            onChange={(event) => setMessage(event.target.value)}
          />
          <small>{message.length} / 200</small>
        </label>
        <div className="dialogActions">
          <button className="btnSecondary" type="button" onClick={onClose}>
            取消
          </button>
          <button className="btnPrimary" type="submit">
            送出留言
          </button>
        </div>
      </form>
    </Modal>
  );
}
