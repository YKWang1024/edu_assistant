# 试卷拍照识题 + 错题智能复习 —— 部署指南

适用环境：env `cloud1-d0gnc8vm2aae15ae5`，appid `wxd38ea3f772d7f157`。

所有「后端」入口都在 **微信开发者工具 → 顶部「云开发」按钮 → 云开发控制台**。
前端三个页面（`pages/exam/capture|exam|course`）随小程序代码一起发布（上传体验版 / 提交审核），无需单独部署。

## 总览

| 资源 | 在哪里获得 / 配置 | 需要 apikey 吗 |
|---|---|---|
| 云数据库集合 `examQuestions` | 云开发控制台 → 数据库 → 新建集合 | 否 |
| 云存储（裁剪图） | 默认已开通，代码直接 `wx.cloud.uploadFile` | 否 |
| 5 个云函数 | 开发者工具里右键文件夹「上传并部署」 | 否 |
| 云 AI 模型 | 云开发控制台 → AI → 模型管理（开通资源包 + 启用模型） | **托管模型不用**；只有接自有/第三方模型才填 |

> 建议顺序：先做 §1（建集合）、§3（部署云函数）、§4（确认模型 id），再按 §5 联调。

---

## 1. 云数据库 —— 建集合（必须）

云开发控制台 → **数据库** → 「+ 添加集合」→ 集合名 `examQuestions` → 创建。

- 选中集合 → **权限设置** → 选「**仅创建者可读写**」。
  （课程页用客户端 `wx.cloud.database().doc().get()` 直接读自己的数据，依赖这个读权限；写操作都走云函数、用管理员权限不受限。）
- （可选，数据量大了再加）**索引管理** → 新建复合索引：`_openid`(升序) + `status`(升序) + `nextReviewDate`(升序)。

数据模型（每文档一道题，按 `_openid` 隔离）：

```
_openid, subject, type('choice'|'fill'|'other'), stem, options[{key,text}],
correctAnswer, analysis, imageFileID,
status('new'|'reviewing'|'mastered'|'hard'), consecutiveWrong,
firstCorrectDate, nextReviewDate('YYYY-MM-DD'), attempts[{date,answer,correct}],
aiCourse{content,createdAt}|null, createdAt, updatedAt
```

## 2. 云存储 —— 无需操作

裁剪后的题目图上传到 `exam/时间戳_随机.jpg`。云存储随云开发开通即有，默认权限（所有人可读、仅创建者可写）够用。想收紧可在 控制台 → **存储** → 权限设置。

## 3. 云函数 —— 部署 5 个（必须）

**GUI（推荐）**：微信开发者工具左侧资源管理器展开 `cloudfunctions/`，对下面每个文件夹右键 →「**上传并部署：云端安装依赖（不上传 node_modules）**」：

```
saveExamQuestion  listExamQuestions  submitExamAnswer  saveExamCourse  deleteExamQuestion
```

注意：
- 上传前确认选中的是环境 `cloud1-d0gnc8vm2aae15ae5`。
- 必须选「**云端安装依赖**」——这些函数 `package.json` 的 deps 为空，靠运行时注入 `wx-server-sdk`（与现有 login/register 等一致）。
- 部署后可在 控制台 → **云函数** → 选 `listExamQuestions` →「云端测试」喂 `{}`，期望返回 `{success:true,data:[]}`。

**CLI（替代，仓库已在 `cloudbaserc.json` 登记好）**：

```bash
npm i -g @cloudbase/cli
tcb login
tcb fn deploy saveExamQuestion listExamQuestions submitExamAnswer saveExamCourse deleteExamQuestion -e cloud1-d0gnc8vm2aae15ae5
```

## 4. 云 AI 模型 —— 确认模型 id（关于 apikey）

入口：云开发控制台 → **AI**，或
`https://tcb.cloud.tencent.com/dev?envId=cloud1-d0gnc8vm2aae15ae5#/ai`

**关于「apikey」的澄清**：
- 本功能用开发云**托管模型**（`wx.cloud.extend.AI`，provider 为 `cloudbase` 或 `hunyuan-exp`）。这类模型**没有 apikey 要填**——调用直接用环境身份鉴权，按用量从 **Token 资源包 / 成长计划额度** 扣费。你只需「开通资源包 + 在模型管理里启用模型」。
- **只有**接「自有部署 / 第三方 OpenAI 兼容」模型时才需 apikey：AI → **模型管理 → 添加自定义模型**，填 `BaseUrl + ApiKey`，组名以 `custom-` 开头，再把 `config/ai.js` 的 provider 改成该 `custom-xxx`。

启用模型后，把实际模型 id 填进 [`config/ai.js`](../config/ai.js)：

```js
VISION_MODEL: '你的视觉模型id',   // 必须是多模态/能看图，*-flash 纯文本模型会拒图
TEXT_MODEL:   '你的文本模型id',
```

> 若提示「资源包未开通 / 模型未启用」，回此页面开通 Token 资源包并在模型管理里「启用」目标模型。识别题目务必选**多模态**模型。

## 5. 联调验证（按顺序）

完成 §1、§3、§4 后：

1. 用**真机或模拟器**打开小程序（AppID 不能是测试号——测试号无云开发/AI）。基础库需 ≥3.7.1（项目为 3.16.0 ✓）。
2. 首页「📷 试卷错题」→「拍照识题」→ 选含选择题的试卷图 → 拖框 →「确认并识别」。看日志 vision 应返回 JSON、表单自动填充；识别失败会自动转手动录入，不中断流程。
3. 选科目保存 → 数据库 `examQuestions` 出现一条文档，存储里有裁剪图。
4. 回列表 →「开始复习」做对一次 → 状态变「复习中」、`nextReviewDate` = 今天 + 20。
5. （难题）把某题连错 3 次 → 升级「重点疑难」并弹窗进入 AI 课程页，流式生成讲解、完成后回存（再次进入直接读缓存）。
6. （掌握）把某「复习中」题的 `nextReviewDate` 临时改到过去日期 → 复习中再做对 → 标记「已掌握」、从待做列表消失。

---

## 实现要点（便于排查）

- AI 全部在小程序端走 `wx.cloud.extend.AI`：识别用 `generateText`（多模态 content 数组 + base64 dataURI），课程用 `streamText`（参数包 `data:{}` + `onText/onFinish`）。
- 间隔复习 / 难题升级状态机在 `cloudfunctions/submitExamAnswer` 服务端，权威、防篡改。
- 日期统一按 **UTC+8** 字符串计算（云端默认 UTC，否则「今天」会差一天）；`utils/exam.js` 复刻同一算法供前端展示。
- 旧「错题本」`pages/wrong/wrong.js` 是本地存储、收 App 自动生成的小测，与本功能各自独立、互不影响。
- `cloudfunctions/aiRecognize` 是历史遗留的「食物营养查表」，并非 AI，本功能未复用它。
