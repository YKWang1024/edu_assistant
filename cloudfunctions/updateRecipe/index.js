// 云函数：编辑修改已有菜谱（REQ-021）。仅本家庭、且本人创建或管理员可改。
// 只更新传入的文本字段 + 建议餐次；不传 images 则保留原图，不动评分。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const CATEGORIES = ['荤菜', '素菜', '汤类', '主食', '水果', '其他']
const MEAL_TIMES = ['早餐', '中餐', '晚餐']
function normMeals(v) {
  if (!Array.isArray(v)) return []
  const out = []
  v.forEach(function (m) { if (MEAL_TIMES.indexOf(m) >= 0 && out.indexOf(m) < 0) out.push(m) })
  return out
}

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const recipeId = event.recipeId
    if (!recipeId) return { success: false, message: '缺少菜谱ID' }

    const ctx = await resolveFamily(openid)
    if (!ctx || !ctx.familyId) return { success: false, message: '用户未注册或未加入家庭' }

    let snap
    try { snap = await db.collection('recipes').doc(recipeId).get() } catch (e) { snap = null }
    const r = snap && snap.data
    if (!r) return { success: false, message: '菜谱不存在或已删除' }
    if (r.familyId !== ctx.familyId) return { success: false, message: '无权编辑该菜谱' }
    const isOwner = (r.userId === openid) || (r._openid === openid)
    if (!isOwner && ctx.role !== 'admin') return { success: false, message: '只能编辑自己添加的菜谱' }

    const upd = { updatedAt: new Date() }
    if (event.name != null) {
      const nm = String(event.name).trim()
      if (!nm) return { success: false, message: '菜名不能为空' }
      upd.name = nm
    }
    if (event.ingredients != null) upd.ingredients = String(event.ingredients)
    if (event.steps != null) upd.steps = String(event.steps)
    if (event.category != null) upd.category = CATEGORIES.indexOf(event.category) >= 0 ? event.category : '其他'
    if (event.tags != null) upd.tags = String(event.tags)
    if (event.nutrition != null) upd.nutrition = String(event.nutrition)
    if (event.mealTimes != null) upd.mealTimes = normMeals(event.mealTimes)
    if (event.referenceLink != null) upd.referenceLink = String(event.referenceLink || '')
    if (event.referenceType != null) upd.referenceType = String(event.referenceType || '')
    if (event.referenceLabel != null) upd.referenceLabel = String(event.referenceLabel || '')
    if (event.calories !== undefined) upd.calories = event.calories || null
    if (Array.isArray(event.images)) upd.images = event.images // 传了才覆盖，否则保留原图

    await db.collection('recipes').doc(recipeId).update({ data: upd })
    return { success: true, data: { _id: recipeId } }
  } catch (err) {
    return { success: false, message: '保存失败', error: err.message }
  }
}
