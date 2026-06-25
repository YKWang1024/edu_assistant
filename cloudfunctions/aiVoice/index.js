// 云函数：语音转文字（ASR）—— 直连「OpenAI 兼容」的 /audio/transcriptions 接口。
// 客户端录音上传云存储后传 fileID，这里下载音频再转写，返回文字。
//
// ⚠️ 重要说明：经核实，Kimi/Moonshot【托管 API 目前没有公开的语音转文字接口】
//    （Kimi-Audio 是开源模型，需自部署）。因此本函数做成「OpenAI 兼容、可配置」，
//    默认指向 Moonshot 根地址以便其将来支持；若不可用，请把环境变量指向真正的 ASR 服务
//    （如 OpenAI Whisper、Groq Whisper，或腾讯云语音识别 —— 腾讯云 ASR 与本 CloudBase 同生态）。
//
// 环境变量（云开发控制台 → 云函数 aiVoice → 环境变量）：
//   AI_VOICE_API_KEY   ASR 服务的 API Key（必填）
//   AI_VOICE_BASE_URL  根地址，默认 https://api.moonshot.ai/v1 （实际请求 .../audio/transcriptions）
//   AI_VOICE_MODEL     模型名，默认 whisper-1
//   AI_VOICE_ENDPOINT  可选：完整请求 URL，覆盖 BASE_URL 拼接
const https = require('https')
const { URL } = require('url')
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const API_KEY = process.env.AI_VOICE_API_KEY || ''
const BASE_URL = process.env.AI_VOICE_BASE_URL || 'https://api.moonshot.ai/v1'
const ENDPOINT = process.env.AI_VOICE_ENDPOINT || ''
const MODEL = process.env.AI_VOICE_MODEL || 'whisper-1'

function endpointUrl() {
  return ENDPOINT || (BASE_URL.replace(/\/+$/, '') + '/audio/transcriptions')
}

// 手工拼 multipart/form-data（不引第三方依赖）
function buildMultipart(boundary, fields, fileFieldName, filename, contentType, fileBuf) {
  let head = ''
  Object.keys(fields).forEach(function (k) {
    head += '--' + boundary + '\r\nContent-Disposition: form-data; name="' + k + '"\r\n\r\n' + fields[k] + '\r\n'
  })
  head += '--' + boundary + '\r\nContent-Disposition: form-data; name="' + fileFieldName + '"; filename="' + filename + '"\r\nContent-Type: ' + contentType + '\r\n\r\n'
  const tail = '\r\n--' + boundary + '--\r\n'
  return Buffer.concat([Buffer.from(head, 'utf8'), fileBuf, Buffer.from(tail, 'utf8')])
}

function httpPost(urlStr, headers, bodyBuf) {
  return new Promise(function (resolve, reject) {
    const u = new URL(urlStr)
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'POST',
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

exports.main = async (event, context) => {
  const DEBUG = !!(event && event.debug)
  try {
    if (!API_KEY) {
      return { success: false, message: '未配置语音识别 API Key：请在云函数 aiVoice 的环境变量 AI_VOICE_API_KEY 中设置' }
    }

    let audio = null
    const contentType = event.mediaType || 'audio/mpeg'
    const filename = event.filename || 'audio.mp3'
    if (event.fileID) {
      const dl = await cloud.downloadFile({ fileID: event.fileID })
      audio = dl.fileContent
    } else if (event.audioBase64) {
      audio = Buffer.from(event.audioBase64, 'base64')
    }
    if (!audio || !audio.length) return { success: false, message: '缺少音频' }

    const boundary = '----wxvoice' + Date.now()
    const fields = { model: MODEL }
    if (event.language) fields.language = event.language // 可传 'zh' 提升中文准确率
    const body = buildMultipart(boundary, fields, 'file', filename, contentType, audio)

    const res = await httpPost(endpointUrl(), {
      'Authorization': 'Bearer ' + API_KEY,
      'Content-Type': 'multipart/form-data; boundary=' + boundary
    }, body)

    if (res.status >= 400) {
      return { success: false, message: '语音识别返回错误(' + res.status + ')', error: DEBUG ? (typeof res.body === 'string' ? res.body : JSON.stringify(res.body)) : undefined }
    }

    let text = ''
    if (res.body && typeof res.body === 'object') text = res.body.text || (res.body.result && res.body.result.text) || ''
    else if (typeof res.body === 'string') text = res.body
    if (!text) return { success: false, message: '未识别到文字', error: DEBUG ? (typeof res.body === 'string' ? res.body : JSON.stringify(res.body)) : undefined }

    return { success: true, text: String(text).trim() }
  } catch (err) {
    return { success: false, message: '识别失败', error: DEBUG ? err.message : undefined }
  }
}
