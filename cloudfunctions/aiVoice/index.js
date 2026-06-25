// 云函数：语音转文字（ASR）—— 腾讯云「一句话识别」SentenceRecognition。
// 客户端录音(mp3, 16k 单声道, ≤60s)上传云存储后传 fileID，这里下载音频转写返回文字。
// 腾讯云 ASR 与本 CloudBase 同生态，最稳。
//
// 环境变量（云开发控制台 → 云函数 aiVoice → 环境变量）：
//   TENCENT_SECRET_ID    腾讯云 API 密钥 SecretId（必填）
//   TENCENT_SECRET_KEY   腾讯云 API 密钥 SecretKey（必填）
//   TENCENT_ASR_REGION   地域，默认 ap-guangzhou
//   TENCENT_ASR_ENGINE   引擎，默认 16k_zh（16k 中文普通话，匹配客户端 16k mp3 录音）
//
// 准备：① 腾讯云控制台开通「语音识别 ASR」；② 在「访问管理 CAM」建子用户/密钥并授予
//      QcloudASRFullAccess；③ 把 SecretId/SecretKey 填到本函数环境变量。
// 依赖 tencentcloud-sdk-nodejs-asr（部署时勾「云端安装依赖」会自动装）。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const tencentcloud = require('tencentcloud-sdk-nodejs-asr')
const AsrClient = tencentcloud.asr.v20190614.Client

const SECRET_ID = process.env.TENCENT_SECRET_ID || ''
const SECRET_KEY = process.env.TENCENT_SECRET_KEY || ''
const REGION = process.env.TENCENT_ASR_REGION || 'ap-guangzhou'
const ENGINE = process.env.TENCENT_ASR_ENGINE || '16k_zh'

exports.main = async (event, context) => {
  const DEBUG = !!(event && event.debug)
  try {
    if (!SECRET_ID || !SECRET_KEY) {
      return { success: false, message: '未配置腾讯云密钥：请在云函数 aiVoice 环境变量设置 TENCENT_SECRET_ID / TENCENT_SECRET_KEY' }
    }

    // 取音频
    let audio = null
    if (event.fileID) {
      const dl = await cloud.downloadFile({ fileID: event.fileID })
      audio = dl.fileContent
    } else if (event.audioBase64) {
      audio = Buffer.from(event.audioBase64, 'base64')
    }
    if (!audio || !audio.length) return { success: false, message: '缺少音频' }

    // 一句话识别要求音频 ≤ 60s 且 base64 后 ≤ 3MB
    if (audio.length > 3 * 1024 * 1024) {
      return { success: false, message: '录音太长了，请控制在 1 分钟以内' }
    }

    const client = new AsrClient({
      credential: { secretId: SECRET_ID, secretKey: SECRET_KEY },
      region: REGION,
      profile: { httpProfile: { endpoint: 'asr.tencentcloudapi.com', reqTimeout: 50 } }
    })

    const res = await client.SentenceRecognition({
      EngSerViceType: ENGINE,
      SourceType: 1,                       // 1 = 音频数据(base64)
      VoiceFormat: event.voiceFormat || 'mp3',
      Data: audio.toString('base64'),
      DataLen: audio.length
    })

    const text = res && res.Result ? String(res.Result).trim() : ''
    if (!text) return { success: false, message: '没听清，请再说一次', error: DEBUG ? JSON.stringify(res) : undefined }
    return { success: true, text: text }
  } catch (err) {
    // 腾讯云 SDK 错误带 code/message
    const detail = err && (err.message || err.code) ? ((err.code || '') + ' ' + (err.message || '')).trim() : String(err)
    return { success: false, message: '识别失败', error: DEBUG ? detail : undefined }
  }
}
