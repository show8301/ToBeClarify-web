import { useEffect, useState } from 'react';
import { adminApi } from '../admin-api.js';
import {
  AdminButton, AdminDialog, AdminDragList, AdminField, AdminImagePicker, AdminPanel, AdminState,
  AdminToggle, AdminPage, newId, splitParagraphs,
} from './AdminShared.jsx';

const emptySite = {
  name: '', shortName: '', subtitle: '', businessStatus: '', openHours: '', server: '', address: '',
  entryNote: '', aboutText: '', footerText: '', pricingNote: '', heroImage: '', heroImageMediaId: '', heroFile: null,
};

export function AdminHomeSettingsPage() {
  const [state, setState] = useState({ loading: true, error: null });
  const [site, setSite] = useState(emptySite);
  const [rules, setRules] = useState([]);
  const [carousels, setCarousels] = useState([]);
  const [slides, setSlides] = useState([]);
  const [reports, setReports] = useState([]);
  const [editingRule, setEditingRule] = useState(null);
  const [editingCarousel, setEditingCarousel] = useState(null);
  const [editingSlide, setEditingSlide] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [removedSlideIds, setRemovedSlideIds] = useState([]);

  const load = async () => {
    setState({ loading: true, error: null });
    try {
      const [settings, nextRules, nextCarousels, nextSlides, nextReports] = await Promise.all([
        adminApi.getSiteSettings(), adminApi.getShopRules(), adminApi.getHomeCarousels(), adminApi.getHomeSlides(), adminApi.getGalleryAlbums(),
      ]);
      const shopInfo = settings.find((item) => item.settingKey === 'shopInfo')?.settingValue || {};
      setSite({ ...emptySite, ...shopInfo, aboutText: (shopInfo.about || []).join('\n\n') });
      setRules(nextRules.map((item) => ({ ...item })));
      setCarousels(nextCarousels.map((item) => ({ ...item, _file: null })));
      setSlides(nextSlides.map((item) => ({
        ...item,
        displaySeconds: Math.min(60, Math.max(1, Number(item.displaySeconds) || 10)),
        _file: null,
      })));
      setReports(nextReports);
      setRemovedSlideIds([]);
      setState({ loading: false, error: null });
    } catch (error) {
      setState({ loading: false, error });
    }
  };

  useEffect(() => { load(); }, []);

  const updateSite = (key, value) => setSite((current) => ({ ...current, [key]: value }));
  const updateRuleEditor = (key, value) => setEditingRule((current) => ({ ...current, [key]: value }));
  const updateCarouselEditor = (key, value) => setEditingCarousel((current) => ({ ...current, [key]: value }));
  const updateSlideEditor = (key, value) => setEditingSlide((current) => ({ ...current, [key]: value }));

  const saveRuleEditor = () => {
    setRules((current) => current.map((item) => item.id === editingRule.id ? editingRule : item));
    setEditingRule(null);
  };

  const saveCarouselEditor = () => {
    setCarousels((current) => current.map((item) => item.id === editingCarousel.id ? editingCarousel : item));
    setEditingCarousel(null);
  };

  const saveSlideEditor = () => {
    if (!editingSlide?._file && !editingSlide?.mediaId && !editingSlide?.imageUrl) {
      removeSlide(editingSlide);
      setEditingSlide(null);
      return;
    }
    setSlides((current) => current.map((item) => item.id === editingSlide.id ? editingSlide : item));
    setEditingSlide(null);
  };

  const saveAll = async () => {
    setSaving(true);
    setMessage('');
    try {
      let heroImageMediaId = site.heroImageMediaId || null;
      let heroImage = site.heroImage || null;
      if (site.heroFile) {
        const uploaded = await adminApi.uploadMedia(site.heroFile, 'site');
        heroImageMediaId = uploaded.id;
        heroImage = uploaded.url;
      }
      const settingValue = { ...site, about: splitParagraphs(site.aboutText), heroImage, heroImageMediaId };
      delete settingValue.aboutText;
      delete settingValue.heroFile;
      await adminApi.saveSiteSetting('shopInfo', { settingValue, description: '現行 Web 首頁店舖資訊', isActive: true });

      for (const rule of rules) {
        await adminApi.saveShopRule(rule.id?.startsWith('local-') ? null : rule.id, {
          ruleText: rule.ruleText, ruleNote: rule.ruleNote || null, sortOrder: Number(rule.sortOrder) || 0, isEnabled: rule.isEnabled,
        });
      }
      for (const carousel of carousels) {
        let overrideMediaId = carousel.overrideMediaId || null;
        let overrideImageUrl = carousel.overrideImageUrl || null;
        if (carousel._file) {
          const uploaded = await adminApi.uploadMedia(carousel._file, 'site');
          overrideMediaId = uploaded.id;
          overrideImageUrl = uploaded.url;
        }
        await adminApi.saveHomeCarousel(carousel.id?.startsWith('local-') ? null : carousel.id, {
          albumId: carousel.albumId || null, overrideTitle: carousel.overrideTitle, overrideSummary: carousel.overrideSummary,
          overrideMediaId, overrideImageUrl, eventTimeSnapshot: carousel.eventTimeSnapshot || null,
          ctaLabel: carousel.ctaLabel || '查看完整活動', sortOrder: Number(carousel.sortOrder) || 0, isEnabled: carousel.isEnabled,
        });
      }
      for (const id of removedSlideIds) await adminApi.deleteHomeSlide(id);
      for (const slide of slides) {
        if (!slide.mediaId && !slide.imageUrl && !slide._file) continue;
        let mediaId = slide.mediaId || null;
        let imageUrl = slide.imageUrl || null;
        if (slide._file) {
          const uploaded = await adminApi.uploadMedia(slide._file, 'home');
          mediaId = uploaded.id;
          imageUrl = uploaded.url;
        }
        await adminApi.saveHomeSlide(slide.id.startsWith('local-') ? null : slide.id, {
          mediaId, imageUrl, sortOrder: Number(slide.sortOrder) || 0, isEnabled: slide.isEnabled,
          displaySeconds: Math.min(60, Math.max(1, Number(slide.displaySeconds) || 10)),
        });
      }
      setMessage('首頁設定已儲存。');
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const addRule = () => {
    const item = { id: newId(), ruleText: '', ruleNote: '', sortOrder: rules.length, isEnabled: true };
    setRules((current) => [...current, item]);
    setEditingRule(item);
  };
  const addCarousel = () => {
    const item = {
      id: newId(), albumId: reports[0]?.id || '', overrideTitle: reports[0]?.albumTitle || '', overrideSummary: reports[0]?.albumDescription || '',
      overrideMediaId: null, overrideImageUrl: reports[0]?.coverImageUrl || '', eventTimeSnapshot: reports[0]?.periodText || '', ctaLabel: '查看完整活動',
      sortOrder: carousels.length, isEnabled: true, _file: null,
    };
    setCarousels((current) => [...current, item]);
    setEditingCarousel(item);
  };
  const addSlide = () => {
    const item = { id: newId(), mediaId: null, imageUrl: '', sortOrder: slides.length, isEnabled: true, displaySeconds: 10, _file: null };
    setSlides((current) => [...current, item]);
    setEditingSlide(item);
  };
  const removeRule = async (item) => {
    if (!item.id.startsWith('local-')) await adminApi.deleteShopRule(item.id);
    setRules((current) => current.filter((value) => value.id !== item.id).map((value, index) => ({ ...value, sortOrder: index })));
    if (editingRule?.id === item.id) setEditingRule(null);
  };
  const removeCarousel = async (item) => {
    if (!item.id.startsWith('local-')) await adminApi.deleteHomeCarousel(item.id);
    setCarousels((current) => current.filter((value) => value.id !== item.id).map((value, index) => ({ ...value, sortOrder: index })));
    if (editingCarousel?.id === item.id) setEditingCarousel(null);
  };
  const removeSlide = (item) => {
    if (!item) return;
    setSlides((current) => current.filter((value) => value.id !== item.id).map((value, index) => ({ ...value, sortOrder: index })));
    if (!item.id.startsWith('local-')) setRemovedSlideIds((current) => current.includes(item.id) ? current : [...current, item.id]);
    if (editingSlide?.id === item.id) setEditingSlide(null);
  };

  const selectCarouselReport = (albumId) => {
    const selected = reports.find((value) => value.id === albumId);
    setEditingCarousel((current) => ({
      ...current, albumId,
      ...(selected ? { overrideTitle: selected.albumTitle, overrideSummary: selected.albumDescription || '', overrideImageUrl: selected.coverImageUrl, eventTimeSnapshot: selected.periodText || '' } : {}),
    }));
  };

  return (
    <AdminPage eyebrow="Homepage Studio" title="首頁設定" description="管理首頁背景幻燈片、店舖資訊、店內規則與慶典情報輪播。導覽列與 Footer 維持系統固定，不在此開放編輯。" actions={<AdminButton onClick={saveAll} disabled={saving}>{saving ? '儲存中…' : '儲存全部變更'}</AdminButton>}>
      {message ? <div className="adminNotice">{message}</div> : null}
      <AdminState loading={state.loading} error={state.error} onRetry={load} />
      {!state.loading && !state.error ? <>
        <AdminPanel title="店舖基本資訊" description="這些欄位會對應公開首頁內容。導覽列與 Footer 不在此編輯。" className="adminFormPanel">
          <div className="adminFormGrid">
            <AdminField label="店名"><input value={site.name} onChange={(event) => updateSite('name', event.target.value)} /></AdminField>
            <AdminField label="英文／簡稱"><input value={site.shortName} onChange={(event) => updateSite('shortName', event.target.value)} /></AdminField>
            <AdminField label="副標題" className="span-2"><input value={site.subtitle} onChange={(event) => updateSite('subtitle', event.target.value)} /></AdminField>
            <AdminField label="營業狀態"><input value={site.businessStatus} onChange={(event) => updateSite('businessStatus', event.target.value)} /></AdminField>
            <AdminField label="營業時間"><input value={site.openHours} onChange={(event) => updateSite('openHours', event.target.value)} /></AdminField>
            <AdminField label="Server"><input value={site.server} onChange={(event) => updateSite('server', event.target.value)} /></AdminField>
            <AdminField label="地址"><input value={site.address} onChange={(event) => updateSite('address', event.target.value)} /></AdminField>
            <AdminField label="入場說明" className="span-2"><input value={site.entryNote} onChange={(event) => updateSite('entryNote', event.target.value)} /></AdminField>
            <AdminField label="關於我們（段落之間空一行）" className="span-2"><textarea rows="7" value={site.aboutText} onChange={(event) => updateSite('aboutText', event.target.value)} /></AdminField>
            <AdminField label="價格備註" className="span-2"><textarea rows="3" value={site.pricingNote} onChange={(event) => updateSite('pricingNote', event.target.value)} /></AdminField>
          </div>
        </AdminPanel>

        <AdminPanel title="首頁背景幻燈片" description="拖曳卡片調整播放順序；點擊卡片開啟圖片預覽與編輯。圖片會在儲存全部變更時才上傳。" actions={<AdminButton variant="secondary" onClick={addSlide}>新增幻燈片</AdminButton>}>
          <AdminDragList
            items={slides}
            onReorder={setSlides}
            onItemClick={(item) => setEditingSlide({ ...item })}
            renderItem={(item) => <><div className="adminDragCardWithImage">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}<div><strong>{item.imageUrl ? '首頁背景圖片' : (item._file?.name || '尚未選擇圖片')}</strong><small>第 {Number(item.sortOrder) + 1} 張 · 播放 {Number(item.displaySeconds) || 10} 秒</small></div></div><div className="adminDragCardMeta"><AdminButton variant="danger" onClick={(event) => { event.stopPropagation(); removeSlide(item); }}>刪除</AdminButton></div></>}
            emptyText="尚無首頁幻燈片，請新增第一張圖片。"
          />
        </AdminPanel>

        <AdminPanel title="店內規則" description="拖曳卡片調整首頁規則順序；點擊卡片開啟編輯。" actions={<AdminButton variant="secondary" onClick={addRule}>新增規則</AdminButton>}>
          <AdminDragList
            items={rules}
            onReorder={setRules}
            onItemClick={(item) => setEditingRule({ ...item })}
            renderItem={(item) => <><div><strong>{item.ruleText || '未命名規則'}</strong><small>{item.ruleNote || '沒有補充說明'}</small></div><div className="adminDragCardMeta"><em>{item.isEnabled ? '啟用' : '停用'}</em><AdminButton variant="danger" onClick={(event) => { event.stopPropagation(); removeRule(item); }}>刪除</AdminButton></div></>}
            emptyText="尚無店內規則，請新增第一筆。"
          />
        </AdminPanel>

        <AdminPanel title="首頁週報輪播" description="首頁輪播只選擇艾歐澤亞週報；拖曳卡片調整順序，點擊卡片開啟編輯，圖片會在儲存全部變更時才上傳。" actions={<AdminButton variant="secondary" onClick={addCarousel} disabled={!reports.length}>新增輪播</AdminButton>}>
          <AdminDragList
            items={carousels}
            onReorder={setCarousels}
            onItemClick={(item) => setEditingCarousel({ ...item })}
            renderItem={(item) => <><div className="adminDragCardWithImage">{item.overrideImageUrl ? <img src={item.overrideImageUrl} alt="" /> : null}<div><strong>{item.overrideTitle || '未命名輪播'}</strong><small>{item.overrideSummary || '沒有摘要'}</small></div></div><div className="adminDragCardMeta"><em>{item.isEnabled ? '啟用' : '停用'}</em><AdminButton variant="danger" onClick={(event) => { event.stopPropagation(); removeCarousel(item); }}>刪除</AdminButton></div></>}
            emptyText="尚無首頁輪播，請新增第一筆。"
          />
        </AdminPanel>
      </> : null}

      <AdminDialog open={Boolean(editingRule)} title={editingRule?.id?.startsWith('local-') ? '新增店內規則' : '編輯店內規則'} onClose={() => setEditingRule(null)} actions={<><AdminButton variant="ghost" onClick={() => setEditingRule(null)}>取消</AdminButton><AdminButton onClick={saveRuleEditor}>完成編輯</AdminButton></>}>
        {editingRule ? <div className="adminFormGrid"><AdminField label="規則" className="span-2"><input value={editingRule.ruleText} onChange={(event) => updateRuleEditor('ruleText', event.target.value)} autoFocus /></AdminField><AdminField label="補充說明" className="span-2"><textarea rows="4" value={editingRule.ruleNote || ''} onChange={(event) => updateRuleEditor('ruleNote', event.target.value)} /></AdminField><div className="adminFormWide"><AdminToggle checked={editingRule.isEnabled} onChange={(value) => updateRuleEditor('isEnabled', value)} /></div></div> : null}
      </AdminDialog>

      <AdminDialog open={Boolean(editingCarousel)} title={editingCarousel?.id?.startsWith('local-') ? '新增首頁輪播' : '編輯首頁輪播'} description="排序請回到卡片清單拖曳調整。" onClose={() => setEditingCarousel(null)} actions={<><AdminButton variant="ghost" onClick={() => setEditingCarousel(null)}>取消</AdminButton><AdminButton onClick={saveCarouselEditor}>完成編輯</AdminButton></>}>
        {editingCarousel ? <div className="adminFormGrid"><AdminField label="對應週報" className="span-2"><select value={editingCarousel.albumId || ''} onChange={(event) => selectCarouselReport(event.target.value)}>{reports.map((report) => <option key={report.id} value={report.id}>{report.albumTitle}</option>)}</select></AdminField><AdminField label="首頁標題"><input value={editingCarousel.overrideTitle} onChange={(event) => updateCarouselEditor('overrideTitle', event.target.value)} /></AdminField><AdminField label="時間文字"><input value={editingCarousel.eventTimeSnapshot || ''} onChange={(event) => updateCarouselEditor('eventTimeSnapshot', event.target.value)} /></AdminField><AdminField label="首頁摘要" className="span-2"><textarea rows="4" value={editingCarousel.overrideSummary} onChange={(event) => updateCarouselEditor('overrideSummary', event.target.value)} /></AdminField><AdminField label="按鈕文字"><input value={editingCarousel.ctaLabel || ''} onChange={(event) => updateCarouselEditor('ctaLabel', event.target.value)} /></AdminField><AdminImagePicker label="首頁輪播圖片覆寫" value={editingCarousel.overrideImageUrl} pendingFile={editingCarousel._file} onChange={(file) => updateCarouselEditor('_file', file)} onClear={() => { updateCarouselEditor('_file', null); updateCarouselEditor('overrideImageUrl', ''); updateCarouselEditor('overrideMediaId', null); }} /><div className="adminFormWide"><AdminToggle checked={editingCarousel.isEnabled} onChange={(value) => updateCarouselEditor('isEnabled', value)} /></div></div> : null}
      </AdminDialog>

      <AdminDialog open={Boolean(editingSlide)} title={editingSlide?.id?.startsWith('local-') ? '新增首頁幻燈片' : '編輯首頁幻燈片'} description="圖片會先在本機預覽，按下首頁的儲存按鈕後才會上傳。排序請回到卡片清單拖曳調整。" onClose={() => setEditingSlide(null)} actions={<><AdminButton variant="ghost" onClick={() => setEditingSlide(null)}>取消</AdminButton><AdminButton onClick={saveSlideEditor}>完成編輯</AdminButton></>}>
        {editingSlide ? <div className="adminFormGrid"><AdminImagePicker label="背景圖片" value={editingSlide.imageUrl} pendingFile={editingSlide._file} onChange={(file) => updateSlideEditor('_file', file)} onClear={() => { updateSlideEditor('_file', null); updateSlideEditor('imageUrl', ''); updateSlideEditor('mediaId', null); }} /><AdminField label="播放秒數"><input type="number" min="1" max="60" value={editingSlide.displaySeconds || 10} onChange={(event) => updateSlideEditor('displaySeconds', event.target.value)} /></AdminField><div><AdminToggle checked={editingSlide.isEnabled} onChange={(value) => updateSlideEditor('isEnabled', value)} label="公開播放" /></div></div> : null}
      </AdminDialog>
    </AdminPage>
  );
}
