import { AdminButton } from "@/features/admin/shared/AdminShared.jsx";
import type { useAdmissionCreation } from "./useAdmissionCreation";

const money = (amount: number) => `${amount.toLocaleString("zh-TW")} G`;

export function AdmissionPaymentFields({
  payment,
  canManage,
}: {
  payment: ReturnType<typeof useAdmissionCreation>;
  canManage: boolean;
}) {
  return (
    <section className="adminAdmissionPayment" aria-label="入場收款確認">
      {payment.preview ? (
        <>
          <div className="adminAdmissionOverview">
            <div className="adminAdmissionOverviewPrimary">
              <h3>入場收款</h3>
              <p className="adminAdmissionOverviewFee">
                <span>入場費</span>
                <strong>{money(payment.preview.admissionAmount)}</strong>
              </p>
              <p className="adminAdmissionOverviewReceived">
                <span>本次實收</span>
                <strong>{money(payment.received)}</strong>
              </p>
            </div>
            <div className="adminAdmissionOverviewMeta">
              <span>餐點折抵額度 {money(payment.preview.mealCreditAmount)}</span>
              <span>收款營業日 {payment.preview.businessDate}</span>
              <span>
                預覽有效至{" "}
                {new Date(payment.preview.expiresAt).toLocaleTimeString("zh-TW", {
                  timeZone: "Asia/Taipei",
                })}
              </span>
            </div>
          </div>
          {canManage && (
            <div className="adminAdmissionFields">
              <label className="adminAdmissionPaymentMode">
                收款狀態
                <select
                  disabled={payment.locked}
                  value={payment.mode}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "received" || value === "unpaid" || value === "waived") {
                      payment.setMode(value);
                      payment.setConfirmed(false);
                    }
                  }}
                >
                  <option value="received">已收款</option>
                  <option value="unpaid">未收款／轉未決</option>
                  <option value="waived">免收</option>
                </select>
              </label>
              {payment.mode !== "waived" && (
                <label className="adminAdmissionPaymentDiscount">
                  優惠／折讓
                  <input
                    type="number"
                    min={0}
                    max={payment.preview.admissionAmount}
                    step={1}
                    value={payment.discount}
                    disabled={payment.locked}
                    onChange={(event) => {
                      payment.setDiscount(Number(event.target.value));
                      payment.setConfirmed(false);
                    }}
                  />
                </label>
              )}
              {(payment.mode !== "received" || payment.discount > 0) && (
                <label className="adminAdmissionPaymentReason">
                  例外原因
                  <input
                    required
                    maxLength={500}
                    value={payment.reason}
                    disabled={payment.locked}
                    onChange={(event) => payment.setReason(event.target.value)}
                  />
                </label>
              )}
            </div>
          )}
          <div className="adminAdmissionPaymentActions">
            {payment.mode === "received" && (
              <label className="adminAdmissionConfirm">
                <input
                  type="checkbox"
                  required
                  checked={payment.confirmed}
                  disabled={payment.locked}
                  onChange={(event) => payment.setConfirmed(event.target.checked)}
                />
                已確認收到上述入場費
              </label>
            )}
            <AdminButton
              variant="ghost"
              disabled={payment.locked}
              onClick={() => void payment.load()}
            >
              重新讀取收費
            </AdminButton>
          </div>
        </>
      ) : (
        <>
          <h3>入場收款</h3>
          <p>尚未取得有效收費預覽，請確認營業日已開啟；入場費請至「營運參數」設定。</p>
          <AdminButton
            variant="ghost"
            disabled={payment.locked}
            onClick={() => void payment.load()}
          >
            重新讀取收費
          </AdminButton>
        </>
      )}
      {payment.error && (
        <p className="adminFormError" role="alert">
          {payment.error}
        </p>
      )}
      {payment.pending && (
        <div role="status">
          <p>結果尚未確認，請保留此畫面；重試會沿用同一筆收款。</p>
          <AdminButton disabled={payment.busy} onClick={() => void payment.lookup()}>
            查回這筆開碼結果
          </AdminButton>
        </div>
      )}
      {payment.result && (
        <div role="status">
          <p>
            已確認入場紀錄，實收 {money(payment.result.receivedAmount)}。原點餐資料未保存；重發不會再收取入場費。
          </p>
          <AdminButton disabled={payment.busy} onClick={() => void payment.reissue()}>
            確認重發點餐資料（原碼失效）
          </AdminButton>
        </div>
      )}
    </section>
  );
}
