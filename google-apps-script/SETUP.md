# Google 部署與驗收

本程式尚未部署。需由擁有者確認 Google 授權與正式網站網址後才進行。網站原始碼與 Google 資料權限是兩個不同的邊界。

1. 選定唯一正式 Google 試算表，不包含真實資料的公開複本。將 ID 存到 Apps Script 的 Script Properties：`SPREADSHEET_ID`。
2. 設定 `ALLOWED_EMAILS` 為擁有者核准的電子郵件清單。不要把實值提交 GitHub。
3. 執行 `node scripts/build.mjs`，將產生的 `Index.html`、本目錄的 `Code.gs` 及 `appsscript.json` 放入同一 Apps Script 專案。
4. 在編輯器執行 `initializeRecords_` 建立 Records 分頁；已存在時會停止，不覆蓋。初始化不建立新試算表、不變更分享、不加入聯絡人。
5. 以「存取網頁應用程式的使用者」身分部署，選擇最小可用受眾。不得為了繞過空白身分而關閉後端 allowlist。授權者必須具備該表讀寫權限。
6. 私人 Google One 帳號的 OAuth、同意畫面、嵌入及多重登入必須實測；未通過前不宣稱上線。此程式只使用試算表與身分 scope，尚不保存 Drive 圖片。
7. 驗收一筆虛構名片：新增→讀回→修改→重新載入→檢查歷史；以不同版本同時修改時須拒絕舊版本；以未授權帳號測試拒絕存取。

Records 採完整版本逐列追加，原資料不覆蓋。每次保存包含操作編號並在鎖內檢查版本與去重。此實作適合小規模驗證，超過 10,000 筆版本時停止完整掃描而非截斷；大規模需後端分頁或索引，不承諾無限容量。不得直接手改 Records 的版本、ID 或 JSON。

LINE 接收端、來源媒體保存、逐欄確認履歷及跨入口服務身分尚未完成。LINE／dot／ChatGPT 不得以公開匿名 doPost 直接繞過這套使用者授權。正式多入口需要受驗證的共同服務，並沿用人物 ID、預期版本與操作編號。

來源：
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/reference/base/session
- https://developers.google.com/apps-script/guides/html/communication
- https://developers.google.com/apps-script/reference/lock/lock
