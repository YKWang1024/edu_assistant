// 云函数：保存自动小测错题(去重+count，家庭维度)
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function pad(n) { return (n < 10 ? '0' : '') + n }
function dateStrUTC8() {
  const d = new Date(Date.now() + 8 * 3600 * 1000)
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
}

function deriveSubject(operator) {
  operator = operator || ''
  if (operator.indexOf('english') === 0) return 'english'
  if (operator.indexOf('pinyin') >= 0 || operator === 'char2pinyin' || operator === 'pinyin2char' || operator === 'pinyin2write' || operator === 'hanzi2pinyin') return 'pinyin'
  return 'math'
}

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { familyId: u.data[0].familyId }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const ctx = await resolveFamily(openid)
    const familyId = ctx ? ctx.familyId : null
    const childName = event.childName || '宝贝'
    const { a, b, operator, answer, userAnswer } = event
    const subject = event.subject || deriveSubject(operator)
    const today = dateStrUTC8()

    const qkey = [subject, a, b, operator, answer].map(function (x) { return x == null ? '' : String(x) }).join('|')
    const where = familyId
      ? { familyId: familyId, childName: childName, qkey: qkey }
      : { _openid: openid, childName: childName, qkey: qkey }

    const ex = await db.collection('quizWrong').where(where).get()
    if (ex.data && ex.data.length) {
      await db.collection('quizWrong').doc(ex.data[0]._id).update({
        data: { count: _.inc(1), lastDate: today, userAnswer: userAnswer == null ? '' : String(userAnswer), updatedAt: new Date() }
      })
      return { success: true, data: { _id: ex.data[0]._id, updated: true } }
    }

    const res = await db.collection('quizWrong').add({
      data: {
        _openid: openid, familyId: familyId, childName: childName, subject: subject,
        a: a == null ? '' : a, b: b == null ? '' : b, operator: operator || '',
        answer: answer == null ? '' : answer, userAnswer: userAnswer == null ? '' : userAnswer,
        qkey: qkey, count: 1, date: today, lastDate: today, createdAt: new Date(), updatedAt: new Date()
      }
    })
    return { success: true, data: { _id: res._id } }
  } catch (err) {
    return { success: false, message: '保存失败', error: err.message }
  }
}
