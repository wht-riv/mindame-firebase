# v5 更新手順

## Firebase更新が必要
🌱リアクションへ変更したため、ZIP内の `firestore.rules` をFirebase ConsoleのFirestoreルールへ全文貼り付けて公開してください。

## GitHub
1. ZIPを展開します。
2. `mindame-firebase-v5` フォルダーの中身をGitHubリポジトリ直下へアップロードします。
3. `package.json` と `package-lock.json` を必ずセットで更新します。
4. `Update Mindame to v5` としてmainへコミットします。
5. Actions成功後、公開URLを `?v=5` 付きで確認します。

## テスト項目
- 言い訳集が、実際にできなかった理由の回数順だけになる
- 予測と違う理由は、実際の理由側に加算される
- みんなの記録に「言い訳 → 最初の一歩」が表示される
- 全ジャンルの記録が表示される
- 🌱を選択・解除でき、件数が表示される
