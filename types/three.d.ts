// 临时类型兜底：某些环境下 `three` 的声明文件未被 TS 正确解析到。
// 该文件仅用于编译通过，不影响运行时的 three 实际加载。
declare module "three" {
  const THREE: any;
  export = THREE;
}

