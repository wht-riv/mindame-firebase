# 公開手順（初心者向け）

## 1. Firebaseを作る
1. Firebase Consoleで「プロジェクトを追加」し、名前を `mindame` にします。
2. 「アプリを追加」からWeb（`</>`）を選び、アプリ名を `mindame-web` にします。
3. 表示される `firebaseConfig` の6項目を控えます。
4. 左メニュー「ビルド」→「Firestore Database」→「データベースを作成」。本番モードを選択し、リージョンは近い場所を選びます。

## 2. Firestoreルール
Firebase Console → Firestore Database → ルールで、ZIPの `firestore.rules` を貼り付けて「公開」します。

## 3. GitHubへアップロード
新しいPublicリポジトリを作成し、このフォルダーの中身をリポジトリ直下へアップロードします。`.github`は隠しフォルダーなので、GitHub上で `.github/workflows/deploy.yml` を新規作成しても構いません。

## 4. GitHub Secrets
リポジトリ → Settings → Secrets and variables → Actions → New repository secret で以下を登録します。

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_ADMIN_CODE`（任意の管理コード）

値にはFirebaseのWebアプリ設定を入れます。引用符は不要です。

## 5. GitHub Pages
Settings → Pages → Sourceを `GitHub Actions` にします。Actionsの `Deploy to GitHub Pages` が緑になれば公開完了です。

## 6. 動作確認
1. 公開URLを開く。
2. `MD-001`で初回設定。
3. 別ブラウザで`MD-002`を作る。
4. Firebase ConsoleのFirestoreに `participants` と `publicPosts` が作成されることを確認します。

## 7. 研究データ
Firestore Consoleからコレクションを確認できます。分析時はFirebaseのエクスポート機能、または後日追加する管理画面のCSV出力を使用してください。

## 注意
この版は参加コードのみの簡易識別です。参加コードを本名・学籍番号にしないでください。実験参加者にはコードを他人へ共有しないよう案内してください。
