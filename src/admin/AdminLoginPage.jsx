import { useState } from 'react';
import brandMark from '../assets/brand-mark.svg';
import { adminApi, ApiError } from '../api/client.js';
import { useAdminAuth } from './AdminAuthContext.jsx';
import { AdminButton, AdminDialog } from './AdminShared.jsx';

export function AdminLoginPage({ navigate }) {
  const { login } = useAdminAuth();
  const [form, setForm] = useState({ loginName: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({ loginName: '', password: '', verificationCode: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState(null);
  const [registerSuccess, setRegisterSuccess] = useState('');

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

  const closeRegistration = () => {
    if (isRegistering) return;
    setIsRegisterOpen(false);
    setRegisterForm({ loginName: '', password: '', verificationCode: '' });
    setRegisterError(null);
    setRegisterSuccess('');
  };

  const submitRegistration = async (event) => {
    event.preventDefault();
    if (!registerForm.loginName.trim() || !registerForm.password || !registerForm.verificationCode.trim()) {
      setRegisterError(new ApiError('請輸入帳號、密碼與驗證碼。'));
      setRegisterSuccess('');
      return;
    }

    setIsRegistering(true);
    setRegisterError(null);
    setRegisterSuccess('');
    try {
      await adminApi.registerStaff({
        loginName: registerForm.loginName.trim(),
        password: registerForm.password,
        verificationCode: registerForm.verificationCode.trim(),
      });
      setRegisterSuccess('註冊成功，請關閉視窗後使用新帳號登入。');
      setForm((current) => ({ ...current, loginName: registerForm.loginName.trim(), password: '' }));
      setRegisterForm({ loginName: '', password: '', verificationCode: '' });
    } catch (requestError) {
      setRegisterError(requestError);
    } finally {
      setIsRegistering(false);
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
          <button className="adminGhostButton adminRegisterButton" type="button" onClick={() => { setIsRegisterOpen(true); setRegisterError(null); setRegisterSuccess(''); }} disabled={isSubmitting}>
            註冊店員帳號
          </button>
        </form>
      </section>

      <AdminDialog
        open={isRegisterOpen}
        title="註冊店員帳號"
        description="請輸入管理者提供的一次性驗證碼。註冊完成後會建立店員資料。"
        onClose={closeRegistration}
        actions={<><AdminButton variant="ghost" onClick={closeRegistration} disabled={isRegistering}>取消</AdminButton><AdminButton type="submit" form="admin-register-form" disabled={isRegistering}>{isRegistering ? '註冊中…' : '註冊帳號'}</AdminButton></>}
      >
        <form id="admin-register-form" className="adminLoginForm" onSubmit={submitRegistration}>
          <label>
            <span>登入帳號</span>
            <input
              autoComplete="username"
              name="registerLoginName"
              value={registerForm.loginName}
              onChange={(event) => setRegisterForm((current) => ({ ...current, loginName: event.target.value }))}
              placeholder="輸入登入帳號"
              disabled={isRegistering}
              autoFocus
            />
          </label>
          <label>
            <span>密碼</span>
            <input
              autoComplete="new-password"
              name="registerPassword"
              type="password"
              value={registerForm.password}
              onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="至少 8 個字元"
              disabled={isRegistering}
            />
          </label>
          <label>
            <span>驗證碼</span>
            <input
              autoComplete="one-time-code"
              name="verificationCode"
              value={registerForm.verificationCode}
              onChange={(event) => setRegisterForm((current) => ({ ...current, verificationCode: event.target.value }))}
              placeholder="輸入管理者提供的驗證碼"
              disabled={isRegistering}
            />
          </label>
          {registerError ? <p className="adminFormError" role="alert">{registerError.message}</p> : null}
          {registerSuccess ? <p className="adminFormSuccess" role="status">{registerSuccess}</p> : null}
        </form>
      </AdminDialog>
    </main>
  );
}
