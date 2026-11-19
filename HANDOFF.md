# 施工接手紀錄

## 使用者明確要求

- 若 Mac Pro／MacBook Pro 關機，後續施工由 Mac mini（Codex 主機）接續；正式網站與 LINE 不應依賴 MacBook Pro 常駐。
- 本次實際核對執行主機為 MacBook Pro，尚未驗證已切到 Mac mini。機型硬體查詢遭限制，未推定型號；個人主機名稱與帳號不存入公開專案。
- 網站網址必須先讓 Adam 確認；專案為使用者建立的 SENJIE。沒有新增付費、購買網域或公開私人資料的授權。

## 已完成

- GitHub 專案：break777tw-sys/SENJIE，公開程式碼，只含虛構資料。
- 名片搜尋、篩選、編輯、聯絡資料欄位、追蹤清單、多圖本頁預覽。
- Google Apps Script 讀寫來源程式：身分 allowlist、鎖定、預期版本、請求防重、歷史追加及讀回驗證。
- 11 項 Node 測試通過，包含模擬 Google 服務的權限、衝突、重送與危險輸入測試；不是 Google 帳號端到端驗收。
- 建置指令：node scripts/build.mjs。輸出 dist/index.html 與 google-apps-script/Index.html，不提交生成檔。

## 阻礙與下一步

1. 本機 HTTP server 無法綁定連接埠；瀏覽器拒絕 file 協定預覽。未繞過限制。版面與瀏覽器操作仍未驗收。
2. Google 正式總表、原圖資料夾、Apps Script 專案及授權部署尚未完成。讀寫程式不可宣稱已接通。
3. LINE AI 的既有主機、接收服務、簽章驗證及帳號權限待盤點。不得把未驗證的事件直接交給 Apps Script。
4. 來源媒體保存、辨識、逐欄確認履歷與 ChatGPT／dot 共同後端尚未完成。
5. 正式網站 URL 與顯示名稱待 Adam 確認；尚未啟用 GitHub Pages 或其他網站發布。
6. Mac mini 接手需在該主機確認帳號、可取得此專案與測試執行；僅保存 GitHub 並不代表施工已自動移轉。

## 資料原則

正式資料維持 Google Sheets／Drive，不加入 Google 聯絡人。個資、原圖與憑證不寫入公開專案。任何入口都必須經過身分驗證；資料查詢失敗不可回退成舊對話或示範結果。跨入口沿用同一人物 ID、版本與操作編號。
