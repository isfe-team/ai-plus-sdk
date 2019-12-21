# ai plus sdk

ai+ sdk, including tts/iat, by @bqliu @hxli.

## Usages

```bash
$ npm i -S @isfe/ai-plus-sdk @isfe/mse-player js-base64 lamejs
```

## Refs

### tts

- [sdk data flow](https://www.processon.com/diagraming/5dcbcec6e4b0e3a6348db16d)
- [sdk data flow2](https://www.processon.com/diagraming/5ddc7d57e4b07f8de341918d)

## Todos

### basic

- [x] 优化 `externals`，将 `js-base64`、`@isfe/mse-player`
- [ ] 完善 examples
- [ ] 使用 `Observable` 重构

### shared

- [x] Error 集中配置，使用字符串 enum，提取到 `shared/helpers/error.ts`
- [x] `net/http.ts` 类型优化，以及代码优化
- [ ] `net/http.ts` 优化，实现一个较为完整的 `http client`

### tts

- [x] 类型提取至类型模块
- [x] `rpcParam` 入参构造优化
- [x] api 设计<Promise?>
- [ ] <del>实现 auth</del>
- [x] 提取 `TTSWithPlayer`
- [x] 增加使用 `TTSWithPlayer` 的 demo

### iat

- [ ] 实现基础版本
