// 云函数：提交一次重做作答 —— 间隔复习 + 难题升级 的权威状态机（家庭成员均可作答）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function pad(n) { return (n < 10 ? '0' : '') + n }
function dateStrUTC8(offsetDays) {
  const d = new Date(Date.now() + 8 * 3600 * 1000 + (offsetDays || 0) * 86400000)
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
}

function normalize(s) {
  return String(s == null ? '' : s).trim().toLowerCase()
}

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
    const { questionId, answer } = event
    if (!questionId) return { success: false, message: '缺少题目 ID' }

    const ctx = await resolveFamily(openid)
    const snap = await db.collection('examQuestions').doc(questionId).get()
    const q = snap.data
    if (!q) return { success: false, message: '题目不存在' }
    if (!canAccess(q, openid, ctx)) return { success: false, message: '无权操作该题目' }

    // 判定对错：优先用客户端自评(无标准答案的题)，否则按标准答案匹配
    let correct
    if (typeof event.correct === 'boolean') {
      correct = event.correct
    } else {
      const ca = normalize(q.correctAnswer)
      correct = ca !== '' && normalize(answer) === ca
    }

    const today = dateStrUTC8(0)

    let status = q.status || 'new'
    let consecutiveWrong = q.consecutiveWrong || 0
    let firstCorrectDate = q.firstCorrectDate || null
    let nextReviewDate = q.nextReviewDate || today
    let becameHard = false

    if (correct) {
      consecutiveWrong = 0
      if (status === 'reviewing') {
        status = 'mastered'
        nextReviewDate = null
      } else {
        status = 'reviewing'
        firstCorrectDate = today
        nextReviewDate = dateStrUTC8(20)
      }
    } else {
      consecutiveWrong = consecutiveWrong + 1
      firstCorrectDate = null
      if (consecutiveWrong >= 3) {
        becameHard = (status !== 'hard') // 仅在「首次升级为疑难题」时触发 AI 课程，避免重复弹窗
        status = 'hard'
        nextReviewDate = today
      } else {
        status = 'new'
        nextReviewDate = today
      }
    }

    const attempt = {
      date: today,
      answer: String(answer == null ? '' : answer),
      correct: correct,
      by: openid
    }

    await db.collection('examQuestions').doc(questionId).update({
      data: {
        status: status,
        consecutiveWrong: consecutiveWrong,
        firstCorrectDate: firstCorrectDate,
        nextReviewDate: nextReviewDate,
        attempts: db.command.push([attempt]),
        updatedAt: new Date()
      }
    })

    return {
      success: true,
      correct: correct,
      status: status,
      consecutiveWrong: consecutiveWrong,
      becameHard: becameHard,
      nextReviewDate: nextReviewDate
    }
  } catch (err) {
    return { success: false, message: '提交失败', error: err.message }
  }
}
