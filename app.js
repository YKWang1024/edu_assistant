App({
  globalData: {
    gameMinutes: 0,
    userInfo: null,
    familyId: null,
    isLoggedIn: false,
    cloudReady: false,
    children: [],          // [{childId,name,grade}]，无账号小孩成员
    currentChild: '',      // 当前选中的小孩名(错题/打分等归属)
    myFamilyRole: ''       // admin | member | observer
  },

  onLaunch: function () {
    // 先加载本地数据，确保应用能正常启动
    this.loadLocalData()
    
    // 异步初始化云开发，不阻塞启动
    this.initCloud()
  },

  initCloud: function () {
    if (!wx.cloud) {
      console.log('当前基础库不支持云能力，使用本地模式')
      return
    }

    try {
      wx.cloud.init({
        env: 'cloud1-d0gnc8vm2aae15ae5',
        traceUser: true
      })
      this.globalData.cloudReady = true
      console.log('云开发初始化成功')
      
      // 云开发初始化成功后，异步检查登录状态
      this.checkLoginStatusAsync()
    } catch (e) {
      console.log('云开发初始化失败，使用本地模式:', e.message)
      this.globalData.cloudReady = false
    }
  },

  loadLocalData: function () {
    try {
      var gameMinutes = wx.getStorageSync('gameMinutes')
      if (gameMinutes !== '') {
        this.globalData.gameMinutes = gameMinutes
      }
      var userInfo = wx.getStorageSync('userInfo')
      if (userInfo) {
        this.globalData.userInfo = JSON.parse(userInfo)
        this.globalData.isLoggedIn = true
      }
      var familyId = wx.getStorageSync('familyId')
      if (familyId) {
        this.globalData.familyId = familyId
      }
    } catch (e) {
      console.error('读取本地数据失败', e)
    }
  },

  saveUserInfo: function (userInfo) {
    this.globalData.userInfo = userInfo
    this.globalData.isLoggedIn = true
    try {
      wx.setStorageSync('userInfo', JSON.stringify(userInfo))
    } catch (e) {
      console.error('保存用户信息失败', e)
    }
  },

  saveFamilyId: function (familyId) {
    this.globalData.familyId = familyId
    try {
      wx.setStorageSync('familyId', familyId)
    } catch (e) {
      console.error('保存家庭ID失败', e)
    }
  },

  saveGameMinutes: function (minutes) {
    this.globalData.gameMinutes = minutes
    try {
      wx.setStorageSync('gameMinutes', minutes)
    } catch (e) {
      console.error('保存游戏时间失败', e)
    }
  },

  // 从云端刷新游戏时间余额（首次会把本地旧钱包迁移为初始余额）。cb(balance, stats)
  refreshGameTime: function (cb) {
    var that = this
    if (!this.globalData.cloudReady) { if (cb) cb(this.globalData.gameMinutes, null); return }
    this.maybeMigrateGameTime(function () {
      that.callCloudFunction('getGameTime', {}, function (res) {
        if (res && res.success) {
          that.saveGameMinutes(res.data.balance)
          that.globalData.gameTimeStats = res.data
          if (cb) cb(res.data.balance, res.data)
        } else {
          if (cb) cb(that.globalData.gameMinutes, null)
        }
      })
    })
  },

  maybeMigrateGameTime: function (done) {
    var migrated = false
    try { migrated = wx.getStorageSync('migratedGameTime') } catch (e) {}
    if (migrated) { done(); return }
    var that = this
    function finish() { try { wx.setStorageSync('migratedGameTime', true) } catch (e) {} done() }
    var local = 0
    try { var g = wx.getStorageSync('gameMinutes'); if (g !== '' && g) local = Number(g) || 0 } catch (e) {}
    if (!local || local <= 0) { finish(); return }
    // 云端已有余额则不重复注入
    this.callCloudFunction('getGameTime', {}, function (res) {
      if (res && res.success && (res.data.balance || 0) > 0) { finish(); return }
      that.callCloudFunction('addGameTime', { delta: local }, function () { finish() })
    })
  },

  // 拉取家庭小孩列表 + 设定当前小孩。cb()
  refreshFamily: function (cb) {
    var that = this
    if (!this.globalData.cloudReady) { if (cb) cb(); return }
    this.callCloudFunction('getFamilyInfo', {}, function (res) {
      if (res && res.success && res.data) {
        that.globalData.children = res.data.children || []
        that.globalData.myFamilyRole = res.data.myRole || ''
        // 同步缓存 userInfo 的当前家庭与角色，切换/退出家庭后各页(如菜谱详情读 userInfo.familyRole)保持一致
        if (that.globalData.userInfo) {
          that.globalData.userInfo.familyId = res.data.familyId
          that.globalData.userInfo.familyRole = res.data.myRole || that.globalData.userInfo.familyRole
          try { wx.setStorageSync('userInfo', JSON.stringify(that.globalData.userInfo)) } catch (e) {}
        }
        var names = that.globalData.children.map(function (c) { return c.name })
        var saved = ''
        try { saved = wx.getStorageSync('currentChild') } catch (e) {}
        that.globalData.currentChild = (saved && names.indexOf(saved) >= 0) ? saved : (names[0] || '宝贝')
      }
      if (cb) cb()
    })
  },

  setCurrentChild: function (name) {
    this.globalData.currentChild = name
    try { wx.setStorageSync('currentChild', name) } catch (e) {}
  },

  getCurrentChild: function () {
    return this.globalData.currentChild || '宝贝'
  },

  // 增减游戏时间（云端权威；离线兜底本地）。cb(balance)
  addGameMinutes: function (minutes, cb) {
    var that = this
    if (!this.globalData.cloudReady) {
      var total = (this.globalData.gameMinutes || 0) + minutes
      if (total < 0) total = 0
      this.saveGameMinutes(total)
      if (cb) cb(total)
      return total
    }
    this.callCloudFunction('addGameTime', { delta: minutes }, function (res) {
      if (res && res.success) that.saveGameMinutes(res.data.balance)
      if (cb) cb(that.globalData.gameMinutes)
    })
    return this.globalData.gameMinutes
  },

  // 微信自动登录（按 openid 静默登录；新用户云端自动建账号+家庭）
  checkLoginStatusAsync: function () {
    var that = this

    // 首次进入会自动建家庭+预置菜谱，留足时间
    var timeoutId = setTimeout(function () {
      console.log('云函数登录超时，使用本地数据')
    }, 12000)

    wx.cloud.callFunction({
      name: 'login',
      timeout: 12000,
      success: function (res) {
        clearTimeout(timeoutId)
        if (res.result && res.result.success && res.result.userInfo) {
          that.saveUserInfo(res.result.userInfo)
          that.saveFamilyId(res.result.userInfo.familyId)
          that.refreshGameTime()
          that.refreshFamily()
          console.log('微信自动登录成功')
        } else {
          console.log('自动登录失败:', res.result && res.result.message)
        }
      },
      fail: function (err) {
        clearTimeout(timeoutId)
        console.log('云函数调用失败:', err.errMsg || '未知错误')
        // 失败时继续使用本地数据，不影响应用运行
      }
    })
  },

  // 手动调用云函数（带超时和错误处理）
  callCloudFunction: function (name, data, callback, timeout) {
    if (!this.globalData.cloudReady) {
      callback({ success: false, message: '云开发未初始化' })
      return
    }

    wx.cloud.callFunction({
      name: name,
      data: data,
      timeout: timeout || 10000,
      success: function (res) {
        callback(res.result)
      },
      fail: function (err) {
        console.log('云函数 ' + name + ' 调用失败:', err.errMsg)
        callback({ success: false, message: err.errMsg || '调用失败' })
      }
    })
  },

  logout: function () {
    this.globalData.userInfo = null
    this.globalData.isLoggedIn = false
    this.globalData.familyId = null
    try {
      wx.removeStorageSync('userInfo')
      wx.removeStorageSync('familyId')
    } catch (e) {
      console.error('退出登录失败', e)
    }
  }
})