# 週刊ゲーム（weekly-games）

毎週、ブラウザで遊べる小さなゲームを公開していくプロジェクトです。

👉 遊ぶ: https://yamasho0419.github.io/weekly-games/

## 目的

- 思いついたアイデアを、1週間で遊べる形にする練習
- インストールなしで、URL を開いた瞬間に人に遊んでもらえる環境を作ること

## 公開中のゲーム

| ゲーム | 内容 |
|---|---|
| ショートゲームのフィード | 数秒で終わるミニゲームが次々に流れてくる。「大きい方をタップ！」「おばけをタップ！」「ぴったり止めろ！」「連打！」の4種類 |
| [大きいのどっち？](https://yamasho0419.github.io/weekly-games/01-bigger/) | 第1弾 |
| [抜け出せない](https://yamasho0419.github.io/weekly-games/loop/) | ゲームの中にゲームがある入れ子のループ |

## 技術

TypeScript / Vite / GitHub Pages（`docs/` を公開）

ミニゲームは共通の型（`src/types.ts`）に合わせて作り、`src/games/index.ts` に1行足せばフィードに流れる作りにしています。

```bash
npm install
npm run dev     # 開発サーバー
npm run build   # 型チェックとビルド
```
