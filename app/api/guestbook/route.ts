import { guestbookProxy } from "@/features/guestbook/server/proxy";

export const GET = (request: Request) => guestbookProxy(request);
export const POST = (request: Request) => guestbookProxy(request);
