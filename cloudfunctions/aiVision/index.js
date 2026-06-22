const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const SUBJECTS = ['语文', '数学', '英语', '科学', '其他']

function buildRecognizePrompt() {
  return [
    '你是一个中小学题目识别助手。请识别图片中的这一道题目，并【只输出一个 JSON 对象】，',
    '不要输出任何额外文字、解释、Markdown 代码块或反引号。JSON 字段如下：',
    '{',
    '  "subject": 科目，只能是以下之一：' + JSON.stringify(SUBJECTS) + '，',
    '  "type": 题型，只能是 "choice"(选择题) / "fill"(填空或简答) / "other"，',
    '  "stem": 题干文字(字符串，不要包含选项内容)，',
    '  "options": 选择题选项数组，每项形如 {"key":"A","text":"选项内容"}；非选择题填 []，',
    '  "correctAnswer": 正确答案。选择题填选项字母如 "B"；其它题填答案文本；若无法判断填 ""，',
    '  "analysis": 简短解析(50字以内，可为空字符串)',
    '}',
    '若图片中有多道题，只识别最完整、最居中的那一道。数学公式用普通文本表示。'
  ].join('\n')
}

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
  var subject = SUBJECTS.indexOf(obj.subject) >= 0 ? obj.subject : '其他'
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

function requestDeepSeek(apiKey, imageBase64) {
  return new Promise(function (resolve, reject) {
    var data = JSON.stringify({
      model: 'deepseek-v4-pro',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: buildRecognizePrompt() },
          { type: 'image_url', image_url: { url: imageBase64 } }
        ]
      }],
      max_tokens: 6000
    })

    var options = {
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': 'Bearer ' + apiKey
      }
    }

    var req = https.request(options, function (res) {
      var chunks = []
      res.on('data', function (chunk) { chunks.push(chunk) })
      res.on('end', function () {
        var result = Buffer.concat(chunks).toString('utf8')
        try {
          var json = JSON.parse(result)
          if (json.error) {
            reject(new Error('API Error: ' + (json.error.message || json.error.type)))
          } else if (json.choices && json.choices[0] && json.choices[0].message) {
            resolve(json.choices[0].message.content)
          } else {
            reject(new Error('AI 返回格式异常'))
          }
        } catch (e) {
          reject(new Error('解析响应失败: ' + e.message))
        }
      })
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    const { imageBase64, apiKey } = event

    if (!imageBase64) {
      return { success: false, message: '缺少图片数据' }
    }

    if (!apiKey) {
      return { success: false, message: '缺少 API Key' }
    }

    if (!imageBase64.startsWith('data:image/')) {
      return { success: false, message: '图片格式不正确' }
    }

    const content = await requestDeepSeek(apiKey, imageBase64)
    const question = parseQuestionJSON(content)

    return {
      success: true,
      data: question
    }

  } catch (err) {
    console.error('aiVision error:', err.message, err.stack)
    return {
      success: false,
      message: '识别失败',
      error: err.message,
      stack: err.stack ? String(err.stack).substring(0, 500) : ''
    }
  }
}
