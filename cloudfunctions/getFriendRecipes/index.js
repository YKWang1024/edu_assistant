// 云函数：菜友圈公共池 —— 拉取所有 isPublic 菜谱 + 发布者信息。
// 关键：把图片/头像的 cloud:// fileID 转成临时下载链接，确保「别人也能看到图片」
// (云函数有读取权限，签名后的临时链接任何人都能加载，规避存储「仅创建者可读」限制)。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 批量把 fileID 转临时链接(每次最多 50 个，自动分批；失败则保留原值)
async function buildTempUrlMap(fileIDs) {
  const ids = Array.from(new Set((fileIDs || []).filter(function (f) { return typeof f === 'string' && f.indexOf('cloud://') === 0 })))
  const map = {}
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    try {
      const r = await cloud.getTempFileURL({ fileList: chunk })
      ;(r.fileList || []).forEach(function (f) { if (f.fileID && f.tempFileURL) map[f.fileID] = f.tempFileURL })
    } catch (e) { /* 转换失败保留原 fileID */ }
  }
  return map
}
function mapImgs(arr, map) { return (arr || []).map(function (f) { return map[f] || f }) }

exports.main = async (event, context) => {
  try {
    const db = cloud.database()
    const { page = 1, pageSize = 20, userOpenid } = event

    let query = { isPublic: true }
    if (userOpenid) query.userId = userOpenid

    const recipesResult = await db.collection('recipes')
      .where(query)
      .orderBy('sharedAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    // 发布者信息
    const publisherOpenids = [...new Set(recipesResult.data.map(r => r.userId))]
    let publishers = {}
    if (publisherOpenids.length > 0) {
      const usersResult = await db.collection('users')
        .where({ openid: db.command.in(publisherOpenids) })
        .field({ openid: true, nickname: true, avatarUrl: true })
        .get()
      usersResult.data.forEach(u => { publishers[u.openid] = u })
    }

    // 收集所有图片/头像 fileID → 临时链接
    const allFileIDs = []
    recipesResult.data.forEach(r => {
      ;(r.images || []).forEach(f => allFileIDs.push(f))
      if (r.imageUrl) allFileIDs.push(r.imageUrl)
    })
    Object.keys(publishers).forEach(k => { if (publishers[k].avatarUrl) allFileIDs.push(publishers[k].avatarUrl) })
    const urlMap = await buildTempUrlMap(allFileIDs)

    const pad = n => (n < 10 ? '0' : '') + n
    const toDateStr = d => {
      if (!d) return ''
      const t = new Date(d).getTime()
      if (isNaN(t)) return ''
      const x = new Date(t + 8 * 3600 * 1000)
      return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate())
    }

    const recipesWithPublisher = recipesResult.data.map(r => {
      const pub = publishers[r.userId] || {}
      return {
        ...r,
        images: mapImgs(r.images, urlMap),
        imageUrl: r.imageUrl ? (urlMap[r.imageUrl] || r.imageUrl) : r.imageUrl,
        publisher: Object.assign({}, pub, { avatarUrl: pub.avatarUrl ? (urlMap[pub.avatarUrl] || pub.avatarUrl) : '' }),
        sharedDate: toDateStr(r.sharedAt || r.createdAt)
      }
    })

    return { success: true, data: recipesWithPublisher, total: recipesResult.data.length }
  } catch (err) {
    return { success: false, message: '获取失败', error: err.message }
  }
}
