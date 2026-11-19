# SENJIE 本機照片測試包

本入口只測既有公開虛構正面、反面與重複正面，**沒有Google請求、OAuth、真正圖像辨識或人物歸檔**。它不是正式網站，不是已建立的隔離雲端站。Node24實測，不需npm或外部套件。僅綁定127.0.0.1，不開放區域網路或手機遠端存取。

在同一SENJIE根目錄執行：

```sh
node experiments/drive-file/local/server.mjs --data-dir /absolute/path/to/local-work-directory --port 8788
```

使用啟動結果實際印出的URL開啟本機入口。資料目錄必須是本機受控工作位置，不能放Google Drive同步根目錄或公開repo；不要換資料目錄後宣稱讀回原資料。Ctrl+C正常停止後，以同一指令及同一資料目錄重啟。它會沿用local-state.json；沒有localStorage依賴，也不會因重整頁面新增收件。

## 可保留的紀錄與讀回

- local-state.json保存明確LOCAL_SIMULATION標記、原圖PNG位元組、模擬OCR文件與文字、來源穩定ID／SHA-256、OCR結果SHA-256、收件操作編號、來源歷史版本及事件。用暫存檔＋檔案fsync＋原子更名保存，限制同一目錄僅一個寫入程序；正常重啟與已保存後強制終止的恢復已測，不擴張成整機斷電保證。
- 重複正面重用原圖與OCR文件，保留原有結果，不抹掉辨識狀態；新收件使用新操作編號，相同操作重試不多記收件。此驗證限制100次收件，不提供刪除／清空按鈕。
- 原圖讀回實際取保存位元組並重算SHA-256；結果讀回先核對來源ID、文件位置及來源雜湊，再重新匯出模擬文件文字比對結果SHA-256。資料遭改動會停止讀取，不展示未核對結果。
- 測試入口只接受front／back／front-repeat固定fixture代號，不接受任意檔案或私人照片。顯示的mock文字是預設字串，沒有從圖像推理或辨識。
- 本機應用層403是實際HTTP結果；提供者404由fake Drive產生，是模擬，不能作Google OAuth隔離證據。案外ID在registry檢查前不會交給fake媒體讀取。跨來源資料請求及錯誤Host也拒絕；靜態頁面允許正常導覽。

## 複驗

```sh
node --test tests/local-photo-lab.test.js
node --test tests/*.test.js
node scripts/build.mjs
```

本包新增8項測試，全套43項通過；包含全新程序重啟、已保存後強制終止、原圖與結果遭改動拒絕、匯出失敗續辦及實際loopback HTTP。另在Mac mini Chrome操作三次收件、整頁重載、服務程序重啟後再重載與案外拒絕通過；這些是真實本機測試，Google服務與OCR仍為模擬。新包的原獨立驗收尚待複驗。

| 順序 | 目標 | 做法 | 檢查點 |
| --- | --- | --- | --- |
| 1 | 啟動唯一測試程序 | 指定絕對資料目錄、固定本機port，以啟動回條URL開頁 | 模式為LOCAL_SIMULATION_NO_GOOGLE；未建立Google資源；不改現站。 |
| 2 | 保存固定虛構照片 | 按「載入虛構正面、反面、重複正面」 | 3次收件、2原圖、2模擬OCR文件、Google呼叫0、人物0；不是一人一卡歸檔驗收。 |
| 3 | 重開及重啟讀回 | 整頁重載，再Ctrl+C／同資料目錄重啟，按「重新讀取保存紀錄」 | 來源ID不變，原圖SHA及OCR結果SHA吻合；沒有重新載入fixture才恢復。 |
| 4 | 驗證拒絕與故障 | 按案外拒絕；執行本包測試注入修改、匯出失敗與程序終止 | 應用層403與模擬提供者404分開；原圖仍可保存續辦；錯誤不當作辨識成功。 |
| 5．複查機制 | 比對預期、實際與證據 | 原驗收者記來源提交、Node版本、資料目錄、重啟前後ID／hash、HTTP狀態及複查時間 | 本Local主窗於2026-11-19自行複查43項與Chrome範圍通過；Google／真實OCR及新包獨立驗收未確認。 |

## 建立隔離環境前的唯一必要決策

**是否允許在同一SENJIE來源與既有Drive專案目的地下，建立僅供虛構資料驗收的獨立Apps Script＋標準GCP／Picker容器，保留現行站及其GCP／網址／權限不動？**

這是一項環境範圍決策，不是要求放行全Drive／Documents。獲核後仍需先完成雲端入口接線、受限制API key及Picker設定，再於可執行時由本人檢視drive.file（如沿用身分核對再加userinfo.email）及選取本案資料夾。現在不需登入、守畫面或授權；本輪沒有建立Google資源、設定計費或變更分享。

本包Node HTTP外殼不直接部署為Apps Script；雲端仍需使用同一ScopedPhotoStore接Google Advanced Drive及受控持久化registry，並實測媒體Blob回傳與OCR。人物Google歸檔另關，不能以本機原圖／mock結果讀回代表整套照片流程完成。
