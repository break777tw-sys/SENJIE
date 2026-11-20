# 原網站照片確認歸檔候選

沿原 SENJIE 網站、來源編號、人物編號、Records／Imports 及私人原圖目的地。新增 PhotoDrive.gs 以 Advanced Drive v3 保存 JPG／PNG／WebP 原圖，仍限 10 MB；保存後另讀 Drive 的 SHA256、大小、格式及父資料夾。重試與重新開啟原圖也重新核對，不以網址存在當作原圖完整性證據。Drive 原圖在 Google 的登入與權限保護下開啟，沒有公開分享或把圖片存到網站 localStorage。

這個候選先接通「原圖保存→人工逐欄確認→歸檔→重開人物→核對原圖」。`PHOTO_OCR_ENABLED` 預設 false；辨識未啟用時回傳 manualReview，不能稱 OCR 已完成。保留的舊 OCR 候選及完整 Drive／Documents manifest 仍未啟用，不能用來擴權。

`photo-manual-runtime-manifest.json` 只在原 Sheets／身分上增加 `drive.file`，尚不是現行授權。這個權限針對應用程式建立或使用者明確選取的檔案；它不是以資料夾命名形成的沙箱。程式另外限定來源清單、操作者與精確父資料夾。Google 原圖 API 的實際可用性及同一應用程式對既有資料夾的存取，必須各自實測；connector 有權不能取代此檢查。

`photoReadiness` 只供已登入者查目前授權與指定資料夾，不觸發同意或建立資源。第一缺件分別回 PHOTO_PERMISSION_REQUIRED 或 PHOTO_FOLDER_REQUIRED，沒有改存根目錄或切換 GCP 的備援。現行網站繼續使用兩項權限及關閉照片能力；取得精確新增權限批准前不能換照片 manifest。

| 順序 | 目標 | 做法 | 檢查點 |
| --- | --- | --- | --- |
| 1 | 固定同版來源 | 組裝 Code.gs、Imports.gs、PhotoDrive.gs、原隔離 Acceptance.gs、WebsiteBridge.gs；建置 Index.html，保留 WebsiteBridge.html | 程式與生成頁面對應固定提交；無私人 ID、端點或憑證進公開來源。 |
| 2 | 核對必要存取 | 原作者先讀回現行 manifest／照片旗標；新增 drive.file 須精確批准，之後以 photoReadiness 核對權限與指定資料夾 | 不用完整 Drive／Documents，不改原 GCP、目的地、分享或帳單；資料夾不通即保留第一缺件。 |
| 3 | 實際走原網站 | 最小條件通過後才開照片能力，以一張既有虛構圖保存、逐欄確認、歸檔；重開網站查同人物、來源及私人原圖 | Google 原圖雜湊、Imports 回條、Records、人物 ID 一致；錯誤、中斷與未授權不得重複建人或洩漏。 |
| 4．複查機制 | 對照預期及實際 | 原作者記版本、時間及真實 Google／瀏覽器證據，再交原獨立驗收者複查；已有文字驗收沿用 | 模擬、實際雲端、獨驗與手機分列；未取得的證據標未確認，只回報實測範圍。 |

官方依據：[Drive 權限範圍](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)、[檔案 SHA256 欄位](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)、[Apps Script 授權資訊](https://developers.google.com/apps-script/reference/script/authorization-info)。
