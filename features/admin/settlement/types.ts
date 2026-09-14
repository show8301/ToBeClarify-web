export type SettlementRule = {
  id: string;
  dayType: string;
  effectiveFrom: string;
  designatedHourlyRate: number;
  serviceManagerHourlyRate: number;
  backstageHourlyRate: number;
  designatedSharePercentage: number;
  publicRoomStaffPercentage: number;
  dedicatedRoomOwnerPercentage: number;
  serviceManagerPoolPercentage: number;
  backstagePoolPercentage: number;
  companyPercentage: number;
  timeRoundMinutes: number;
  moneyRoundUnit: number;
  publicTipMode: string;
};

export type SettlementStaff = {
  id: string;
  displayName: string;
  roleTitle?: string | null;
  isActive: boolean;
  isWorkingToday?: boolean;
};

export type SettlementRun = {
  id: string;
  businessDate: string;
  sessionNo: number;
  dayType: string;
  status: string;
  publicTipAmount: number;
  admissionFeeOverride: number | null;
  activityExpense: number;
  companyShareHours: number | null;
  activityHoursConfirmed: boolean;
  businessPeriodId?: string | null;
  sourceVersion?: number;
  sourceCutoffAt?: string | null;
  cashReceived?: number;
  cashRefunded?: number;
  netCash?: number;
  retainedAmount?: number;
  pendingFinanceCount?: number;
  correctsSettlementId?: string | null;
  correctionVersion?: number;
};

export type SettlementSummary = {
  grossRevenue: number;
  designatedRevenueBase: number;
  companyRevenue: number;
  serviceManagerPool: number;
  backstagePool: number;
  companyIncome: number;
  totalPayroll: number;
  companySubsidy: number;
  cashReceived?: number;
  cashRefunded?: number;
  netCash?: number;
  retainedAmount?: number;
  pendingFinanceCount?: number;
};

export type SettlementWorkflow = {
  businessPeriodId?: string | null;
  periodStatus: string;
  intakeMode: string;
  unfinishedOrderCount: number;
  activeServiceCount: number;
  cashReceived: number;
  cashRefunded: number;
  netCash: number;
  retainedAmount: number;
  pendingFinanceCount: number;
  canStopNewOrders: boolean;
  canClose: boolean;
  canFinalize: boolean;
  canCarryForward: boolean;
};

export type SettlementResult = {
  staffId: string | null;
  displayName: string | null;
  role: string;
  basePay: number;
  revenueShare: number;
  designatedTip: number;
  publicTip: number;
  afterRounding: number;
  anomalyStatus: string;
  anomalyNote: string | null;
};

export type AttendanceBackfill = {
  id: string;
  staffId: string;
  staffName: string;
  role: string;
  requestedMinutes: number;
  reason: string;
  status: string;
};
