# GitHub 主介面候選

Adam 已再次明確確認：網站主介面及未來 AI 聊天均留在原 GitHub 網址；Google 保存資料與原圖。先前「登入後轉到 Google 工作頁」不再作為這個目標的完成方案。

本候選沿用同一套 SENJIE 畫面與程式，`node scripts/build-github-preview.mjs` 產生明示虛構的 GitHub 頁面。可走名片卡片／列表、搜尋、各模組及兩回合對話示例。人物修改只留本頁；示例偏好以專用鍵保存於此瀏覽器並讀回。沒有網站登入、真資料 API、真實 AI 或帳單。原正式入口暫保留，避免把未接資料的候選取代現有可用功能。

`web-api-transport.js` 已實作不導覽離站的前端連線層，僅接受明確配置的 HTTPS endpoint 與登入提供者。先由服務確認 session 才讀寫，保留原請求編號及版本；401／403 清掉各模組與在途回應；憑證只留記憶體，不放網址或持久儲存。現有表單、收件匣及偏好可使用此介面。這是待服務 owner 審核的客戶端契約，不宣稱現有 Google 或 LINE 後端已支援它。

## 作者已實測的精確範圍

2026-11-27 在 ChatGPT App 內瀏覽器開啟已發布候選，實際走名片模組、人物修改後重開、追蹤、收件匣、入口與資料、兩回合對話及本機偏好整頁重開讀回；各頁網址均留在原 GitHub 網域。320／390 的每種尺寸均量測七個畫面（含人物詳情），根元素無水平溢出、對話框在視窗內；390 對話入口一次點擊定位失敗後，以 Enter 進入。這是候選與 App 內瀏覽器的證據，不是 Safari／實體手機、真資料登入或 AI 聊天通過。

全套 141 項程式測試通過。正式驗收範圍已加入「登入後仍留 GitHub／本人資料讀寫／其他身分拒絕」三項必要檢查；目前全部尚未取得實站證據，整站不通過。Safari 原圖已在原 Mac mini 重現空白頁及 `The operation is insecure`，共用連結修正仍未部署到原 Google v13。

## 已核對的依賴

- 第一組原帳 `G1_website_contract_existing_20261127`：目前只有虛構展示欄位，沒有已批准、走通的網站登入／私人資料 API。LINE webhook 及 Mac 金鑰試跑不能代替網站身分證明。
- 原 SENJIE Apps Script 設定仍為 GCP 預設專案。若採 `scripts.run` 路徑，Google 要求共同標準 Cloud 專案、OAuth 及 API executable；現有預設專案不符合，尚未遷移或新增。參見 [Google 官方 API 條件](https://developers.google.com/apps-script/api/how-tos/execute)。
- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) 承載 HTML／CSS／JavaScript；AI 執行及私人資料授權仍需服務端能力。網站留在 GitHub，不等於把模型金鑰、私人資料或後端執行放入公開儲存庫。

## 複查與下一個最小差異

| 順序 | 目標 | 做法 | 檢查點 |
| --- | --- | --- | --- |
| 1 | 固定 GitHub 主介面 | 在此候選走各頁與詳情，對話示例及本機偏好重開讀回。 | 網址持續留在 GitHub，沒有 Google 工作頁或連線常駐視窗。 |
| 2 | 資格化安全資料路徑 | 原作者與原服務 owner 提出確切 endpoint、身分提供者、服務端驗證、原 Google 窄權限檔案可讀及部署／費用差異。 | 未具備已核准契約前不填猜測網址、不接真資料、不改匿名部署或分享。需要新憑證／權限時，交原統籌備妥最小必要決策。 |
| 3 | 複查機制 | 同原驗收者從森捷網站驗證本人可讀寫、其他身分拒絕、登出清空、版本與重試保護、上傳歸檔與 Safari 原圖。 | 只有本機 HTTP fixture 與 DOM 測試不算實站通過。AI 聊天需另外有真實服務回覆證據；此候選沒有呼叫模型。 |
