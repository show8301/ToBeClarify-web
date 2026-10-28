import type { OrderServiceCommand } from "./order-service-types";

export const pendingServiceCommands = new Map<string, OrderServiceCommand>();

export function clearPendingServiceCommands() {
  pendingServiceCommands.clear();
}
