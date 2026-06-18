// 云函数：按用户拉取错题列表（可按科目筛选 / 只看到期）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function pad(n) { return (n < 10 ? '0' : '') + n }
function dateStrUTC8(offsetDays) {
  const d = new Date(Date.now() + 8 * 3600 * 1000 + (offsetDays || 0) * 86400000)
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
}

// 排序优先级：重点疑难 > 待重做 > 复习中 > 已掌握
const STATUS_ORDER = { hard: 0, 'new': 1, reviewing: 2, mastered: 3 }

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID

  try {
    const { subject, dueOnly } = event
    const today = dateStrUTC8(0)

    const where = { _openid: openid }
    if (subject && subject !== '全部') where.subject = subject
    if (dueOnly) {
      where.status = _.neq('mastered')
      where.nextReviewDate = _.lte(today)
    }

    const res = await db.collection('examQuestions').where(where).limit(1000).get()
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
