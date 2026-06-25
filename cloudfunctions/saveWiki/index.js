// 云函数：保存/更新「买菜心得」wiki 条目（家庭维度）。id 存在则更新，可切换是否分享到菜友圈。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const ctx = await resolveFamily(openid)
    if (!ctx || !ctx.familyId) return { success: false, message: '未加入家庭' }

    const { id, title, content } = event
    const isPublic = !!event.isPublic
    if (!content || !String(content).trim()) return { success: false, message: '内容不能为空' }

    const now = new Date()
    if (id) {
      const snap = await db.collection('wikis').doc(id).get()
      const w = snap.data
      if (!w) return { success: false, message: '心得不存在' }
      if (w._openid !== openid && w.familyId !== ctx.familyId) return { success: false, message: '无权编辑' }
      const patch = {
        title: title == null ? w.title : String(title).trim(),
        content: String(content).trim(),
        isPublic: isPublic,
        updatedAt: now
      }
      if (isPublic && !w.sharedAt) patch.sharedAt = now
      await db.collection('wikis').doc(id).update({ data: patch })
      return { success: true, data: { _id: id } }
    }

    const doc = {
      _openid: openid,
      userId: openid,
      familyId: ctx.familyId,
      authorName: (ctx.user && ctx.user.nickname) || '家长',
      title: String(title || '买菜心得').trim(),
      content: String(content).trim(),
      isPublic: isPublic,
      sharedAt: isPublic ? now : null,
      createdAt: now,
      updatedAt: now
    }
    const res = await db.collection('wikis').add({ data: doc })
    return { success: true, data: { _id: res._id } }
  } catch (err) {
    return { success: false, message: '保存失败', error: err.message }
  }
}
