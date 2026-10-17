export type AdmissionCreationMode = "received" | "unpaid" | "waived";

export interface AdmissionPolicy {
  admissionAmount: number | null;
  version: number;
  mealCreditAmount: number;
  amountSource: "ordering_admission_policy";
  creditSource: "ordering_settings.minimum_meal_credit";
}

export interface AdmissionPreview {
  contractVersion: 1;
  businessPeriodId: string;
  businessDate: string;
  periodVersion: number;
  policyVersion: number;
  admissionAmount: number;
  mealCreditAmount: number;
  expiresAt: string;
  pricingRevision: string;
  confirmedCreationAvailable: boolean;
  legacyCreationAllowed: boolean;
}

export interface AdmissionConfirmation {
  businessPeriodId: string;
  pricingRevision: string;
  expiresAt: string;
  mode: AdmissionCreationMode;
  discountAmount: number;
  paymentConfirmed: boolean;
  confirmedReceivedAmount: number;
  reason?: string;
}

// The POST route is introduced in phase 2. Do not send this body to legacy
// POST /order-sessions: its binder cannot confirm or record an admission receipt.
export interface CreateAdmissionSessionRequest {
  operationId: string;
  gameId: string;
  serverName: string;
  customerName?: string | null;
  customerUid?: string | null;
  maxNominatedStaff?: number;
  admission: AdmissionConfirmation;
}

export interface AdmissionCreationResult {
  operationId: string;
  sessionId: string;
  admissionId: string;
  businessPeriodId: string;
  businessDate: string;
  admissionAmount: number;
  discountAmount: number;
  mealCreditAmount: number;
  admissionStatus: AdmissionCreationMode;
  receivedAmount: number;
  chargeRecordId: string | null;
  receiptRecordId: string | null;
  cashPeriodId: string | null;
  accountVersion: number;
  recordedAt: string;
  recordedBy: string;
  credentialAction: "explicit_reissue_if_needed";
}

export interface SaveAdmissionPolicyRequest {
  admissionAmount: number | null;
  expectedVersion: number;
  reason: string;
}

export type IssuedAdmissionSession = {
  session: { id: string; gameId: string; customerName: string };
  orderUrl: string;
  orderToken: string;
  recoveryCode: string;
  admission?: AdmissionCreationResult;
};
