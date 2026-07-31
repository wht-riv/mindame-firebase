# v5.4 更新手順

1. ZIPを展開します。
2. `mindame-firebase-v54` フォルダー自体ではなく、その中身をGitHubリポジトリ直下へアップロードします。
3. `package.json` と `package-lock.json` は必ずセットで更新します。
4. mainブランチへ `Update Mindame to v5.4` としてコミットします。
5. GitHub Actionsの最新実行が成功したら、公開ページを `?v=5.4` 付きで開きます。

## Firebase

v5.3のFirestoreルールと匿名認証を設定済みなら、Firebase Console側の更新は不要です。保存先と権限構造は変更していません。

## 本番実験前

`src/App.jsx` の `const DEMO_MODE=true;` を `const DEMO_MODE=false;` に変更してください。
