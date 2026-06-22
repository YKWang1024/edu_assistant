// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 新家庭预置的示例家常菜（通用模板，非真实博主内容）
const SEED_RECIPES = [
  { name: '番茄炒蛋', category: '荤菜', ingredients: '番茄、鸡蛋、葱、盐、糖', steps: '1. 鸡蛋打散炒熟盛出\n2. 番茄切块炒出汁\n3. 倒入鸡蛋翻炒，加盐和少许糖调味', tags: '下饭、家常、快手', nutrition: '蛋白质丰富，开胃下饭' },
  { name: '青椒土豆丝', category: '素菜', ingredients: '土豆、青椒、蒜、醋、盐', steps: '1. 土豆青椒切丝，土豆丝泡水去淀粉\n2. 热油爆香蒜末\n3. 下土豆丝青椒丝大火快炒，加醋和盐', tags: '家常、清爽', nutrition: '碳水为主，口感爽脆' },
  { name: '紫菜蛋花汤', category: '汤类', ingredients: '紫菜、鸡蛋、虾皮、香油、盐', steps: '1. 水烧开放入紫菜、虾皮\n2. 缓缓淋入蛋液形成蛋花\n3. 加盐，滴香油出锅', tags: '清淡、快手', nutrition: '低热量，补碘补钙' },
  { name: '清蒸鲈鱼', category: '荤菜', ingredients: '鲈鱼、姜、葱、蒸鱼豉油', steps: '1. 鱼身划刀，铺姜葱\n2. 水开后上锅蒸约8分钟\n3. 倒掉汤汁，淋蒸鱼豉油，浇热油', tags: '营养、宴客', nutrition: '高蛋白低脂肪' },
  { name: '白米饭', category: '主食', ingredients: '大米、清水', steps: '1. 大米淘洗干净\n2. 加水没过米面约一指节\n3. 电饭煲煮熟后再焖10分钟', tags: '主食', nutrition: '主要碳水来源' }
]

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    const db = cloud.database()
    const openid = wxContext.OPENID
    const { nickname, avatarUrl } = event

    // 检查用户是否已注册
    const existUser = await db.collection('users').where({
      openid: openid
    }).get()

    if (existUser.data && existUser.data.length > 0) {
      return {
        success: false,
        message: '用户已注册'
      }
    }

    // 创建家庭
    const familyResult = await db.collection('families').add({
      data: {
        createdAt: new Date(),
        seeded: true,
        members: [{
          openid: openid,
          role: 'admin',
          joinedAt: new Date(),
          displayName: nickname || '用户'
        }]
      }
    })

    // 创建用户
    const userResult = await db.collection('users').add({
      data: {
        openid: openid,
        nickname: nickname || '用户',
        avatarUrl: avatarUrl || '',
        familyId: familyResult._id,
        familyRole: 'admin',
        createdAt: new Date()
      }
    })

    // 给新家庭预置示例菜谱（失败不影响注册）
    try {
      const seedNow = new Date()
      for (let i = 0; i < SEED_RECIPES.length; i++) {
        const s = SEED_RECIPES[i]
        await db.collection('recipes').add({
          data: {
            _openid: openid,
            userId: openid,
            familyId: familyResult._id,
            name: s.name,
            ingredients: s.ingredients,
            steps: s.steps,
            category: s.category,
            tags: s.tags,
            nutrition: s.nutrition,
            images: [],
            referenceLink: '',
            referenceType: '',
            referenceLabel: '',
            calories: null,
            ratings: [],
            avgScore: 0,
            memberAvgScores: {},
            isPublic: false,
            isSeed: true,
            createdAt: seedNow,
            updatedAt: seedNow
          }
        })
      }
    } catch (e) { /* 预置示例菜谱失败忽略 */ }

    const userInfo = {
      _id: userResult._id,
      openid: openid,
      nickname: nickname || '用户',
      avatarUrl: avatarUrl || '',
      familyId: familyResult._id,
      familyRole: 'admin'
    }

    return {
      success: true,
      message: '注册成功',
      userInfo: userInfo,
      familyId: familyResult._id,
      data: {
        userId: userResult._id,
        familyId: familyResult._id,
        openid: openid
      }
    }
  } catch (err) {
    return {
      success: false,
      message: '注册失败',
      error: err.message
    }
  }
}
