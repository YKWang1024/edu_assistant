// 云函数：把菜友圈里别人公开分享的菜，收藏(复制)成自己家庭的独立菜谱
// 复制 name/食材/步骤/图片(沿用同一 cloud:// fileID,靠 getTempFileURL 跨家庭可见)/分类/标签/营养/参考链接；
// 不继承评分(ratings=[]/avgScore=0)，isPublic=false，记 sourceRecipeId 防重复收藏。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const CATEGORIES = ['荤菜', '素菜', '汤类', '主食', '水果', '其他']

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const sourceRecipeId = event.sourceRecipeId
    if (!sourceRecipeId) return { success: false, message: '缺少菜谱ID' }

    const ctx = await resolveFamily(openid)
    if (!ctx || !ctx.familyId) return { success: false, message: '用户未注册或未加入家庭' }

    let snap
    try { snap = await db.collection('recipes').doc(sourceRecipeId).get() } catch (e) { snap = null }
    const src = snap && snap.data
    if (!src) return { success: false, message: '菜谱不存在或已删除' }
    if (!src.isPublic) return { success: false, message: '该菜谱未公开，无法收藏' }

    // 不能收藏自己家的菜
    if (src.familyId === ctx.familyId) return { success: false, message: '这是你家的菜，无需收藏' }

    // 防重复：本家庭已收藏过同一来源菜
    const dup = await db.collection('recipes').where({ familyId: ctx.familyId, sourceRecipeId: sourceRecipeId }).count()
    if (dup && dup.total > 0) return { success: true, data: { duplicated: true } }

    const now = new Date()
    const doc = {
      _openid: openid,
      userId: openid,
      familyId: ctx.familyId,
      name: src.name || '未命名',
      ingredients: src.ingredients || '',
      steps: src.steps || '',
      category: CATEGORIES.indexOf(src.category) >= 0 ? src.category : '其他',
      tags: src.tags || '',
      nutrition: src.nutrition || '',
      images: Array.isArray(src.images) ? src.images : [], // 沿用原 fileID，不复制文件
      imageUrl: src.imageUrl || '',
      referenceLink: src.referenceLink || '',
      referenceType: src.referenceType || '',
      referenceLabel: src.referenceLabel || '',
      calories: src.calories || null,
      ratings: [],
      avgScore: 0,
      memberAvgScores: {},
      isPublic: false,
      sourceRecipeId: sourceRecipeId,             // 来源标记，用于防重复
      collectedFromOpenid: src.userId || src._openid || '',
      createdAt: now,
      updatedAt: now
    }

    const res = await db.collection('recipes').add({ data: doc })
    return { success: true, data: { _id: res._id, duplicated: false } }
  } catch (err) {
    return { success: false, message: '收藏失败', error: err.message }
  }
}
