import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Resolve parsers through the declared build tool, including isolated installs.
const buildRequire = createRequire(import.meta.resolve("@tailwindcss/postcss"));
const postcss = buildRequire("postcss");
const tailwindRequire = createRequire(buildRequire.resolve("@tailwindcss/node"));
const { transform } = tailwindRequire("lightningcss");
const normalizationCache = new Map();

function normalizeCss(css) {
  if (!normalizationCache.has(css)) {
    const result = transform({
      filename: "preview-css-check.css",
      code: Buffer.from(css),
      minify: true,
      errorRecovery: false,
    });
    if (result.warnings.length) {
      throw new Error(`CSS 正規化有警告：${result.warnings[0].message}`);
    }
    normalizationCache.set(css, postcss.parse(result.code.toString()));
  }
  return normalizationCache.get(css);
}

function normalizeSelector(selector) {
  const root = normalizeCss(`${selector}{--preview-check:0}`);
  if (root.nodes.length !== 1 || root.first.type !== "rule" || root.first.selectors.length !== 1) {
    throw new Error(`需要單一、非巢狀選擇器：${selector}`);
  }
  return root.first.selector;
}

function normalizeContext(context) {
  return context.map((header) => {
    const root = normalizeCss(`${header}{.preview-check{--preview-check:0}}`);
    if (root.nodes.length !== 1 || root.first.type !== "atrule" || root.first.nodes?.length !== 1 || root.first.first.type !== "rule") {
      throw new Error(`需要單一 at-rule 條件：${header}`);
    }
    return `@${root.first.name} ${root.first.params}`.trim();
  });
}

function normalizeDeclaration(property, value, important = false) {
  const css = `.preview-check{${property}:${value}${important ? " !important" : ""}}`;
  const input = postcss.parse(css);
  if (input.nodes.length !== 1 || input.first.type !== "rule" || input.first.nodes.length !== 1 || input.first.first.type !== "decl") {
    throw new Error(`需要單一宣告，值不得注入其他規則：${property}`);
  }
  const root = normalizeCss(css);
  if (root.nodes.length !== 1 || root.first.type !== "rule" || root.first.nodes.length !== 1 || root.first.first.type !== "decl") {
    throw new Error(`需要單一可正規化宣告：${property}: ${value}`);
  }
  const declaration = root.first.first;
  return {
    property: declaration.prop,
    value: declaration.value,
    important: Boolean(declaration.important),
  };
}

function propertyName(property) {
  return property.startsWith("--") ? property : property.toLowerCase();
}

export function validateExpectations(input) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("預期規則必須是非空 JSON 陣列。");
  }
  return input.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
        typeof entry.selector !== "string" || !entry.selector.trim() ||
        !entry.declarations || typeof entry.declarations !== "object" || Array.isArray(entry.declarations) ||
        Object.keys(entry.declarations).length === 0 ||
        (entry.context !== undefined && (!Array.isArray(entry.context) || entry.context.some((item) => typeof item !== "string" || !item.trim())))) {
      throw new Error(`第 ${index + 1} 筆規則需要 selector、declarations 及選用的 context 陣列。`);
    }
    if (Object.keys(entry).some((key) => !["selector", "declarations", "context"].includes(key))) {
      throw new Error(`第 ${index + 1} 筆規則含未知欄位，請檢查拼字。`);
    }
    const declarations = Object.entries(entry.declarations).map(([property, value]) => {
      if (!/^--[\w-]+$|^-?[a-z][a-z0-9-]*$/i.test(property) || typeof value !== "string" || !value.trim()) {
        throw new Error(`第 ${index + 1} 筆規則含無效屬性或值：${property}`);
      }
      return normalizeDeclaration(property, value);
    });
    return {
      selector: normalizeSelector(entry.selector),
      context: normalizeContext(entry.context ?? []),
      declarations,
    };
  });
}

function ruleContext(rule) {
  const context = [];
  for (let parent = rule.parent; parent && parent.type !== "root"; parent = parent.parent) {
    if (parent.type !== "atrule" || /keyframes$/i.test(parent.name)) return null;
    context.unshift(`@${parent.name} ${parent.params}`.trim());
  }
  return normalizeContext(context);
}

// This checks emitted declarations, not DOM matching, full cascade or rendering.
export function checkCssSources(sources, input) {
  const expectations = validateExpectations(input);
  if (!Array.isArray(sources) || sources.length === 0) throw new Error("沒有 CSS 來源。");
  const rules = [];
  for (const source of sources) {
    if (!source || typeof source.css !== "string" || !source.css.trim() || typeof source.name !== "string") {
      throw new Error("CSS 來源需要非空 css 與 name。");
    }
    const root = postcss.parse(source.css, { from: source.name });
    root.walkAtRules("import", () => {
      throw new Error(`${source.name} 尚有 @import；請改用已展開匯入的建置產物。`);
    });
    root.walkRules((rule) => {
      const context = ruleContext(rule);
      if (context === null) return;
      const selectors = rule.selectors.map(normalizeSelector);
      if (!expectations.some((entry) => selectors.includes(entry.selector))) return;
      rules.push({
        selectors,
        context: JSON.stringify(context),
        declarations: rule.nodes.filter((node) => node.type === "decl"),
        source: `${source.name}:${rule.source.start.line}`,
      });
    });
  }
  const results = [];
  for (const entry of expectations) {
    const selectorRules = rules.filter((rule) => rule.selectors.includes(entry.selector));
    const contextRules = selectorRules.filter((rule) => rule.context === JSON.stringify(entry.context));
    for (const expected of entry.declarations) {
      const candidates = contextRules.flatMap((rule) => rule.declarations
        .filter((declaration) => propertyName(declaration.prop) === expected.property)
        .map((declaration) => ({ ...normalizeDeclaration(declaration.prop, declaration.value, declaration.important), source: rule.source })));
      // Preserve resource order and !important for repeated explicit properties.
      const importantCandidates = candidates.filter((candidate) => candidate.important);
      const actual = (importantCandidates.length ? importantCandidates : candidates).at(-1);
      let status;
      if (!selectorRules.length) status = "missing-selector";
      else if (!contextRules.length) status = "missing-context";
      else if (!actual) status = "missing-declaration";
      else if (actual.value !== expected.value || actual.important !== expected.important) status = "value-mismatch";
      else status = "pass";
      results.push({ selector: entry.selector, context: entry.context, property: expected.property, expected, actual: actual ?? null, status });
    }
  }
  return results;
}

function localUrl(value, base) {
  const url = new URL(value, base);
  if (!["http:", "https:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password || (base && url.origin !== new URL(base).origin)) {
    throw new Error("URL 模式只讀取本機、同源且不含帳密的頁面與 CSS。");
  }
  return url;
}

async function fetchText(url, contentType) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes(contentType)) {
    throw new Error(`${url.pathname} 回應 ${response.status}，需要 ${contentType}。`);
  }
  const text = await response.text();
  if (!text.trim()) throw new Error(`${url.pathname} 回應為空。`);
  return text;
}

export async function readPreviewCss(value) {
  const pageUrl = localUrl(value);
  const html = await fetchText(pageUrl, "text/html");
  const links = [];
  // HTML discovery only; all CSS matching uses parsers rather than regex.
  for (const tag of html.matchAll(/<link\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const attributes = new Map();
    for (const match of tag[0].slice(5, -1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
    }
    if (!attributes.get("rel")?.toLowerCase().split(/\s+/).includes("stylesheet")) continue;
    const href = attributes.get("href");
    if (!href) throw new Error("stylesheet link 缺少 href。");
    const url = localUrl(href.replaceAll("&amp;", "&"), pageUrl.href);
    if (attributes.has("disabled") || attributes.has("media") || attributes.has("title")) {
      throw new Error("條件式／替代樣式表需要瀏覽器確認，不能直接當成無條件產物。");
    }
    links.push(url);
  }
  if (!links.length) throw new Error("HTML 沒有 stylesheet link；請確認頁面及建置模式。");
  // Promise.all preserves HTML order; filenames/hashes are never hard-coded.
  return Promise.all(links.map(async (url) => ({ name: url.pathname, css: await fetchText(url, "text/css") })));
}

function parseArguments(args) {
  const options = { css: [] };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help") return { help: true };
    if (!["--url", "--css", "--expect"].includes(argument) || !args[index + 1] || args[index + 1].startsWith("--")) {
      throw new Error(`未知或缺少值的參數：${argument}`);
    }
    const value = args[++index];
    if (argument === "--css") options.css.push(value);
    else if (options[argument.slice(2)]) throw new Error(`重複參數：${argument}`);
    else options[argument.slice(2)] = value;
  }
  if (!options.expect || Boolean(options.url) === Boolean(options.css.length)) {
    throw new Error("請指定 --expect，以及 --url 或一個以上 --css（不可同時使用）。");
  }
  return options;
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log("node scripts/check-preview-css.mjs --url http://127.0.0.1:3001/admin/staff --expect scripts/preview-css/admin-navigation.json\n或使用 --css <建置 CSS 路徑>（可重複）取代 --url。僅檢查外部 CSS 宣告，不驗證實際渲染。");
      return;
    }
    const input = JSON.parse(await readFile(resolve(options.expect), "utf8"));
    validateExpectations(input);
    const sources = options.url ? await readPreviewCss(options.url) : await Promise.all(options.css.map(async (path) => ({ name: path, css: await readFile(resolve(path), "utf8") })));
    const results = checkCssSources(sources, input);
    for (const result of results) {
      const expected = `${result.expected.value}${result.expected.important ? " !important" : ""}`;
      const actual = result.actual ? `${result.actual.value}${result.actual.important ? " !important" : ""} (${result.actual.source})` : "未找到明確宣告";
      console.log(`[${result.status}] ${result.context.join(" → ") || "頂層"} | ${result.selector} | ${result.property}: 預期 ${expected}；產物 ${actual}`);
    }
    const failed = results.filter((result) => result.status !== "pass").length;
    console.log(`CSS 產物：${sources.length} 個來源，${results.length - failed}/${results.length} 項符合。Computed／Rendered Fonts 未確認。`);
    process.exitCode = failed ? 1 : 0;
  } catch (error) {
    console.error(`[check-error] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
