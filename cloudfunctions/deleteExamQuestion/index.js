// 云函数：删除一道错题（家庭成员均可删，同时尝试删除关联的裁剪图）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

function canAccess(q, openid, ctx) {
  if (!q) return false
  if (q._openid === openid) return true
  if (ctx && ctx.familyId && q.familyId === ctx.familyId) return true
  return false
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID

  try {
    const { questionId } = event
    if (!questionId) return { success: false, message: '缺少题目 ID' }

    const ctx = await resolveFamily(openid)
    const snap = await db.collection('examQuestions').doc(questionId).get()
    const q = snap.data
    if (!q) return { success: true } // 已不存在，视为删除成功
    if (!canAccess(q, openid, ctx)) return { success: false, message: '无权操作该题目' }

    if (q.imageFileID) {
      try {
        await cloud.deleteCloudFile({ fileList: [q.imageFileID] })
      } catch (e) { /* 图片删除失败不影响题目删除 */ }
    }

    await db.collection('examQuestions').doc(questionId).remove()
    return { success: true }
  } catch (err) {
    return { success: false, message: '删除失败', error: err.message }
  }
}
