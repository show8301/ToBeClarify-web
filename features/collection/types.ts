export type CollectionAccess =
  | { claimCode: string; customerUid?: never }
  | { claimCode?: never; customerUid: string };

export type CollectionAsset = {
  id: string;
  kind: "image" | "link";
  label: string;
  url: string | null;
  contentType: string | null;
  byteSize: number;
  createdAt: string;
};

export type CollectionWork = {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "ready" | "delivered" | "cancelled";
  dueDate: string | null;
  createdAt: string;
  deliveredAt: string | null;
  assets: CollectionAsset[];
};

export type CollectionPageResult = {
  items: CollectionWork[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};
