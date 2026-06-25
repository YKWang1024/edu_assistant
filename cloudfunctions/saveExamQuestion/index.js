// 云函数：保存一道拍照识别出来的错题（家庭维度）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const SUBJECTS = ['语文', '数学', '英语', '科学', '其他']

function pad(n) { return (n < 10 ? '0' : '') + n }
function dateStrUTC8(offsetDays) {
  const d = new Date(Date.now() + 8 * 3600 * 1000 + (offsetDays || 0) * 86400000)
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
}

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID

  try {
    const ctx = await resolveFamily(openid)
    const { subject, type, stem, options, correctAnswer, analysis, imageFileID, figure } = event

    if (!stem || !String(stem).trim()) {
      return { success: false, message: '题干不能为空' }
    }

    const today = dateStrUTC8(0)
    const now = new Date()

    const doc = {
      _openid: openid,
      familyId: ctx ? ctx.familyId : null,
      childName: event.childName || '宝贝',
      subject: SUBJECTS.indexOf(subject) >= 0 ? subject : '其他',
      type: (type === 'choice' || type === 'fill' || type === 'other') ? type : 'other',
      stem: String(stem).trim(),
      options: Array.isArray(options) ? options : [],
      correctAnswer: correctAnswer == null ? '' : String(correctAnswer),
      analysis: analysis ? String(analysis) : '',
      imageFileID: imageFileID || '',
      figure: (figure && typeof figure === 'object') ? figure : null,
      status: 'new',
      consecutiveWrong: 0,
      firstCorrectDate: null,
      nextReviewDate: today,
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
