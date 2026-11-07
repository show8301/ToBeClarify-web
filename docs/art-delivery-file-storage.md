# 作品圖片改存私密檔案：Web 串接與發布邊界

本次 Web 只補充交付與部署說明，無前端 runtime、proxy 或上傳大小變更。
API 實作及核准後的操作步驟見
[API release procedure](https://github.com/show8301/ToBeClarify-api/blob/codex/art-delivery-files-20261020/docs/art-delivery-files-release.md)。

2026-10-20 已唯讀查核 repository variables：API `D:\www_root\ToBeClarify_API`、
Web 正式 `D:\www_root\ToBeClarify_web`、Web dev `D:\www_root\ToBeClarify_web_dev`。
共同父層為 `D:\www_root`；預定私密檔案位置為
`D:\www_root\media\art-deliveries\{deliveryId}\{assetId}.png`，由 API 的穩定絕對
`Media:PrivateRootPath` = `D:\www_root\media` 與相對 STORAGE_KEY 組合。
實際建立、ACL、設定、migration、部署與回填均待使用者確認。

瀏覽器維持現有 `/api/admin/art-deliveries/.../assets/...` 及
`/api/collection/...` same-origin proxy；後者由
`app/api/collection/[...path]/route.ts` 與 `lib/server/customer-portal-proxy.ts`
轉發顧客憑證。Web 不讀磁碟、不接收 STORAGE_KEY／實體路徑、不新增靜態媒體映射。
Admin 權限、顧客 UID／領取碼、作品 ready 狀態及移除狀態仍由 API 判定。
不得把私密目錄放入 Web public、Vinext 產物、IIS virtual directory 或公開 CDN。

API root 與兩個 Web root 的部署只可操作各自根目錄，不能對共同父層做 /MIR 或清除；
私密 media 的配對備份與復原由 API release procedure 處理。Web build／程式 rollback
不包含此持久化目錄。首次設定前須在 IIS 主機執行 API 的唯讀 preflight，
確保沒有任何站台根目錄或虛擬目錄包含該 media 路徑。

API schema 必須先於依賴版本發布，並完成可重跑 copy／verify；舊 BLOB 保留在回滾窗口。
API 沒有獨立測試主機，API dev 僅 build。若後續需要 Web runtime 修改，仍先進 Web dev，
經使用者確認後才以 dev → main PR 推進。本次不合併 PR、不發布、不執行正式 migration。
