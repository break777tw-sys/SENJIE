# 名片管理網站草稿

## 本輪限制：暫停完整 Drive／文件授權，保留現行網站

先前照片候選版的完整 Drive／Documents 放行請求已暫停；請勿依較早段落操作未驗證提示或部署該候選。現行私人網站保持原狀。本輪只增加 [drive.file離線實驗](experiments/drive-file/README.md)，原圖、OCR與案外拒絕的7項fake測試通過，全套28項；沒有Google真實最小scope／OCR回條。未改雲端編輯器、授權、部署或分享。需要同一應用程式的逐檔案授權與Picker前置條件，目前尚未具備。以下較早照片進度保留為歷史，由本段限制優先。

完整產品目標、四入口、資料規格、批次流程、驗收關卡與接手檢查見 [HANDOFF.md](HANDOFF.md)。保留最初六項目標，不以目前畫面原型代表完整交付。

GitHub 專案為 Adam 建立的 `break777tw-sys/SENJIE`。網站顯示名稱與正式網站網址仍待 Adam 確認，不自動啟用 Pages 或其他網站發布。本目錄名稱僅為本地工作目錄。

## 已實作

無外部套件依賴的 HTML/CSS/JavaScript 網頁，提供響應式名片卡片與列表、關鍵字及分類篩選、人物與聯絡方式編輯、疑似重複阻擋、追蹤清單，以及多圖選取／拖曳收件。單獨開啟時只包含虛構資料，頁面內修改不持久保存，重新整理還原。

Apps Script 讀寫程式包含 Google 身分驗證、版本衝突保護、操作重送去重、追加歷史版本及保存後讀回驗證。2026-11-19 已在私人隔離專案，以虛構資料通過後端及網站列項驗收。此程式透過 Apps Script HTML Service 執行；GitHub 保存程式版本，網站執行與資料保存仍在 Google。

## 本輪照片流程（待 Google 新增授權實測）

已實作照片上傳、Drive 原始位元組保存與 hash 讀回、收件與來源去重、Drive OCR 原文及保守欄位候選、正反面手動配對、逐欄確認後建立一個人物，以及來源／確認履歷。辨識失敗保留原圖；重試使用相同操作編號，歸檔中斷後可恢復。原圖、辨識文字、人物資料分階段保存，沒有確認就不建立人物。人物資料可回到 Drive 原圖。

21 項本機模擬測試與建置通過，包含虛構正面、反面、重複正面對到 3 次收件、2 張不重複原圖、1 張實體卡、1 位人物，以及未授權四個端點與歸檔部分失敗重試。這不是實際 Google OCR 或瀏覽器上傳驗收。新增 Drive／Documents OAuth 畫面已要求擁有者確認；尚未更新現行私人網站版本 1。

照片後端為 Code.gs＋Imports.gs，依序以單一換行串接；私人隔離驗收可再加單一換行與 Acceptance.gs。HTML 組裝方式不變。部署候選設定為 deployment/photo-runtime-manifest.json；正式範本 google-apps-script/appsscript.json 具有相同服務與 scope、無 webapp 受眾設定。版本 1 歷史快照 acceptance-runtime-manifest.json 保留；目前 HEAD 含新功能，已不宣稱 HEAD 重建舊版本 1。

可複驗的兩張虛構 PNG 以 base64 保存在 tests/fixtures/photo-cards.json，沒有真實名片。執行 `python3 scripts/make-photo-fixtures.py /absolute/local/output-directory` 可還原正面、反面與位元組相同的重複正面；腳本先核對 SHA-256，不呼叫 Google、不需要外部套件。上傳這三個檔案後預期收件三次、原圖兩張；必須選取正反面、逐欄核對並明確確認才歸檔。此 fixture 供後續實際網站與獨立複驗使用，目前未宣稱已完成真實 OCR。

限制：單張原圖至多 10 MB；此階段 OCR 僅 2 MB 內 JPEG／PNG。WebP 原圖會保存但要另提供 JPEG／PNG 供 OCR。多卡同框需先拆分；正反面不猜配。QR 尚未解碼，沒有背景工作常駐與自然語言找人。未接 LINE／dot／ChatGPT，也未寫入 Google 聯絡人。正式多人安全、容量、手機及實際名片仍需驗收。設定、範圍與檢查順序見 [SETUP.md](google-apps-script/SETUP.md)。

## 前一輪已驗收範圍與版本組裝（9000d7d）

2026-11-19 的私人驗收網站使用 Apps Script 版本 1，設定為以存取者身分執行、只有本人可存取。已實測既有 Google 登入工作階段進入網站、表單新增與保存、整頁重新載入、修改與再查。暫撤 allowlist 資格後，網站讀寫與入口均拒絕，資料未變；無 Cookie 的 HTTP 請求導向 Google 登入。允許帳號已還原。另一 Google 帳號、手機／Mac Pro 實機及正式業務資料未驗收。

已從不可變的版本 1 讀回下列三個檔案，逐字核對組裝內容；私人專案、部署、試算表 ID、帳號實值與原始回條不放入公開儲存庫。

| Google 版本 1 檔案 | 本儲存庫來源 | 對應方式 |
| --- | --- | --- |
| 程式碼.gs | google-apps-script/Code.gs、google-apps-script/Acceptance.gs | 依序以單一換行串接；Acceptance 僅屬私人隔離驗收，不納入正式業務部署。 |
| Index.html | index.html、style.css、model.js、transport.js、app.js | 由 scripts/build.mjs 建置；生成檔不提交。 |
| appsscript.json | deployment/acceptance-runtime-manifest.json | 保存已驗收部署的實際設定，沒有帳號或資源 ID。 |

`google-apps-script/appsscript.json` 仍是明確宣告試算表與身分 scope 的正式部署範本；它與此次由 Google 推導權限、含 webapp 設定的隔離部署快照分開保存，不宣稱範本已部署。這是上一輪同步的精確範圍；新照片候選版另列於上節。

| 順序 | 目標 | 做法 | 檢查點 |
| --- | --- | --- | --- |
| 1 | 固定來源 | 使用同一 Git 提交中的來源檔，不混用其他版本。 | Git 提交、來源 blob 與建置腳本可核對。 |
| 2 | 重建網站與隔離後端 | 執行 node scripts/build.mjs；將 Code.gs、單一換行及 Acceptance.gs 依序串接。 | 生成 Index.html 與隔離後端可對照，不包含私人設定。 |
| 3 | 對應部署設定 | 私人隔離驗收對照 deployment/acceptance-runtime-manifest.json；正式部署另按 SETUP.md 配置。 | 不把隔離測試函式或設定當成正式業務已上線。 |
| 4．複查機制 | 核對預期與實際 | 比對生成後端、HTML 與部署快照的完整內容及 SHA-256；本輪由原 Local 主窗於 2026-11-19 自行複查，詳細證據私存。 | 預期與實際三檔吻合範圍通過；另一帳號與實機裝置未確認，不擴張完成範圍。 |

## 尚未接通

正式名片總表、LINE、dot 與 ChatGPT 共同後端尚未接通；已驗收的是私人網站版本 1 與虛構 Google 資料。照片流程目前屬候選來源與模擬驗證；追蹤日期不會建立通知。此草稿不應被視為正式名片保存系統。

## 本地預覽與檢查

在本目錄執行 `python3 -m http.server 8765 --bind 127.0.0.1`，開啟終端顯示的本機網址。支援 Node.js 時可執行 `npm test` 或 `node --test tests/*.test.js`。執行 `node scripts/build.mjs` 產生不依賴外部資產的 `dist/index.html` 與 `google-apps-script/Index.html`；生成檔不提交，避免維護重複來源。

Google 部署步驟見 [google-apps-script/SETUP.md](google-apps-script/SETUP.md)。既有 11 項模擬測試與建置已通過；私人隔離網站另已完成上述真實 Google 及桌面瀏覽器列項驗收，未代表完整裝置版面驗收。先前本機 HTTP 預覽受到限制，未繞過。

## 正式架構界線

- GitHub 現有儲存庫為公開專案，只保存程式碼與虛構測試資料；真實名片、原圖、憑證、金鑰及私人授權紀錄不得提交。
- Google Sheets 保存唯一正式資料；Drive 保存原圖；不加入 Google 聯絡人。
- 網站、ChatGPT、LINE 與 dot 經同一份版本化資料合約讀寫。網站必須由後端授權，不能把私人資料預先打包進靜態檔。
- LINE 的既有接收服務尚待盤點。需驗證原始請求與 LINE 簽章，限制授權使用者，依 webhookEventId 去重，儘快保存媒體，再非同步辨識。Apps Script 不直接承擔未驗證的 LINE webhook。
- 人物 ID、名片來源 ID、匯入任務 ID 分開；正反面不重複計人；重送不重複建檔；歷年任職不無聲覆蓋。
- 確認按鈕須綁定任務、人物及版本。圖像來源、逐欄確認狀態與推論分開。
- 所有入口在真實 Google 資料讀回與端到端驗收後才標記已接通。無法歸檔要回報待歸檔。
- 後端服務、AI 成本、網域、網站公開與正式部署尚未決定。不要啟用計費或公開資料。

## 上線前驗收

先驗證新增、核對、修改、查詢與讀回；再驗證未授權存取、LINE 重送、跨入口版本、辨識失敗重試及批次進度。以實際測試結果決定託管方式，不把畫面原型當成已完成的串接。
