// 云函数：列出「买菜心得」。scope='public' → 菜友圈公开心得(跨家庭，带作者)；否则本家庭。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function pad(n) { return (n < 10 ? '0' : '') + n }
function toDateStr(d) {
  if (!d) return ''
  const t = new Date(d).getTime()
  if (isNaN(t)) return ''
  const x = new Date(t + 8 * 3600 * 1000)
  return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate())
}

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { familyId: u.data[0].familyId }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    if (event.scope === 'public') {
      const res = await db.collection('wikis').where({ isPublic: true })
        .orderBy('sharedAt', 'desc').limit(50).get()
      const list = res.data || []
      // 补作者头像/昵称
      const openids = [...new Set(list.map(w => w.userId).filter(Boolean))]
      const userMap = {}
      if (openids.length) {
        const us = await db.collection('users').where({ openid: _.in(openids) })
          .field({ openid: true, nickname: true, avatarUrl: true }).get()
        ;(us.data || []).forEach(u => { userMap[u.openid] = u })
      }
      const out = list.map(w => ({
        _id: w._id, title: w.title, content: w.content,
        authorName: (userMap[w.userId] && userMap[w.userId].nickname) || w.authorName || '匿名',
        avatarUrl: (userMap[w.userId] && userMap[w.userId].avatarUrl) || '',
        sharedDate: toDateStr(w.sharedAt || w.createdAt)
      }))
      return { success: true, data: out }
    }

    const ctx = await resolveFamily(openid)
    const familyId = ctx ? ctx.familyId : null
    const cond = familyId ? _.or([{ familyId: familyId }, { _openid: openid }]) : { _openid: openid }
    const res = await db.collection('wikis').where(cond).orderBy('updatedAt', 'desc').limit(200).get()
    const out = (res.data || []).map(w => ({
      _id: w._id, title: w.title, content: w.content, isPublic: !!w.isPublic,
      isMine: w._openid === openid, authorName: w.authorName || '',
      updatedDate: toDateStr(w.updatedAt || w.createdAt)
    }))
    return { success: true, data: out }
  } catch (err) {
    return { success: false, message: '加载失败', error: err.message }
  }
}
