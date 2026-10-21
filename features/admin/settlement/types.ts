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
  inputVersion?: number;
  calculationVersion?: number;
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
  activityNetRevenue: number;
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
  pendingFinanceItems?: {
    sessionId: string;
    customerName: string;
    orderId: string | null;
    orderNumber: string | null;
    pendingRecordCount: number;
  }[] | null;
  canStopNewOrders: boolean;
  canClose: boolean;
  canFinalize: boolean;
  canCarryForward: boolean;
};

export type SettlementResult = {
  staffId: string | null;
  displayName: string | null;
  role: string;
  payableHours: number;
  hourlyRate: number;
  basePay: number;
  revenueBase: number;
  revenuePercentage: number;
  revenueShare: number;
  designatedTip: number;
  publicTip: number;
  preferredPay: number;
  beforeRounding: number;
  afterRounding: number;
  sourceDetailsSnapshotted?: boolean;
  sources?: SettlementResultSource[] | null;
  anomalyStatus: string;
  anomalyNote: string | null;
};

export type SettlementResultSource = {
  kind: "designated_revenue" | "designated_tip" | "public_tip";
  orderId: string;
  orderNumber: string;
  label: string;
  orderItemId?: string | null;
  itemName?: string | null;
  originalAmount?: number | null;
  orderPayableAmount?: number | null;
  orderCollectedAmount?: number | null;
  cancelledAmount?: number | null;
  mealCreditAmount?: number | null;
  afterCreditAmount?: number | null;
  orderRevenueAmount?: number | null;
  adjustedRevenueAmount?: number | null;
  basisAmount: number;
  percentage: number;
  amount: number;
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

export type SettlementStaffInput = {
  payrollSnapshotVersion?: number | null;
  staffId: string;
  displayName: string;
  roleTitle?: string | null;
  role: string;
  isWorking: boolean;
  actualMinutes: number;
  activityHours?: number | null;
  payableHours: number;
  publicTipEligible: boolean;
  isBackstageParticipant: boolean;
  attendanceSource: "manual" | "clock" | "backfill_approved";
  attendanceRequestId?: string | null;
  attendanceBackfillStatus?: string | null;
  attendanceBackfillReason?: string | null;
  note?: string | null;
};

export type SettlementTab = "operations" | "personal" | "settings";

export type SettlementAnomaly = {
  code: string;
  message: string;
  sourceId?: string | null;
  staffName?: string | null;
  orders?: { orderId: string; orderNumber: string }[] | null;
  sessionId?: string | null;
  customerName?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
  financeSources?: SettlementFinanceSource[] | null;
};

export type SettlementFinanceSource = {
  id: string;
  sourceKind: string;
  kind: string;
  amount: number;
  reason: string | null;
  allocationStatus: string;
  holdScope: string;
  orderId: string | null;
  orderNumber: string | null;
  orderItemId: string | null;
  itemName: string | null;
};

export type SettlementPayrollAssignment = {
  staffId: string; displayName: string; payrollRole: string | null; payrollSnapshotVersion: number | null;
  canUseBackstage: boolean; startedAt: string | null;
};

export type SettlementPublicTipPool = {
  recognizedAmount: number;
  distributableAmount: number;
  sources: { orderId: string; orderNumber: string; originalAmount: number; orderPayableAmount: number;
    orderCollectedAmount: number; recognizedAmount: number; status: string }[];
  legacyStoreSources?: SettlementPublicTipPool["sources"] | null;
};

export type SettlementOverview = {
  publicTipPool?: SettlementPublicTipPool | null;
  pendingPayrollRoleCorrections?: { staffId: string; displayName: string; beforeRole: string; afterRole: string }[];
  payrollAssignments?: SettlementPayrollAssignment[];
  run: SettlementRun;
  rule: SettlementRule;
  summary: SettlementSummary;
  staffInputs: SettlementStaffInput[];
  results: SettlementResult[];
  anomalies: SettlementAnomaly[];
  attendanceBackfillRequests: AttendanceBackfill[];
  workflow?: SettlementWorkflow | null;
  pendingOrderBackfillCount?: number;
};

export type SettlementRunFields = {
  publicTipReconciliationReason?: string;
  publicTipAmount: number;
  admissionFeeOverride: string;
  activityExpense: number;
  companyShareHours: string;
  activityHoursConfirmed: boolean;
};

export type SettlementBackfillReview = {
  request: AttendanceBackfill;
  approved: boolean;
  businessDate: string;
  sessionNo: number;
};
