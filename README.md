# 名片管理網站草稿

GitHub 專案為 Adam 建立的 `break777tw-sys/SENJIE`。網站顯示名稱與正式網站網址仍待 Adam 確認，不自動啟用 Pages 或其他網站發布。本目錄名稱僅為本地工作目錄。

## 已實作

無外部套件依賴的 HTML/CSS/JavaScript 網頁，提供響應式名片卡片與列表、關鍵字及分類篩選、人物與聯絡方式編輯、疑似重複阻擋、追蹤清單，以及多圖選取／拖曳預覽。單獨開啟時只包含虛構資料，頁面內修改不持久保存，重新整理還原。

另已撰寫 Apps Script 讀寫來源程式：驗證 Google 身分、版本衝突保護、操作重送去重、追加歷史版本及保存後讀回驗證。只有經授權部署並通過真實 Google 驗收後才算連線完成。此程式透過 Apps Script HTML Service 執行，GitHub Pages 並不會直接取得私人資料。

## 尚未接通

Google Sheets、Drive、身分驗證、圖片辨識、LINE、dot、ChatGPT 共同後端均尚未接通。收件預覽不會上傳圖片；追蹤日期不會建立通知。此草稿不應被視為正式名片保存系統。

## 本地預覽與檢查

在本目錄執行 `python3 -m http.server 8765 --bind 127.0.0.1`，開啟終端顯示的本機網址。支援 Node.js 時可執行 `npm test` 或 `node --test tests/*.test.js`。執行 `node scripts/build.mjs` 產生不依賴外部資產的 `dist/index.html` 與 `google-apps-script/Index.html`；生成檔不提交，避免維護重複來源。

Google 部署步驟見 [google-apps-script/SETUP.md](google-apps-script/SETUP.md)。程式邏輯已以模擬服務驗證，尚未完成 Google 實際連線及瀏覽器版面測試。本機 HTTP 預覽在目前執行環境被限制，未繞過。

## 正式架構界線

- GitHub 儲存程式碼，初始採私人專案；真實名片、原圖、憑證及金鑰不得提交。
- Google Sheets 保存唯一正式資料；Drive 保存原圖；不加入 Google 聯絡人。
- 網站、ChatGPT、LINE 與 dot 經同一份版本化資料合約讀寫。網站必須由後端授權，不能把私人資料預先打包進靜態檔。
- LINE 的既有接收服務尚待盤點。需驗證原始請求與 LINE 簽章，限制授權使用者，依 webhookEventId 去重，儘快保存媒體，再非同步辨識。Apps Script 不直接承擔未驗證的 LINE webhook。
- 人物 ID、名片來源 ID、匯入任務 ID 分開；正反面不重複計人；重送不重複建檔；歷年任職不無聲覆蓋。
- 確認按鈕須綁定任務、人物及版本。圖像來源、逐欄確認狀態與推論分開。
- 所有入口在真實 Google 資料讀回與端到端驗收後才標記已接通。無法歸檔要回報待歸檔。
- 後端服務、AI 成本、網域、網站公開與正式部署尚未決定。不要啟用計費或公開資料。

## 上線前驗收

先驗證新增、核對、修改、查詢與讀回；再驗證未授權存取、LINE 重送、跨入口版本、辨識失敗重試及批次進度。以實際測試結果決定託管方式，不把畫面原型當成已完成的串接。
