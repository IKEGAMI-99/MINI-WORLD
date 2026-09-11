# MINI WORLD

探索して、集めて、育てる。1画面で短時間に遊べる、完全オフライン対応のブラウザ育成ゲームです。

## 実装済み

- 探索 → 資源 → 建築 → 世界進化の基本ループ
- 6段階の文明進化（荒野 / 芽吹き / 集落 / 町 / 都市 / 未来文明）
- 木・石・食料・人口・知識の5資源
- 家 / 畑 / 研究所 / 観測塔の建築とレベルアップ
- ランダム探索イベント + 3択のスペシャルイベント
- 図鑑18種
- 実績10種
- localStorageによる自動セーブ
- セーブデータJSONの書き出し / 読み込み
- 最大8時間のオフライン進行
- Web Audioの簡易効果音とVibration対応
- Web App Manifest + Service WorkerによるPWA / オフライン動作
- スマートフォン向けレスポンシブUI

## 起動

PWA機能（Service Worker）を使うため、`file://` ではなくHTTP(S)で配信してください。

ローカル確認例:

```bash
python3 -m http.server 8080
```

ブラウザで `http://localhost:8080` を開きます。

## GitHub Pages

このリポジトリをGitHub Pagesで公開する場合は、Repository Settings → Pages から `main` ブランチのルートを公開元に設定してください。公開後はHTTPSになるため、PWAとしてホーム画面へのインストールとオフライン起動が利用できます。

## ファイル

- `index.html` : 1画面ゲームUI
- `styles.css` : レスポンシブUIと世界のビジュアル
- `app.js` : ゲームロジック、セーブ、イベント、図鑑、実績
- `manifest.webmanifest` : PWA設定
- `sw.js` : オフラインキャッシュ
- `icon.svg` : アプリアイコン

## セーブ

セーブキー: `mini-world-save-v1`

ゲーム内メニューからJSON形式でバックアップできます。
