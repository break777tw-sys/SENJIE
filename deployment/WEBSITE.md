# 原 SENJIE 網站與 Google 安全連線

網站來源維持本儲存庫。一般靜態頁面使用 `data-runtime="connected"`，登入前不載入示範人物；Google HTML Service 模式仍使用原 `google.script.run`。既有自然語句驗收入口明確改成 demo 模式，與正式入口分開。

靜態網站由使用者按「使用 Google 登入」，開啟同一個 owner-private Apps Script 網頁。Google 端先驗證既有帳號與允許清單，再透過限定網站來源、開啟視窗、隨機通道及請求編號傳遞訊息；每次真正資料操作仍先跑 `authorize_`。沒有將 Google OAuth token 或密鑰交給靜態頁面，沒有公開匿名資料 API，也沒有變更現站 GCP。

專用啟用連結形狀為「實際網站URL + `#connect=` + URL編碼的既有私人部署URL」。只透過私人交付給擁有者；儲存庫不記錄該URL或Google資源ID。片段由瀏覽器讀取後移除，只將部署端點存於這個瀏覽器，不保存人物資料或登入token。登入窗口須保持開啟；登出、重開頁面或關閉窗口會清除網站記憶中的私人資料，再次讀取須重新登入。

目前 `website-runtime-manifest.json` 保留原 Sheets／身分兩項權限。照片上傳、確認歸檔與續辦程式和介面保留，但網站會依後端能力停用尚未核驗的照片權限；`PHOTO_IMPORTS_ENABLED` 預設不是 true。不得只把它改 true 就宣稱原圖／OCR已通過，也不得直接換成要求完整Drive／Documents的照片候選設定。最小權限與Google照片實測沿原驗收關卡續辦。

| 順序 | 目標 | 做法 | 檢查點 |
| --- | --- | --- | --- |
| 1 | 使用同版來源 | Code.gs、Imports.gs、PhotoDrive.gs、隔離測試的Acceptance.gs、WebsiteBridge.gs依序以單一換行組裝；`node scripts/build.mjs`生成Index.html，另保留WebsiteBridge.html | 來源固定提交與生成檔hash可讀回。Acceptance只用虛構資料隔離驗收。 |
| 2 | 保留既有Google權限 | 使用website-runtime-manifest.json；既有允許帳號、表格與原圖資料夾設定留在私人Script Properties | USER_ACCESSING／MYSELF不變，沒有token、個資或私人ID進GitHub。 |
| 3 | 接回同一網站 | 保存並核對同一Google部署；網站只發布公開程式與通用登入畫面；私人啟用連結另交擁有者 | 實際發布網址讀回，登入前無人物，錯誤不回退範例。 |
| 4．複查機制 | 比較預期、實際與證據 | 原作者與原驗收者各記版本、人員、時間；實測登入、新增、保存、重開、修改再查、登出清空、撤除允許資格拒絕及還原；Google資料由另一連線讀回 | 僅列項實測通過可完成；手機、另一帳號、真實照片與ChatGPT／LINE接線各自標示，不混用模擬回條。 |

來源與公開測試不包含私人端點。`tests/popup-transport.test.js`驗證跨來源與視窗冒用拒絕、失效連線、後端允許清單與操作白名單；這些單元測試不取代實際Google及手機驗收。Google服務與資料仍使用既有資源，沒有新增付費後端或購買網域。
