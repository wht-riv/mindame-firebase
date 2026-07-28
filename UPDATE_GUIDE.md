# v4 更新手順

1. GitHubで `backup-before-v4` ブランチを作成します。
2. Firebase Consoleで匿名認証が有効であることを確認します。
3. Firebase Console → Firestore Database → ルールで、ZIP内の `firestore.rules` を全文貼り付けて公開します。
4. ZIPを展開し、`mindame-firebase-v4` フォルダーの**中身**をGitHubリポジトリ直下へアップロードします。
5. `Update Mindame to v4` としてmainへコミットします。
6. GitHub Actionsが緑になったら、公開URLを `?v=4` 付きで開きます。
7. テストコード `TEST-001` で一周確認します。

## 新しい保存先
- `participantsV4/{匿名UID}`
- `participantsV4/{匿名UID}/records/{YYYY-MM-DD}`
- `publicPostsV4`
- 投稿下の `reactions` と `replies`

## 確認項目
- 開いた直後にホームが表示される
- 前回の未回答が「振り返り」に出る
- 今日の作戦が登録済みなら再登録ボタンが出ない
- 下部3タブが動く
- 三分類バーが表示される
- 言い訳集が使用回数順になる
- 全ジャンルの投稿にジャンルラベルが付く
- あるある／ないないを選択・切替・解除できる
- 一人一返信を送信・削除できる
