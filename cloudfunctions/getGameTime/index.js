// 云函数：读取游戏时间余额 + 今日/本周获得（家庭维度，按孩子）
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

    const walletWhere = familyId ? { familyId: familyId, childName: childName } : { _openid: openid, childName: childName }
    const gt = await db.collection('gameTime').where(walletWhere).get()
    const balance = (gt.data && gt.data.length) ? (gt.data[0].balance || 0) : 0

    // 今日/本周获得：从 familyCheckins 聚合（UTC+8，周日为周起点，与原 account 口径一致）
    const today = dateStrUTC8(0)
    const now8 = new Date(Date.now() + 8 * 3600 * 1000)
    const weekStart = dateStrUTC8(-now8.getUTCDay())

    const memberCond = familyId ? _.or([{ familyId: familyId }, { _openid: openid }]) : { _openid: openid }
    const checkins = await db.collection('familyCheckins')
      .where(memberCond)
      .where({ childName: childName, date: _.gte(weekStart) })
      .limit(1000).get()

    let todayEarned = 0, todayDeducted = 0, weekEarned = 0
    ;(checkins.data || []).forEach(function (r) {
      const rw = Number(r.reward) || 0
      weekEarned += rw
      if (r.date === today) {
        if (rw > 0) todayEarned += rw
        else if (rw < 0) todayDeducted += Math.abs(rw)
      }
    })

    return { success: true, data: { balance: balance, todayEarned: todayEarned, todayDeducted: todayDeducted, weekEarned: weekEarned } }
  } catch (err) {
    return { success: false, message: '加载失败', error: err.message }
  }
}
