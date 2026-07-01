// 云函数：用积分兑换奖励（REQ-025）。
// 安全要点：所需积分从 rewardCatalog 服务端读取，绝不信任客户端传入的 cost——
// 与「打卡奖励」不同(那是家庭内部记账、沿用既有 client-trust 模型)，
// 兑换是「花钱」，必须由服务端权威计价，否则孩子端可伪造更低花费。
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
    if (!event.itemId) return { success: false, message: '缺少兑换项ID' }
    const ctx = await resolveFamily(openid)
    if (!ctx || !ctx.familyId) return { success: false, message: '用户未注册或未加入家庭' }
    const childName = event.childName || '宝贝'
    // 幂等键(可选，客户端传)：同一次兑换意图的重复请求(如超时后重试)不会被重复扣分。
    const requestId = event.clientRequestId ? String(event.clientRequestId).slice(0, 64) : ''

    const itemSnap = await db.collection('rewardCatalog').doc(event.itemId).get()
    const item = itemSnap && itemSnap.data
    if (!item || item.familyId !== ctx.familyId || item.isDeleted) return { success: false, message: '该奖励不存在或已下架' }
    const cost = Number(item.pointsCost) || 0
    if (cost <= 0) return { success: false, message: '奖励配置有误' }

    // 幂等检查：若这个 requestId 之前已经兑换成功过，直接返回原结果，不再扣分
    if (requestId) {
      const dup = await db.collection('redemptions').where({ familyId: ctx.familyId, childName: childName, clientRequestId: requestId }).limit(1).get()
      if (dup.data && dup.data.length) {
        const w2 = await db.collection('rewardWallet').where({ familyId: ctx.familyId, childName: childName, type: 'points' }).get()
        const bal2 = (w2.data && w2.data.length) ? (w2.data[0].balance || 0) : 0
        return { success: true, data: { balance: bal2, redemptionId: dup.data[0]._id, duplicated: true } }
      }
    }

    const walletWhere = { familyId: ctx.familyId, childName: childName, type: 'points' }
    const w = await db.collection('rewardWallet').where(walletWhere).get()
    const balance = (w.data && w.data.length) ? (w.data[0].balance || 0) : 0
    if (balance < cost) return { success: false, message: '积分不足，还差 ' + (cost - balance) + ' 分', code: 'INSUFFICIENT' }

    const newBalance = balance - cost
    // 乐观锁：where 里带上刚读到的旧余额一起做条件更新，命中数为0说明被并发改过，报错让客户端重试(而不是无条件覆盖)
    const upd = await db.collection('rewardWallet').where({ _id: w.data[0]._id, balance: balance }).update({ data: { balance: newBalance, updatedAt: new Date() } })
    if (!upd || !upd.stats || upd.stats.updated !== 1) {
      return { success: false, message: '兑换失败，请重试(余额可能刚被更新)' }
    }

    // 扣款已提交；若写兑换记录失败，做补偿性回滚(把余额加回去)，避免「扣了积分但没记录」的不一致。
    try {
      const redeemRes = await db.collection('redemptions').add({
        data: {
          _openid: openid, familyId: ctx.familyId, childName: childName,
          catalogItemId: event.itemId, itemName: item.name, itemIcon: item.icon || '🎁',
          pointsCost: cost, clientRequestId: requestId, createdAt: new Date()
        }
      })
      return { success: true, data: { balance: newBalance, redemptionId: redeemRes._id } }
    } catch (writeErr) {
      try {
        await db.collection('rewardWallet').where({ _id: w.data[0]._id }).update({ data: { balance: db.command.inc(cost), updatedAt: new Date() } })
      } catch (rollbackErr) { /* 回滚也失败：只能等对账；不吞掉原始错误 */ }
      return { success: false, message: '兑换失败，请重试', error: writeErr.message }
    }
  } catch (err) {
    return { success: false, message: '兑换失败', error: err.message }
  }
}
