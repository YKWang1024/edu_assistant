// 云函数：删除系统默认菜谱（REQ-022）。仅超级用户可调。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const SUPER_OPENID = 'oSnsZ7e4ja7cq2Eq5_u3hQKx3HMo'

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    if (openid !== SUPER_OPENID) return { success: false, message: '无权限', code: 'NOT_SUPER' }
    if (!event.recipeId) return { success: false, message: '缺少菜谱ID' }
    await db.collection('systemRecipes').doc(event.recipeId).remove()
    return { success: true }
  } catch (err) {
    return { success: false, message: '删除失败', error: err.message }
  }
}
