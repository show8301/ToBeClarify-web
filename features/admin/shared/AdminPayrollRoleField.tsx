"use client";

import { useId } from "react";
import { AdminHelp } from "./AdminHelp";
import { isPayrollRole, payrollRoleOptions } from "./workRoles";
import type { PayrollRole } from "./workRoles";

type Props = {
  value: PayrollRole | "";
  onChange: (role: PayrollRole | "") => void;
  disabled: boolean;
  required: boolean;
  canUseManagerRole: boolean;
  canUseBackstage: boolean;
};

export function AdminPayrollRoleField({ value, onChange, disabled, required, canUseManagerRole, canUseBackstage }: Props) {
  const inputId = useId();
  return <div className="adminField">
    <div className="adminFieldHeading">
      <label htmlFor={inputId}>本班計薪職位{required && <b className="adminRequiredMark" aria-hidden="true">*</b>}</label>
      <AdminHelp title="本班計薪職位說明">每班只指定一個計薪職位，由經理核准，開始上班時鎖定；上班後更正須留下原因。幕後職位僅限開發人員。切換工作台或臨時支援不會改變此職位；舊班表尚未指定時，請先確認後選擇。</AdminHelp>
    </div>
    <select id={inputId} value={value} disabled={disabled} required={required} onChange={(event) => {
      const role = event.target.value;
      if (role === "" || isPayrollRole(role)) onChange(role);
    }}>
      <option value="">請選擇單一計薪職位</option>
      {((value === "backstage" && !canUseBackstage) || (value === "manager" && !canUseManagerRole)) ? <option value={value} disabled>原職位資格不足，請重新選擇</option> : null}
      {payrollRoleOptions.filter((option) => (option.id !== "manager" || canUseManagerRole) && (option.id !== "backstage" || canUseBackstage))
        .map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </div>;
}
