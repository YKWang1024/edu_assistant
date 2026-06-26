// 云函数：微信自动登录（按 openid 静默登录；新用户自动建家庭+用户+邀请码+示例菜谱）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混 O/0/I/1
function genCode() {
  let s = ''
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

const SEED_RECIPES = [
  { name: '番茄炒蛋', category: '荤菜', ingredients: '番茄、鸡蛋、葱、盐、糖', steps: '1. 鸡蛋打散炒熟盛出\n2. 番茄切块炒出汁\n3. 倒入鸡蛋翻炒，加盐和少许糖调味', tags: '下饭、家常、快手', nutrition: '蛋白质丰富，开胃下饭' },
  { name: '青椒土豆丝', category: '素菜', ingredients: '土豆、青椒、蒜、醋、盐', steps: '1. 土豆青椒切丝，土豆丝泡水去淀粉\n2. 热油爆香蒜末\n3. 下土豆丝青椒丝大火快炒，加醋和盐', tags: '家常、清爽', nutrition: '碳水为主，口感爽脆' },
  { name: '紫菜蛋花汤', category: '汤类', ingredients: '紫菜、鸡蛋、虾皮、香油、盐', steps: '1. 水烧开放入紫菜、虾皮\n2. 缓缓淋入蛋液形成蛋花\n3. 加盐，滴香油出锅', tags: '清淡、快手', nutrition: '低热量，补碘补钙' },
  { name: '清蒸鲈鱼', category: '荤菜', ingredients: '鲈鱼、姜、葱、蒸鱼豉油', steps: '1. 鱼身划刀，铺姜葱\n2. 水开后上锅蒸约8分钟\n3. 倒掉汤汁，淋蒸鱼豉油，浇热油', tags: '营养、宴客', nutrition: '高蛋白低脂肪' },
  { name: '白米饭', category: '主食', ingredients: '大米、清水', steps: '1. 大米淘洗干净\n2. 加水没过米面约一指节\n3. 电饭煲煮熟后再焖10分钟', tags: '主食', nutrition: '主要碳水来源' }
]

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const db = cloud.database()

    // 已注册 → 直接登录
    const userResult = await db.collection('users').where({ openid: openid }).get()
    if (userResult.data && userResult.data.length > 0) {
      const u = userResult.data[0]
      return { success: true, userInfo: u, familyId: u.familyId, data: u, message: '登录成功' }
    }

    // —— 微信自动登录：首次进入自动建账号 + 家庭 ——
    const nickname = (event && event.nickname) || '家长'
    const avatarUrl = (event && event.avatarUrl) || ''

    // 生成唯一邀请码
    let code = ''
    for (let t = 0; t < 8; t++) {
      code = genCode()
      const ex = await db.collection('families').where({ inviteCode: code }).get()
      if (!ex.data || !ex.data.length) break
    }
    const expireAt = new Date(Date.now() + 7 * 24 * 3600 * 1000)

    const familyResult = await db.collection('families').add({
      data: {
        createdAt: new Date(),
        seeded: true,
        name: nickname + '的家庭', // 家庭名称，可在家庭管理里改
        inviteCode: code,
        inviteCodeExpireAt: expireAt,
        members: [{ openid: openid, role: 'admin', joinedAt: new Date(), displayName: nickname }],
        // 默认一个无账号小孩成员，保证已有「错题/打分」流程有归属
        children: [{ childId: 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000000), name: '宝贝', grade: '', isDeleted: false, createdAt: new Date() }]
      }
    })

    const newUser = await db.collection('users').add({
      data: {
        openid: openid,
        nickname: nickname,
        avatarUrl: avatarUrl,
        familyId: familyResult._id,
        familyIds: [familyResult._id], // 支持加入多个家庭：familyId 为「当前」, familyIds 为全部
        familyRole: 'admin',
        createdAt: new Date()
      }
    })

    // 预置示例菜谱（失败不影响登录）
    try {
      const now = new Date()
      for (let i = 0; i < SEED_RECIPES.length; i++) {
        const s = SEED_RECIPES[i]
        await db.collection('recipes').add({
          data: {
            _openid: openid, userId: openid, familyId: familyResult._id,
            name: s.name, ingredients: s.ingredients, steps: s.steps, category: s.category,
            tags: s.tags, nutrition: s.nutrition, images: [],
            referenceLink: '', referenceType: '', referenceLabel: '',
            calories: null, ratings: [], avgScore: 0, memberAvgScores: {},
            isPublic: false, isSeed: true, createdAt: now, updatedAt: now
          }
        })
      }
    } catch (e) { /* 预置失败忽略 */ }

    const userInfo = {
      _id: newUser._id,
      openid: openid,
      nickname: nickname,
      avatarUrl: avatarUrl,
      familyId: familyResult._id,
      familyIds: [familyResult._id],
      familyRole: 'admin'
    }
    return { success: true, userInfo: userInfo, familyId: familyResult._id, data: userInfo, autoCreated: true, message: '自动登录成功' }
  } catch (err) {
    return { success: false, message: '登录失败', error: err.message }
  }
}
