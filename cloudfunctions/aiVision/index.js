// 云函数：通用视觉识别 —— 直连「OpenAI 兼容 / Anthropic(Claude) 兼容」的多模态接口
// 适配 Kimi Code 的 apikey(Anthropic 兼容)。客户端传 base64 图片 + prompt，返回模型文本。
//
// ⚠️ API Key 等机密请在云开发控制台 → 云函数 aiVision → 环境变量 里配置，不要写进代码提交：
//   AI_VISION_API_KEY   你的 Kimi Code / 视觉接口 API Key (必填)
//   AI_VISION_PROTOCOL  'anthropic'(默认, Claude 兼容) 或 'openai'
//   AI_VISION_BASE_URL  根地址，默认 https://api.moonshot.cn/anthropic
//                       (国际版用 https://api.moonshot.ai/anthropic; openai 协议用 https://api.moonshot.cn/v1)
//   AI_VISION_ENDPOINT  可选：直接给完整请求 URL，覆盖 BASE_URL 拼接
//   AI_VISION_MODEL     模型名(需支持图片)，如 kimi-latest
const https = require('https')
const { URL } = require('url')

const PROTOCOL = process.env.AI_VISION_PROTOCOL || 'anthropic'
const BASE_URL = process.env.AI_VISION_BASE_URL || 'https://api.moonshot.cn/anthropic'
const ENDPOINT = process.env.AI_VISION_ENDPOINT || ''
const API_KEY = process.env.AI_VISION_API_KEY || ''
const MODEL = process.env.AI_VISION_MODEL || 'kimi-latest'

function endpointFor(protocol) {
  if (ENDPOINT) return ENDPOINT
  const base = BASE_URL.replace(/\/+$/, '')
  return protocol === 'openai' ? (base + '/chat/completions') : (base + '/v1/messages')
}

function httpPostJson(urlStr, headers, bodyObj) {
  return new Promise(function (resolve, reject) {
    const u = new URL(urlStr)
    const data = JSON.stringify(bodyObj)
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, headers)
    }, function (res) {
      let buf = ''
      res.on('data', function (d) { buf += d })
      res.on('end', function () {
        let parsed = buf
        try { parsed = JSON.parse(buf) } catch (e) {}
        resolve({ status: res.statusCode, body: parsed })
      })
    })
    req.on('error', reject)
    req.setTimeout(50000, function () { req.destroy(new Error('请求超时')) })
    req.write(data)
    req.end()
  })
}

exports.main = async (event, context) => {
  try {
    if (!API_KEY) {
      return { success: false, message: '未配置视觉模型 API Key：请在云函数 aiVision 的环境变量 AI_VISION_API_KEY 中设置' }
    }
    const image = event.image // 原始 base64（不含 data: 前缀）
    const prompt = event.prompt || '请描述这张图片。'
    const mediaType = event.mediaType || 'image/jpeg'
    const maxTokens = event.maxTokens || 2000
    if (!image) return { success: false, message: '缺少图片' }

    let text = ''
    if (PROTOCOL === 'openai') {
      const body = {
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: 'data:' + mediaType + ';base64,' + image } },
            { type: 'text', text: prompt }
          ]
        }]
      }
      const res = await httpPostJson(endpointFor('openai'), { 'Authorization': 'Bearer ' + API_KEY }, body)
      if (res.status >= 400) return { success: false, message: '视觉接口返回错误(' + res.status + ')', error: typeof res.body === 'string' ? res.body : JSON.stringify(res.body) }
      try { text = res.body.choices[0].message.content } catch (e) { text = '' }
    } else {
      // anthropic (Claude / Kimi Code 兼容)
      const body = {
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: prompt }
          ]
        }]
      }
      const res = await httpPostJson(endpointFor('anthropic'), { 'x-api-key': API_KEY, 'Authorization': 'Bearer ' + API_KEY, 'anthropic-version': '2023-06-01' }, body)
      if (res.status >= 400) return { success: false, message: '视觉接口返回错误(' + res.status + ')', error: typeof res.body === 'string' ? res.body : JSON.stringify(res.body) }
      try {
        text = (res.body.content || []).filter(function (b) { return b.type === 'text' }).map(function (b) { return b.text }).join('')
      } catch (e) { text = '' }
    }

    if (!text) return { success: false, message: '模型未返回内容' }
    return { success: true, text: text }
  } catch (err) {
    return { success: false, message: '识别失败', error: err.message }
  }
}
