import { useState } from 'react';
import { adminApi, ApiError } from '@/features/admin/api/client.js';
import { AdminButton } from '@/features/admin/shared/AdminShared.jsx';

export function AdminForgotPasswordPage({ navigate }) {
  const [form, setForm] = useState({ loginName: '', newPassword: '', confirmPassword: '', verificationCode: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setError(null);
    setSuccess('');
  };

  const submit = async (event) => {
    event.preventDefault();
    const loginName = form.loginName.trim();
    const verificationCode = form.verificationCode.trim();

    if (!loginName || !form.newPassword || !form.confirmPassword || !verificationCode) {
      setError(new ApiError('請完整填寫帳號、新密碼、確認密碼與驗證碼。'));
      return;
    }
    if (form.newPassword.length < 8) {
      setError(new ApiError('新密碼至少需要 8 個字元。'));
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError(new ApiError('新密碼與確認密碼不一致。'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess('');
    try {
      await adminApi.resetPassword({
        loginName,
        newPassword: form.newPassword,
        verificationCode,
      });
      setForm((current) => ({ ...current, newPassword: '', confirmPassword: '', verificationCode: '' }));
      setSuccess('密碼已重新設定完成，請返回登入頁使用新密碼登入。');
    } catch (requestError) {
      setError(requestError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="adminLoginShell">
      <section className="adminLoginCard" aria-labelledby="admin-forgot-password-title">
        <div className="adminLoginBrand">
          <span className="adminLoginMark"><img src="/favicon.svg" alt="" /></span>
          <span>
            <strong>清醒夢</strong>
            <small>LUCID DREAM / ADMIN</small>
          </span>
        </div>

        <button className="adminBackButton" type="button" onClick={() => navigate('/admin/login')}>
          ←返回登入
        </button>

        <div className="adminLoginHeading">
          <p className="eyebrow">Password Recovery</p>
          <h1 id="admin-forgot-password-title">重新設定密碼</h1>
          <p>請向開發者或經理取得對應帳號的一次性驗證碼。</p>
        </div>

        <form className="adminLoginForm" onSubmit={submit}>
          <label>
            <span>帳號</span>
            <input
              autoComplete="username"
              name="loginName"
              value={form.loginName}
              onChange={updateField('loginName')}
              placeholder="輸入要重設的登入帳號"
              disabled={isSubmitting}
              autoFocus
            />
          </label>
          <label>
            <span>新密碼</span>
            <input
              autoComplete="new-password"
              name="newPassword"
              type="password"
              value={form.newPassword}
              onChange={updateField('newPassword')}
              placeholder="至少 8 個字元"
              disabled={isSubmitting}
            />
          </label>
          <label>
            <span>確認密碼</span>
            <input
              autoComplete="new-password"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={updateField('confirmPassword')}
              placeholder="再次輸入新密碼"
              disabled={isSubmitting}
            />
          </label>
          <label>
            <span>驗證碼</span>
            <input
              autoComplete="one-time-code"
              name="verificationCode"
              value={form.verificationCode}
              onChange={updateField('verificationCode')}
              placeholder="輸入管理員提供的驗證碼"
              disabled={isSubmitting}
            />
            <small>驗證碼只可使用一次，且會與指定帳號綁定。</small>
          </label>

          {error ? <p className="adminFormError" role="alert">{error.message}</p> : null}
          {success ? <p className="adminFormSuccess" role="status">{success}</p> : null}

          <AdminButton className="adminPrimaryButton" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '設定中…' : '重新設定密碼'}
          </AdminButton>
          <AdminButton variant="ghost" className="adminRegisterButton" onClick={() => navigate('/admin/login')} disabled={isSubmitting}>
            返回登入
          </AdminButton>
        </form>
      </section>
    </main>
  );
}
