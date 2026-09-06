export type RoomPhoto = {
  id:string;
  mediaId:string|null;
  imageUrl:string;
  sortOrder:number;
};

export type Room = {
  id:string;
  roomName:string;
  shortDescription:string;
  detailContent:string|null;
  ownershipType:"common"|"dedicated"|string;
  ownerStaffId:string|null;
  ownerStaffName:string|null;
  segmentMinutes:number;
  segmentPrice:number;
  photos:RoomPhoto[];
};

export type RoomsData = {
  segmentMinutes:number;
  rooms:Room[];
};

export type RoomStatus = {
  id:string;
  roomName:string;
  ownershipType:"common"|"dedicated"|string;
  ownerStaffName:string|null;
  currentStatus:"available"|"reserved"|"occupied"|string;
  statusText:string;
};
