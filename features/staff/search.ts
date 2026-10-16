import type { StaffSummary } from "./types";

export type StaffSearchMatch = { label: string; excerpt: string };

function excerpt(text: string, query: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  const position = compact.toLowerCase().indexOf(query);
  const start = Math.max(0, position - 16);
  const end = Math.max(start + 72, position + query.length);
  return `${start ? "…" : ""}${compact.slice(start, end)}${compact.length > end ? "…" : ""}`;
}

// Match fields separately so text spanning two unrelated fields cannot produce a hit.
export function matchStaffSearch(person: StaffSummary, query: string): StaffSearchMatch | false | null {
  if (!query) return null;
  const contains = (text: string | null | undefined) => Boolean(text?.toLowerCase().includes(query));
  if ([person.displayName, person.nickname, person.roleTitle, person.shortBio].some(contains)) return null;

  for (const service of [...(person.commonServices ?? []), ...(person.specialServices ?? [])]) {
    if (contains(service.serviceName)) return { label: "符合服務", excerpt: service.serviceName };
    if (contains(service.serviceDescription)) {
      return { label: `服務說明 · ${service.serviceName}`, excerpt: excerpt(service.serviceDescription, query) };
    }
  }
  if (contains(person.profileBio)) {
    return { label: "人物介紹", excerpt: excerpt(person.profileBio ?? "", query) };
  }
  return false;
}
