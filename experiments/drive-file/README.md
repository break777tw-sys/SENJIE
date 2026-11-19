# 照片最小權限實驗（未部署）

本目錄只供同一 SENJIE 的離線檢查，不參與 scripts/build.mjs，也未貼入雲端編輯器。現行網站、Google 授權、部署與分享未更動。先前全 Drive／Documents 照片候選版的放行請求已暫停，請勿依舊回條授權或部署。

## 最小範圍與現有證據

候選照片 I/O 僅要求 `https://www.googleapis.com/auth/drive.file`。原圖存入精確指定且已授權給同一應用程式的專案資料夾，按 hash 去重並讀回位元組；同一 API 將圖片轉為 OCR Google 文件，再用 files.export 匯出 text/plain。不使用 DriveApp、DocumentApp、外部 HTTP 請求、刪除、分享操作或根目錄備援。呼叫者提供的來源 ID 必須先存在本案 registry，才可能呼叫 Google API。

官方 API 的 files.create／files.get／files.export 接受 drive.file；這是 API 能力依據，**不是本專案真實授權及 OCR 成功證據**。Google 的 drive.file 邊界是該應用程式建立／使用者明確授權的檔案，不是名為「本案」的自動資料夾沙箱；本程式再以精確父資料夾與來源 registry 限制本案用途。既有但由其他應用程式建立的資料夾，不能只填 ID 就假定已授權。

全套28項本機測試通過，其中本實驗新增7項。測試讀入真正的虛構名片 PNG 位元組，正面／反面／重複正面產生兩份不重複原圖，SHA-256吻合；資料夾授權失敗不建立檔案；案外ID在API請求前拒絕；移出資料夾或原圖變更拒絕；OCR文件去重與匯出失敗保留來源通過。**Google API 以 fake 模擬，OCR 回傳明確 MOCK 字串；未驗證 Google OAuth、OCR 正確率、真實404或網站歸檔。**

最小實驗不包含 Sheets 人物歸檔、UI、身分與跨呼叫鎖。registry 需由未來同一後端安全持久化；目前測試使用記憶體 Map。Advanced Drive 媒體下載／匯出的 Apps Script Blob 回傳形狀尚需雲端驗證。不得把這個實驗直接視為可部署替代版。

## 實測缺件與可選路徑

既有 Apps Script 使用預設 GCP 專案；尚無同一應用程式 drive.file 同意、既有專案資料夾的逐檔案授權回條或 Picker 完整設定。現有 Drive connector 不能指定 scope／驗證它與 Apps Script 是否同一 OAuth 應用程式，透過 connector 成功上傳也不能證明此實驗的 drive.file 隔離。

Google Picker 的官方 Apps Script 路線要求標準 GCP 專案、同一專案號、Picker API 與受限制的 API key 等設定。切換現行預設 GCP 與授權不是本輪允許動作，因此未執行、未要求擁有者放行任何提示。不是認定技術不可行，而是現有條件不足以完成真實雲端驗證。

| 可選路徑 | 必要條件 | 目前結論 |
| --- | --- | --- |
| 同一 Apps Script 的 drive.file＋明確檔案選取 | 另核標準 GCP／Picker 設定；限定檔案同意；父資料夾與來源 registry 實測 | 有官方能力依據，本機限制測試通過，雲端未驗；未啟用。 |
| 保留現行手動建檔，照片自動化暫停 | 沿用現有網站，不新增任何 Google scope | 可保留既有功能；不宣稱照片已接通。 |

照片 I/O 的目標新增 scope 只有 drive.file，不需要完整 drive 或 documents。整站仍有既有 Sheets／身分授權；本實驗不宣稱整站已限縮。若未來要求人物表也逐檔案限制，還須替換 SpreadsheetApp 並驗證對指定表格的API讀寫，不是只改 manifest。

| 順序 | 目標 | 做法 | 檢查點 |
| --- | --- | --- | --- |
| 1 | 保留現行站 | 僅在本目錄準備草稿與本機測試 | 不改雲端編輯器、正式scope、部署、分享或LINE。 |
| 2 | 驗證程式限制 | 使用虛構PNG及fake Drive做正反面去重、案外拒絕與故障檢查 | 本實驗7項、本機全套28項通過；Google實測未確認。 |
| 3 | 具體列缺件 | 核對同一OAuth應用程式、檔案授權與Picker前置條件 | 沒有拿connector或mock冒充drive.file授權成功。 |
| 4 | 在另有精確授權後才能雲端驗證 | 固定候選版本；只用本案虛構來源，測實際upload／OCR／案外檔案拒絕 | 目前未執行，不請擁有者略過全Drive／文件未驗證警告。 |
| 5．複查機制 | 對照預期、實際及證據 | 保留測試種類、原圖hash、來源提交、複查人與臺灣時間；雲端另留scope與API回條 | 本Local主窗自行複查，本機範圍通過；Google逐檔案隔離與OCR未確認，非獨立驗收。 |

官方依據：
- [drive.file範圍](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [files.create](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create)
- [files.get](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get)
- [files.export](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export)
- [圖像轉換與OCR](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Apps Script Picker前置條件](https://developers.google.com/apps-script/guides/dialogs#file-open_dialogs)
