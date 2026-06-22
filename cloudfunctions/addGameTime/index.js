// 云函数：增加/减少游戏时间余额（delta 可负；打卡奖励入账走这里）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const delta = Number(event.delta) || 0
    const ctx = await resolveFamily(openid)
    const familyId = ctx ? ctx.familyId : null
    const childName = event.childName || '宝贝'

    const where = familyId ? { familyId: familyId, childName: childName } : { _openid: openid, childName: childName }
    const gt = await db.collection('gameTime').where(where).get()

    let balance
    if (gt.data && gt.data.length) {
      balance = (gt.data[0].balance || 0) + delta
      if (balance < 0) balance = 0
      await db.collection('gameTime').doc(gt.data[0]._id).update({ data: { balance: balance, updatedAt: new Date() } })
    } else {
      balance = delta < 0 ? 0 : delta
      await db.collection('gameTime').add({
        data: { _openid: openid, familyId: familyId, childName: childName, balance: balance, createdAt: new Date(), updatedAt: new Date() }
      })
    }

    return { success: true, data: { balance: balance } }
  } catch (err) {
    return { success: false, message: '更新失败', error: err.message }
  }
}
