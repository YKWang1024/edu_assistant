// 云函数：列出系统默认菜谱库（REQ-022）。任何登录用户可读(用于导入浏览)。
// 图片 cloud:// fileID → 临时链接，保证跨账号可见。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function buildTempUrlMap(fileIDs) {
  const ids = Array.from(new Set((fileIDs || []).filter(function (f) { return typeof f === 'string' && f.indexOf('cloud://') === 0 })))
  const map = {}
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    try {
      const r = await cloud.getTempFileURL({ fileList: chunk })
      ;(r.fileList || []).forEach(function (f) { if (f.fileID && f.tempFileURL) map[f.fileID] = f.tempFileURL })
    } catch (e) { /* 失败保留原值 */ }
  }
  return map
}
function mapImgs(arr, map) { return (arr || []).map(function (f) { return map[f] || f }) }

exports.main = async (event, context) => {
  try {
    const res = await db.collection('systemRecipes').orderBy('createdAt', 'desc').limit(200).get()
    const list = res.data || []
    const allFileIDs = []
    list.forEach(function (r) { (r.images || []).forEach(function (f) { allFileIDs.push(f) }); if (r.imageUrl) allFileIDs.push(r.imageUrl) })
    const urlMap = await buildTempUrlMap(allFileIDs)
    const out = list.map(function (r) {
      return Object.assign({}, r, {
        images: mapImgs(r.images, urlMap),
        imageUrl: r.imageUrl ? (urlMap[r.imageUrl] || r.imageUrl) : ''
      })
    })
    return { success: true, data: out }
  } catch (err) {
    return { success: false, message: '加载失败', error: err.message }
  }
}
