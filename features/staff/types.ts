export type Service = {
  id:string; serviceName:string; serviceDescription:string; priceText:string|null;
  price:number|null; durationMinutes:number|null; isNominatable:boolean; additionalPersonPrice:number|null;
};
export type GalleryImage = { id:string; imageUrl:string; thumbnailUrl?:string|null };
export type StaffSummary = {
  id:string; displayName:string; nickname:string|null; avatarUrl:string|null; signatureUrl?:string|null; roleTitle:string|null;
  shortBio:string; profileBio?:string|null; isWorkingToday:boolean; currentStatus:string; statusText:string;
  isNominatable:boolean;
  commonServices:Service[]; specialServices:Service[];
};
export type StaffDetail = StaffSummary & { profileBio:string|null; gallery:GalleryImage[] };
export type StaffDutyStatus = {
  id: string;
  isWorkingToday: boolean;
  currentStatus: "off" | "busy" | "available";
  statusText: string;
  isNominatable: boolean;
  nominationStatus?: string;
};
