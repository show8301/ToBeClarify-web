import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { validatePublicTipPool } from "../features/admin/settlement/public-tip-contract.ts";

const nativeRequire = createRequire(import.meta.url);
function component(path) {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  function load(filename) {
    const exports = {};
    const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    vm.runInNewContext(code, { exports, require: name => name.startsWith(".")
      ? load(resolve(dirname(filename), `${name}.ts`)) : nativeRequire(name) }, { filename });
    return exports;
  }
  return load(filename).SettlementPublicTips;
}
const Panel = component("../features/admin/settlement/SettlementPublicTips.tsx");
const source = { orderId: "order-1", orderNumber: "20261018-001", originalAmount: 1001,
  orderPayableAmount: 1001, orderCollectedAmount: 501, recognizedAmount: 501, status: "部分實收" };
const overview = () => ({ run: { calculationVersion: 4, status: "finalized", publicTipAmount: 1001 },
  publicTipPool: { recognizedAmount: 501, distributableAmount: 501, sources: [source], legacyStoreSources: [source] } });
const render = value => renderToStaticMarkup(React.createElement(Panel,
  { overview: value, reason: "", editable: true, onReasonChange() {} }));

test("public tip payload accepts recognized order sources and legacy reconciliation candidates", () => {
  const value = overview();
  assert.equal(validatePublicTipPool(value), value);
  assert.equal(validatePublicTipPool({ run: {} }).publicTipPool, undefined);
});
test("malformed source amounts and missing order identifiers fail before rendering", () => {
  for (const invalid of [null, { ...source, orderId: 123 }, { ...source, recognizedAmount: -1 }, { ...source, originalAmount: NaN }]) {
    const value = overview(); value.publicTipPool.sources = [invalid];
    assert.throws(() => validatePublicTipPool(value));
  }
  const value = overview(); value.publicTipPool.legacyStoreSources = "bad";
  assert.throws(() => validatePublicTipPool(value));
});
test("finalized panel renders live source links and labels manager recalculation without a manual money input", () => {
  const html = render(overview());
  assert.match(html, /href="\/admin\/notifications\/orders\/order-1"/);
  assert.match(html, /501 G/);
  assert.match(html, /已結算薪資仍保留原版本/);
  assert.match(html, /舊店家小費待核對/);
  assert.doesNotMatch(html, /<input/);
});
test("legacy manual amounts remain visible and require explicit reconciliation instead of silent clearing", () => {
  const value = overview(); value.run.calculationVersion = 2;
  const html = render(value);
  assert.match(html, /舊手動公共小費 1,001 G/);
  assert.match(html, /核對原因<input/);
  assert.doesNotMatch(html, /type="number"/);
});
test("missing pool response is an unavailable state rather than an invented zero", () => {
  const value = overview(); delete value.publicTipPool;
  assert.match(render(value), /role="status"/);
  assert.match(render(value), /尚未提供公共小費來源/);
});
