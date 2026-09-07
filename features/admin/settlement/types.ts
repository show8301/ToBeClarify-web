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
