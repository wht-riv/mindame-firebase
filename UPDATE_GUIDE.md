# v3更新手順

## 重要：先に匿名認証を有効化
1. Firebase Consoleを開く
2. 「Authentication」→「始める」
3. 「Sign-in method」→「匿名」
4. 「有効にする」→「保存」

## Firestoreルール
ZIP内の `firestore.rules` をFirebase ConsoleのFirestoreルールへ全文貼り付けて公開します。

## GitHub
1. `backup-before-v3` ブランチを作る
2. ZIPを展開する
3. フォルダー自体ではなく、中身をリポジトリ直下へアップロードする
4. `Update Mindame to v3` としてmainへコミットする
5. Actionsが緑になるまで待つ

## テスト
`TEST-001` を使い、次を確認します。
- 初回設定
- 言い訳予測と最初の一歩
- 次回起動時の実行／未実行
- 一致／不一致／理由不明
- 言い訳予測レポート
- 最近のペース
- みんなの言い訳

## 新しい保存先
- `participantsV3/{匿名UID}`
- `publicPostsV3`

旧版データとは混ざりません。
