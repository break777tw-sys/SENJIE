# 原 SENJIE 網站與 Google 安全連線

網站來源維持本儲存庫。一般靜態頁面使用 `data-runtime="connected"`，登入前不載入示範人物；Google HTML Service 模式仍使用原 `google.script.run`。既有自然語句驗收入口明確改成 demo 模式，與正式入口分開。

使用者已明確採用單頁流程：GitHub Pages 維持入口，按「使用 Google 登入」在相同頁面導覽到 site-config.js 的原 Apps Script /exec，不加橋接參數、不建立視窗或 postMessage 連線。登入後網址可顯示 Google。Google 工作頁以原 google.script.run 直接讀寫，每次操作先跑 authorize_；「返回入口」為 target=_top 的固定 GitHub HTTPS 連結，不使用 focus 或 opener，也不冒稱已登出 Google 帳號。

原登入路由隨網站提供，不含資料或憑證；舊 #connect= 片段不能覆寫目的地。舊 bridge URL 的新頁面只提供「進入工作頁」的一般連結，沒有 JavaScript、保持視窗或返回焦點要求。使用者已載入的舊頁不會自動取得新版 DOM，交付時提供正常網站入口。

目前 `website-runtime-manifest.json` 保留原 Sheets／身分兩項權限。照片上傳、確認歸檔與續辦程式和介面保留，但網站會依後端能力停用尚未核驗的照片權限；`PHOTO_IMPORTS_ENABLED` 預設不是 true。不得只把它改 true 就宣稱原圖／OCR已通過，也不得直接換成要求完整Drive／Documents的照片候選設定。最小權限與Google照片實測沿原驗收關卡續辦。

| 順序 | 目標 | 做法 | 檢查點 |
| --- | --- | --- | --- |
| 1 | 使用同版來源 | Code.gs、Imports.gs、PhotoDrive.gs、隔離測試的Acceptance.gs、WebsiteBridge.gs依序以單一換行組裝；`node scripts/build.mjs`生成Index.html，另保留WebsiteBridge.html | 來源固定提交與生成檔hash可讀回。Acceptance只用虛構資料隔離驗收。 |
| 2 | 保留既有Google權限 | 使用website-runtime-manifest.json；既有允許帳號、表格與原圖資料夾設定留在私人Script Properties | USER_ACCESSING／MYSELF不變；只有登入路由公開，沒有token、人物資料、表格／原圖ID進GitHub。 |
| 3 | 接回同一網站 | 保存並核對同一Google部署；網站發布公開程式、登入路由與中性登入畫面；一般網址直接登入 | 實際發布網址讀回，登入前無人物，錯誤不回退範例。 |
| 4．複查機制 | 比較預期、實際與證據 | 原作者與原驗收者各記版本、人員、時間；實測登入、新增、保存、重開、修改再查、登出清空、撤除允許資格拒絕及還原；Google資料由另一連線讀回 | 僅列項實測通過可完成；手機、另一帳號、真實照片與ChatGPT／LINE接線各自標示，不混用模擬回條。 |

公開設定只包含原 Google 登入路由。單元測試核對同頁導覽、未登入頁拒絕讀寫、舊片段不能改目的地、工作頁返回連結及後端允許名單／操作白名單；不以模擬結果替代 Safari 與手機實測。Google服務及資料仍在原資源，沒有新增付費後端、網域或分享。
