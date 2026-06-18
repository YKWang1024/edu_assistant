// 云函数：保存一道拍照识别出来的错题
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const SUBJECTS = ['语文', '数学', '英语', '科学', '其他']

function pad(n) { return (n < 10 ? '0' : '') + n }
// 以中国时区(UTC+8)计算日期串，规避云端 UTC 差一天的问题
function dateStrUTC8(offsetDays) {
  const d = new Date(Date.now() + 8 * 3600 * 1000 + (offsetDays || 0) * 86400000)
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID

  try {
    const { subject, type, stem, options, correctAnswer, analysis, imageFileID } = event

    if (!stem || !String(stem).trim()) {
      return { success: false, message: '题干不能为空' }
    }

    const today = dateStrUTC8(0)
    const now = new Date()

    const doc = {
      _openid: openid,
      subject: SUBJECTS.indexOf(subject) >= 0 ? subject : '其他',
      type: (type === 'choice' || type === 'fill' || type === 'other') ? type : 'other',
      stem: String(stem).trim(),
      options: Array.isArray(options) ? options : [],
      correctAnswer: correctAnswer == null ? '' : String(correctAnswer),
      analysis: analysis ? String(analysis) : '',
      imageFileID: imageFileID || '',
      status: 'new',          // new | reviewing | mastered | hard
      consecutiveWrong: 0,    // 仅统计「重做」连错次数
      firstCorrectDate: null,
      nextReviewDate: today,  // 入库即到期，下次作为错题出现
      attempts: [],
      aiCourse: null,
      createdAt: now,
      updatedAt: now
    }

    const res = await db.collection('examQuestions').add({ data: doc })
    return { success: true, data: { _id: res._id } }
  } catch (err) {
    return { success: false, message: '保存失败', error: err.message }
  }
}
