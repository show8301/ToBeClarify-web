export type Service = { id:string; serviceName:string; serviceDescription:string; priceText:string|null };
export type GalleryImage = { id:string; imageUrl:string };
export type StaffSummary = {
  id:string; displayName:string; nickname:string|null; avatarUrl:string|null; roleTitle:string|null;
  shortBio:string; isWorkingToday:boolean; currentStatus:string; statusText:string;
  commonServices:Service[]; specialServices:Service[];
};
export type StaffDetail = StaffSummary & { profileBio:string|null; gallery:GalleryImage[] };
