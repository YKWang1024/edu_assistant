// 云函数：修改一条评分（早于今天需 confirmBeforeToday，服务端再次校验）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function pad(n) { return (n < 10 ? '0' : '') + n }
function dateStrUTC8() {
  const d = new Date(Date.now() + 8 * 3600 * 1000)
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
}

function recompute(ratings) {
  const active = (ratings || []).filter(function (r) { return !r.deleted })
  let total = 0
  active.forEach(function (r) { total += Number(r.score) || 0 })
  const avg = active.length ? Math.round((total / active.length) * 10) / 10 : 0
  const ms = {}
  active.forEach(function (r) {
    const k = r.memberName || '未知'
    if (!ms[k]) ms[k] = { t: 0, c: 0 }
    ms[k].t += Number(r.score) || 0
    ms[k].c += 1
  })
  const memberAvg = {}
  Object.keys(ms).forEach(function (k) { memberAvg[k] = Math.round((ms[k].t / ms[k].c) * 10) / 10 })
  return { avgScore: avg, memberAvgScores: memberAvg }
}

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const { recipeId, ratingId, score, comment, confirmBeforeToday } = event
    if (!recipeId || !ratingId) return { success: false, message: '参数不完整' }
    const sc = Number(score)
    if (!sc || sc < 1 || sc > 5) return { success: false, message: '评分需为 1-5' }

    const ctx = await resolveFamily(openid)
    if (!ctx || !ctx.familyId) return { success: false, message: '用户未注册或未加入家庭' }

    const snap = await db.collection('recipes').doc(recipeId).get()
    const recipe = snap.data
    if (!recipe) return { success: false, message: '菜谱不存在' }
    if (recipe.familyId !== ctx.familyId) return { success: false, message: '无权操作该菜谱' }

    const ratings = recipe.ratings || []
    const idx = ratings.findIndex(function (r) { return r.id === ratingId })
    if (idx < 0) return { success: false, message: '评分不存在' }
    const rating = ratings[idx]

    if (rating.memberOpenid !== openid && ctx.role !== 'admin') {
      return { success: false, message: '只能修改自己的评分' }
    }
    if (rating.date < dateStrUTC8() && !confirmBeforeToday) {
      return { success: false, code: 'NEED_CONFIRM', message: '该评分早于今天，需要确认' }
    }

    ratings[idx] = Object.assign({}, rating, {
      score: sc,
      comment: comment == null ? rating.comment : String(comment),
      updatedAt: new Date()
    })
    const agg = recompute(ratings)

    await db.collection('recipes').doc(recipeId).update({
      data: { ratings: ratings, avgScore: agg.avgScore, memberAvgScores: agg.memberAvgScores, updatedAt: new Date() }
    })

    return { success: true }
  } catch (err) {
    return { success: false, message: '修改失败', error: err.message }
  }
}
