// 云函数：删除菜谱（所有者或管理员），同时尝试删除关联图片
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const { recipeId } = event
    if (!recipeId) return { success: false, message: '缺少菜谱 ID' }

    const ctx = await resolveFamily(openid)
    if (!ctx || !ctx.familyId) return { success: false, message: '用户未注册或未加入家庭' }

    const snap = await db.collection('recipes').doc(recipeId).get()
    const recipe = snap.data
    if (!recipe) return { success: true } // 已不存在
    if (recipe.familyId !== ctx.familyId) return { success: false, message: '无权操作该菜谱' }
    if (recipe.userId !== openid && ctx.role !== 'admin') {
      return { success: false, message: '只有创建者或管理员可以删除' }
    }

    if (Array.isArray(recipe.images) && recipe.images.length) {
      try { await cloud.deleteCloudFile({ fileList: recipe.images }) } catch (e) { /* 图片删除失败不影响 */ }
    }

    await db.collection('recipes').doc(recipeId).remove()
    return { success: true }
  } catch (err) {
    return { success: false, message: '删除失败', error: err.message }
  }
}
