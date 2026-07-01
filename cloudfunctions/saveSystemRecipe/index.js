// 云函数：新建/修改系统默认菜谱（REQ-022）。仅超级用户(指定 openid)可调。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const SUPER_OPENID = 'oSnsZ7e4ja7cq2Eq5_u3hQKx3HMo' // 超级用户(系统菜谱管理员)
const CATEGORIES = ['荤菜', '素菜', '汤类', '主食', '水果', '其他']
const MEAL_TIMES = ['早餐', '中餐', '晚餐']
function normMeals(v) {
  if (!Array.isArray(v)) return []
  const out = []
  v.forEach(function (m) { if (MEAL_TIMES.indexOf(m) >= 0 && out.indexOf(m) < 0) out.push(m) })
  return out
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    if (openid !== SUPER_OPENID) return { success: false, message: '无权限', code: 'NOT_SUPER' }

    const name = String(event.name || '').trim()
    if (!name) return { success: false, message: '菜名不能为空' }

    const fields = {
      name: name,
      ingredients: event.ingredients ? String(event.ingredients) : '',
      steps: event.steps ? String(event.steps) : '',
      category: CATEGORIES.indexOf(event.category) >= 0 ? event.category : '其他',
      mealTimes: normMeals(event.mealTimes),
      tags: event.tags ? String(event.tags) : '',
      nutrition: event.nutrition ? String(event.nutrition) : '',
      referenceLink: event.referenceLink || '',
      referenceType: event.referenceType || '',
      referenceLabel: event.referenceLabel || '',
      calories: event.calories || null,
      updatedAt: new Date()
    }
    // 仅在传了 images 时才覆盖，编辑时不传则保留原图(避免被清空)
    if (Array.isArray(event.images)) fields.images = event.images

    if (event.recipeId) {
      await db.collection('systemRecipes').doc(event.recipeId).update({ data: fields })
      return { success: true, data: { _id: event.recipeId } }
    }
    const res = await db.collection('systemRecipes').add({
      data: Object.assign({ _openid: openid, createdAt: new Date(), images: Array.isArray(event.images) ? event.images : [] }, fields)
    })
    return { success: true, data: { _id: res._id } }
  } catch (err) {
    return { success: false, message: '保存失败', error: err.message }
  }
}
