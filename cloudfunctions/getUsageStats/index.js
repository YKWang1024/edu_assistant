// 云函数：读取「学习使用」每日统计（REQ-003）
// 返回近 days 天(默认7)的：练习互动次数 taps、练习停留秒数 dwellSec，按日聚合。
// 仅采集与展示，不做「真学习 vs 挂机」判定（按需求方要求，先积累数据）。
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

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const ctx = await resolveFamily(openid)
    const familyId = ctx ? ctx.familyId : null
    const childName = event.childName || '宝贝'
    const days = Math.min(60, Math.max(1, Math.floor(Number(event.days) || 7)))
    const since = dateStrUTC8(-(days - 1))

    const where = familyId
      ? { familyId: familyId, childName: childName }
      : { _openid: openid, childName: childName }
    const r = await db.collection('usageStats')
      .where(where).where({ date: _.gte(since) })
      .orderBy('date', 'desc').limit(200).get()

    // 按日聚合（防同键重复文档）
    const map = {}
    ;(r.data || []).forEach(function (d) {
      const k = d.date
      if (!map[k]) map[k] = { date: k, taps: 0, dwellSec: 0 }
      map[k].taps += Number(d.taps) || 0
      map[k].dwellSec += Number(d.dwellSec) || 0
    })
    const list = Object.keys(map).map(function (k) { return map[k] })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1 })

    const today = dateStrUTC8(0)
    const todayRec = map[today] || { date: today, taps: 0, dwellSec: 0 }

    return { success: true, data: { today: todayRec, list: list } }
  } catch (err) {
    return { success: false, message: '加载失败', error: err.message }
  }
}
