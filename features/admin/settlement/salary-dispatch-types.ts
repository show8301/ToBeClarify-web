export type SalaryDispatchItem = {
  staffId: string;
  displayName: string;
  salary: number;
  isPaid: boolean;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
};

export type SalaryDispatch = {
  businessDate: string;
  sessionNo: number;
  settlementId: string | null;
  finalized: boolean;
  correctionVersion: number;
  inputVersion: number;
  items: SalaryDispatchItem[];
};

export type SaveSalaryDispatchRequest = {
  businessDate: string;
  sessionNo: number;
  settlementId: string;
  staffId: string;
  isPaid: boolean;
  expectedVersion: number;
  expectedCorrectionVersion: number;
  expectedInputVersion: number;
  operationId: string;
};
