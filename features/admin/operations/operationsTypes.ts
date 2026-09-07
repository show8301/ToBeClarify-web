export type DashboardRole = "designated" | "service" | "manager" | "developer";

export type CurrentAdminUser = {
  displayName: string;
  role: string;
  roleLabel: string;
  staffMemberId: string;
};

export type OperationsContext = {
  referenceBusinessDate: string;
  referenceStartsAt: string;
  referenceEndsAt: string;
  periodStatus: string;
  intakeMode: string;
  orderingOpen: boolean;
  projectedCloseAt: string;
  actualOpenedAt: string;
  waitingOrderCount: number;
  unfinishedOrderCount: number;
  openSessionCount: number;
  latestCommittedBusyUntil: string;
};

export type OperationsSession = {
  id: string;
  customerName: string;
  gameId: string;
  status: string;
  orderCount: number;
  waitingOrderCount: number;
  confirmedOrderCount: number;
  totalAmount: number;
  lastOrderedAt: string;
};

export type OperationsNominee = {
  id: string;
  staffId: string;
  staffName: string;
  serviceName: string;
  segmentCount: number;
  requestedStartsAt: string;
  requestedServiceEndsAt: string;
  busyUntil: string;
  confirmationStatus: string;
};

export type OperationsAddon = {
  id: string;
  staffId: string;
  staffName: string;
  serviceName: string;
  status: string;
};

export type OperationsOrder = {
  id: string;
  sessionId: string;
  customerName: string;
  gameId: string;
  orderNumber: string;
  orderKind: string;
  status: string;
  storeConfirmationStatus: string;
  queueStage: string;
  queueMinutes: number;
  submittedAt: string;
  totalAmount: number;
  customerNote: string;
  nominees: OperationsNominee[];
  addons: OperationsAddon[];
  roomBookings: Array<{ roomName: string; startsAt: string; endsAt: string; status: string }>;
};

export type OperationsRoomOrder = {
  id: string;
  roomName: string;
  startsAt: string;
  endsAt: string;
  segmentCount: number;
  totalAmount: number;
  status: string;
  note: string;
};

export type OperationsStaffMember = {
  id: string;
  displayName: string;
  roleTitle: string;
  statusText: string;
  isWorkingToday: boolean;
  isActive: boolean;
};

export type OperationsData = {
  context: OperationsContext | null;
  sessions: OperationsSession[];
  orders: OperationsOrder[];
  roomOrders: OperationsRoomOrder[];
  staff: OperationsStaffMember[];
};

export type OperationsActionState = {
  busyId: string;
  message: string;
  error: string;
};

export type OperationsAction = (
  id: string,
  request: () => Promise<unknown>,
  successMessage: string,
) => Promise<void>;
