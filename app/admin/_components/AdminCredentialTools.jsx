import { useState } from 'react';
import { adminApi } from '../admin-api.js';
import { useAdminAuth } from './AdminAuthContext.jsx';
import { AdminButton, AdminDialog, AdminPanel } from './AdminShared.jsx';

export function AdminCredentialTools() {
  const { user } = useAdminAuth();
  const canManage = user.role === 'developer' || user.role === 'manager';
  const [registerKeyState, setRegisterKeyState] = useState({ loading: false, message: '', error: false });
  const [isPasswordResetKeyOpen, setIsPasswordResetKeyOpen] = useState(false);
  const [passwordResetKeyForm, setPasswordResetKeyForm] = useState({ loginName: '' });
  const [passwordResetKeyState, setPasswordResetKeyState] = useState({ loading: false, result: null, message: '', error: false, copied: false });
  const canCopyPasswordResetKey = typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.writeText);

  if (!canManage) return null;

  const handleGetRegisterKey = async () => {
    if (registerKeyState.loading) return;
    setRegisterKeyState({ loading: true, message: '', error: false });
    try {
      const result = await adminApi.getRegisterKey();
      if (!result?.key || !navigator.clipboard?.writeText) throw new Error('目前瀏覽器不允許使用剪貼簿，無法複製金鑰。');
      await navigator.clipboard.writeText(result.key);
      setRegisterKeyState({ loading: false, message: '已將金鑰複製至剪貼簿', error: false });
    } catch (error) {
      setRegisterKeyState({ loading: false, message: error.message, error: true });
    }
  };

  const openPasswordResetKey = () => {
    setPasswordResetKeyForm({ loginName: '' });
    setPasswordResetKeyState({ loading: false, result: null, message: '', error: false, copied: false });
    setIsPasswordResetKeyOpen(true);
  };

  const closePasswordResetKey = () => {
    if (!passwordResetKeyState.loading) setIsPasswordResetKeyOpen(false);
  };

  const handleGetPasswordResetKey = async (event) => {
    event.preventDefault();
    const loginName = passwordResetKeyForm.loginName.trim();
    if (!loginName) {
      setPasswordResetKeyState({ loading: false, result: null, message: '請輸入要協助重設的登入帳號。', error: true, copied: false });
      return;
    }
    setPasswordResetKeyState({ loading: true, result: null, message: '', error: false, copied: false });
    try {
      const result = await adminApi.getPasswordResetKey({ loginName });
      setPasswordResetKeyState({ loading: false, result, message: '驗證碼已產生，請安全地交給該帳號持有人。', error: false, copied: false });
    } catch (error) {
      setPasswordResetKeyState({ loading: false, result: null, message: error.message, error: true, copied: false });
    }
  };

  const copyPasswordResetKey = async () => {
    if (!passwordResetKeyState.result?.key || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(passwordResetKeyState.result.key);
      setPasswordResetKeyState((current) => ({ ...current, copied: true }));
    } catch {
      setPasswordResetKeyState((current) => ({ ...current, copied: false }));
    }
  };

  const formatPasswordResetExpiry = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <>
      <AdminPanel className="adminCredentialTools" title="帳號安全工具" description="開發者與店經理可在此取得註冊金鑰，或協助重設後台帳號。">
        <div className="adminCredentialToolsBody">
          <div className="adminCredentialActions">
            <AdminButton variant="secondary" onClick={handleGetRegisterKey} disabled={registerKeyState.loading}>
              {registerKeyState.loading ? '取得中…' : '取得註冊金鑰'}
            </AdminButton>
            <AdminButton variant="secondary" onClick={openPasswordResetKey} disabled={registerKeyState.loading}>取得重設驗證碼</AdminButton>
          </div>
          {registerKeyState.message ? <span className={`adminCredentialMessage ${registerKeyState.error ? 'isError' : ''}`} role="status">{registerKeyState.message}</span> : null}
        </div>
      </AdminPanel>

      <AdminDialog
        open={isPasswordResetKeyOpen}
        title="產生重設驗證碼"
        description="選擇要協助重設的後台帳號；經理僅能替店員帳號產生驗證碼。"
        onClose={closePasswordResetKey}
        actions={<AdminButton variant="ghost" onClick={closePasswordResetKey} disabled={passwordResetKeyState.loading}>關閉</AdminButton>}
      >
        <form id="admin-password-reset-key-form" className="adminPasswordResetKeyForm" onSubmit={handleGetPasswordResetKey}>
          <label className="adminField">
            <span>幫誰重設</span>
            <input autoComplete="username" name="passwordResetLoginName" value={passwordResetKeyForm.loginName} onChange={(event) => setPasswordResetKeyForm({ loginName: event.target.value })} placeholder="輸入後台登入帳號" disabled={passwordResetKeyState.loading} autoFocus />
            <small>請輸入登入帳號。開發者可協助所有角色，經理只能協助店員。</small>
          </label>
          {passwordResetKeyState.message ? <p className={passwordResetKeyState.error ? 'adminFormError' : 'adminFormSuccess'} role="status">{passwordResetKeyState.message}</p> : null}
          {passwordResetKeyState.result?.key ? <div className="adminPasswordResetKeyResult" role="status">
            <span>一次性驗證碼</span>
            <code>{passwordResetKeyState.result.key}</code>
            {formatPasswordResetExpiry(passwordResetKeyState.result.expiresAt) ? <small>有效期限：{formatPasswordResetExpiry(passwordResetKeyState.result.expiresAt)}</small> : null}
            <AdminButton variant="secondary" onClick={copyPasswordResetKey} disabled={!canCopyPasswordResetKey}>{passwordResetKeyState.copied ? '已複製' : '複製驗證碼'}</AdminButton>
          </div> : null}
          <AdminButton type="submit" disabled={passwordResetKeyState.loading}>{passwordResetKeyState.loading ? '產生中…' : '產生驗證碼'}</AdminButton>
        </form>
      </AdminDialog>
    </>
  );
}
