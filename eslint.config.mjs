import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  // eslint 9 + react-hooks/exhaustive-deps 在部分场景会触发内部异常（a.getSource is not a function）
  // 为保证 CI/部署稳定，先关闭该规则；需要时可在未来升级依赖后再开启。
  {
    rules: {
      "react-hooks/exhaustive-deps": "off",
    },
  },
];

export default eslintConfig;
