// 云函数：读取「金钱/积分」奖励钱包余额（REQ-024）。游戏时间沿用既有 gameTime 集合/getGameTime，不在此处理。
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
    const ctx = await resolveFamily(openid)
    const familyId = ctx ? ctx.familyId : null
    const childName = event.childName || '宝贝'

    const where = familyId
      ? { familyId: familyId, childName: childName, type: type }
      : { _openid: openid, childName: childName, type: type }
    const w = await db.collection('rewardWallet').where(where).get()
    const balance = (w.data && w.data.length) ? (w.data[0].balance || 0) : 0

    return { success: true, data: { balance: balance, type: type } }
  } catch (err) {
    return { success: false, message: '加载失败', error: err.message }
  }
}
