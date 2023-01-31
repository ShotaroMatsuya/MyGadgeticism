# MyGadgeticism

## プロジェクト作成

```bash
mkdir <pj_name>
cd <pj_name>
npm init
npm install -D typescript @google/clasp @types/google-apps-script esbuild esbuild-gas-plugin
# typescriptを使う場合(optional)
npx tsc --init
```

## clasp との接続

```bash
# ログイン(事前にAPI認証すませること)
npx clasp login

# プロジェクト作成
npx clasp create --title <タイトル>

# dist/とsrc/index.tsとbuild.jsを作って開発
```

## package.json に scripts 追加

```json
{
  // ...
  "scripts": {
    "build": "node build.js"
  }
  // ...
}
```

```bash
npm run build
```

## デプロイ

```bash
# 予めbuild.jsを作成しdist直下にindex.jsをbuiodする
# .clasp.jsonのrootDirを./distに書き換え,distフォルダにappsscript.jsonを移動
npx clasp push
```
