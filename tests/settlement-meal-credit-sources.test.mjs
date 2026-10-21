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

const nativeRequire = createRequire(import.meta.url);
function load(filename) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name.startsWith(".")
    ? load(resolve(dirname(filename), `${name}.ts`)) : nativeRequire(name) }, { filename });
  return exports;
}
const { SettlementOrderSources } = load(fileURLToPath(new URL("../features/admin/settlement/SettlementOrderSources.tsx", import.meta.url)));
const source = { kind: "designated_revenue", orderId: "order-1", orderNumber: "20261018-223329-9353",
  label: "指名商品", originalAmount: 150000, basisAmount: 150000, percentage: 70, amount: 105000,
  cancelledAmount: 0, mealCreditAmount: 0, afterCreditAmount: 150000, orderRevenueAmount: 150000,
  adjustedRevenueAmount: 150000, orderPayableAmount: 150000, orderCollectedAmount: 150000 };
const render = value => renderToStaticMarkup(React.createElement(SettlementOrderSources,
  { sources: [value], kind: "designated_revenue" }));

test("nomination source shows its own zero credit, order ratios and corrected commission", () => {
  const html = render(source);
  assert.match(html, /本品項餐飲折抵 −0 G；折抵後 150,000 G/);
  assert.match(html, /訂單營收調整比例 150,000 ÷ 150,000/);
  assert.match(html, /有效實收比例 150,000 ÷ 150,000/);
  assert.match(html, /認列基礎 150,000 G × 70%/);
  assert.match(html, /105,000 G/);
  assert.match(html, /href="\/admin\/notifications\/orders\/order-1"/);
});

test("legacy snapshot retains its saved amount and asks manager to recalculate without inventing details", () => {
  const html = render({ ...source, basisAmount: 140625, amount: 98437.5,
    cancelledAmount: null, mealCreditAmount: null, afterCreditAmount: null,
    orderRevenueAmount: null, adjustedRevenueAmount: null });
  assert.match(html, /認列基礎 140,625 G/);
  assert.match(html, /98,437.5 G/);
  assert.match(html, /此版本未保存逐項取消/);
  assert.doesNotMatch(html, /本品項餐飲折抵/);
});

test("cancelled zero-payable item never presents a zero denominator as a usable ratio", () => {
  const html = render({ ...source, cancelledAmount: 150000, afterCreditAmount: 0, orderRevenueAmount: 0,
    adjustedRevenueAmount: 0, orderPayableAmount: 0, orderCollectedAmount: 0, basisAmount: 0, amount: 0 });
  assert.match(html, /品項取消 −150,000 G/);
  assert.match(html, /認列基礎 0 G/);
  assert.doesNotMatch(html, /÷ 0|NaN|Infinity/);
});
