// 云函数：家庭管理（管理员操作）。一个函数多动作，减少部署数量。
//   action='addChild'      { name, grade }           新增无账号小孩成员
//   action='updateChild'   { childId, name, grade }  编辑小孩
//   action='removeChild'   { childId }               软删除小孩(isDeleted=true，不真正删数据)
//   action='setMemberRole' { targetOpenid, role }    设置成员角色 admin|member|observer
//   action='setFamilyName' { name }                  家庭改名
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const ROLES = ['admin', 'member', 'observer']

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

function newChildId() {
  return 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000000)
}

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

// 把本家庭菜谱里满足 matchFn 的评分署名改为 newName，并重算均分
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
    const ctx = await resolveFamily(openid)
    if (!ctx || !ctx.familyId) return { success: false, message: '未加入家庭' }
    if (ctx.role !== 'admin') return { success: false, message: '只有管理员可以操作' }

    const famSnap = await db.collection('families').doc(ctx.familyId).get()
    const family = famSnap.data || {}
    const children = Array.isArray(family.children) ? family.children.slice() : []
    const members = Array.isArray(family.members) ? family.members.slice() : []
    const action = event.action

    if (action === 'addChild') {
      const name = String(event.name || '').trim()
      if (!name) return { success: false, message: '请填写小孩称呼' }
      const childId = newChildId()
      children.push({ childId: childId, name: name, grade: String(event.grade || '').trim(), isDeleted: false, createdAt: new Date() })
      await db.collection('families').doc(ctx.familyId).update({ data: { children: children } })
      return { success: true, data: { childId: childId } }
    }

    if (action === 'updateChild') {
      const idx = children.findIndex(c => c.childId === event.childId)
      if (idx < 0) return { success: false, message: '小孩不存在' }
      const oldName = children[idx].name
      let newName = oldName
      if (event.name != null) newName = String(event.name).trim() || oldName
      children[idx].name = newName
      if (event.grade != null) children[idx].grade = String(event.grade).trim()
      await db.collection('families').doc(ctx.familyId).update({ data: { children: children } })
      // 关联：小孩改名 → 同步菜谱里以该小孩署名的打分(小孩无账号, 按旧名匹配)
      if (newName !== oldName) {
        await renameInRatings(ctx.familyId, function (rt) { return rt.memberName === oldName }, newName)
      }
      return { success: true }
    }

    if (action === 'removeChild') {
      const idx = children.findIndex(c => c.childId === event.childId)
      if (idx < 0) return { success: true }
      children[idx].isDeleted = true // 软删除：不真正移除数据
      children[idx].deletedAt = new Date()
      await db.collection('families').doc(ctx.familyId).update({ data: { children: children } })
      return { success: true }
    }

    if (action === 'setMemberRole') {
      const target = event.targetOpenid
      const role = ROLES.indexOf(event.role) >= 0 ? event.role : 'member'
      if (!target) return { success: false, message: '缺少成员' }
      if (target === openid) return { success: false, message: '不能修改自己的角色' }
      const idx = members.findIndex(m => m.openid === target)
      if (idx < 0) return { success: false, message: '成员不存在' }
      members[idx].role = role
      await db.collection('families').doc(ctx.familyId).update({ data: { members: members } })
      // 仅当对方「当前家庭」正是本家庭时，才同步缓存角色 users.familyRole；
      // 多家庭下若直接覆盖，会污染对方在其它当前家庭里的角色(越权/降权)。
      const us = await db.collection('users').where({ openid: target }).get()
      if (us.data && us.data.length && us.data[0].familyId === ctx.familyId) {
        await db.collection('users').doc(us.data[0]._id).update({ data: { familyRole: role } })
      }
      return { success: true }
    }

    if (action === 'setFamilyName') {
      const name = String(event.name || '').trim()
      if (!name) return { success: false, message: '请填写家庭名称' }
      await db.collection('families').doc(ctx.familyId).update({ data: { name: name } })
      return { success: true }
    }

    return { success: false, message: '未知操作' }
  } catch (err) {
    return { success: false, message: '操作失败', error: err.message }
  }
}
