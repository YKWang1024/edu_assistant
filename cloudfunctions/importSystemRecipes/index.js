// 云函数：把系统默认菜谱导入到当前用户的家庭（REQ-022）。任何家庭用户可调。
// 复制为本家庭独立菜谱(图片沿用同一 fileID)；按 (familyId, sourceSystemId) 去重，不继承评分。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const CATEGORIES = ['荤菜', '素菜', '汤类', '主食', '水果', '其他']

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const ids = Array.isArray(event.ids) ? event.ids.filter(function (x) { return !!x }) : []
    if (!ids.length) return { success: false, message: '请选择要导入的菜谱' }

    const ctx = await resolveFamily(openid)
    if (!ctx || !ctx.familyId) return { success: false, message: '用户未注册或未加入家庭' }
    const familyId = ctx.familyId

    // 已导入过的(去重)
    const existed = await db.collection('recipes')
      .where({ familyId: familyId, sourceSystemId: _.in(ids) })
      .field({ sourceSystemId: true }).limit(500).get()
    const have = {}
    ;(existed.data || []).forEach(function (r) { if (r.sourceSystemId) have[r.sourceSystemId] = true })

    let imported = 0, skipped = 0
    const now = new Date()
    for (let i = 0; i < ids.length; i++) {
      const sid = ids[i]
      if (have[sid]) { skipped++; continue }
      let snap
      try { snap = await db.collection('systemRecipes').doc(sid).get() } catch (e) { snap = null }
      const s = snap && snap.data
      if (!s) { continue }
      await db.collection('recipes').add({
        data: {
          _openid: openid, userId: openid, familyId: familyId,
          name: s.name || '未命名',
          ingredients: s.ingredients || '', steps: s.steps || '',
          category: CATEGORIES.indexOf(s.category) >= 0 ? s.category : '其他',
          mealTimes: Array.isArray(s.mealTimes) ? s.mealTimes : [],
          tags: s.tags || '', nutrition: s.nutrition || '',
          images: Array.isArray(s.images) ? s.images : [], imageUrl: s.imageUrl || '',
          referenceLink: s.referenceLink || '', referenceType: s.referenceType || '', referenceLabel: s.referenceLabel || '',
          calories: s.calories || null,
          ratings: [], avgScore: 0, memberAvgScores: {}, isPublic: false,
          sourceSystemId: sid,
          createdAt: now, updatedAt: now
        }
      })
      imported++
    }
    return { success: true, data: { imported: imported, skipped: skipped } }
  } catch (err) {
    return { success: false, message: '导入失败', error: err.message }
  }
}
