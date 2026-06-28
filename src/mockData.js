const image = (text, width = 1400, height = 900) => {
  const label = encodeURIComponent(text);
  return `https://imagefaker.access.mx.com/${width}x${height}/15151c/ff2e88/?text=${label}&font=noto`;
};

export const navigationItems = [
  { label: '首頁', href: '/home' },
  { label: '店員珍藏', href: '/staff' },
  { label: '慶典情報', href: '/event' },
];

export const shopInfo = {
  name: '暮光沙龍',
  shortName: 'Twilight Salon',
  subtitle: '一處替旅人留燈的深夜貴賓廳，提供陪伴、談心、占卜與沉浸式 RP 接待。',
  businessStatus: '今日營業 21:30 開席',
  openHours: '每週五、六 21:30 - 24:00',
  server: 'Elemental / Aegis',
  address: '薰衣草苗圃 第 12 區 斜坡小屋',
  entryNote: '入場前請先閱讀消費說明與 RP 禮儀',
  about: [
    '暮光沙龍是一間以深夜貴賓廳為主題的 FF14 RP 店，提供陪談、指名陪伴、活動企劃與角色沉浸式互動。',
    '我們位於 Elemental / Aegis，薰衣草苗圃第 12 區斜坡小屋，歡迎想放慢腳步的冒險者入席。',
    '店內重視彼此尊重與舒適節奏，第一次來訪也可以由店員協助說明入場、指名與拍照流程。',
  ],
  footerText: '燭火、杯影與低聲的故事，為每位來訪者保留一席安靜的夜晚。',
  heroImage: image('暮光沙龍 Hero'),
  pricingNote: '第一版價格為 demo mock data，正式營運前可由後台或 API 維護。',
  pricing: [
    { name: '入場席費', price: '30,000 Gil' },
    { name: '指名陪伴', price: '50,000 Gil / 30min' },
    { name: '包廂預約', price: '120,000 Gil / 場' },
  ],
};

export const shopRules = [
  '店內全面禁止使用任何具有攻擊性、干擾他人 RP 體驗的技能與特效。',
  '點選女僕指名服務時，請尊重店員，嚴禁使用過度越軌的言詞或情感動作。',
  '拍照留念時請開啟 Gpose，並歡迎在社群平台上標註本店活動 Tag。',
  '若店內當前人數過多，包廂將採取計時 60 分鐘制，敬請冒險者配合。',
];

export const staffMembers = [
  {
    id: 'selene',
    nickname: '賽琳',
    role: '首席接待 / 占星談心',
    todayShift: '21:30 - 24:00',
    avatarUrl: image('賽琳 頭貼', 900, 1100),
    intro: '擅長安靜陪伴與夜談，會替旅人把混亂的心緒慢慢收束。',
    detail:
      '賽琳偏好低聲對話與角色內敘事，適合希望被溫柔接住、慢慢展開設定與心情的客人。她會先確認你的 RP 邊界，再安排談心節奏。',
    gallery: [
      image('賽琳 沙龍照', 1100, 1300),
      image('賽琳 生活照', 1200, 900),
      image('賽琳 夜談照', 1200, 900),
    ],
    commonServices: [
      { name: '迎賓陪談', price: '30,000 Gil' },
      { name: '雙人酒席', price: '45,000 Gil' },
      { name: '包廂陪伴', price: '120,000 Gil' },
    ],
    specialServices: [
      { name: '星盤短占', price: '60,000 Gil' },
      { name: '角色背景共創', price: '80,000 Gil' },
    ],
  },
  {
    id: 'noir',
    nickname: '諾亞',
    role: '吧台侍者 / 劇情引導',
    todayShift: '22:00 - 24:00',
    avatarUrl: image('諾亞 頭貼', 900, 1100),
    intro: '語氣俐落、節奏明快，適合想要一場有火花對談的客人。',
    detail:
      '諾亞擅長把日常閒聊推進成一段完整小劇情，能配合酒館、偵探、舊識重逢等 RP 情境，也能替害羞的客人開場。',
    gallery: [
      image('諾亞 沙龍照', 1100, 1300),
      image('諾亞 吧台照', 1200, 900),
      image('諾亞 劇情照', 1200, 900),
    ],
    commonServices: [
      { name: '迎賓陪談', price: '30,000 Gil' },
      { name: '雙人酒席', price: '45,000 Gil' },
      { name: '包廂陪伴', price: '120,000 Gil' },
    ],
    specialServices: [
      { name: '即興劇情開場', price: '70,000 Gil' },
      { name: '吧台秘飲 RP', price: '55,000 Gil' },
    ],
  },
  {
    id: 'lumi',
    nickname: '露米',
    role: '花廳陪伴 / 攝影協助',
    todayShift: '休假',
    avatarUrl: image('露米 頭貼', 900, 1100),
    intro: '輕快細膩，會替客人安排適合紀念照與短篇互動的氛圍。',
    detail:
      '露米熟悉店內光源與棚景，能帶客人完成一組角色紀念照，也適合想用短時間留下活動記憶的來訪者。',
    gallery: [
      image('露米 沙龍照', 1100, 1300),
      image('露米 棚拍照', 1200, 900),
      image('露米 紀念照', 1200, 900),
    ],
    commonServices: [
      { name: '迎賓陪談', price: '30,000 Gil' },
      { name: '雙人酒席', price: '45,000 Gil' },
      { name: '包廂陪伴', price: '120,000 Gil' },
    ],
    specialServices: [
      { name: '棚拍陪同', price: '75,000 Gil' },
      { name: '紀念照構圖', price: '65,000 Gil' },
    ],
  },
  {
    id: 'ash',
    nickname: '亞修',
    role: '貴賓廳管家 / 禮儀引導',
    todayShift: '21:30 - 23:30',
    avatarUrl: image('亞修 頭貼', 900, 1100),
    intro: '沉穩、重視儀式感，擅長替初訪客人說明店內節奏。',
    detail:
      '亞修適合第一次接觸 RP 店的客人。他會清楚說明入場、點單、指名與互動邊界，讓整晚流程更穩定。',
    gallery: [
      image('亞修 沙龍照', 1100, 1300),
      image('亞修 貴賓廳', 1200, 900),
      image('亞修 導覽照', 1200, 900),
    ],
    commonServices: [
      { name: '迎賓陪談', price: '30,000 Gil' },
      { name: '雙人酒席', price: '45,000 Gil' },
      { name: '包廂陪伴', price: '120,000 Gil' },
    ],
    specialServices: [
      { name: '初訪導覽', price: '40,000 Gil' },
      { name: '貴賓廳儀式 RP', price: '90,000 Gil' },
    ],
  },
];

export const events = [
  {
    id: 'moon-toast',
    title: '月下祝杯夜',
    summary: '以月光、低酒精調飲與雙人短談為主題的週末限定場。',
    period: '2026/07/03 - 2026/07/04',
    status: '生效中',
    imageUrl: image('月下祝杯夜'),
    hiddenByAge: false,
    details: [
      '活動期間每位來客可獲得一張月色籤詩，由當班店員依籤詩延伸一段短篇 RP。',
      '本場適合想輕量體驗陪談、初次入店或與朋友一起參與的客人。',
      '包廂名額有限，建議提前於店舖動態確認當週安排。',
    ],
  },
  {
    id: 'crystal-letter',
    title: '水晶留信企劃',
    summary: '替指定角色留下一封匿名短箋，活動結束後由店員朗讀或轉交。',
    period: '2026/06/21 - 2026/07/12',
    status: '生效中',
    imageUrl: image('水晶留信企劃'),
    hiddenByAge: false,
    details: [
      '客人可在店內填寫一封不含現實個資的角色短箋，指定公開朗讀或私下轉交。',
      '內容需符合店內 RP 禮儀，工作人員會保留審核與婉拒權利。',
    ],
  },
  {
    id: 'ember-ball',
    title: '燼火小舞會',
    summary: '已結束的舞會主題夜，保留給想回顧規則與照片的客人。',
    period: '2026/05/24 - 2026/05/25',
    status: '已失效',
    imageUrl: image('燼火小舞會'),
    hiddenByAge: false,
    details: [
      '燼火小舞會已結束，第一版 demo 保留一個失效活動案例。',
      '過期超過一個月的活動會在前端資料層排除，不再顯示於列表。',
    ],
  },
  {
    id: 'old-salon',
    title: '舊日沙龍夜',
    summary: '超過一個月的歷史活動，依規格不顯示於活動列表。',
    period: '2026/04/12 - 2026/04/13',
    status: '已失效',
    imageUrl: image('舊日沙龍夜'),
    hiddenByAge: true,
    details: ['這筆資料用於驗證過期活動不顯示。'],
  },
];

export const galleryItems = [
  {
    title: '月下祝杯佈置預覽',
    category: '活動',
    description: '吧台周邊將以低光燭台與淡紫花材裝飾。',
    imageUrl: image('月下祝杯佈置預覽', 900, 700),
  },
  {
    title: '貴賓廳棚景測試',
    category: '店員',
    description: '為店員珍藏準備的沙龍照測試場景。',
    imageUrl: image('貴賓廳棚景測試', 900, 700),
  },
  {
    title: '週末散場紀錄',
    category: '日常',
    description: '營業結束後保留下來的一盞燈與留言卡。',
    imageUrl: image('週末散場紀錄', 900, 700),
  },
];

export const guestNotes = [
  {
    name: '匿名旅人',
    badge: '初訪',
    date: '2026/06/22',
    message: '第一次來也不會緊張，店員把流程說得很清楚，整晚節奏很舒服。',
  },
  {
    name: '白銀鄉的常客',
    badge: '回訪',
    date: '2026/06/15',
    message: '喜歡這裡的低光佈置，適合把角色故事慢慢講完。',
  },
];

export const updates = [
  {
    type: '班表',
    tone: 'success',
    title: '本週五營業確認',
    description: '賽琳、諾亞與亞修將於晚間 21:30 後陸續入席。',
    action: { label: '查看店員', href: '/staff' },
  },
  {
    type: '公告',
    tone: 'accent',
    title: '月下祝杯夜開放預約',
    description: '包廂名額採現場與預約並行，請留意活動頁說明。',
    action: { label: '查看活動', href: '/event' },
  },
  {
    type: '規劃',
    tone: 'muted',
    title: '後端專案預留',
    description: '正式版可由 C# API 提供店員、活動、班表與留言資料。',
  },
];
