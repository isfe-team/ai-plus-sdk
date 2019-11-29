# ai plus sdk

ai+ sdk, including tts/iat, by @bqliu @hxli.

## Usages

```bash
$ npm i -S @isfe/ai-plus-sdk @isfe/mse-player js-base64 lamejs
```

## Refs

## Todos

### basic

- [x] 优化 `externals`，将 `js-base64`、`@isfe/mse-player`
- [ ] 完善 examples

### shared

- [x] Error 集中配置，使用字符串 enum，提取到 `shared/helpers/error.ts`
- [x] `net/http.ts` 类型优化，以及代码优化
- [ ] `net/http.ts` 优化，实现一个较为完整的 `http client`

### tts

- [x] 类型提取至类型模块
- [x] `rpcParam` 入参构造优化
- [x] api 设计<Promise?>
- [ ] 实现 auth

### iat

- [ ] 实现基础版本
