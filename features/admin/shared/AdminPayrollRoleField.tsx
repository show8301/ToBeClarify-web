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
};

export function AdminPayrollRoleField({ value, onChange, disabled, required, canUseManagerRole }: Props) {
  const inputId = useId();
  return <div className="adminField">
    <div className="adminFieldHeading">
      <label htmlFor={inputId}>本班計薪職位{required && <b className="adminRequiredMark" aria-hidden="true">*</b>}</label>
      <AdminHelp title="本班計薪職位說明">每班只指定一個計薪職位，由經理核准。切換工作台或臨時支援不會改變此職位；舊班表尚未指定時，請先確認後選擇。</AdminHelp>
    </div>
    <select id={inputId} value={value} disabled={disabled} required={required} onChange={(event) => {
      const role = event.target.value;
      if (role === "" || isPayrollRole(role)) onChange(role);
    }}>
      <option value="">請選擇單一計薪職位</option>
      {payrollRoleOptions.filter((option) => option.id !== "manager" || canUseManagerRole)
        .map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </div>;
}
