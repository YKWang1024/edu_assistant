// 云函数：设置成员显示名（本人可改自己；管理员可改他人）。
// 关联更新：把这位成员在本家庭菜谱里的打分署名(ratings.memberName)同步改名并重算均分，
// 并更新其账户昵称 users.nickname，使「菜友圈」里他分享菜谱的署名也一起变更。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function recompute(ratings) {
  const active = (ratings || []).filter(function (r) { return !r.deleted })
  let total = 0
  active.forEach(function (r) { total += Number(r.score) || 0 })
  const avg = active.length ? Math.round((total / active.length) * 10) / 10 : 0
  const ms = {}
  active.forEach(function (r) {
    const k = r.memberName || '未知'
    if (!ms[k]) ms[k] = { t: 0, c: 0 }
    ms[k].t += Number(r.score) || 0
    ms[k].c += 1
  })
  const memberAvg = {}
  Object.keys(ms).forEach(function (k) { memberAvg[k] = Math.round((ms[k].t / ms[k].c) * 10) / 10 })
  return { avgScore: avg, memberAvgScores: memberAvg }
}

// 把本家庭菜谱里满足 matchFn 的评分署名改为 newName，并重算均分/各成员均分
async function renameInRatings(familyId, matchFn, newName) {
  const res = await db.collection('recipes').where({ familyId: familyId }).get()
  for (const r of (res.data || [])) {
    let changed = false
    const ratings = (r.ratings || []).map(function (rt) {
      if (!rt.deleted && matchFn(rt)) { changed = true; return Object.assign({}, rt, { memberName: newName }) }
      return rt
    })
    if (changed) {
      const agg = recompute(ratings)
      await db.collection('recipes').doc(r._id).update({
        data: { ratings: ratings, avgScore: agg.avgScore, memberAvgScores: agg.memberAvgScores, updatedAt: new Date() }
      })
    }
  }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const newName = String(event.displayName == null ? '' : event.displayName).trim()
    const u = await db.collection('users').where({ openid: openid }).get()
    if (!u.data || !u.data.length) return { success: false, message: '用户未注册' }
    const me = u.data[0]
    const familyId = me.familyId
    if (!familyId) return { success: false, message: '未加入家庭' }

    const target = event.targetOpenid || openid
    if (target !== openid && me.familyRole !== 'admin') {
      return { success: false, message: '只有管理员可以修改他人名称' }
    }
    if (!newName) return { success: false, message: '请填写称呼' }

    const f = await db.collection('families').doc(familyId).get()
    const members = (f.data && f.data.members) || []
    const idx = members.findIndex(function (m) { return m.openid === target })
    if (idx < 0) return { success: false, message: '成员不存在' }

    // 目标用户(取旧名兜底 + 同步昵称)
    const tu = await db.collection('users').where({ openid: target }).get()
    const targetUser = (tu.data && tu.data[0]) || null
    const oldEffective = members[idx].displayName || (targetUser && targetUser.nickname) || '成员'

    members[idx].displayName = newName
    await db.collection('families').doc(familyId).update({ data: { members: members } })

    if (newName !== oldEffective) {
      // 同步账户昵称 → 菜友圈署名跟着变
      if (targetUser) {
        await db.collection('users').doc(targetUser._id).update({ data: { nickname: newName } })
      }
      // 同步菜谱里这位成员本人(旧名)的打分署名
      await renameInRatings(familyId, function (rt) {
        return rt.memberOpenid === target && rt.memberName === oldEffective
      }, newName)
    }

    return { success: true }
  } catch (err) {
    return { success: false, message: '修改失败', error: err.message }
  }
}
