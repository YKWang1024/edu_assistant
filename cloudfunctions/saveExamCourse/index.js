// 云函数：保存某道题 AI 生成的讲解课程（缓存，下次直接展示）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID

  try {
    const { questionId, content } = event
    if (!questionId || !content) return { success: false, message: '参数不完整' }

    const snap = await db.collection('examQuestions').doc(questionId).get()
    const q = snap.data
    if (!q) return { success: false, message: '题目不存在' }
    if (q._openid !== openid) return { success: false, message: '无权操作该题目' }

    await db.collection('examQuestions').doc(questionId).update({
      data: {
        aiCourse: { content: String(content), createdAt: new Date() },
        updatedAt: new Date()
      }
    })

    return { success: true }
  } catch (err) {
    return { success: false, message: '保存课程失败', error: err.message }
  }
}
