"use client";

import { Save } from "lucide-react";
import { AdminButton } from "@/features/admin/shared/AdminButton";

type Props = {
  location: string;
  note: string;
  loading: boolean;
  onLocationChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSave: () => void;
};

export function OrderCustomerDetails({ location, note, loading, onLocationChange, onNoteChange, onSave }: Props) {
  return <div className="adminOrderCustomerDetails">
    <label><span>顧客位置</span><input maxLength={200} value={location} onChange={(event) => onLocationChange(event.target.value)} placeholder="尚未提供位置" /></label>
    <label><span>顧客備註</span><textarea maxLength={500} rows={2} value={note} onChange={(event) => onNoteChange(event.target.value)} /></label>
    <AdminButton variant="secondary" className="iconActionButton" disabled={loading} aria-label="儲存位置與備註" title="儲存位置與備註" onClick={onSave}>
      <Save aria-hidden="true" />
    </AdminButton>
  </div>;
}
