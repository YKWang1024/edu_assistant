# 家庭共享（菜谱 / 错题 / 习惯）+ AI识别 + 评分改造 —— 部署指南

适用环境：env `cloud1-d0gnc8vm2aae15ae5`，appid `wxd38ea3f772d7f157`。
本指南覆盖三个阶段：Phase 1 家庭绑定、Phase 2 菜谱云端化、Phase 3 错题/习惯家庭共享。

入口：微信开发者工具 →「云开发」按钮 → 云开发控制台。

---

## 1. 数据库集合

已存在：`users`、`families`、`recipes`、`examQuestions`（NoSQL 无需预定义字段，新增字段自动写入）。

**需新建**（控制台 → 数据库 →「+ 添加集合」，权限均「仅创建者可读写」）：
- `familyCheckins`（习惯打卡，家庭维度）
- `gameTime`（游戏时间余额，每 familyId+childName 一条）— Phase 4
- `quizWrong`（自动小测错题，家庭维度）— Phase 5
- `quizRecords`（自动小测整局记录）— Phase 5

**权限（全部设「仅创建者可读写」即可）**：所有读写都走云函数（云函数以管理员身份运行，绕过集合 ACL），客户端不再直接读数据库，因此各集合保持「仅创建者可读写」最安全。
- 特别注意 `examQuestions`：家长跨成员查看孩子的题目/课程走云函数 `getExamQuestion`，不依赖放开 ACL。

**建议索引（性能，非必需）**：
- `families.inviteCode`（单字段）— 邀请码查找
- `recipes`：`familyId` + `createdAt`（复合）
- `examQuestions`：`familyId`（单字段）
- `familyCheckins`：`familyId` + `date`（复合）

---

## 2. 云函数（逐个「上传并部署：云端安装依赖」，或 `tcb fn deploy`）

**Phase 1（家庭绑定）**：`register`(改)、`login`(改)、`getFamilyInfo`、`generateInviteCode`、`joinFamilyByCode`、`joinFamilyById`、`setMemberName`

**Phase 2（菜谱）**：`register`(改, 含预置示例菜谱)、`saveRecipe`、`listRecipes`、`deleteRecipe`、`rateRecipe`、`editRating`、`deleteRating`

**Phase 3（错题/习惯共享）**：`saveExamQuestion`(改)、`listExamQuestions`(改)、`submitExamAnswer`(改)、`deleteExamQuestion`(改)、`saveExamCourse`(改)、`getExamQuestion`、`saveCheckin`、`listCheckins`

**Phase 4（时间管理上云）**：`getGameTime`、`addGameTime`、`spendGameTime`（`app.js`/`reward`/`account`/`index` 随小程序发布）

**Phase 5（旧小测错题/记录上云）**：`saveQuizWrong`、`listQuizWrong`、`deleteQuizWrong`、`clearQuizWrong`、`saveQuizRecord`（`utils/util.js`/`wrong`/`math`/`pinyin`/`english` 随小程序发布）

**视觉识别**：`aiVision`（超时 60s；需在其环境变量配置 `AI_VISION_API_KEY` 等，见 §3）

> 游戏时间余额现按 `(familyId, childName)` 存于 `gameTime`，跨设备一致；首次联网会把本地旧 `gameMinutes` 迁为初始余额一次。旧本地小测错题首次联网导入 `quizWrong` 一次。

> `register`/`login` 一定要重新部署（返回结构改了，否则家庭功能拿不到 familyId）。所有 `examQuestions` 函数都改过（加了 familyId/canAccess），也要重新部署。

---

## 3. AI 模型

### 视觉识别（菜谱识图 / 拍照识题）—— 云函数 `aiVision`
腾讯云开发的**托管 AI（deepseek 等）不接受图片输入**（`content` 只支持文字，这就是 `image_url` 报错的原因）。视觉识别改为云函数 `aiVision` 直连「Anthropic(Claude) 兼容」接口（适配 **Kimi Code** 的 apikey）。在 云开发控制台 → 云函数 `aiVision` → **环境变量** 配置（**不要把 key 写进代码提交**）：
- `AI_VISION_API_KEY`：你的 Kimi Code / 视觉接口 API Key（必填）
- `AI_VISION_PROTOCOL`：`anthropic`（默认，Claude 兼容）或 `openai`
- `AI_VISION_BASE_URL`：默认 `https://api.moonshot.cn/anthropic`（国际版 `https://api.moonshot.ai/anthropic`；若用 openai 协议则填到 `/v1`）
- `AI_VISION_MODEL`：**支持图片**的模型名（如 `kimi-latest`）
- `AI_VISION_ENDPOINT`（可选）：完整请求 URL，覆盖 BASE_URL 自动拼接

部署 `aiVision`（超时已配 60s）。菜谱「AI识别菜谱」与「拍照识题」都走它，返回做法/配料/热量/题干等结构化 JSON。

### 文本（错题 AI 讲解课程）
课程生成仍走小程序端 `wx.cloud.extend.AI` 文本模型，`config/ai.js` 的 `TEXT_MODEL` 指向已启用的文本模型（如 `deepseek-v4-pro`）。若该文本模型也未开通，可同理改造为走云函数文本接口。

---

## 4. 端到端验证（两个微信账号/两台真机，基础库≥3.16.0）

**家庭绑定**：A 注册→「我的→家庭管理」生成邀请码；B「加入家庭」输码加入；A「转发卡片」→ C 打开自动加入；三人看到同一成员列表。

**菜谱共享**：A 加带图菜谱→「🤖 AI识别菜谱」自动填→保存；B 在菜谱列表看到、图片正常；B 打分→A 看到均分+历史；当天改/删随意，隔天改/删需输入「修改/删除」；分类筛选生效；详情页「分享到菜友圈」；小红书链接点了复制+提示。

**错题共享**：孩子设备拍照识题入库→家长设备进「试卷错题」能看到（家庭维度）；家长点疑难题「AI 讲解」能正常加载（走 getExamQuestion）。

**习惯共享**：A 打卡→B 进「打卡记录」能看到（带「谁」的标签）。注意：游戏时间钱包仍是每台设备本地。

**旧数据迁移**：首次联网，本地旧菜谱与旧打卡记录各自自动导入一次（菜谱图片为旧临时路径无法迁移，需重拍）。

**离线**：断网时菜谱/打卡读本地缓存（只读），写操作会提示联网；App 仍可正常启动。
