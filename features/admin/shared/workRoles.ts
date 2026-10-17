export type SupportRole = "service" | "designated" | "backstage";
export type PayrollRole = SupportRole | "manager";

export const payrollRoleOptions: ReadonlyArray<{ id: PayrollRole; label: string }> = [
  { id: "service", label: "服務員" },
  { id: "designated", label: "指名人員" },
  { id: "manager", label: "經理" },
  { id: "backstage", label: "幕後" },
];

export function isPayrollRole(value: unknown): value is PayrollRole {
  return value === "service" || value === "designated" || value === "manager" || value === "backstage";
}

export function payrollRoleLabel(value: PayrollRole | null): string {
  return payrollRoleOptions.find((option) => option.id === value)?.label || "待經理確認";
}
