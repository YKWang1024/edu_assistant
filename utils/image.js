// 图片压缩工具（全局复用）
// =====================================================================
// 用途：
//   ① 传给云函数 aiVision 识别【之前】先压缩，避免大图触发
//      `cloud.callFunction:fail Error:data exceed max size`（请求包体积超限）。
//   ② 上传云存储（菜谱/错题配图）之前压缩，省流量与存储空间。
//
// 说明：微信小程序的 canvas / wx.compressImage 仅支持导出 jpg / png，
//       【不支持 webp 编码】。照片场景 jpg 体积最小、识别足够，所以统一压成 jpg。
//       （webp 仅能解码显示、不能由小程序端生成，故此处不用 webp。）
//
// 主要接口：
//   compressForCloud(src, opts) -> Promise<{ tempFilePath, base64, dataUri, mediaType, sizeKB }>
//       逐级降分辨率/画质，直到 base64 体积 <= 目标(默认~720KB)，用于喂给 aiVision。
//   compressForUpload(src, opts) -> Promise<tempFilePath>
//       仅压一次（默认 1280px / 0.8），用于 wx.cloud.uploadFile。
// =====================================================================

function getImageInfo(src) {
  return new Promise(function (resolve, reject) {
    wx.getImageInfo({ src: src, success: resolve, fail: reject })
  })
}

function readFileBase64(path) {
  return new Promise(function (resolve, reject) {
    wx.getFileSystemManager().readFile({
      filePath: path,
      encoding: 'base64',
      success: function (r) { resolve(r.data) },
      fail: reject
    })
  })
}

// 用离屏 2d canvas 缩放并导出 jpg（无需页面里的 canvas 节点，便于全局复用）。
// quality: 0~1。失败时由调用方回退到 wx.compressImage。
function drawViaOffscreen(src, outW, outH, quality) {
  return new Promise(function (resolve, reject) {
    if (!wx.createOffscreenCanvas) { reject(new Error('offscreen canvas 不可用')); return }
    var canvas
    try {
      canvas = wx.createOffscreenCanvas({ type: '2d', width: outW, height: outH })
    } catch (e) { reject(e); return }
    if (!canvas) { reject(new Error('offscreen canvas 创建失败')); return }
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
        fail: reject
      })
    }
    img.onerror = function () { reject(new Error('图片解码失败')) }
    img.src = src
  })
}

// 回退方案：wx.compressImage（部分机型可能忽略尺寸，仅作兜底）。quality: 0~1。
function compressViaApi(src, outW, outH, quality) {
  return new Promise(function (resolve, reject) {
    var q = Math.max(1, Math.min(100, Math.round(quality * 100)))
    wx.compressImage({
      src: src,
      quality: q,
      compressedWidth: outW,
      compressedHeight: outH,
      success: function (r) { resolve(r.tempFilePath) },
      fail: function () {
        // 再退一步：只压画质、不改尺寸
        wx.compressImage({
          src: src,
          quality: q,
          success: function (r2) { resolve(r2.tempFilePath) },
          fail: reject
        })
      }
    })
  })
}

// 把图片最长边缩到 maxEdge 内、按 quality 压成 jpg，返回临时文件路径。
function resizeToTempFile(src, maxEdge, quality) {
  return getImageInfo(src).then(function (info) {
    var longest = Math.max(info.width || 0, info.height || 0) || maxEdge
    var scale = Math.min(1, maxEdge / longest)
    var outW = Math.max(1, Math.round((info.width || maxEdge) * scale))
    var outH = Math.max(1, Math.round((info.height || maxEdge) * scale))
    return drawViaOffscreen(src, outW, outH, quality).catch(function () {
      return compressViaApi(src, outW, outH, quality)
    })
  })
}

// 逐级压缩档位：先尽量保清晰（利于 OCR），太大再降。
var CLOUD_STEPS = [
  { maxEdge: 1800, quality: 0.75 },
  { maxEdge: 1600, quality: 0.66 },
  { maxEdge: 1280, quality: 0.60 },
  { maxEdge: 1024, quality: 0.55 },
  { maxEdge: 820,  quality: 0.50 }
]

// 压到 base64 体积 <= targetBytes（默认约 720KB，远低于云函数请求上限）。
// 返回 { tempFilePath, base64, dataUri, mediaType, sizeKB }。
function compressForCloud(src, options) {
  options = options || {}
  var targetBytes = options.targetBytes || 720 * 1024
  var steps = options.steps || CLOUD_STEPS
  var i = 0
  var last = null

  function attempt() {
    if (i >= steps.length) return Promise.resolve(last) // 用最后一档兜底
    var s = steps[i++]
    return resizeToTempFile(src, s.maxEdge, s.quality).then(function (path) {
      return readFileBase64(path).then(function (b64) {
        last = {
          tempFilePath: path,
          base64: b64,
          dataUri: 'data:image/jpeg;base64,' + b64,
          mediaType: 'image/jpeg',
          sizeKB: Math.round(b64.length / 1024)
        }
        if (b64.length <= targetBytes) return last
        return attempt() // 还是太大，继续降档
      })
    }).catch(function (err) {
      if (i < steps.length) return attempt()
      if (last) return last
      throw err
    })
  }

  return attempt()
}

// 仅返回压缩后的临时文件路径（上传云存储用）。
function compressForUpload(src, options) {
  options = options || {}
  var maxEdge = options.maxEdge || 1280
  var quality = options.quality || 0.8
  return resizeToTempFile(src, maxEdge, quality).catch(function () { return src })
}

// 上传本地文件到云存储，返回 fileID。cloudPath 不传则按 prefix 自动生成。
function uploadFile(srcPath, cloudPathOrPrefix) {
  return new Promise(function (resolve, reject) {
    if (!wx.cloud) { reject(new Error('云开发不可用')); return }
    var cloudPath = cloudPathOrPrefix || 'tmp/'
    if (/\/$/.test(cloudPath) || cloudPath.indexOf('.') < 0) {
      cloudPath = cloudPath.replace(/\/$/, '') + '/' + Date.now() + '_' + Math.floor(Math.random() * 1000000) + '.jpg'
    }
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: srcPath,
      success: function (r) { resolve(r.fileID) },
      fail: reject
    })
  })
}

module.exports = {
  compressForCloud: compressForCloud,
  compressForUpload: compressForUpload,
  resizeToTempFile: resizeToTempFile,
  readFileBase64: readFileBase64,
  uploadFile: uploadFile
}
