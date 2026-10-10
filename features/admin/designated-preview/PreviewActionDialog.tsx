import { useState } from "react";
import { AdminButton, AdminDialog, AdminField } from "@/features/admin/shared/AdminShared.jsx";
import { formatGil } from "./preview-data";
import type { PreviewAction, PreviewGuest } from "./preview-data";

const ACTION_TITLES: Record<PreviewAction, string> = {
  pass: "重發點餐碼",
  meal: "代點餐點",
  room: "代訂包廂",
  commission: "建立繪圖／簽繪委託",
  addon: "加點服務",
  extend: "續約指名",
  decline: "回覆無法承接",
  exception: "異常與調整",
};

const MEALS = [
  { id: "drink", name: "月下特調", price: 30000 },
  { id: "dessert", name: "星夜甜點", price: 50000 },
  { id: "set", name: "旅人宵夜套餐", price: 80000 },
];

interface ActionDialogProps {
  action: PreviewAction;
  guest: PreviewGuest;
  onClose: () => void;
  onComplete: (message: string, declined?: boolean) => void;
}

export default function PreviewActionDialog({ action, guest, onClose, onComplete }: ActionDialogProps) {
  const [note, setNote] = useState("");
  const [selection, setSelection] = useState(action === "room" ? "星夜包廂" : action === "commission" ? "簽繪" : action === "exception" ? "協調改期" : "合照");
  const [quantities, setQuantities] = useState<Record<string, number>>({ drink: 1, dessert: 0, set: 0 });
  const [result, setResult] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [startTime, setStartTime] = useState(action === "extend" ? "23:10" : "22:50");
  const [sessions, setSessions] = useState("1");
  const [error, setError] = useState("");
  const total = MEALS.reduce((sum, meal) => sum + meal.price * (quantities[meal.id] || 0), 0);
  const claimCode = `DEMO-CLAIM-${guest.id.toUpperCase()}`;
  const passCode = `DEMO-ORDER-${guest.id.toUpperCase()}`;
  const shareMessage = action === "commission"
    ? `${guest.name}，你的${selection}委託已建立。領取碼：${claimCode}。作品完成並開放領取後，可使用此碼領取。（設計稿範例訊息）`
    : `${guest.name}，本次點餐碼：${passCode}。（設計稿範例碼）`;

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopyStatus("已複製範例訊息");
    } catch {
      setCopyStatus("未取得剪貼簿權限，請選取下方訊息複製。");
    }
  };

  const submit = () => {
    if ((action === "decline" || action === "commission" || action === "exception") && !note.trim()) {
      setError("請填寫內容後再確認。");
      return;
    }
    if (action === "meal" && total === 0) {
      setError("請至少選擇一份餐點。");
      return;
    }
    if ((action === "room" || action === "extend") && !startTime) {
      setError("請選擇開始時間。");
      return;
    }
    setError("");
    const messages: Record<PreviewAction, string> = {
      pass: `已準備 ${guest.name} 的範例點餐碼。`,
      meal: `已模擬為 ${guest.name} 送出餐點，合計 ${formatGil(total)}。`,
      room: `已模擬為 ${guest.name} 代訂${selection}，${startTime} 開始。`,
      commission: `已模擬建立 ${guest.name} 的${selection}委託與初始領取碼。`,
      addon: `已模擬為 ${guest.name} 加點${selection}。`,
      extend: `已模擬送出 ${guest.name} 的新指名需求：${startTime} 開始、${sessions} 節；等待排程確認。`,
      decline: `已回覆無法承接 ${guest.name} 的指名；交回經理協調，保留顧客訂單。`,
      exception: `已模擬記錄 ${guest.name} 的「${selection}」需求與原因。`,
    };
    onComplete(messages[action], action === "decline");
    if (action === "commission" || action === "pass") setResult(messages[action]);
    else onClose();
  };

  return (
    <AdminDialog
      open
      title={`${ACTION_TITLES[action]} · ${guest.name}`}
      description="設計預覽 · 範例資料與操作"
      onClose={onClose}
      className="adminDesignatedPreviewDialog"
      actions={result || action === "pass" ? <>
        <AdminButton variant="ghost" onClick={onClose}>完成</AdminButton>
        <AdminButton onClick={copyMessage}>複製顧客訊息</AdminButton>
      </> : <>
        <AdminButton variant="ghost" onClick={onClose}>返回</AdminButton>
        <AdminButton onClick={submit}>
          {action === "decline" ? "無法承接，交回經理" : action === "commission" ? "建立委託與領取碼" : action === "extend" ? "建立新的指名需求" : "確認送出"}
        </AdminButton>
      </>}
    >
      <div className="dpDialogStack">
        <div className="dpDialogContext"><strong>{guest.gameId}</strong><span>{guest.location} · {guest.order}</span></div>
        {action === "pass" && <>
          <div className="dpCode"><span>本次點餐碼 · 範例</span><strong>{passCode}</strong></div>
          <p className="dpDialogHint">沿用本次來店的點餐資格，提供顧客重新點餐。</p>
        </>}
        {action === "meal" && <>
          <div className="dpMealRows">
            {MEALS.map((meal) => (
              <AdminField key={meal.id} label={`${meal.name} · ${formatGil(meal.price)}`}>
                <input
                  type="number"
                  min="0"
                  max="9"
                  value={quantities[meal.id] || 0}
                  onChange={(event) => setQuantities({
                    ...quantities,
                    [meal.id]: Math.min(9, Math.max(0, Number(event.target.value) || 0)),
                  })}
                />
              </AdminField>
            ))}
          </div>
          <div className="dpDialogTotal"><span>範例合計</span><strong>{formatGil(total)}</strong></div>
          <AdminField label="餐點備註">
            <textarea value={note} placeholder="例如：請在服務後送上" onChange={(event) => setNote(event.target.value)} />
          </AdminField>
        </>}
        {action === "room" && <>
          <p className="dpDialogHint">沿用目前代客訂購：選擇包廂、時間與需求。</p>
          <AdminField label="包廂">
            <select value={selection} onChange={(event) => setSelection(event.target.value)}>
              <option>星夜包廂</option><option>月光包廂</option>
            </select>
          </AdminField>
          <div className="dpDialogGrid">
            <AdminField label="開始時間">
              <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </AdminField>
            <AdminField label="使用節數">
              <select value={sessions} onChange={(event) => setSessions(event.target.value)}>
                <option value="1">1 節 · 20 分鐘</option><option value="2">2 節 · 40 分鐘</option>
              </select>
            </AdminField>
          </div>
          <AdminField label="包廂需求">
            <textarea value={note} placeholder="人數、活動或其他現場需求" onChange={(event) => setNote(event.target.value)} />
          </AdminField>
          <div className="dpDialogTotal"><span>範例報價</span><strong>{formatGil(Number(sessions) * 150000)}</strong></div>
        </>}
        {action === "commission" && !result && <>
          <AdminField label="委託類型">
            <select value={selection} onChange={(event) => setSelection(event.target.value)}>
              <option>簽繪</option><option>繪圖</option>
            </select>
          </AdminField>
          <AdminField label="委託內容" required>
            <textarea value={note} placeholder="角色、範圍與顧客希望的內容" onChange={(event) => setNote(event.target.value)} />
          </AdminField>
          <p className="dpDialogHint">先建立委託並給顧客領取碼。作品完成後，再通知顧客開放領取。</p>
        </>}
        {action === "commission" && result && <>
          <p className="dpDialogSuccess">{result}</p>
          <div className="dpCode">
            <span>初始領取碼 · 範例</span><strong>{claimCode}</strong>
            <small>委託已建立 · 尚未開放領取</small>
          </div>
        </>}
        {action === "addon" && <>
          <AdminField label="加點項目">
            <select value={selection} onChange={(event) => setSelection(event.target.value)}>
              <option>合照</option><option>即興表演</option>
            </select>
          </AdminField>
          <AdminField label="備註">
            <textarea value={note} placeholder="顧客希望的內容" onChange={(event) => setNote(event.target.value)} />
          </AdminField>
          <p className="dpDialogHint">加點項目附在本次服務，時間延長請使用續約指名。</p>
        </>}
        {action === "extend" && <>
          <p className="dpDialogHint">續約會新增一筆指名需求，依現有排程確認可服務時段。</p>
          <div className="dpDialogGrid">
            <AdminField label="希望開始時間">
              <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </AdminField>
            <AdminField label="服務節數">
              <select value={sessions} onChange={(event) => setSessions(event.target.value)}>
                <option value="1">1 節 · 20 分鐘</option><option value="2">2 節 · 40 分鐘</option>
              </select>
            </AdminField>
          </div>
          <AdminField label="備註">
            <textarea value={note} placeholder="顧客可等待的時間或其他需求" onChange={(event) => setNote(event.target.value)} />
          </AdminField>
        </>}
        {action === "decline" && <>
          <p className="dpDialogHint">這筆指名會交回經理協調。顧客訂單及其他已確認項目會保留。</p>
          <AdminField label="無法承接原因" required>
            <textarea value={note} placeholder="例如：這個時段另有工作安排" onChange={(event) => setNote(event.target.value)} />
          </AdminField>
        </>}
        {action === "exception" && <>
          <AdminField label="處理項目">
            <select value={selection} onChange={(event) => setSelection(event.target.value)}>
              <option>協調改期</option>
              {guest.status === "awaiting" || guest.status === "confirmed" ? <option>取消未服務項目</option> : null}
              <option>補登服務</option>
              {guest.status === "in_service" ? <option>提早完成</option> : null}
            </select>
          </AdminField>
          <AdminField label="原因與處理內容" required>
            <textarea value={note} placeholder="請記錄異常原因與希望的安排" onChange={(event) => setNote(event.target.value)} />
          </AdminField>
        </>}
        {(action === "pass" || (action === "commission" && result)) && (
          <AdminField label="提供顧客的訊息"><textarea readOnly value={shareMessage} rows={4} /></AdminField>
        )}
        {error && <p role="alert" className="dpDialogHint">{error}</p>}
        {copyStatus && <p role="status" className="dpDialogHint">{copyStatus}</p>}
      </div>
    </AdminDialog>
  );
}
