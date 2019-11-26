(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.index = factory());
}(this, (function () { 'use strict';

  function index () {
    console.log(111);
  }

  return index;

})));
