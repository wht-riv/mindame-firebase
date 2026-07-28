# v4.1 更新手順

1. FirebaseのFirestoreルールはv4のままで利用できます。
2. ZIPを展開します。
3. `mindame-firebase-v41` フォルダーの中身をGitHubリポジトリ直下へアップロードします。
4. `package.json` と `package-lock.json` は必ず両方アップロードしてください。
5. `Update Mindame to v4.1` としてmainへコミットします。
6. Actionsが成功したら `?v=4.1` を付けて表示を確認します。

## 変更ファイルだけ更新する場合
最低限、以下を上書きします。
- `src/App.jsx`
- `package.json`
- `package-lock.json`
- `README.md`

## デモ終了後
`src/App.jsx` の `const DEMO_MODE=true;` を `false` に変更します。
