# v4.2 更新手順

## Firebase
v4用のルールを公開済みなら、Firebase側の更新は不要です。

## GitHub
1. ZIPを展開します。
2. `mindame-firebase-v42` フォルダーの中身をGitHubリポジトリ直下へアップロードします。
3. `package.json` と `package-lock.json` は必ず両方アップロードします。
4. `Update Mindame to v4.2` としてmainへコミットします。
5. Actionsが成功したら `?v=4.2` を付けて確認します。

## 最低限の上書き対象
- `src/App.jsx`
- `src/styles.css`
- `package.json`
- `package-lock.json`
- `README.md`

## テスト項目
- 初回登録は3つちょうどでのみ保存できる
- 自由入力した最初の一歩が次回候補へ出る
- 予測と違う実際の理由が、その理由側へ加算される
- 言い訳集が止まった回数順になる
- 公開画面に「ネタ」という表現がない
