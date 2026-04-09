# digital-human-quiz

中天火箭在线答题 — **可运行 MVP**（网页 H5 + 3D 占位数字人 + 题库管理 + 统计后台）。当前不依赖正式吉祥物素材与正式题库 Excel，便于演示；架构上预留替换真实数字人、云端语音与 LLM 判题。

## 项目简介

- 用户通过链接/二维码进入 H5，输入昵称后开始答题。
- 占位数字人展示 **idle / speaking / listening**，题干由浏览器 **TTS** 朗读，作答支持 **文本** 与 **Mock 语音**（弹窗模拟识别）。
- 题型：**单选、判断、简答题**（简答题为关键词 + 标准答案片段的启发式判分，可替换为大模型）。
- 完成后展示得分、明细、排行榜；管理端维护题库、导入导出 Excel、查看会话与作答明细。

## 技术栈

- Next.js 15（App Router）
- TypeScript
- Tailwind CSS
- Prisma + SQLite
- zod（校验）
- xlsx（导入/导出）
- lucide-react

## 目录结构（核心）

```
app/
  page.tsx                      # 首页
  quiz/start/page.tsx           # 填写昵称与渠道
  quiz/[sessionId]/page.tsx     # 答题
  quiz/[sessionId]/result/page.tsx
  leaderboard/page.tsx
  admin/...                     # 管理后台
  api/                          # REST API
components/
  avatar/AvatarPresenter.tsx
  quiz/                         # 题目卡片、作答、计时
  stats/                        # 分数条、排行榜表
  admin/                        # 表单、导入导出、删除
lib/
  db.ts
  quiz/                         # engine、scoring、归一化、简答题 Judge
  providers/                    # TTS / STT / Avatar 抽象与占位实现
  schemas/                      # zod
  xlsx/                         # 模板与导入解析
prisma/
  schema.prisma
  seed.ts
```

## 安装步骤

```bash
cd digital-human-quiz
pnpm install
```

> 若本机未安装 pnpm，可使用 `npm install`；以下 Prisma 命令可写成 `npx prisma ...` / `npx tsx prisma/seed.ts`（或将 `package.json` 中的 `db:seed` 改为 `npx prisma db seed` 并确保已安装 `tsx`）。

复制环境变量文件：

```bash
copy .env.example .env
```

（Linux / macOS：`cp .env.example .env`）

## 环境变量说明

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | SQLite 路径，默认 `file:./dev.db`（数据库文件在项目根目录生成） |

当前 MVP **无需**配置第三方语音/数字人 Key；后续接入时在对应 Provider 中读取自定义变量即可。

## 数据库初始化

```bash
pnpm exec prisma db push
pnpm db:seed
```

**航天日题库**：`pnpm db:seed` 会优先读取项目根目录 **`航天日题库.docx`**（Word 单选题格式：题干 + A–D + `答案：X`）；若根目录没有该文件，则回退使用已提交的 **`prisma/hangtian-bank.seed.json`**（当前为从 docx 解析出的 **92** 道题）。更新 Word 后可执行 `pnpm hangtian:regen-seed` 重新生成 JSON 并提交。

**抽题规则**：每位用户开始答题时，从已启用题目中 **随机抽取 20 道**（ Fisher–Yates 打乱后取前 20 题），并写入会话的 `questionOrder` 固定本场题目。

- `db push`：按 `schema.prisma` 同步 SQLite 结构（开发便捷，非迁移文件流程）。
- `seed`：清空场次与答案后写入航天日题库（见上文 docx / JSON 说明）。

## 用 Git 管理代码（推仓库、服务器克隆）

我无法替你在 GitHub / Gitee 上创建远程仓库或保存你的账号密码；你需要在**本机已安装 Git** 的前提下，在**项目根目录**执行：

```bash
git init
git add .
git commit -m "chore: initial commit"
```

在 GitHub 或 Gitee **新建空仓库**后，按平台提示添加远程并推送，例如：

```bash
git remote add origin https://github.com/你的用户名/digital-human-quiz.git
git branch -M main
git push -u origin main
```

**服务器上拉代码**（之后更新用 `git pull` 即可，比整包拷贝省事）：

```bash
git clone https://github.com/你的用户名/digital-human-quiz.git
cd digital-human-quiz
pnpm install
cp .env.example .env   # 再编辑生产环境变量
pnpm exec prisma db push
pnpm db:seed
pnpm build
pnpm start
```

题库数据：仓库里已有 **`prisma/hangtian-bank.seed.json`**；若服务器上还要用 Word 源文件，请把 **`航天日题库.docx`** 放在项目根目录再执行 `pnpm db:seed`。

## 运行方式

```bash
pnpm dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

- 前台：首页 → 开始答题 → 结果页 → 排行榜。
- 后台：[http://localhost:3000/admin](http://localhost:3000/admin)（无登录，演示用）。

生产构建：

```bash
pnpm build
pnpm start
```

## 部署到服务器（建议）

### 环境要求

- Node.js：建议 **18+**（与 Next 15 兼容；生产环境建议固定版本）
- 需要可写临时目录（TTS 会写入临时 mp3）
- 服务器可访问外网（`node-edge-tts` 需要连接微软 TTS 服务）

### 环境变量

参考 `.env.example`，生产环境务必设置：

- `DATABASE_URL`
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`（≥32 字符随机串）

TTS 推荐配置（外部优先 + 允许浏览器兜底）：

- `NEXT_PUBLIC_TTS_ENGINE=external`
- `NEXT_PUBLIC_TTS_API_URL=/api/tts`
- `NEXT_PUBLIC_TTS_FALLBACK=browser`
- `NEXT_PUBLIC_TTS_TIMEOUT_MS=12000`（客户端 fetch 超时基线；服务端仍会按需要重试/拉长）

### 构建与启动

```bash
pnpm install
pnpm build
pnpm start
```

如果你使用进程守护（PM2 / systemd），请确保工作目录与 `.env` 生效。

### 常见问题排查

- **TTS 偶发 502 / 超时**：多为外网连接不稳定/防火墙/代理导致；服务器需放行到微软语音服务相关域名。
- **Windows 本地 build 报 Prisma EPERM rename**：通常是杀软/索引器占用导致；项目已对 `prisma generate` 做了自动重试（见 `scripts/prisma-generate-retry.mjs`）。

## 题库导入模板说明

1. 在后台「题库管理」点击 **下载导入模板**，或请求：`GET /api/questions/template`。
2. 表头必须为（顺序一致）：

`category,type,difficulty,question,aliases,canonicalAnswer,avatarAnswer,optionA,optionB,optionC,optionD,correctOption,keywords,explanation,score,timeLimitSec,enabled,sourceDoc,sourceVersion,reviewStatus`

3. `type`：`single_choice` | `true_false` | `short_answer`  
   `difficulty`：`easy` | `medium` | `hard`  
   `reviewStatus`：`draft` | `reviewed` | `needs_review`  
   `enabled`：布尔或 `true`/`false`/`1`/`0`  
4. 上传：`POST /api/questions/import`，`multipart/form-data` 字段名 **`file`**。失败时返回 **行号 + zod 错误信息**。

导出当前题库：`GET /api/questions/export`。

## 占位数字人实现方式

- 组件：`components/avatar/AvatarPresenter.tsx`，通过 `state` 切换 **浮动 / 声波动画 / 麦克风光环**。
- 逻辑侧：`LocalAvatarProvider` 仅同步状态；答题页在 **朗读** 时设为 `speaking`，朗读结束设为 `listening`。
- 替换真实吉祥物时：保留同一套 `state` 语义，在组件内将几何层替换为 **Live2D / 视频 / Canvas**，或由 `AvatarProvider` 驱动外部运行时。

## 3D 数字人模型（GLB）与视频回退

- 答题页由 `components/quiz/QuizAvatarHost.tsx` 决定展示方式：
  - **有 WebGL** 且 `HEAD /models/digital-human.glb` 成功：使用 `DigitalHumanScene` 加载 3D；文件缺失或加载失败时 Scene 内仍会显示 **程序化占位角色**（胶囊小人）。
  - **无 WebGL**（部分环境、显卡驱动问题）或 **无 GLB 文件**：自动改用 `QuizAvatarVideo`，从 `public/avatar/` 读取状态视频（见 `lib/quiz/avatarClips.ts` 中的文件名映射）。
- 若既无 GLB、也未放入 `public/avatar/*.mp4`，视频请求会失败，页面会显示 **「主持人视频未就绪」** 说明与占位图标，答题流程仍可继续。

## 后续接入真实吉祥物数字人

1. 实现 `AvatarProvider`：在 `setState` 内调用 Live2D/three.js 等 API 切换动画。
2. 参考占位文件：`lib/providers/live2d-avatar.ts`（含接入步骤注释）。
3. 口型：将 TTS 音频分析为 viseme，或与云端数字人 SDK 的唇形驱动对接。

## 后续接入 OpenAI Realtime 语音链路

1. **不要在浏览器暴露长期 API Key**：由服务端建立与 OpenAI 的 WebSocket，前端连接自家信令服务。
2. 阅读占位：`lib/providers/openai-realtime.ts`。
3. 建议：Realtime 负责听与说，**判分仍走服务端 `gradeAnswer`**，保证规则一致。

## 后续将简答题判分替换为大模型

1. 当前实现：`lib/quiz/short-answer-judge.ts` 中 `ShortAnswerJudge` 接口 + `KeywordShortAnswerJudge`。
2. 替换方式：新增 `LLMShortAnswerJudge`，在 `lib/quiz/scoring.ts` 中注入（或按环境变量选择实现）。
3. 注意：控制成本、超时与 **内容安全**；可将模型返回限制为 JSON（分数、理由、是否满分）。

## API 一览（主要）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/questions` | 列表 / 新建 |
| GET/PATCH/DELETE | `/api/questions/[id]` | 详情 / 更新 / 删除 |
| GET | `/api/questions/template` | 下载模板 |
| POST | `/api/questions/import` | 导入 |
| GET | `/api/questions/export` | 导出 |
| GET | `/api/sessions` | 会话列表 |
| GET | `/api/sessions/[id]` | 会话详情 |
| POST | `/api/quiz/start` | 开始答题 |
| GET | `/api/quiz/[sessionId]` | 当前进度与题目（不含标准答案） |
| POST | `/api/quiz/[sessionId]/answer` | 提交答案 |
| GET | `/api/leaderboard` | 排行榜 JSON |

## 许可与声明

示例题库文案均为 **演示用 mock**，请在正式环境中替换为贵司审核后的内容。
