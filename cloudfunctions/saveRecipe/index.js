// 云函数：保存一条菜谱（家庭维度）
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
    const ctx = await resolveFamily(openid)
    if (!ctx || !ctx.familyId) return { success: false, message: '用户未注册或未加入家庭' }

    const { name, ingredients, steps, category, tags, nutrition, images, referenceLink, referenceType, referenceLabel, calories } = event
    if (!name || !String(name).trim()) return { success: false, message: '菜名不能为空' }

    const now = new Date()
    const doc = {
      _openid: openid,
      userId: openid, // 与现有 getFamilyRecipes/getFriendRecipes/shareRecipe 兼容
      familyId: ctx.familyId,
      name: String(name).trim(),
      ingredients: ingredients ? String(ingredients) : '',
      steps: steps ? String(steps) : '',
      category: CATEGORIES.indexOf(category) >= 0 ? category : '其他',
      tags: tags ? String(tags) : '',
      nutrition: nutrition ? String(nutrition) : '',
      images: Array.isArray(images) ? images : [],
      referenceLink: referenceLink || '',
      referenceType: referenceType || '',
      referenceLabel: referenceLabel || '',
      calories: calories || null,
      ratings: [],
      avgScore: 0,
      memberAvgScores: {},
      isPublic: false,
      createdAt: now,
      updatedAt: now
    }

    const res = await db.collection('recipes').add({ data: doc })
    return { success: true, data: { _id: res._id } }
  } catch (err) {
    return { success: false, message: '保存失败', error: err.message }
  }
}
