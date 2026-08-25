import { useEffect, useState } from "react";

const NAVIGATION_EVENT = "lucid:navigation";

function notifyNavigation() {
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

function navigate(href: string, replace = false) {
  const target = new URL(href, window.location.href);
  const method = replace ? "replaceState" : "pushState";
  window.history[method](window.history.state, "", `${target.pathname}${target.search}${target.hash}`);
  notifyNavigation();
  if (target.hash) {
    window.requestAnimationFrame(() => {
      const anchor = document.getElementById(decodeURIComponent(target.hash.slice(1)));
      if (anchor) anchor.scrollIntoView({ block: "start" });
      else window.scrollTo({ top: 0, behavior: "auto" });
    });
  } else {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}

export function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", update);
    window.addEventListener(NAVIGATION_EVENT, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(NAVIGATION_EVENT, update);
    };
  }, []);

  return pathname;
}

export function useRouter() {
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, true),
  };
}

export { NAVIGATION_EVENT };
