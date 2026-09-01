const DEFAULT_PUBLIC_CLIENT_API_BASE_URL = "https://api.marchgroup.net/api/client";
const DEFAULT_ADMIN_API_BASE_URL = "https://api.marchgroup.net/api/admin";
const DEFAULT_ORDERING_API_BASE_URL = "https://api.marchgroup.net/api/client/ordering";
const DEFAULT_PUBLIC_MEDIA_BASE_URL = "https://api.marchgroup.net/api/client/media";

function normalizeBaseUrl(value: string | undefined, fallback: string) {
  return (value?.trim() || fallback).replace(/\/$/, "");
}

export function getPublicClientApiBaseUrl() {
  return normalizeBaseUrl(process.env.PUBLIC_CLIENT_API_BASE_URL, DEFAULT_PUBLIC_CLIENT_API_BASE_URL);
}

export function getAdminApiBaseUrl() {
  return normalizeBaseUrl(process.env.ADMIN_API_BASE_URL, DEFAULT_ADMIN_API_BASE_URL);
}

export function getOrderingApiBaseUrl() {
  return normalizeBaseUrl(process.env.ORDERING_API_BASE_URL, DEFAULT_ORDERING_API_BASE_URL);
}

export function getPublicMediaBaseUrl() {
  return normalizeBaseUrl(process.env.PUBLIC_MEDIA_BASE_URL, DEFAULT_PUBLIC_MEDIA_BASE_URL);
}

export function publicClientApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getPublicClientApiBaseUrl()}${normalizedPath}`;
}
