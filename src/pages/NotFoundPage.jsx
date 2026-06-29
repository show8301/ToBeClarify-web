import { PageFrame } from '../components/PageFrame.jsx';

export function NotFoundPage({ navigate }) {
  return (
    <PageFrame eyebrow="404" title="迷路的傳送門" intro="這個頁面尚未開放，請回到沙龍大廳。">
      <button className="btnPrimary" type="button" onClick={() => navigate('/home')}>
        回首頁
      </button>
    </PageFrame>
  );
}
