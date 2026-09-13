import type { GuestbookAuthor } from "@/features/guestbook/types";

export const AUTHOR_LABELS: Record<GuestbookAuthor, string> = {
  customer: "客人",
  staff: "店員本人",
  mascot: "吉祥物",
  anonymous_staff: "匿名店員",
};

export const ACTION_LABELS: Record<string, string> = {
  create: "新增留言",
  edit: "編輯留言",
  moderate: "調整顯示／回覆／置頂狀態",
  reorder: "調整置頂順序",
  settings: "更新設定",
};

export const SECONDARY_BUTTON_CLASS = "adminButton adminButton-secondary";

export function adminGuestbookTime(value: string) {
  return value.replace("T", " ").slice(0, 19);
}
