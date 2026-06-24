// 试卷错题 —— 客户端工具：调用开发云 AI 模型(识别题目 / 生成课程) + 日期工具
var config = require('../config/ai.js')

function pad(n) { return (n < 10 ? '0' : '') + n }

// 以中国时区(UTC+8)计算日期串，避免服务端 UTC 与本地差一天。
// 必须与云函数 submitExamAnswer 里的同名函数保持一致。
function todayStrUTC8(offsetDays) {
  var d = new Date(Date.now() + 8 * 3600 * 1000 + (offsetDays || 0) * 86400000)
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
}

// 是否到期（可做）。与服务端口径一致：未掌握 且 到了复习日。
function isDue(doc, todayStr) {
  if (!doc) return false
  if (doc.status === 'mastered') return false
  if (!doc.nextReviewDate) return false
  return doc.nextReviewDate <= (todayStr || todayStrUTC8(0))
}

var STATUS_LABEL = {
  'new': '待重做',
  reviewing: '复习中',
  mastered: '已掌握',
  hard: '重点疑难'
}

function statusLabel(status) { return STATUS_LABEL[status] || '' }

// ---------------- AI：识别题目（视觉，非流式） ----------------

// 识别通用规则（单题/多题复用）：附图描述、尽量出选择题、选项不重复。
var COMMON_RULES = [
  '【附图规则】若题目带插图/附图(计数器、算盘、坐标轴、几何图形、线段图、实物图、看图写话的图等)，',
  '请在 stem 里用括号把图的关键信息简要写清楚，使题目脱离原图也能读懂，',
  '例如"（计数器图：十位3颗珠、个位4颗珠）"、"（图：一个长方形，长6厘米、宽4厘米）"。',
  '【尽量出选择题】凡是能用选择题表达的(填空/判断/拼音写字/比大小等)，请尽量 type 设为 "choice"，',
  '给出 4 个选项，correctAnswer 填正确选项的【字母】(如 "B")。看拼音写汉字/写词语：',
  '正确选项放正确的字/词，另外 3 个用形近或音近的干扰项。',
  '【选项不重复】4 个选项的内容必须【互不相同】，有且只有一个正确；',
  '严禁把正确答案重复成多个选项，也不要出现内容一样的选项。',
  '真正无法转成选择题的(如需要动手画、计算过程题)才用 type "fill" 或 "other"。'
].join('\n')

function buildRecognizePrompt() {
  return [
    '你是一个中小学题目识别助手。请识别图片中的这一道题目，并【只输出一个 JSON 对象】，',
    '不要输出任何额外文字、解释、Markdown 代码块或反引号。JSON 字段如下：',
    '{',
    '  "subject": 科目，只能是以下之一：' + JSON.stringify(config.SUBJECTS) + '，',
    '  "type": 题型，只能是 "choice"(选择题) / "fill"(填空或简答) / "other"，',
    '  "stem": 题干文字(字符串，不要包含选项内容)，',
    '  "options": 选择题选项数组，每项形如 {"key":"A","text":"选项内容"}；非选择题填 []，',
    '  "correctAnswer": 正确答案。选择题填选项字母如 "B"；其它题填答案文本；若无法判断填 ""，',
    '  "studentAnswer": 图中小朋友写下/勾选的答案(若能看出)，否则填 ""，',
    '  "errorPoint": 用一句话总结这道题的错因或考点(20字以内，可为空)，',
    '  "analysis": 简短解析(50字以内，可为空字符串)',
    '}',
    COMMON_RULES,
    '若图片中有多道题，只识别最完整、最居中的那一道。数学公式用普通文本表示。'
  ].join('\n')
}

// 整张试卷·多题：找出所有做错的题目，逐题归纳错因。返回 { questions: [...] }。
function buildRecognizeManyPrompt() {
  return [
    '你是一个中小学错题归纳助手。下面是一张试卷的照片，请找出其中所有【做错的题目】',
    '(有红叉/被批改为错/扣分/答案明显错误的题)，逐题归纳，并【只输出一个 JSON 对象】，',
    '不要输出任何额外文字、解释、Markdown 代码块或反引号。格式：',
    '{ "questions": [ {',
    '  "subject": 科目，只能是以下之一：' + JSON.stringify(config.SUBJECTS) + '，',
    '  "type": "choice" / "fill" / "other"，',
    '  "stem": 题干文字(不含选项)，',
    '  "options": 选择题选项数组 [{"key":"A","text":"..."}]；非选择题填 []，',
    '  "correctAnswer": 正确答案(选择题填字母；其它填答案文本；无法判断填 "")，',
    '  "studentAnswer": 小朋友这次写错/选错的答案(看不出填 "")，',
    '  "errorPoint": 一句话总结错因或考点(20字以内)，',
    '  "analysis": 简短解析(50字以内，可空)',
    '} , ... ] }',
    '【拆小题】把同一道大题里的每个小题(1)(2)(3)…拆成【独立的一条】，stem 带上必要的大题背景；',
    '只收录【做错的】小题，做对的小题不要收录（例如大题里第2小题做对了就跳过，只列第1、3小题）。',
    COMMON_RULES,
    '优先收录有批改记号(红叉/扣分)或明显答错的题；若整张看不出批改痕迹，',
    '则收录全部题目、把 studentAnswer 留空，交给家长勾选。最多 16 道。数学公式用普通文本表示。'
  ].join('\n')
}

// 从模型返回文本里抠出 JSON 并解析（容错：去代码围栏、截取大括号）
function parseQuestionJSON(text) {
  if (!text) throw new Error('AI 未返回内容')
  var s = String(text).trim()
  s = s.replace(/^```[a-zA-Z]*/, '').replace(/```$/, '').trim()
  var start = s.indexOf('{')
  var end = s.lastIndexOf('}')
  if (start >= 0 && end > start) s = s.slice(start, end + 1)
  var obj
  try {
    obj = JSON.parse(s)
  } catch (e) {
    throw new Error('AI 返回的内容无法解析为题目')
  }
  return normalizeQuestion(obj)
}

function normalizeQuestion(obj) {
  obj = obj || {}
  var subject = config.SUBJECTS.indexOf(obj.subject) >= 0 ? obj.subject : '其他'
  var type = (obj.type === 'choice' || obj.type === 'fill' || obj.type === 'other') ? obj.type : 'other'

  // 原始选项(保留模型给的 key 以便定位正确答案)
  var raw = []
  if (Array.isArray(obj.options)) {
    raw = obj.options.map(function (o, i) {
      var key = String.fromCharCode(65 + i)
      if (o && typeof o === 'object') return { key: String(o.key || key), text: String(o.text == null ? '' : o.text).trim() }
      return { key: key, text: String(o == null ? '' : o).trim() }
    }).filter(function (o) { return o.text })
  }

  var rawCorrect = String(obj.correctAnswer == null ? '' : obj.correctAnswer).trim()
  // 先确定正确选项的【文本】(答案可能给的是字母，也可能直接给文本)
  var correctText = ''
  for (var i = 0; i < raw.length; i++) {
    if (raw[i].key === rawCorrect || raw[i].text === rawCorrect) { correctText = raw[i].text; break }
  }

  // 选项去重(按文本)，避免重复选项/重复正确答案；去重后重新编号 A/B/C…
  var seen = {}, texts = []
  raw.forEach(function (o) { if (o.text && !seen[o.text]) { seen[o.text] = 1; texts.push(o.text) } })
  var options = texts.map(function (t, idx) { return { key: String.fromCharCode(65 + idx), text: t } })

  if (options.length > 0) type = 'choice'

  // 正确答案映射到去重后选项的字母
  var correct = rawCorrect
  if (type === 'choice' && options.length > 0) {
    correct = ''
    for (var j = 0; j < options.length; j++) {
      if (options[j].text === correctText) { correct = options[j].key; break }
    }
    if (!correct && /^[A-Ha-h]$/.test(rawCorrect)) {
      var k = rawCorrect.toUpperCase().charCodeAt(0) - 65
      if (k >= 0 && k < options.length) correct = options[k].key
    }
  }

  return {
    subject: subject,
    type: type,
    stem: String(obj.stem == null ? '' : obj.stem).trim(),
    options: options,
    correctAnswer: correct,
    studentAnswer: String(obj.studentAnswer == null ? '' : obj.studentAnswer).trim(),
    errorPoint: String(obj.errorPoint == null ? '' : obj.errorPoint).trim(),
    analysis: String(obj.analysis == null ? '' : obj.analysis).trim()
  }
}

// 解析「多题」返回：容错地取出 questions 数组并逐项 normalize。
// 同时兼容返回对象 {questions:[...]} 或裸数组 [...]。
function parseQuestionsJSON(text) {
  if (!text) throw new Error('AI 未返回内容')
  var s = String(text).trim()
  s = s.replace(/^```[a-zA-Z]*/, '').replace(/```$/, '').trim()
  var objStart = s.indexOf('{')
  var arrStart = s.indexOf('[')
  var useArray = arrStart >= 0 && (objStart < 0 || arrStart < objStart)
  if (useArray) {
    var ae = s.lastIndexOf(']')
    if (ae > arrStart) s = s.slice(arrStart, ae + 1)
  } else {
    var oe = s.lastIndexOf('}')
    if (objStart >= 0 && oe > objStart) s = s.slice(objStart, oe + 1)
  }
  var obj
  try { obj = JSON.parse(s) } catch (e) { throw new Error('AI 返回的内容无法解析为错题列表') }
  var arr = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.questions) ? obj.questions : [])
  return arr.map(normalizeQuestion).filter(function (q) { return q.stem })
}

function splitDataUri(dataUri) {
  var m = /^data:(.*?);base64,(.*)$/.exec(dataUri || '')
  if (m) return { mediaType: m[1] || 'image/jpeg', base64: m[2] }
  return { mediaType: 'image/jpeg', base64: dataUri || '' }
}

// 把「图片来源」转成 aiVision 入参。source 可为：
//   字符串 dataUri / base64（兼容旧用法）
//   { fileID, mediaType }  —— 推荐，云端下载，规避 callFunction 包体上限
//   { base64, mediaType } / { dataUri }
function buildVisionPayload(source) {
  if (source && typeof source === 'object') {
    if (source.fileID) return { fileID: source.fileID, mediaType: source.mediaType || 'image/jpeg' }
    if (source.base64) return { image: source.base64, mediaType: source.mediaType || 'image/jpeg' }
    if (source.dataUri) source = source.dataUri
  }
  var img = splitDataUri(source)
  return { image: img.base64, mediaType: img.mediaType }
}

// 通过云函数 aiVision 调用视觉模型(Kimi/Anthropic 兼容)识别题目。
function recognizeQuestion(source) {
  return new Promise(function (resolve, reject) {
    var app = getApp()
    if (!app || !app.globalData || !app.globalData.cloudReady) {
      reject(new Error('云开发未就绪，请联网后重试'))
      return
    }
    var payload = buildVisionPayload(source)
    payload.prompt = buildRecognizePrompt()
    payload.debug = !!config.DEBUG
    app.callCloudFunction('aiVision', payload, function (res) {
      if (!res || !res.success) {
        var msg = (res && res.message) || 'AI 识别失败'
        if (config.DEBUG && res && res.error) msg += '：' + res.error
        reject(new Error(msg))
        return
      }
      try { resolve(parseQuestionJSON(res.text)) } catch (e) { reject(e) }
    }, 60000)
  })
}

// 整张试卷·多题识别：返回错题数组（每项含 studentAnswer / errorPoint）。
function recognizeQuestions(source) {
  return new Promise(function (resolve, reject) {
    var app = getApp()
    if (!app || !app.globalData || !app.globalData.cloudReady) {
      reject(new Error('云开发未就绪，请联网后重试'))
      return
    }
    var payload = buildVisionPayload(source)
    payload.prompt = buildRecognizeManyPrompt()
    payload.maxTokens = 4000
    payload.debug = !!config.DEBUG
    app.callCloudFunction('aiVision', payload, function (res) {
      if (!res || !res.success) {
        var msg = (res && res.message) || 'AI 识别失败'
        if (config.DEBUG && res && res.error) msg += '：' + res.error
        reject(new Error(msg))
        return
      }
      try { resolve(parseQuestionsJSON(res.text)) } catch (e) { reject(e) }
    }, 60000)
  })
}

// ---------------- AI：生成课程（文本，流式） ----------------

function buildCoursePrompt(q) {
  var lines = [
    '你是一位耐心、亲切的小学老师。一个小朋友在下面这道题上连续做错了多次，',
    '请为他展开一节简短的讲解课程，帮助他真正学会。',
    '科目：' + (q.subject || ''),
    '题目：' + (q.stem || '')
  ]
  if (q.options && q.options.length) {
    lines.push('选项：' + q.options.map(function (o) { return o.key + '. ' + o.text }).join('   '))
  }
  if (q.correctAnswer) lines.push('正确答案：' + q.correctAnswer)
  lines.push('')
  lines.push('请用适合小学生的语言、亲切的口吻讲解，使用简单的纯文本（不要用复杂 Markdown），按以下结构：')
  lines.push('1）这道题在考什么知识点；')
  lines.push('2）一步一步的解题思路；')
  lines.push('3）小朋友常见的错误以及如何避免；')
  lines.push('4）给出一道类似的小练习题，并附上答案。')
  return lines.join('\n')
}

// onText(chunk, fullSoFar) 用于流式刷新 UI；返回 Promise<完整文本>
function generateCourse(q, onText) {
  return new Promise(function (resolve, reject) {
    if (!wx.cloud || !wx.cloud.extend || !wx.cloud.extend.AI) {
      reject(new Error('当前环境不支持 AI 能力，请确认基础库≥3.7.1并已开通云开发 AI'))
      return
    }
    var model
    try {
      model = wx.cloud.extend.AI.createModel(config.TEXT_PROVIDER)
    } catch (e) { reject(e); return }

    var full = ''
    model.streamText({
      data: {
        model: config.TEXT_MODEL,
        messages: [{ role: 'user', content: buildCoursePrompt(q) }]
      },
      onText: function (t) { full += t; if (onText) onText(t, full) },
      onFinish: function (ft) { resolve(ft || full) }
    }).catch(reject)
  })
}

module.exports = {
  todayStrUTC8: todayStrUTC8,
  isDue: isDue,
  statusLabel: statusLabel,
  STATUS_LABEL: STATUS_LABEL,
  recognizeQuestion: recognizeQuestion,
  recognizeQuestions: recognizeQuestions,
  generateCourse: generateCourse
}
