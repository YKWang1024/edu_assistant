// 云函数：上报「学习使用」增量统计（REQ-003）
// 按 (familyId, childName, date) 累计：练习页互动次数 taps、练习页停留秒数 dwellSec。
// 客户端传的是「自上次同步以来的增量」，这里用 _.inc 累加，避免重复计数。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

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
    const date = String(event.date || '').slice(0, 10)
    const taps = Math.max(0, Math.floor(Number(event.taps) || 0))
    const dwellSec = Math.max(0, Math.floor(Number(event.dwellSec) || 0))

    if (!date) return { success: false, message: '缺少日期' }
    if (taps === 0 && dwellSec === 0) return { success: true, data: { noop: true } }

    // 家庭维度共享一条文档；无家庭时退回按 openid。
    const where = familyId
      ? { familyId: familyId, childName: childName, date: date }
      : { _openid: openid, childName: childName, date: date }
    const exist = await db.collection('usageStats').where(where).limit(1).get()

    if (exist.data && exist.data.length) {
      await db.collection('usageStats').doc(exist.data[0]._id).update({
        data: { taps: _.inc(taps), dwellSec: _.inc(dwellSec), updatedAt: new Date() }
      })
    } else {
      await db.collection('usageStats').add({
        data: {
          _openid: openid, familyId: familyId, childName: childName, date: date,
          taps: taps, dwellSec: dwellSec, createdAt: new Date(), updatedAt: new Date()
        }
      })
    }
    return { success: true }
  } catch (err) {
    return { success: false, message: '保存失败', error: err.message }
  }
}
