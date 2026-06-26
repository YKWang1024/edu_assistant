// 云函数：拉取本家庭的菜谱列表
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

// 批量把图片 fileID 转临时链接，确保同家庭其他成员也能看到菜品图片
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
  const openid = cloud.getWXContext().OPENID
  try {
    const ctx = await resolveFamily(openid)
    if (!ctx || !ctx.familyId) return { success: false, message: '用户未注册或未加入家庭', code: 'NO_FAMILY' }

    const res = await db.collection('recipes')
      .where({ familyId: ctx.familyId })
      .orderBy('createdAt', 'desc')
      .limit(1000)
      .get()

    const recipes = res.data || []
    const allFileIDs = []
    recipes.forEach(r => {
      ;(r.images || []).forEach(f => allFileIDs.push(f))
      if (r.imageUrl) allFileIDs.push(r.imageUrl)
    })
    const urlMap = await buildTempUrlMap(allFileIDs)
    const out = recipes.map(r => Object.assign({}, r, {
      images: mapImgs(r.images, urlMap),
      imageUrl: r.imageUrl ? (urlMap[r.imageUrl] || r.imageUrl) : r.imageUrl
    }))

    return { success: true, data: out }
  } catch (err) {
    return { success: false, message: '加载失败', error: err.message }
  }
}
