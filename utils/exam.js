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

// ---------------- AI：识别题目（通过云函数调用 DeepSeek V4 Pro） ----------------

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

function recognizeQuestion(base64DataUri) {
  return new Promise(function (resolve, reject) {
    if (!wx.cloud) {
      reject(new Error('云开发环境未初始化'))
      return
    }
    if (!config.DEEPSEEK_API_KEY) {
      reject(new Error('未配置 DeepSeek API Key'))
      return
    }

    wx.cloud.callFunction({
      name: 'aiVision',
      data: {
        imageBase64: base64DataUri,
        apiKey: config.DEEPSEEK_API_KEY
      },
      success: function (res) {
        if (res.result && res.result.success) {
          try {
            resolve(normalizeQuestion(res.result.data))
          } catch (e) {
            reject(new Error('解析题目失败: ' + e.message))
          }
        } else {
          var msg = res.result && res.result.message || '识别失败'
          if (res.result && res.result.error) msg += ' (' + res.result.error + ')'
          reject(new Error(msg))
        }
      },
      fail: function (err) {
        reject(new Error('云函数调用失败: ' + (err.errMsg || err.message)))
      }
    })
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
