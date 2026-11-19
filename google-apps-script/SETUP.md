# Google 部署與驗收

目前版本含照片收件流程；實際部署與驗收狀態見 README。所有資源 ID、帳號與授權回條只存私人設定，不提交公開 GitHub。

| 順序 | 目標 | 做法 | 檢查點 |
| --- | --- | --- | --- |
| 1 | 沿用資料與權限 | 設定 SPREADSHEET_ID、ALLOWED_EMAILS；沿用已確認的試算表。設定 IMPORT_FOLDER_ID 為既有專案內的私人原圖資料夾。 | 不建立第二份正式總表，不修改分享，不加入聯絡人。 |
| 2 | 組裝同一版來源 | node scripts/build.mjs 產生 Index.html；Code.gs、Imports.gs 分檔或依序以單一換行串接。私人隔離測試才加 Acceptance.gs。 | 生成檔與原始碼一致；不要混用舊版後端。 |
| 3 | 啟用 Google 辨識 | 使用 appsscript.json 宣告 Advanced Drive v3 與 Sheets、身分、Drive、Documents scope。預設 GCP 專案會隨進階服務自動啟用 API；不啟用付費 OCR。 | Drive 保存原始位元組，Google Docs 轉換取得 OCR 原文。新增 OAuth 同意需由擁有者在 Google 畫面確認。 |
| 4 | 保護現有紀錄 | Records 已存在時不初始化覆寫；缺少時由 editor 的 initializeRecords_ 建立。Imports 首次在授權與鎖內建立，兩表都檢查標頭。 | 原表不覆寫；Records 六欄，Imports 三欄；版本完整追加。 |
| 5 | 驗收後更新私人部署 | 以 USER_ACCESSING／MYSELF 驗證；同一部署更新版本可保留網址。不得取消 allowlist 或改為匿名公開。 | 未授權讀取、上傳、辨識、歸檔都拒絕；另一帳號與裝置分開實測。 |
| 6 | 核對匯入流程 | 虛構正面、反面、重複正面依序上傳；核對原圖 SHA-256、OCR 原文、逐欄確認、同卡面別，最後歸檔與重載。 | 收件 3 次、不重複原圖 2 張、實體卡 1 張、人物 1 位；來源 URL 與穩定 ID 可讀回；本機故障注入後重開收件匣，從續辦入口補齊來源，人物／實體卡仍各一。 |
| 7．複查機制 | 比對預期與實際 | 保存來源提交、部署版本、原圖 hash、Google 讀回、拒絕測試、複查人與時間；標示通過／未通過／未確認。 | 只回報有證據的範圍；本機模擬不等於真實 Google OCR 或手機通過。 |

原圖允許 JPEG／PNG／WebP，10 MB 以內。此階段 Google OCR 僅處理 2 MB 內 JPEG／PNG；WebP 與較大原圖仍先保存，另提供較小 JPEG／PNG 作補充再一起確認。未支援多卡同框切割；須先拆分。正反面由人明確選取配對，不以檔名或 OCR 猜測合併。QR 標記未解碼；無背景排程，關頁停止尚未上傳項目，已保存來源可讀回續辦。

Imports 以來源 SHA-256 去重；收件操作編號可重送，每個來源保留最多 100 次收件。原圖檔名由 hash 決定；原檔名留在收件紀錄。OCR 文件留在同一私人資料夾供稽核，不刪除。確認時保存原文候選、確認值、確認者、時間、來源與面別。未能確認的欄位留白；能提供與需要資源只接受使用者明確補充，不從照片猜測。歸檔先追加人物再標記來源，若中途失敗以同一操作編號續辦，不重複建檔。

Records／Imports 各有 10,000 筆版本掃描上限，超過停止且不截斷。來源單筆 JSON 上限 45,000 字元，OCR 原文上限 16,000 字元。這是小規模驗證後端，尚無分頁與常駐處理保證。

Drive／Documents 的 OAuth scope 由 Google 服務所需，介面可能描述可存取整個 Drive／文件；程式僅對設定資料夾、已保存來源 ID 與指定表格操作，不提供任意 ID 讀寫入口。OAuth scope 不代表資料夾層級沙箱；正式多人服務前仍需獨立安全驗收。

官方依據：
- [Drive 圖像轉換與 OCR](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Advanced Drive](https://developers.google.com/apps-script/advanced/drive)
- [啟用進階服務與預設 GCP 行為](https://developers.google.com/apps-script/guides/services/advanced)
- [Google 網頁應用程式](https://developers.google.com/apps-script/guides/web)
- [Google 身分](https://developers.google.com/apps-script/reference/base/session)
- [鎖定服務](https://developers.google.com/apps-script/reference/lock/lock)
