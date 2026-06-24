// 云函数：删除一条买菜心得(本人或同家庭)
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { familyId: u.data[0].familyId }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const { id } = event
    if (!id) return { success: false, message: '缺少 ID' }
    const ctx = await resolveFamily(openid)
    const snap = await db.collection('wikis').doc(id).get()
    const w = snap.data
    if (!w) return { success: true }
    const sameFamily = ctx && ctx.familyId && w.familyId === ctx.familyId
    if (w._openid !== openid && !sameFamily) return { success: false, message: '无权操作' }
    await db.collection('wikis').doc(id).remove()
    return { success: true }
  } catch (err) {
    return { success: false, message: '删除失败', error: err.message }
  }
}
