// 云函数：增减「金钱/积分」奖励钱包余额（delta 可负；REQ-024）。
// 与既有 addGameTime 完全同构：客户端算出奖励数值后调用入账(与游戏时间信任模型一致，非新增风险)。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const TYPES = ['money', 'points']

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const type = TYPES.indexOf(event.type) >= 0 ? event.type : 'points'
    const delta = Number(event.delta) || 0
    const ctx = await resolveFamily(openid)
    const familyId = ctx ? ctx.familyId : null
    const childName = event.childName || '宝贝'

    const where = familyId ? { familyId: familyId, childName: childName, type: type } : { _openid: openid, childName: childName, type: type }
    const w = await db.collection('rewardWallet').where(where).get()

    let balance
    if (w.data && w.data.length) {
      balance = (w.data[0].balance || 0) + delta
      if (balance < 0) balance = 0
      await db.collection('rewardWallet').doc(w.data[0]._id).update({ data: { balance: balance, updatedAt: new Date() } })
    } else {
      balance = delta < 0 ? 0 : delta
      await db.collection('rewardWallet').add({
        data: { _openid: openid, familyId: familyId, childName: childName, type: type, balance: balance, createdAt: new Date(), updatedAt: new Date() }
      })
    }

    return { success: true, data: { balance: balance, type: type } }
  } catch (err) {
    return { success: false, message: '更新失败', error: err.message }
  }
}
