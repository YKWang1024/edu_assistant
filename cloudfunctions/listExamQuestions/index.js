// 云函数：拉取错题列表（家庭维度：本家庭 + 本人旧数据兼容）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function pad(n) { return (n < 10 ? '0' : '') + n }
function dateStrUTC8(offsetDays) {
  const d = new Date(Date.now() + 8 * 3600 * 1000 + (offsetDays || 0) * 86400000)
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
}

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

const STATUS_ORDER = { hard: 0, 'new': 1, reviewing: 2, mastered: 3 }

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID

  try {
    const { subject, dueOnly, childName } = event
    const today = dateStrUTC8(0)
    const ctx = await resolveFamily(openid)

    // 同家庭 或 本人旧数据(无 familyId)
    let cond
    if (ctx && ctx.familyId) cond = _.or([{ familyId: ctx.familyId }, { _openid: openid }])
    else cond = { _openid: openid }

    let query = db.collection('examQuestions').where(cond)
    if (subject && subject !== '全部') query = query.where({ subject: subject })
    if (childName) query = query.where({ childName: childName })
    if (dueOnly) query = query.where({ status: _.neq('mastered'), nextReviewDate: _.lte(today) })

    const res = await query.limit(1000).get()
    const list = res.data || []

    list.forEach(function (q) {
      q.due = q.status !== 'mastered' && !!q.nextReviewDate && q.nextReviewDate <= today
    })

    list.sort(function (a, b) {
      const so = (STATUS_ORDER[a.status] == null ? 9 : STATUS_ORDER[a.status]) -
        (STATUS_ORDER[b.status] == null ? 9 : STATUS_ORDER[b.status])
      if (so !== 0) return so
      const ad = a.nextReviewDate || '9999-99-99'
      const bd = b.nextReviewDate || '9999-99-99'
      if (ad < bd) return -1
      if (ad > bd) return 1
      return 0
    })

    return { success: true, data: list, today: today }
  } catch (err) {
    return { success: false, message: '加载失败', error: err.message }
  }
}
