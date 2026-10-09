import assert from "node:assert/strict";
import { test } from "node:test";
import { checkCssSources, readPreviewCss, validateExpectations } from "./check-preview-css.mjs";

const base = [{ selector: ".card", declarations: { display: "flex" } }];
const source = (css, name = "fixture.css") => ({ css, name });
const statuses = (sources, expectations = base) => checkCssSources(sources, expectations).map((result) => result.status);

test("formatted, reordered, grouped and minified CSS are equivalent", () => {
  const expectations = [{ selector: ".card > span", declarations: { display: "flex", "text-align": "center", color: "red" } }];
  for (const css of [
    "/* note */ .other, .card > span { color: rgb(255, 0, 0); text-align: center; display: flex; }",
    ".card>span{display:flex;color:#f00;text-align:center}",
  ]) {
    assert.deepEqual(statuses([source(css)], expectations), ["pass", "pass", "pass"]);
  }
});

test("functional selectors containing commas remain a single selector", () => {
  assert.deepEqual(statuses([source(":is(.a,.b),.other{display:flex}")], [
    { selector: ":is(.a, .b)", declarations: { display: "flex" } },
  ]), ["pass"]);
});

test("wrong values and later explicit overrides do not pass", () => {
  for (const sources of [
    [source(".card{display:grid}")],
    [source(".card{display:flex;display:block}")],
    [source(".card{display:flex}", "first.css"), source(".card{display:block}", "last.css")],
  ]) {
    assert.deepEqual(statuses(sources), ["value-mismatch"]);
  }
});

test("important wins over a later normal declaration and must be asserted", () => {
  const sources = [source(".card{display:flex!important}.card{display:block}")];
  assert.deepEqual(statuses(sources, [{ selector: ".card", declarations: { display: "flex !important" } }]), ["pass"]);
  assert.deepEqual(statuses(sources), ["value-mismatch"]);
  assert.deepEqual(statuses([source(".card{display:flex!important;display:block!important}")], [
    { selector: ".card", declarations: { display: "flex !important" } },
  ]), ["value-mismatch"]);
});

test("wrong media and mobile-only declarations cannot satisfy desktop", () => {
  const sources = [source("@media(width<=800px){.card{display:flex}}")];
  assert.deepEqual(statuses(sources), ["missing-context"]);
  assert.deepEqual(statuses(sources, [{ ...base[0], context: ["@media(max-width:1020px)"] }]), ["missing-context"]);
});

test("equivalent media syntax and nested at-rule contexts normalize", () => {
  assert.deepEqual(statuses([source("@media(width<=1020px){.card{display:flex}}")], [
    { ...base[0], context: ["@media (max-width: 1020px)"] },
  ]), ["pass"]);
  assert.deepEqual(statuses([source("@media(width<=1020px){@supports(display:grid){.card{display:flex}}}")], [
    { ...base[0], context: ["@media(max-width:1020px)", "@supports (display: grid)"] },
  ]), ["pass"]);
});

test("pseudos, themes and similar class names cannot satisfy the base selector", () => {
  for (const css of [".card:hover{display:flex}", ".dark .card{display:flex}", ".card-extra{display:flex}"]) {
    assert.deepEqual(statuses([source(css)]), ["missing-selector"]);
  }
});

test("missing declarations remain distinct from missing selectors", () => {
  assert.deepEqual(statuses([source(".card{color:red}")]), ["missing-declaration"]);
});

test("normal properties ignore case, custom properties preserve case", () => {
  assert.deepEqual(statuses([source(".card{DISPLAY:flex}")]), ["pass"]);
  assert.deepEqual(statuses([source(".card{--Value:12px}")], [{ selector: ".card", declarations: { "--value": "12px" } }]), ["missing-declaration"]);
});

test("invalid CSS, unresolved imports and invalid expectations are rejected", () => {
  assert.throws(() => statuses([source(".card{")]));
  assert.throws(() => statuses([source("@import url(other.css);.card{display:flex}")]), /@import/);
  assert.throws(() => validateExpectations([{ ...base[0], contexts: [] }]), /未知欄位/);
  assert.throws(() => validateExpectations([{ selector: ".a, .b", declarations: { display: "flex" } }]), /單一/);
  assert.throws(() => validateExpectations([{ selector: ".card", declarations: { display: 1 } }]), /無效/);
  assert.throws(() => validateExpectations([{ selector: ".card", declarations: { display: "flex;display:grid" } }]), /單一宣告/);
});

test("URL discovery uses current hrefs and HTML order, not sorted hashes", async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url.pathname);
    if (url.pathname === "/admin/staff") {
      return new Response('<link href="/z.new.css" rel="stylesheet"><link REL=stylesheet href="a.other.css">', { headers: { "content-type": "text/html" } });
    }
    return new Response(url.pathname.startsWith("/z") ? ".card{display:block}" : ".card{display:flex}", { headers: { "content-type": "text/css" } });
  };
  try {
    const sources = await readPreviewCss("http://127.0.0.1:3001/admin/staff");
    assert.deepEqual(sources.map((item) => item.name), ["/z.new.css", "/admin/a.other.css"]);
    assert.deepEqual(statuses(sources), ["pass"]);
    assert.deepEqual(requests, ["/admin/staff", "/z.new.css", "/admin/a.other.css"]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("URL mode rejects disabled/conditional, off-origin and non-CSS resources", async () => {
  const previousFetch = globalThis.fetch;
  try {
    for (const html of [
      '<link disabled rel="stylesheet" href="/style.css">',
      '<link media="screen" rel="stylesheet" href="/style.css">',
      '<link rel="stylesheet" href="https://example.com/style.css">',
    ]) {
      globalThis.fetch = async () => new Response(html, { headers: { "content-type": "text/html" } });
      await assert.rejects(readPreviewCss("http://127.0.0.1:3001/admin/staff"));
    }
    globalThis.fetch = async (url) => new Response(
      url.pathname === "/admin/staff" ? '<link rel="stylesheet" href="/style.css">' : "error page",
      { headers: { "content-type": "text/html" } },
    );
    await assert.rejects(readPreviewCss("http://127.0.0.1:3001/admin/staff"), /text\/css/);
    await assert.rejects(readPreviewCss("https://example.com/admin/staff"), /本機/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
