# SENJIE 單筆唯讀隔離候選 C1

依原總統籌本輪精確 scope：原 GitHub 前端、虛構 popup 身分 A/B、GET `/v1/me/record` 單筆六欄、成功／取消／未登入／拒絕後清空。正式入口、原名片作業與 Google 配置未改。本資料夾不接 Firebase SDK、真 OAuth、真資料、LINE 或模型。

本頁的 API 由 `demo-fixture.js` 在瀏覽器內離線模擬，A/B 回應不是服務端授權證明；`readonly-client.js` 可注入另一個已核身分／API，但本輪沒有配置這種連線。虛構字串均不是憑證。

操作：`node scripts/serve-readonly-candidate.mjs`，開啟終端顯示的本機網址。伺服器只提供白名單候選資產，不提供工程目錄或私人驗收檔。

1. 按虛構登入並在 popup 選 A，原頁顯示六欄一筆示例。
2. 已顯示資料時重新登入，選取消或關 popup；原頁清空且不呼資料 API。
3. A 成功後重新登入選 B，模擬 403，原頁不再顯示前次資料。
4. A 成功後選 401／403／404／503／錯欄位／網路未知，再按重新讀取，原資料立即清空。
5. 登出或重整頁面，登入及資料不保留；未登入重新讀取不呼資料 API。

測試：`node --test tests/readonly-client.test.js`。包含本機 HTTP GET 接收、取消／阻擋、不持久化、晚到回應、嚴格六欄與 UTF-8 上限；不驗 JWT 簽章或真 Google issuer。

最後複查須分開作者離線結果、真瀏覽器 popup／畫面、原驗收者複驗及真平台。Safari 原圖與實體手機真登入沿原未通過／未確認狀態，不因本候選而改判。
