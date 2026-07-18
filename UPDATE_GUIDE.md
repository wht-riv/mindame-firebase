# GitHub更新手順

## 重要
このZIPを展開し、`mindame-firebase-v2` フォルダー自体ではなく、**中身**をGitHubリポジトリ直下へアップロードします。

## 1. 現在の状態をバックアップ
GitHubのブランチ選択で `backup-before-v2` を作成し、その後 `main` に戻ります。

## 2. 不要な二重フォルダーを削除
現在のリポジトリ直下にある `mindame-firebase` フォルダーは重複です。リポジトリ直下の `src`、`package.json` などが実際にビルドされます。バックアップ後、重複フォルダーは削除して構いません。

## 3. Firestoreルールを先に更新
Firebase Console → Firestore → ルールで、このZIPの `firestore.rules` の内容を全文貼り付けて公開します。

## 4. GitHubへアップロード
GitHub → Code → Add file → Upload files で、ZIPを展開したフォルダーの中身をアップロードします。

アップロード対象：
- `.github/workflows/deploy.yml`
- `src/`
- `index.html`
- `package.json`
- `package-lock.json`
- `vite.config.js`
- `firebase.json`
- `firestore.rules`
- `.gitignore`
- `.env.example`
- `README.md`
- `UPDATE_GUIDE.md`

コミットメッセージ例：`Update Mindame to v2`

## 5. GitHub Actionsを確認
Actions → Deploy to GitHub Pages → 最新の実行が緑になるまで待ちます。

## 6. 動作確認
`https://wht-riv.github.io/mindame-firebase/?v=2` を開き、テストコード `TEST-001` で確認します。

## 7. Firebaseで確認
Firestoreに以下が作成されます。
- `participantsV2`
- `publicPostsV2`

旧版の `participants` と `publicPosts` はそのまま残るため、旧データと混ざりません。

## 8. LINE Bot
LINE BotのボタンURLは次に設定してください。
`https://wht-riv.github.io/mindame-firebase/`

通知文例：
「今日、止まりそうな理由と最初の一歩を考えてみませんか。昨日できなかったとしても、今日のことから再開できます。」
