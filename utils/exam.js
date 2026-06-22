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
    '  "analysis": 简短解析(50字以内，可为空字符串)',
    '}',
    '若图片中有多道题，只识别最完整、最居中的那一道。数学公式用普通文本表示。'
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
  var options = []
  if (Array.isArray(obj.options)) {
    options = obj.options.map(function (o, i) {
      var key = String.fromCharCode(65 + i)
      if (o && typeof o === 'object') {
        return { key: String(o.key || key), text: String(o.text == null ? '' : o.text) }
      }
      return { key: key, text: String(o == null ? '' : o) }
    }).filter(function (o) { return o.text && o.text.trim() })
  }
  if (options.length > 0) type = 'choice'
  return {
    subject: subject,
    type: type,
    stem: String(obj.stem == null ? '' : obj.stem).trim(),
    options: options,
    correctAnswer: String(obj.correctAnswer == null ? '' : obj.correctAnswer).trim(),
    analysis: String(obj.analysis == null ? '' : obj.analysis).trim()
  }
}

function splitDataUri(dataUri) {
  var m = /^data:(.*?);base64,(.*)$/.exec(dataUri || '')
  if (m) return { mediaType: m[1] || 'image/jpeg', base64: m[2] }
  return { mediaType: 'image/jpeg', base64: dataUri || '' }
}

// 通过云函数 aiVision 调用视觉模型(Kimi/Anthropic 兼容)识别题目。
function recognizeQuestion(base64DataUri) {
  return new Promise(function (resolve, reject) {
    var app = getApp()
    if (!app || !app.globalData || !app.globalData.cloudReady) {
      reject(new Error('云开发未就绪，请联网后重试'))
      return
    }
    var img = splitDataUri(base64DataUri)
    app.callCloudFunction('aiVision', {
      image: img.base64,
      mediaType: img.mediaType,
      prompt: buildRecognizePrompt()
    }, function (res) {
      if (!res || !res.success) {
        reject(new Error((res && (res.message + (res.error ? ('：' + res.error) : ''))) || 'AI 识别失败'))
        return
      }
      try { resolve(parseQuestionJSON(res.text)) } catch (e) { reject(e) }
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
  generateCourse: generateCourse
}
