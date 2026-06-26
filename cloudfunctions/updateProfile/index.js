// 云函数：更新用户账户资料(昵称 / 头像)。头像传云存储 fileID(可直接作 image src)。
// 注意：这里只改账户级 nickname/avatarUrl；家庭内「称呼」(displayName)由 setMemberName 单独维护，互不覆盖。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const u = await db.collection('users').where({ openid: openid }).get()
    if (!u.data || !u.data.length) return { success: false, message: '用户未注册' }
    const me = u.data[0]

    const patch = { updatedAt: new Date() }
    if (event.nickname != null && String(event.nickname).trim()) patch.nickname = String(event.nickname).trim()
    if (event.avatarUrl != null && String(event.avatarUrl).trim()) patch.avatarUrl = String(event.avatarUrl).trim()
    if (patch.nickname === undefined && patch.avatarUrl === undefined) {
      return { success: false, message: '没有可更新的内容' }
    }

    await db.collection('users').doc(me._id).update({ data: patch })
    const merged = Object.assign({}, me, patch)
    return { success: true, data: { userInfo: merged } }
  } catch (err) {
    return { success: false, message: '更新失败', error: err.message }
  }
}
