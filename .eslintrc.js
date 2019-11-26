module.exports = {
  parser:  '@typescript-eslint/parser', //定义ESLint的解析器
  extends: ['plugin:@typescript-eslint/recommended'], //定义文件继承的子规范
  plugins: ['@typescript-eslint'], //定义了该eslint文件所依赖的插件
  env:{
    browser: true,
    node: true,
  }                               
}
