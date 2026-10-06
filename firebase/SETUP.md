# オンライン対戦の Firebase 設定

サイトは GitHub Pages で配信し、ロビー・申請・回答を Firebase Realtime Database で同期します。ユーザーは名前だけを入力します。ゲストは匿名認証、アカウント対戦はメール／パスワード認証を使用します。ログイン・レーティングの追加設定は [ACCOUNTS.md](ACCOUNTS.md) を参照してください。Analytics は使用しません。

## Firebase Console での設定

1. `sankakufunction` プロジェクトの Authentication → Sign-in method で **匿名（Anonymous）** を有効にします。
2. Realtime Database を作成します。本番モードで開始してください。表示されるデータベース URL を `firebase-config.js` の `databaseURL` に指定します。地域によって URL が異なるため、Console の URL をそのまま使います。
3. Realtime Database → ルールに [database.rules.json](database.rules.json) の内容を設定し、公開します。既存のデータベースを使う場合は、既存ルールを保ったまま `trigBattle` 配下のルールを統合してください。全体を公開読み書きにしないでください。
4. Authentication → Settings → Authorized domains で `lit-kei.github.io` を追加します。API キーのリファラーを制限している場合は GitHub Pages の公開 URL と開発用ホストを許可し、Identity Toolkit / Token Service / Firebase Realtime Database に必要な API の使用を許可します。
5. `main` に設定変更を反映し、GitHub Actions の公開完了後、別々のブラウザーまたは端末から `battle.html` を開いて動作を確認します。

`apiKey` を含む Web 用 `firebaseConfig` はブラウザーで公開する設定です。サービスアカウントの秘密鍵、管理用トークンはサイトに入れないでください。

## 動作

- 1対1。ロビーの待機中プレイヤーに申請し、相手が承諾すると5秒後に開始します。対戦申請は60秒で取り消します。
- 申請側が度数法／弧度法を選び、両者に同じ単位・同じ順番で10問を出題します。範囲は −5π〜5π（−900°〜900°）です。
- 誤答は記録され、同じ問題に回答し直せます。1試合200回まで回答できます。
- サーバーの時刻で回答到着を記録し、10問目の正解が先に到着したプレイヤーを勝者とします。端末の時計には依存しません。通信速度の差は結果に影響します。
- ロビーには15秒以内に接続を確認できた参加者を表示します。切断時は `onDisconnect` で参加情報を削除します。接続が戻ると復帰します。相手の切断を表示しますが、自動で勝敗を決めず、必要に応じて対戦を終了できます。
- 「対戦をやめる」は降参として扱います。通常のページ退出時も終了を試みますが、端末やブラウザーの強制終了では送信できないことがあります。
- 名前は公開され、重複を許可します。ユーザー ID は Firebase Authentication の ID です。ログイン済みの同一アカウントでのロビー同時参加は制限します。
- 各対戦の読み取りは参加者のみ、回答は本人のみ。ルールで出題角・正答・回答順序・サーバー時刻・二重承諾を検証します。

これは学習向けのカジュアル対戦です。正答はクライアントから確認できるため、不正行為を完全には防げません。ランキングや賞品のある対戦には、問題生成と採点を信頼できるサーバーへ移す必要があります。

## お試し対戦

同じブラウザーで2つのタブを開き、それぞれ別の名前で「お試し対戦」に入室します。BroadcastChannel / localStorage / Web Locks で同期し、同時承諾や回答を直列化します。Firebase 設定は不要です。別端末にはつながらず、オンライン接続の検証にはなりません。Chrome / Edge 等の Web Locks 対応ブラウザーを使用してください。名前などのお試し状態はブラウザーの localStorage に保存されます。

## ローカル検証

通常の数学・対戦プロトコルテスト:

```sh
npm test
```

Firebase のルールの統合テストは、Firebase CLI、`firebase` と `@firebase/rules-unit-testing` を用意してから、エミュレーターで実行します。これらは検証用で、サイト実行には不要です。

```sh
firebase emulators:exec --only database --project demo-sankaku 'node firebase/rules-check.mjs'
```

Node.js 20 以上と Java 21 を推奨します。エミュレーター初回起動では Google の公式配布元からダウンロードが必要です。

## 運用

Database の使用量と Authentication の匿名ユーザー数を監視してください。終了した `trigBattle/rooms` と古い `trigBattle/inbox` は管理者側で定期削除してください。ルールは一般参加者による他人の試合削除を許可しません。大規模運用ではロビーの人数制限、サーバー側の保存期限、App Check・レート制限を追加してください。
