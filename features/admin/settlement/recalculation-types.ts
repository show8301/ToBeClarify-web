import type { SettlementAnomaly } from "./types";

export type RecalculationChange = {
  staffId: string | null;
  displayName: string;
  role: string;
  previousMinutes: number | null;
  correctedMinutes: number | null;
  previousHours: number;
  correctedHours: number;
  previousPay: number;
  correctedPay: number;
  payDelta: number;
};

export type RecalculationBalance = {
  staffId: string;
  displayName: string;
  correctedPay: number;
  netPaid: number;
  manualCorrection: number;
  outstanding: number;
};

export type RecalculationPreview = {
  businessDate: string;
  sessionNo: number;
  sourceToken: string;
  correctionVersion: number;
  hasChanges: boolean;
  previousPayroll: number;
  correctedPayroll: number;
  payrollDelta: number;
  previousNetCash: number;
  correctedNetCash: number;
  previousCompanyIncome: number;
  correctedCompanyIncome: number;
  changes: RecalculationChange[];
  balances: RecalculationBalance[];
  anomalies: SettlementAnomaly[];
  existingCorrections: { staffId: string | null; amountDelta: number; reason: string }[];
};

export type RecalculationConfirmation = {
  businessDate: string;
  sessionNo: number;
  sourceToken: string;
  expectedCorrectionVersion: number;
  operationId: string;
  reason: string;
};

export type RecalculationHistory = {
  id: string;
  version: number;
  previousPayroll: number;
  correctedPayroll: number;
  payrollDelta: number;
  reason: string;
  actorId: string;
  createdAt: string;
};
