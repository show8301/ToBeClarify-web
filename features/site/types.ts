export type NavigationItem = {
  id:string;
  label:string;
  routePath:string;
  placement:string;
  isDropdown:boolean;
  children:NavigationItem[];
};

export type ShopInfo = {
  name:string;
  shortName:string;
  subtitle:string;
  businessStatus:string;
  openHours:string;
  server:string;
  address:string;
  entryNote:string;
  footerText:string;
  heroImage:string;
  about:string[];
  pricing:{name:string;price:string}[];
};

export type HomeSlide = { id:string; imageUrl:string; displaySeconds:number };
export type HomeCarousel = {
  id:string; albumId:string; title:string; summary:string; eventTime:string;
  ctaLabel:string; imageUrl:string; albumExists:boolean;
};
export type ShopRule = { id:string; ruleText:string; ruleNote:string|null };
export type LiveUpdateConfig = {
  lastUpdatedAt:string; scheduleStart:string; scheduleEnd:string; timeSlots:string[];
};

export type HomePageVisibility = {
  home:boolean;
  staff:boolean;
  gallery:boolean;
  menu:boolean;
  guestbook:boolean;
  liveUpdate:boolean;
  staffRanking:boolean;
  monetaryRanking:boolean;
};

export type HomeData = {
  shopInfo:ShopInfo;
  liveUpdateConfig:LiveUpdateConfig;
  pageVisibility:HomePageVisibility;
  /** @deprecated use pageVisibility.menu */
  menuHidden:boolean;
  navigation:NavigationItem[];
  shopRules:ShopRule[];
  slides:HomeSlide[];
  carousels:HomeCarousel[];
};

export type MenuItem = {
  id:string; itemName:string; itemDescription:string; price:number; priceText:string|null;
};
export type MenuCategory = {
  id:string; categoryName:string; categoryDescription:string; items:MenuItem[];
};
export type PricingRule = { id:string; title:string; description:string; priceText:string };
export type MenuSetItem = {
  id:string; menuItemId:string; itemName:string; itemRole:string; quantity:number;
};
export type MenuSet = {
  id:string; setName:string; setDescription:string; setPrice:number; imageUrl:string|null; items:MenuSetItem[];
};
export type MenuData = { categories:MenuCategory[]; pricingRules:PricingRule[]; sets:MenuSet[]; showSets?:boolean };

export type GalleryAlbumSummary = {
  id:string; albumTitle:string; albumDescription:string; coverImageUrl:string;
  periodText:string; endsAt:string;
};
export type GalleryPhoto = {
  id:string; imageUrl:string; thumbnailUrl:string; title:string; caption:string|null; shotAt:string;
};
export type GalleryAlbum = GalleryAlbumSummary & { details:string[]; items:GalleryPhoto[] };

export type RankingItem = {
  id:string; rankingType:"staffRanking"|"monetaryRanking"; targetId:string;
  displayName:string; avatar:string|null; titleBadge:string|null; rankPosition:number;
  scoreValue:number; scoreLabel:string; periodLabel:string;
};

export type StaffReservation = {
  id:string; staffId:string; serviceLabel:string; startsAt:string; endsAt:string; status:string;
};

export type GuestbookReply = {
  id:string; displayName:string; content:string; createdAt:string;
};
export type GuestbookComment = {
  id:string; displayName:string; content:string; isPinned:boolean; createdAt:string; replies:GuestbookReply[];
};
export type GuestbookPage = {
  items:GuestbookComment[]; page:number; pageSize:number; totalCount:number;
};

export type SiteSnapshot = {
  generatedAt:string;
  home:HomeData;
  menu:MenuData;
  albums:GalleryAlbumSummary[];
  albumDetails:Record<string,GalleryAlbum>;
  staffRanking:RankingItem[];
  monetaryRanking:RankingItem[];
  guestbook:GuestbookPage;
};
