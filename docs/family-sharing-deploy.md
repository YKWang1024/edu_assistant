# 家庭共享（菜谱 / 错题 / 习惯）+ AI识别 + 评分改造 —— 部署指南

适用环境：env `cloud1-d0gnc8vm2aae15ae5`，appid `wxd38ea3f772d7f157`。
本指南覆盖三个阶段：Phase 1 家庭绑定、Phase 2 菜谱云端化、Phase 3 错题/习惯家庭共享。

入口：微信开发者工具 →「云开发」按钮 → 云开发控制台。

---

## 1. 数据库集合（务必先建全，否则写入直接报错）

> ⚠️ **云函数往「不存在的集合」写数据会直接失败。** 典型表现：拍照识题点「保存」报「保存失败」（把 `config/ai.js` 的 `DEBUG` 设为 `true` 后会看到 `collection not exists` / 错误码 `-502005`）。所以**上线前先把下面所有集合建好**。

控制台 → 数据库 →「+ 添加集合」，**权限统一选「仅创建者可读写」**。逐个建好（打勾自查）：

| 集合 | 用途 | 备注 |
|---|---|---|
| ☐ `users` | 用户与家庭归属 | 能自动登录即说明已存在 |
| ☐ `families` | 家庭信息 + 邀请码 | 同上，通常已存在 |
| ☐ `recipes` | 家庭菜谱 | 新家庭会被预置示例菜谱 |
| ☐ `examQuestions` | 试卷错题 | **拍照识题保存到这里**（漏建即保存报错） |
| ☐ `familyCheckins` | 习惯打卡（家庭维度） | |
| ☐ `gameTime` | 游戏时间余额 | 每 `familyId`+`childName` 一条 |
| ☐ `quizWrong` | 自动小测错题（数学/拼音/英语） | |
| ☐ `quizRecords` | 自动小测整局记录 | |
| ☐ `wikis` | 买菜心得（可分享到菜友圈） | Phase 8 新增 |

**权限说明**：所有读写都走云函数（以管理员身份运行，绕过集合 ACL），客户端不再直接读库，所以统一「仅创建者可读写」最安全。`examQuestions` 跨成员查看走云函数 `getExamQuestion`，不需放开 ACL。

**建议索引（性能，非必需）**：`families.inviteCode`（单字段）；`recipes`（`familyId`+`createdAt`）；`examQuestions.familyId`（单字段）；`familyCheckins`（`familyId`+`date`）。

---

## 2. 云函数（逐个「上传并部署：云端安装依赖」，或 `tcb fn deploy`）

**Phase 1（家庭绑定）**：`register`(改)、`login`(改)、`getFamilyInfo`、`generateInviteCode`、`joinFamilyByCode`、`joinFamilyById`、`setMemberName`

**Phase 2（菜谱）**：`register`(改, 含预置示例菜谱)、`saveRecipe`、`listRecipes`、`deleteRecipe`、`rateRecipe`、`editRating`、`deleteRating`

**Phase 3（错题/习惯共享）**：`saveExamQuestion`(改)、`listExamQuestions`(改)、`submitExamAnswer`(改)、`deleteExamQuestion`(改)、`saveExamCourse`(改)、`getExamQuestion`、`saveCheckin`、`listCheckins`

**Phase 4（时间管理上云）**：`getGameTime`、`addGameTime`、`spendGameTime`（`app.js`/`reward`/`account`/`index` 随小程序发布）

**Phase 5（旧小测错题/记录上云）**：`saveQuizWrong`、`listQuizWrong`、`deleteQuizWrong`、`clearQuizWrong`、`saveQuizRecord`（`utils/util.js`/`wrong`/`math`/`pinyin`/`english` 随小程序发布）

**Phase 6（错题本统一+可编辑）**：新增 `updateExamQuestion`、`updateQuizWrong`（家长编辑错题/答案）。
「我的→错题本」改为进入统一错题本 `pages/exam/exam`，同时展示拍照错题(examQuestions)与语数英小测错题(quizWrong)；家长点「✎ 编辑」需输入密码(见 `config/ai.js` 的 `PARENT_EDIT_PASSWORD`，默认 8888，上线请改)。无需新建集合。

**Phase 7（家庭重构：小孩成员/角色）**：新增 `manageFamily`（一函数多动作：addChild/updateChild/removeChild软删/setMemberRole）。
`getFamilyInfo`(改，返回 children)、`login`(改，建家庭时预置默认小孩'宝贝') 需**重新部署**。
小孩成员(无小程序账号，妹妹/姐姐等)与角色 admin/member/observer 都存在 `families` 文档里（`children` 数组 + `members[].role`），**无需新建集合**。
「我的→设置(本地成员名)」入口已删除，家庭管理统一走 `pages/family/manage`。
> 拍照错题/小测错题/菜谱评分会按「当前小孩」归属(`childName`)；统一错题本顶部可按小孩筛选(>1 个小孩时显示)。

**Phase 8（买菜心得 Wiki + 语音）**：新增集合 `wikis`(权限「仅创建者可读写」)；新增云函数 `saveWiki`、`listWiki`、`deleteWiki`。
菜友圈页新增「我的买菜心得」入口与「菜友买菜心得」信息流(`listWiki` scope=public)。
**语音输入用「微信同声传译」插件**：需在 微信公众平台(mp.weixin.qq.com) → 小程序 → 「设置→第三方设置→插件管理」**添加并启用插件「微信同声传译」(appid `wx069ba97219f66d99`)**，否则语音按钮不可用(可改用打字)。
`app.json` 已声明该插件(version 0.3.5)；AI 整理走小程序端 `wx.cloud.extend.AI` 文本模型(同错题课程)。

**视觉识别**：`aiVision`（超时 60s；需在其环境变量配置 `AI_VISION_API_KEY` 等，见 §3）

> 游戏时间余额现按 `(familyId, childName)` 存于 `gameTime`，跨设备一致；首次联网会把本地旧 `gameMinutes` 迁为初始余额一次。旧本地小测错题首次联网导入 `quizWrong` 一次。

> `register`/`login` 一定要重新部署（返回结构改了，否则家庭功能拿不到 familyId）。所有 `examQuestions` 函数都改过（加了 familyId/canAccess），也要重新部署。

---

## 3. AI 模型

### 视觉识别（菜谱识图 / 拍照识题）—— 云函数 `aiVision`
腾讯云开发的**托管 AI（deepseek 等）不接受图片输入**（`content` 只支持文字，这就是 `image_url` 报错的原因）。视觉识别改为云函数 `aiVision` 直连「Anthropic(Claude) 兼容」接口（适配 **Kimi Code** 的 apikey）。在 云开发控制台 → 云函数 `aiVision` → **环境变量** 配置（**不要把 key 写进代码提交**）：
默认已按 **Kimi Code** 配好，通常**只需设 `AI_VISION_API_KEY`** 一项：
- `AI_VISION_API_KEY`：Kimi Code 控制台创建的 API Key（必填，最多 5 个、仅创建时显示）
- `AI_VISION_PROTOCOL`：默认 `anthropic`（Claude 兼容）；可选 `openai`
- `AI_VISION_BASE_URL`：默认 `https://api.kimi.com/coding`（anthropic 实际请求 `.../coding/v1/messages`；openai 协议请设为 `https://api.kimi.com/coding/v1` → `.../chat/completions`）
- `AI_VISION_MODEL`：默认 `kimi-for-coding`（Kimi Code 固定模型，后端自动映射到最新版/k2.6）
- `AI_VISION_ENDPOINT`（可选）：完整请求 URL，覆盖自动拼接
- 鉴权固定 `Authorization: Bearer <key>`

部署 `aiVision`（超时已配 60s）。菜谱「AI识别菜谱」与「拍照识题」都走它，返回做法/配料/热量/题干等结构化 JSON。

> ⚠️ **本次 `aiVision` 改了代码，务必重新部署。** 新增按 **云存储 fileID** 下载图片的能力：
> 客户端会先把（压缩后的）图片上传云存储，再把 `fileID` 传给 `aiVision`，云端下载后转 base64 再识别。
> 这样**彻底规避了 `cloud.callFunction:fail Error:data exceed max size`**（大图直传 base64 超过 callFunction 包体上限）。
> base64 直传仍兼容（小图/上传失败时回退）。识别会在云存储 `exam/`、`recipe/` 下产生图片，正常占用存储。

### 本次客户端新增能力（随小程序发布即可，无需额外云资源）
- **大图自动压缩**：新增 `utils/image.js`（`compressForCloud` / `compressForUpload` / `uploadFile`），全局复用；
  iPhone Pro Max 等大图先缩放+jpg 压缩再上云（微信端不支持生成 webp，照片用 jpg 体积最小）。
- **整张试卷·多题**：拍整张卷子，AI 一次找出所有做错的题、逐题归纳「错因」，用户勾选后批量入库（逐条调 `saveExamQuestion`，错因/上次错答并入 `analysis`，无需改云函数）。
- **看拼音写字→选择题**：识别时这类题自动转成选择题（4 选项），复习时点选而非打字。

> ⚠️ **Kimi Code 是编程产品，官方文档未声明支持图片输入。** 若识别报错或模型“看不到图”，说明该模型不支持视觉，需改用真正的视觉模型（如 Moonshot 开放平台的 `moonshot-v1-*-vision`，但那要用开放平台 API Key，把 `AI_VISION_*` 改成对应值），或改走 OCR。

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
