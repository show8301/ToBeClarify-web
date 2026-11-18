# Web 換版流程

使用者說「換版」或「上版到測試環境」時，已授權推送本次變更、開 PR 並合併至目標分支。後續接手的 AI 可從最近一次已完成的步驟繼續，依分支、PR 與 commit SHA 查證進度。[專案規則](../AGENTS.md)

## 1. 確認範圍

| 本次變更 | 處理方式 |
| --- | --- |
| 純 Web 畫面 | 在 3001 完成本機驗收，只發布 Web 到 `dev`。 |
| 其他 Web 程式或設定 | 依影響範圍檢查，走同一個 Web PR 與部署流程。 |
| 純文件 | 本機核對連結、指令、規則與 diff 即可。若要求發布，合併後仍由既有工作流程部署。 |
| Web 與 API 一起換版到測試環境 | Web 進 `dev`，API 依其專案規則進 `main`。API `dev` 僅建置。若 Web 依賴新契約，先確認 API 相容目前正式 Web。必要的資料庫遷移先於相依 API 發布，待 API 部署成功再發布相依 Web。[API 專案規則](../../ToBeClarify-api/AGENTS.md) · [DBA 遷移程序](../../ToBeClarify-api/docs/DATABASE-MIGRATION-RUNBOOK.md) |

## 2. 沿用已驗收的畫面

- 提供本機預覽時，在工作紀錄一起留下 checkout、來源 commit、驗收頁面及已完成的 CSS／字型檢查。乾淨版本可直接用 commit 識別。若建置含未提交的輸入，列出刪除的路徑，對新增或修改的檔案以 `git hash-object -- <path>` 記錄內容，供換版時比對。詳見[本機預覽流程](local-ui-preview.md)。
- 收到換版指令後，核對候選版本與驗收時的應用程式、素材、依賴及建置設定。內容相同就直接整理 PR，省去第二次本機 build、typecheck、全庫 lint 與 CSS 掃描。PR CI 仍會從乾淨環境建置及檢查。
- 若其間有影響畫面的修改、整合了會改變產物的新基底，或無法對應先前驗收的版本，依預覽流程重建並核對受影響的畫面。使用者明確指定的檢查照常執行。

## 3. 合併並追蹤部署

1. 在 Web 根目錄確認 `git status --short --branch` 與遠端 `dev`，檢視 `git diff --cached` 和 PR 全部差異，只提交本次範圍。推送 `codex/*` 工作分支，建立或沿用該分支到 `dev` 的 PR。
2. 追蹤目前 PR head 的 CI。build、TypeScript、ESLint 與部署腳本語法檢查通過、可合併時，直接合併該 head。失敗時讀取該 job 的錯誤，修正後追蹤新 head。發布到 `dev` 預設略過所有自動化測試套件，只有使用者要求該次測試才執行。
3. 從已合併 PR 取得目標分支的完整合併 SHA。以該 SHA、目標分支與 `push` 事件選取 [deploy.yml](../.github/workflows/deploy.yml) 的 run，等待 IIS 部署 job 成功。使用 GitHub 連接器即可操作。若使用已登入的 GitHub CLI，可用下列指令；run 尚未建立時，短暫等候後再查同一 SHA。

```powershell
# $pr、$headSha 為已檢查的 PR 編號與完整 head SHA，$branch 為目標分支
gh pr checks $pr --watch --interval 10
if ($LASTEXITCODE -ne 0) { throw '請查看目前 PR 的檢查狀態' }
gh pr merge $pr --merge --match-head-commit $headSha
if ($LASTEXITCODE -ne 0) { throw '請核對 PR head 與合併狀態' }
$mergeSha = gh pr view $pr --json mergeCommit --jq '.mergeCommit.oid'
if ($LASTEXITCODE -ne 0 -or $mergeSha -notmatch '^[a-f0-9]{40}$') { throw '請確認 PR 已合併並取得完整 SHA' }
$runId = gh run list --workflow deploy.yml --branch $branch --commit $mergeSha --event push --json databaseId --jq '.[0].databaseId // empty'
if ($LASTEXITCODE -ne 0 -or !$runId) { throw '請查詢該 SHA 的 push run，建立後繼續追蹤' }
gh run watch $runId --exit-status --interval 10
if ($LASTEXITCODE -ne 0) { throw '請查看該 run 的部署狀態與失敗步驟' }
```

4. IIS 部署 job 已核對目標站的 localhost 與公開 `/api/health` 回傳 `status=ok` 和完整合併 SHA，也核對另一站台的原有 SHA。成功紀錄中的 `Verified deployment SHA through IIS` 可直接作為該版的 HTTP 驗證。需要確認當下仍在線的版本時，對目標站讀取一次 `/api/health` 並比對 `deploymentSha`。若 SHA 不同，先查同分支後續 run 或回復紀錄。若 run 失敗，從失敗的 step 查起，確認實際在線版本和回復結果後再處理。[IIS 部署與回復](iis-dev-deployment.md)
5. 回報環境網址、PR、部署 run 與已核對的 SHA。已驗收的純畫面變更到此即可交付測試站。使用者回報顯示差異或要求查驗時，再針對該頁檢查線上 CSS。

## 4. 正式發布

使用者確認測試站版本後，核對目前遠端 `dev` head 等於已驗收 SHA，再開 `dev` → `main` PR。依正式 PR 的既有檢查（含 Windows PM2 驗證）手動合併已驗收 head，再依第 3 節追蹤 `main` 的 push run 與正式站 SHA。若 `dev` 已有其他提交，先請使用者確認新的測試站版本。

## 換版變慢時

從同一個 PR 與部署 run 取時間，比較「收到指令 → 開 PR」、「開 PR → 合併」、「合併 → 部署完成」與「部署完成 → 回報」。前段慢時先查重跑的本機工作。需要重現 lint 而 Windows 只有 Node 可用時，可直接執行 `node node_modules/eslint/bin/eslint.js .`。IIS 階段慢時，看部署 log 的 `IIS staging npm ci elapsed`，與排隊、建置、下載及切換站台的時間分開比較。

2026-11-18 點餐暗色模式換版共 15 分 01 秒。上述四段依序為 6 分 59 秒、1 分 56 秒、3 分 58 秒、2 分 08 秒。當次 Windows 已命中 npm 快取，staging 安裝仍用了約 95 秒。下次可用相同分段比較實際差異。[PR #170](https://github.com/show8301/ToBeClarify-web/pull/170) · [測試站部署紀錄](https://github.com/show8301/ToBeClarify-web/actions/runs/44278324191)
