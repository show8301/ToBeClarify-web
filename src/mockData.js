const image = (text, width = 1400, height = 900) => {
  const label = encodeURIComponent(text);
  return `https://imagefaker.access.mx.com/${width}x${height}/15151c/ff2e88/?text=${label}&font=noto`;
};

export const navigationItems = [
  { label: '首頁', href: '/home' },
  { label: '店員珍藏', href: '/staff' },
  { label: '慶典情報', href: '/event' },
  { label: '艾歐澤亞週報', href: '/gallery' },
  { label: '留聲機', href: '/guestbook' },
  { label: '店舖動態', href: '/liveupdate' },
  {
    label: '榮譽殿堂',
    href: '/staffRanking',
    children: [
      { label: '店員榜', href: '/staffRanking' },
      { label: '消費榜', href: '/monetaryRanking' },
    ],
  },
];

export const shopInfo = {
  name: '35女王古殿',
  shortName: 'Twilight Salon',
  subtitle: '一處替旅人留燈的深夜貴賓廳，提供陪伴、談心、占卜與沉浸式 RP 接待。',
  businessStatus: '今日營業 21:30 開席',
  openHours: '每週五、六 21:30 - 24:00',
  server: 'Elemental / Aegis',
  address: '薰衣草苗圃 第 12 區 斜坡小屋',
  entryNote: '入場前請先閱讀消費說明與 RP 禮儀',
  about: [
    '35女王古殿是一間以深夜貴賓廳為主題的 FF14 RP 店，提供陪談、指名陪伴、活動企劃與角色沉浸式互動。',
    '我們位於 Elemental / Aegis，薰衣草苗圃第 12 區斜坡小屋，歡迎想放慢腳步的冒險者入席。',
    '店內重視彼此尊重與舒適節奏，第一次來訪也可以由店員協助說明入場、指名與拍照流程。',
  ],
  footerText: '燭火、杯影與低聲的故事，為每位來訪者保留一席安靜的夜晚。',
  heroImage: image('35女王古殿 Hero'),
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
      { name: '星盤短占', description: '以角色設定與當晚情境抽取短籤，延伸一段適合入戲的占星回饋。', price: '60,000 Gil' },
      { name: '角色背景共創', description: '陪同梳理角色過往、人際關係與入店動機，適合想補完設定的冒險者。', price: '80,000 Gil' },
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
      { name: '即興劇情開場', description: '由店員替客人建立一段開場衝突或相遇橋段，降低第一次互動的尷尬感。', price: '70,000 Gil' },
      { name: '吧台秘飲 RP', description: '依角色心情調製一杯店內秘飲，並以飲品作為短篇對話主題。', price: '55,000 Gil' },
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
      { name: '棚拍陪同', description: '陪同挑選店內棚景、協助安排站位與氛圍，適合留下完整活動紀念。', price: '75,000 Gil' },
      { name: '紀念照構圖', description: '提供雙人或多人合照構圖建議，讓照片更符合角色關係與場景故事。', price: '65,000 Gil' },
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
      { name: '初訪導覽', description: '說明入場、指名、包廂與拍照流程，適合第一次接觸 RP 店的客人。', price: '40,000 Gil' },
      { name: '貴賓廳儀式 RP', description: '以正式迎賓、席間禮儀與送客橋段組成完整貴賓廳體驗。', price: '90,000 Gil' },
    ],
  },
];

export const events = [
  {
    id: 'moon-toast',
    title: '月下祝杯夜',
    summary: '以月光、低酒精調飲與雙人短談為主題的週末限定場。',
    period: '2026/07/03 - 2026/07/04',
    endAt: '2026-07-04',
    status: '生效中',
    imageUrl: image('月下祝杯夜'),
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
    endAt: '2026-07-12',
    status: '生效中',
    imageUrl: image('水晶留信企劃'),
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
    endAt: '2026-05-25',
    status: '已失效',
    imageUrl: image('燼火小舞會'),
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
    endAt: '2026-04-13',
    status: '已失效',
    imageUrl: image('舊日沙龍夜'),
    details: ['這筆資料用於驗證過期活動不顯示。'],
  },
];

export const galleryItems = [
  {
    id: 'moon-toast-gallery',
    title: '月下祝杯夜',
    period: '2026/07/03 - 2026/07/04',
    endAt: '2026-07-04',
    description: '以月光、低酒精調飲與雙人短談為主題的週末限定花絮。',
    imageUrl: image('月下祝杯夜 花絮', 900, 700),
    details: [
      '本輯收錄月下祝杯夜的吧台佈置、座席燭光、店員互動與客人紀念照。',
      '照片以活動氛圍展示為主，正式上線後可接後台審核與公開狀態。',
    ],
    photos: [
      image('月下祝杯 01', 900, 1200),
      image('月下祝杯 02', 1200, 800),
      image('月下祝杯 03', 800, 1100),
      image('月下祝杯 04', 1100, 900),
      image('月下祝杯 05', 900, 900),
      image('月下祝杯 06', 1200, 1000),
      image('月下祝杯 07', 800, 1000),
      image('月下祝杯 08', 1100, 760),
    ],
  },
  {
    id: 'crystal-letter-gallery',
    title: '水晶留信企劃',
    period: '2026/06/21 - 2026/07/12',
    endAt: '2026-07-12',
    description: '匿名短箋、朗讀席與水晶燈影構成的活動紀錄。',
    imageUrl: image('水晶留信企劃 花絮', 900, 700),
    details: [
      '花絮聚焦留言卡、朗讀桌、店內水晶裝飾與活動期間的安靜角落。',
      '為避免暴露客人資訊，正式資料應只展示已審核的公開投稿。',
    ],
    photos: [
      image('水晶留信 01', 900, 1100),
      image('水晶留信 02', 1200, 780),
      image('水晶留信 03', 840, 1050),
      image('水晶留信 04', 1100, 1100),
      image('水晶留信 05', 900, 760),
      image('水晶留信 06', 1200, 900),
    ],
  },
  {
    id: 'ember-ball-gallery',
    title: '燼火小舞會',
    period: '2026/05/24 - 2026/05/25',
    endAt: '2026-05-25',
    description: '已超過一個月的活動相簿，依規格不顯示於列表。',
    imageUrl: image('燼火小舞會 花絮', 900, 700),
    details: ['這筆資料保留作為過期過一個月相簿不顯示的測試資料。'],
    photos: [image('燼火小舞會 01', 900, 700)],
  },
];

export const guestbookMessages = [
  {
    id: 'PIN-001',
    authorId: '暮光櫃台',
    message: '歡迎留下不含現實個資的 RP 感想。正式版會接審核流程，第一版僅作畫面展示。',
    createdAt: '2026-07-01T20:40:00+08:00',
    isPinned: true,
  },
  {
    id: 'PIN-002',
    authorId: '店內公告',
    message: '留言請保持角色內禮儀，避免攻擊性文字、過度越界內容或破壞他人沉浸體驗。',
    createdAt: '2026-07-01T20:30:00+08:00',
    isPinned: true,
  },
  ...Array.from({ length: 18 }, (_, index) => {
    const number = index + 1;
    const day = String(30 - (index % 8)).padStart(2, '0');
    const hour = String(23 - (index % 5)).padStart(2, '0');
    const minute = String((index * 7) % 60).padStart(2, '0');
    return {
      id: `MSG-${String(number).padStart(3, '0')}`,
      authorId: ['匿名旅人', '白銀鄉常客', '月下來客', '初訪冒險者'][index % 4],
      message: [
        '第一次來也不會緊張，店員把流程說得很清楚，整晚節奏很舒服。',
        '喜歡這裡的低光佈置，適合把角色故事慢慢講完。',
        '月下祝杯的氣氛很漂亮，短籤詩讓角色有了新的靈感。',
        '包廂陪談節奏剛好，適合想安靜聊天的晚上。',
      ][index % 4],
      createdAt: `2026-06-${day}T${hour}:${minute}:00+08:00`,
      isPinned: false,
    };
  }),
];

export const liveUpdate = {
  lastUpdatedAt: '2026-07-01T22:18:36+08:00',
  openSeats: [
    { id: 'A1', label: '開放席 A1', status: 'occupied', guestName: '白銀鄉常客', staffId: 'selene', position: { x: 24, y: 38 } },
    { id: 'A2', label: '開放席 A2', status: 'available', guestName: '', staffId: null, position: { x: 42, y: 34 } },
    { id: 'A3', label: '開放席 A3', status: 'occupied', guestName: '月下來客', staffId: 'noir', position: { x: 60, y: 39 } },
    { id: 'B1', label: '開放席 B1', status: 'available', guestName: '', staffId: null, position: { x: 30, y: 70 } },
    { id: 'B2', label: '開放席 B2', status: 'reserved', guestName: '預約席', staffId: 'ash', position: { x: 52, y: 68 } },
    { id: 'B3', label: '開放席 B3', status: 'available', guestName: '', staffId: null, position: { x: 74, y: 64 } },
  ],
  rooms: [
    { id: 'VIP-01', name: '月影包廂', status: 'occupied', guestName: '匿名旅人', staffId: 'ash' },
    { id: 'VIP-02', name: '水晶包廂', status: 'available', guestName: '', staffId: null },
    { id: 'VIP-03', name: '燭火包廂', status: 'reserved', guestName: '預約中', staffId: 'selene' },
  ],
  staffStatuses: [
    { staffId: 'selene', status: 'busy', label: '~23:00' },
    { staffId: 'noir', status: 'available', label: '空閒中' },
    { staffId: 'lumi', status: 'off', label: '未上班' },
    { staffId: 'ash', status: 'busy', label: '~22:45' },
  ],
};

export const staffRankings = [
  { staffId: 'selene', nominations: 86, declaration: '願每一位旅人都能在夜裡找到被溫柔接住的位置。' },
  { staffId: 'noir', nominations: 73 },
  { staffId: 'ash', nominations: 61 },
  { staffId: 'lumi', nominations: 48 },
];

export const guestRankings = [
  { guestId: 'Moonlit-042', totalAmount: 1860000, title: '月冠貴賓' },
  { guestId: 'Aegis-Tea-17', totalAmount: 1520000, title: '水晶贊助者' },
  { guestId: 'Lavender-09', totalAmount: 1285000, title: '燭光守望者' },
  { guestId: 'Silent-Guest-31', totalAmount: 940000 },
  { guestId: 'SilverBell-22', totalAmount: 810000 },
  { guestId: 'Nocturne-58', totalAmount: 680000 },
];
