// 买菜心得 —— 客户端工具：把口述/输入的内容用 AI 文本模型整理成条理小记。
var config = require('../config/ai.js')

function buildWikiPrompt(raw) {
  return [
    '你是买菜小助手。请把家长口述/输入的买菜心得，整理成简洁、有条理的小记。',
    '尽量分点，覆盖(有就写，没有就略)：今天买了什么、哪些划算/新鲜值得买、',
    '哪些不好/踩坑要避免、保存或挑选小窍门。用简单口语化中文，控制在 150 字内，',
    '只输出整理后的内容，不要加额外说明。',
    '原话：' + (raw || '')
  ].join('\n')
}

// 返回 Promise<整理后的文本>
function organizeNote(raw) {
  return new Promise(function (resolve, reject) {
    if (!wx.cloud || !wx.cloud.extend || !wx.cloud.extend.AI) {
      reject(new Error('当前环境不支持智能能力，请确认基础库与云开发智能'))
      return
    }
    var model
    try { model = wx.cloud.extend.AI.createModel(config.TEXT_PROVIDER) } catch (e) { reject(e); return }
    var full = ''
    model.streamText({
      data: {
        model: config.TEXT_MODEL,
        messages: [{ role: 'user', content: buildWikiPrompt(raw) }]
      },
      onText: function (t) { full += t },
      onFinish: function (ft) { resolve(ft || full) }
    }).catch(reject)
  })
}

module.exports = {
  organizeNote: organizeNote
}
