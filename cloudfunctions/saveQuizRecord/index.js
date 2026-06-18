// 云函数：保存一局自动小测记录(家庭维度)
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
    const ctx = await resolveFamily(openid)
    const { subject, total, correct, timeUsed, level, date, time } = event

    await db.collection('quizRecords').add({
      data: {
        _openid: openid,
        familyId: ctx ? ctx.familyId : null,
        childName: event.childName || '宝贝',
        subject: subject || '',
        total: Number(total) || 0,
        correct: Number(correct) || 0,
        timeUsed: Number(timeUsed) || 0,
        level: level || '',
        date: date || '',
        time: time || '',
        createdAt: new Date()
      }
    })
    return { success: true }
  } catch (err) {
    return { success: false, message: '保存失败', error: err.message }
  }
}
