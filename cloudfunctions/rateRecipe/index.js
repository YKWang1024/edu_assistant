// 云函数：给菜谱评分（追加一条评分，保留历史）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function pad(n) { return (n < 10 ? '0' : '') + n }
function dateStrUTC8() {
  const d = new Date(Date.now() + 8 * 3600 * 1000)
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
}
function timeStrUTC8() {
  const d = new Date(Date.now() + 8 * 3600 * 1000)
  return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes())
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
    const { recipeId, score, comment, memberName } = event
    if (!recipeId) return { success: false, message: '缺少菜谱 ID' }
    const sc = Number(score)
    if (!sc || sc < 1 || sc > 5) return { success: false, message: '评分需为 1-5' }

    const ctx = await resolveFamily(openid)
    if (!ctx || !ctx.familyId) return { success: false, message: '用户未注册或未加入家庭' }

    const snap = await db.collection('recipes').doc(recipeId).get()
    const recipe = snap.data
    if (!recipe) return { success: false, message: '菜谱不存在' }
    if (recipe.familyId !== ctx.familyId) return { success: false, message: '无权评分该菜谱' }

    const rating = {
      id: 'r_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
      score: sc,
      comment: comment ? String(comment) : '',
      memberOpenid: openid,
      memberName: memberName ? String(memberName) : '成员',
      date: dateStrUTC8(),
      time: timeStrUTC8(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: false
    }

    const ratings = (recipe.ratings || []).concat([rating])
    const agg = recompute(ratings)

    await db.collection('recipes').doc(recipeId).update({
      data: { ratings: ratings, avgScore: agg.avgScore, memberAvgScores: agg.memberAvgScores, updatedAt: new Date() }
    })

    return { success: true, data: { avgScore: agg.avgScore } }
  } catch (err) {
    return { success: false, message: '评分失败', error: err.message }
  }
}
