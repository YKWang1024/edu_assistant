// 云函数：设置成员显示名（本人可改自己；管理员可改他人）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const { displayName, targetOpenid } = event
    const u = await db.collection('users').where({ openid: openid }).get()
    if (!u.data || !u.data.length) return { success: false, message: '用户未注册' }
    const me = u.data[0]
    const familyId = me.familyId
    if (!familyId) return { success: false, message: '未加入家庭' }

    const target = targetOpenid || openid
    if (target !== openid && me.familyRole !== 'admin') {
      return { success: false, message: '只有管理员可以修改他人名称' }
    }

    const f = await db.collection('families').doc(familyId).get()
    const members = (f.data && f.data.members) || []
    const idx = members.findIndex(function (m) { return m.openid === target })
    if (idx < 0) return { success: false, message: '成员不存在' }

    members[idx].displayName = String(displayName == null ? '' : displayName).trim()
    await db.collection('families').doc(familyId).update({ data: { members: members } })
    return { success: true }
  } catch (err) {
    return { success: false, message: '修改失败', error: err.message }
  }
}
