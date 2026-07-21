import { useState } from 'react';
import brandMark from '../assets/brand-mark.svg';
import { ApiError } from '../api/client.js';
import { useAdminAuth } from './AdminAuthContext.jsx';

export function AdminLoginPage({ navigate }) {
  const { login } = useAdminAuth();
  const [form, setForm] = useState({ loginName: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.loginName.trim() || !form.password) {
      setError(new ApiError('請輸入帳號與密碼。'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await login({ loginName: form.loginName.trim(), password: form.password });
      navigate('/admin');
    } catch (requestError) {
      setError(requestError.status === 401 ? new ApiError('帳號或密碼錯誤。') : requestError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="adminLoginShell">
      <section className="adminLoginCard" aria-labelledby="admin-login-title">
        <div className="adminLoginBrand">
          <span className="adminLoginMark"><img src={brandMark} alt="" /></span>
          <span>
            <strong>35女王古殿</strong>
            <small>ADMIN LOUNGE</small>
          </span>
        </div>

        <button className="adminBackButton" type="button" onClick={() => navigate('/home')}>
          ←返回首頁
        </button>

        <div className="adminLoginHeading">
          <p className="eyebrow">Restricted Entrance</p>
          <h1 id="admin-login-title">後台登入</h1>
          <p>請輸入後台人員帳號，進入管理者專屬區域。</p>
        </div>

        <form className="adminLoginForm" onSubmit={submit}>
          <label>
            <span>登入帳號</span>
            <input
              autoComplete="username"
              name="loginName"
              value={form.loginName}
              onChange={(event) => setForm((current) => ({ ...current, loginName: event.target.value }))}
              placeholder="輸入登入帳號"
              disabled={isSubmitting}
            />
          </label>
          <label>
            <span>密碼</span>
            <input
              autoComplete="current-password"
              name="password"
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="輸入密碼"
              disabled={isSubmitting}
            />
          </label>

          {error ? <p className="adminFormError" role="alert">{error.message}</p> : null}

          <button className="adminPrimaryButton" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '驗證中…' : '進入後台'}
          </button>
        </form>
      </section>
    </main>
  );
}
