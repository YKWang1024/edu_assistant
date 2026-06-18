// 云函数：删除一道错题（同时尝试删除关联的裁剪图）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID

  try {
    const { questionId } = event
    if (!questionId) return { success: false, message: '缺少题目 ID' }

    const snap = await db.collection('examQuestions').doc(questionId).get()
    const q = snap.data
    if (!q) return { success: true } // 已不存在，视为删除成功
    if (q._openid !== openid) return { success: false, message: '无权操作该题目' }

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
