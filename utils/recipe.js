// 菜谱 —— 客户端工具：图片压缩 / 上传云存储 / AI 识别菜谱
var config = require('../config/ai.js')

var CATEGORIES = ['荤菜', '素菜', '汤类', '主食', '水果', '其他']

// 用 2d canvas 把图片缩放到 maxEdge 内并导出 jpg。canvasNode 由页面传入。
function compressImage(canvasNode, srcPath, maxEdge, quality) {
  maxEdge = maxEdge || 1280
  quality = quality || 0.8
  return new Promise(function (resolve, reject) {
    if (!canvasNode) { resolve(srcPath); return } // 无 canvas 时退回原图
    wx.getImageInfo({
      src: srcPath,
      success: function (info) {
        var scale = Math.min(1, maxEdge / Math.max(info.width, info.height))
        var outW = Math.round(info.width * scale)
        var outH = Math.round(info.height * scale)
        var canvas = canvasNode
        canvas.width = outW
        canvas.height = outH
        var ctx = canvas.getContext('2d')
        var img = canvas.createImage()
        img.onload = function () {
          ctx.drawImage(img, 0, 0, outW, outH)
          wx.canvasToTempFilePath({
            canvas: canvas,
            fileType: 'jpg',
            quality: quality,
            success: function (r) { resolve(r.tempFilePath) },
            fail: function () { resolve(srcPath) } // 导出失败退回原图
          })
        }
        img.onerror = function () { resolve(srcPath) }
        img.src = srcPath
      },
      fail: function () { resolve(srcPath) }
    })
  })
}

// 上传到云存储，返回 fileID
function uploadImage(srcPath) {
  return new Promise(function (resolve, reject) {
    if (!wx.cloud) { reject(new Error('云开发不可用')); return }
    var cloudPath = 'recipe/' + Date.now() + '_' + Math.floor(Math.random() * 1000000) + '.jpg'
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: srcPath,
      success: function (r) { resolve(r.fileID) },
      fail: reject
    })
  })
}

// ---------------- AI：识别菜谱 ----------------

function buildRecipePrompt(nameHint) {
  return [
    '你是家常菜谱助手。请根据这张菜品照片' + (nameHint ? '（菜名提示：' + nameHint + '）' : '') + '识别这道菜，',
    '并【只输出一个 JSON 对象】，不要输出多余文字、解释、Markdown 代码块或反引号。字段：',
    '{',
    '  "name": 菜名,',
    '  "category": 分类，只能是以下之一：' + JSON.stringify(CATEGORIES) + '，',
    '  "ingredients": 主要食材(字符串，用「、」分隔),',
    '  "steps": 简明做法步骤(字符串，可用换行分隔每步),',
    '  "tags": 标签(字符串，如 下饭、家常、快手),',
    '  "nutrition": 一句话营养简评(字符串),',
    '  "calories": { "calories": 每份估算热量(千卡，数字), "protein": 蛋白质克数, "fat": 脂肪克数, "carbs": 碳水克数 }',
    '}',
    '若无法判断热量则给出合理估算。'
  ].join('\n')
}

function parseRecipeJSON(text) {
  if (!text) throw new Error('AI 未返回内容')
  var s = String(text).trim()
  s = s.replace(/^```[a-zA-Z]*/, '').replace(/```$/, '').trim()
  var start = s.indexOf('{')
  var end = s.lastIndexOf('}')
  if (start >= 0 && end > start) s = s.slice(start, end + 1)
  var obj
  try { obj = JSON.parse(s) } catch (e) { throw new Error('AI 返回的内容无法解析为菜谱') }
  return normalizeRecipe(obj)
}

function joinIfArray(v) {
  if (Array.isArray(v)) return v.join('\n')
  return v == null ? '' : String(v)
}

function normalizeRecipe(obj) {
  obj = obj || {}
  var category = CATEGORIES.indexOf(obj.category) >= 0 ? obj.category : '其他'
  var calories = null
  if (obj.calories && typeof obj.calories === 'object') {
    calories = {
      calories: Number(obj.calories.calories) || 0,
      protein: Number(obj.calories.protein) || 0,
      fat: Number(obj.calories.fat) || 0,
      carbs: Number(obj.calories.carbs) || 0,
      unit: '每份(AI估算)'
    }
  }
  return {
    name: String(obj.name == null ? '' : obj.name).trim(),
    category: category,
    ingredients: (Array.isArray(obj.ingredients) ? obj.ingredients.join('、') : String(obj.ingredients == null ? '' : obj.ingredients)).trim(),
    steps: joinIfArray(obj.steps).trim(),
    tags: (Array.isArray(obj.tags) ? obj.tags.join('、') : String(obj.tags == null ? '' : obj.tags)).trim(),
    nutrition: String(obj.nutrition == null ? '' : obj.nutrition).trim(),
    calories: calories
  }
}

function splitDataUri(dataUri) {
  var m = /^data:(.*?);base64,(.*)$/.exec(dataUri || '')
  if (m) return { mediaType: m[1] || 'image/jpeg', base64: m[2] }
  return { mediaType: 'image/jpeg', base64: dataUri || '' }
}

// 通过云函数 aiVision 调用视觉模型(Kimi/Anthropic 兼容)。base64DataUri 可带或不带 data: 前缀。
function recognizeRecipe(base64DataUri, nameHint) {
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
      prompt: buildRecipePrompt(nameHint),
      debug: !!config.DEBUG
    }, function (res) {
      if (!res || !res.success) {
        var msg = (res && res.message) || 'AI 识别失败'
        if (config.DEBUG && res && res.error) msg += '：' + res.error
        reject(new Error(msg))
        return
      }
      try { resolve(parseRecipeJSON(res.text)) } catch (e) { reject(e) }
    }, 60000)
  })
}

module.exports = {
  CATEGORIES: CATEGORIES,
  compressImage: compressImage,
  uploadImage: uploadImage,
  recognizeRecipe: recognizeRecipe
}
