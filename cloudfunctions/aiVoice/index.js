// 云函数：语音转文字（ASR）。客户端录音上传云存储后传 fileID，这里下载音频再转写。
//
// 两种模式（env `AI_VOICE_MODE`）：
//   'chat'（默认）—— 把音频当作多模态输入丢给 Kimi 2.6（和图片识别 aiVision 走同一套 Kimi Code 接口/Key），
//                    让模型转写。【这是按用户要求“像图片识别一样用 kimi 2.6 试一试”的实现】。
//                    ⚠️ Anthropic 兼容协议官方只有 text/image 块，没有 audio 块；若返回
//                    “unknown variant audio”之类错误，说明该接口不吃音频，请改用 transcribe 模式。
//   'transcribe' —— 走「OpenAI 兼容」的 /audio/transcriptions（真正的 ASR，如 Whisper / 腾讯云 ASR）。
//
// 环境变量（缺省复用 aiVision 的 Kimi Code 配置，所以默认不用另配 Key）：
//   AI_VOICE_MODE      'chat'(默认) | 'transcribe'
//   AI_VOICE_API_KEY   不填则用 AI_VISION_API_KEY（与图片识别同一把 Kimi Code Key）
//   AI_VOICE_BASE_URL  不填则用 AI_VISION_BASE_URL，再不填默认 https://api.kimi.com/coding
//   AI_VOICE_MODEL     不填则用 AI_VISION_MODEL，再不填默认 kimi-2.6
//   AI_VOICE_PROTOCOL  'anthropic'(默认, 同 aiVision) | 'openai'
//   AI_VOICE_ENDPOINT  可选：完整请求 URL，覆盖拼接
const https = require('https')
const { URL } = require('url')
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const MODE = process.env.AI_VOICE_MODE || 'chat'
const PROTOCOL = process.env.AI_VOICE_PROTOCOL || 'anthropic'
const API_KEY = process.env.AI_VOICE_API_KEY || process.env.AI_VISION_API_KEY || ''
const BASE_URL = process.env.AI_VOICE_BASE_URL || process.env.AI_VISION_BASE_URL || 'https://api.kimi.com/coding'
const ENDPOINT = process.env.AI_VOICE_ENDPOINT || ''
const MODEL = process.env.AI_VOICE_MODEL || process.env.AI_VISION_MODEL || 'kimi-2.6'

const TRANSCRIBE_PROMPT = '请把这段语音逐字转写成简体中文纯文本，只输出转写结果，不要加任何解释或标点之外的内容。'

function endpointFor(kind) {
  if (ENDPOINT) return ENDPOINT
  const base = BASE_URL.replace(/\/+$/, '')
  if (kind === 'transcribe') return base + '/audio/transcriptions'
  if (kind === 'openai') return base + '/chat/completions'
  return base + '/v1/messages' // anthropic
}

function httpPost(urlStr, headers, bodyBuf) {
  return new Promise(function (resolve, reject) {
    const u = new URL(urlStr)
    const req = https.request({
      hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, method: 'POST',
      headers: Object.assign({ 'Content-Length': bodyBuf.length }, headers)
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
    req.write(bodyBuf)
    req.end()
  })
}

function postJson(urlStr, headers, obj) {
  return httpPost(urlStr, Object.assign({ 'Content-Type': 'application/json' }, headers), Buffer.from(JSON.stringify(obj), 'utf8'))
}

// multipart/form-data（transcribe 模式用）
function buildMultipart(boundary, fields, fileFieldName, filename, contentType, fileBuf) {
  let head = ''
  Object.keys(fields).forEach(function (k) {
    head += '--' + boundary + '\r\nContent-Disposition: form-data; name="' + k + '"\r\n\r\n' + fields[k] + '\r\n'
  })
  head += '--' + boundary + '\r\nContent-Disposition: form-data; name="' + fileFieldName + '"; filename="' + filename + '"\r\nContent-Type: ' + contentType + '\r\n\r\n'
  const tail = '\r\n--' + boundary + '--\r\n'
  return Buffer.concat([Buffer.from(head, 'utf8'), fileBuf, Buffer.from(tail, 'utf8')])
}

exports.main = async (event, context) => {
  const DEBUG = !!(event && event.debug)
  try {
    if (!API_KEY) {
      return { success: false, message: '未配置 API Key：请在云函数 aiVoice/aiVision 的环境变量里设置（默认复用 AI_VISION_API_KEY）' }
    }

    // 取音频
    let audio = null
    const mediaType = event.mediaType || 'audio/mpeg'
    const filename = event.filename || 'audio.mp3'
    if (event.fileID) {
      const dl = await cloud.downloadFile({ fileID: event.fileID })
      audio = dl.fileContent
    } else if (event.audioBase64) {
      audio = Buffer.from(event.audioBase64, 'base64')
    }
    if (!audio || !audio.length) return { success: false, message: '缺少音频' }

    // ---- transcribe 模式：真正的 ASR（/audio/transcriptions）----
    if (MODE === 'transcribe') {
      const boundary = '----wxvoice' + Date.now()
      const fields = { model: MODEL }
      if (event.language) fields.language = event.language
      const body = buildMultipart(boundary, fields, 'file', filename, mediaType, audio)
      const res = await httpPost(endpointFor('transcribe'), {
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type': 'multipart/form-data; boundary=' + boundary
      }, body)
      if (res.status >= 400) return { success: false, message: '语音识别返回错误(' + res.status + ')', error: DEBUG ? stringify(res.body) : undefined }
      let text = pick(res.body, ['text']) || (res.body && res.body.result && res.body.result.text) || ''
      if (!text) return { success: false, message: '未识别到文字', error: DEBUG ? stringify(res.body) : undefined }
      return { success: true, text: String(text).trim() }
    }

    // ---- chat 模式：把音频当多模态输入丢给 Kimi 2.6（和图片识别同一套）----
    const b64 = audio.toString('base64')
    const maxTokens = event.maxTokens || 2000

    if (PROTOCOL === 'openai') {
      const body = {
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{
          role: 'user',
          content: [
            { type: 'input_audio', input_audio: { data: b64, format: 'mp3' } },
            { type: 'text', text: TRANSCRIBE_PROMPT }
          ]
        }]
      }
      const res = await postJson(endpointFor('openai'), { 'Authorization': 'Bearer ' + API_KEY }, body)
      if (res.status >= 400) return { success: false, message: '语音接口返回错误(' + res.status + ')', error: DEBUG ? stringify(res.body) : undefined }
      let text = ''
      try { text = res.body.choices[0].message.content } catch (e) { text = '' }
      if (!text) return { success: false, message: '模型未返回文字', error: DEBUG ? stringify(res.body) : undefined }
      return { success: true, text: String(text).trim() }
    }

    // anthropic（Kimi Code 兼容，和 aiVision 一致）
    const body = {
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: [
          { type: 'audio', source: { type: 'base64', media_type: mediaType, data: b64 } },
          { type: 'text', text: TRANSCRIBE_PROMPT }
        ]
      }]
    }
    const res = await postJson(endpointFor('anthropic'), {
      'x-api-key': API_KEY, 'Authorization': 'Bearer ' + API_KEY, 'anthropic-version': '2023-06-01'
    }, body)
    if (res.status >= 400) {
      return { success: false, message: '语音接口返回错误(' + res.status + ')。若提示 audio 不支持，说明 Kimi 接口暂不吃音频，请把 aiVoice 环境变量 AI_VOICE_MODE 改为 transcribe 并接入真正的 ASR。', error: DEBUG ? stringify(res.body) : undefined }
    }
    let text = ''
    try {
      text = (res.body.content || []).filter(function (b) { return b.type === 'text' }).map(function (b) { return b.text }).join('')
    } catch (e) { text = '' }
    if (!text) return { success: false, message: '模型未返回文字', error: DEBUG ? stringify(res.body) : undefined }
    return { success: true, text: String(text).trim() }
  } catch (err) {
    return { success: false, message: '识别失败', error: DEBUG ? err.message : undefined }
  }
}

function stringify(v) { return typeof v === 'string' ? v : JSON.stringify(v) }
function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return ''
  for (let i = 0; i < keys.length; i++) { if (obj[keys[i]]) return obj[keys[i]] }
  return ''
}
