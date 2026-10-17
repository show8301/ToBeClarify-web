import { adminRequest } from "@/features/admin/api/client.js";
import { parseAdmissionCreated, parseAdmissionCreationResult, parseAdmissionPolicy, parseAdmissionPreview } from "./admission-creation-contract";
import type { CreateAdmissionSessionRequest, SaveAdmissionPolicyRequest } from "./admission-creation-types";

export const admissionCreationApi = {
  create: async (body: CreateAdmissionSessionRequest, signal?: AbortSignal) => parseAdmissionCreated(
    await adminRequest("/order-sessions/with-admission", { method: "POST", body: JSON.stringify(body), signal }),
  ),
  policy: async (signal?: AbortSignal) => parseAdmissionPolicy(
    await adminRequest("/order-session-admission-policy", { signal }),
  ),
  savePolicy: async (body: SaveAdmissionPolicyRequest, signal?: AbortSignal) => parseAdmissionPolicy(
    await adminRequest("/order-session-admission-policy", { method: "PUT", body: JSON.stringify(body), signal }),
  ),
  preview: async (signal?: AbortSignal) => parseAdmissionPreview(
    await adminRequest("/order-sessions/admission-preview", { signal }),
  ),
  operation: async (operationId: string, signal?: AbortSignal) => parseAdmissionCreationResult(
    await adminRequest(`/order-sessions/creation-operations/${encodeURIComponent(operationId)}`, { signal }),
  ),
};
