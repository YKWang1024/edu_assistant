App({
  globalData: {
    gameMinutes: 0,
    userInfo: null,
    familyId: null,
    isLoggedIn: false,
    cloudReady: false,
    children: [],          // [{childId,name,grade}]，无账号小孩成员
    currentChild: '',      // 当前选中的小孩名(错题/打分等归属)
    myFamilyRole: '',      // admin | member | observer
    parentVerifiedAt: 0,   // 家长密码本会话验证时间戳(REQ-013，0=未验证)
    isOnline: true         // 当前网络是否可用(离线写入队列用)
  },

  onLaunch: function () {
    // 先加载本地数据，确保应用能正常启动
    this.loadLocalData()

    // 监听网络状态(离线写入队列)
    this.initNetwork()

    // 异步初始化云开发，不阻塞启动
    this.initCloud()
  },

  // ---------------- 学习时长监控(REQ-003，开发中) ----------------
  // 说明：在小程序内只能统计「前台在线时长」。切到后台/切出由 onHide 触发并累计。
  // 待办(见表中 CC的反馈)：有效交互统计(区分真学习/挂机)、长时间无操作告警、每日报告页+导出、跨设备上云。
  onShow: function () {
    this._fgStart = Date.now()
    // 回到前台时尝试把离线期间积压的写操作回传云端
    this.flushSync()
  },

  onHide: function () {
    this._accumulateStudy()
    this._fgStart = 0
    // 切到后台时结算练习页停留并把使用统计刷到云端
    this.usageLeavePractice()
    this.usageFlush()
  },

  _studyTodayStr: function () {
    var d = new Date(Date.now() + 8 * 3600 * 1000)
    function p(n) { return (n < 10 ? '0' : '') + n }
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate())
  },

  // 把当前前台时段并入今日累计(按 UTC+8 日切)
  _accumulateStudy: function () {
    if (!this._fgStart) return
    var add = Math.floor((Date.now() - this._fgStart) / 1000)
    this._fgStart = Date.now()
    if (add <= 0) return
    var today = this._studyTodayStr()
    var rec = { date: today, seconds: 0 }
    try { var s = wx.getStorageSync('studyTime'); if (s && s.date === today) rec = s } catch (e) {}
    rec.seconds += add
    try { wx.setStorageSync('studyTime', rec) } catch (e) {}
  },

  // 今日前台在线学习时长(分钟)。读取时把当前进行中的时段也并入。
  getTodayStudyMinutes: function () {
    this._accumulateStudy()
    var today = this._studyTodayStr()
    var sec = 0
    try { var s = wx.getStorageSync('studyTime'); if (s && s.date === today) sec = s.seconds } catch (e) {}
    return Math.floor(sec / 60)
  },

  // ---------------- 使用统计采集(REQ-003：练习互动次数 + 练习页停留时长) ----------------
  // 需求方已确认：先只「采集」不做挂机判定；归属到当前小孩；按日(UTC+8)累计；上云供家长端查看。
  // 本地缓冲 usageBuf: { "日期|小孩": { taps, dwellSec } }，存的是「自上次同步以来的增量」，
  // 同步成功即从缓冲里扣掉已发送量，失败则加回，避免重复或丢失。
  _usageBufGet: function () {
    try { var b = wx.getStorageSync('usageBuf'); return (b && typeof b === 'object') ? b : {} } catch (e) { return {} }
  },
  _usageBufSet: function (buf) {
    try { wx.setStorageSync('usageBuf', buf || {}) } catch (e) {}
  },

  // 练习页进入：记录起点(当前小孩/当前日)。math/pinyin/english 等练习页 onShow 调用。
  usageEnterPractice: function (tag) {
    this._practiceStart = Date.now()
    this._practiceChild = this.getCurrentChild()
    this._practiceDate = this._studyTodayStr()
    this._practiceTag = tag || ''
  },

  // 练习页离开：结算停留秒数并入缓冲，随后刷云。onHide/onUnload 调用(幂等)。
  usageLeavePractice: function () {
    if (!this._practiceStart) return
    var sec = Math.floor((Date.now() - this._practiceStart) / 1000)
    this._practiceStart = 0
    if (sec > 0) {
      var k = this._practiceDate + '|' + (this._practiceChild || '宝贝')
      var buf = this._usageBufGet()
      if (!buf[k]) buf[k] = { taps: 0, dwellSec: 0 }
      buf[k].dwellSec = (buf[k].dwellSec || 0) + sec
      this._usageBufSet(buf)
    }
    this.usageFlush()
  },

  // 练习页一次有效交互(答题/选项/提交)。练习页调用 app.usageTapInc()。
  usageTapInc: function (n) {
    n = n || 1
    var k = this._studyTodayStr() + '|' + this.getCurrentChild()
    var buf = this._usageBufGet()
    if (!buf[k]) buf[k] = { taps: 0, dwellSec: 0 }
    buf[k].taps = (buf[k].taps || 0) + n
    this._usageBufSet(buf)
    this._scheduleUsageFlush()
  },

  _scheduleUsageFlush: function () {
    if (this._usageFlushTimer) return
    var that = this
    this._usageFlushTimer = setTimeout(function () { that._usageFlushTimer = null; that.usageFlush() }, 5000)
  },

  // 把缓冲里的增量逐条刷到云端(saveUsageStat)。乐观先扣，失败加回。
  usageFlush: function () {
    if (!this.globalData.cloudReady) return
    var that = this
    var buf = this._usageBufGet()
    Object.keys(buf).forEach(function (k) {
      var e = buf[k] || {}
      var sendTaps = e.taps || 0
      var sendDwell = e.dwellSec || 0
      if (sendTaps <= 0 && sendDwell <= 0) return
      var parts = k.split('|')
      var date = parts[0]
      var child = parts[1] || '宝贝'
      // 乐观扣减(防重复发送/重复计数)
      var cur = that._usageBufGet()
      if (cur[k]) {
        cur[k].taps = (cur[k].taps || 0) - sendTaps
        cur[k].dwellSec = (cur[k].dwellSec || 0) - sendDwell
        if (cur[k].taps <= 0 && cur[k].dwellSec <= 0) delete cur[k]
        that._usageBufSet(cur)
      }
      that.callCloudFunction('saveUsageStat', { childName: child, date: date, taps: sendTaps, dwellSec: sendDwell }, function (res) {
        if (!res || !res.success) {
          // 失败：把增量加回缓冲，下次再试
          var b2 = that._usageBufGet()
          if (!b2[k]) b2[k] = { taps: 0, dwellSec: 0 }
          b2[k].taps = (b2[k].taps || 0) + sendTaps
          b2[k].dwellSec = (b2[k].dwellSec || 0) + sendDwell
          that._usageBufSet(b2)
        }
      })
    })
  },

  // 读取近 days 天使用统计(家长端展示)。cb({ today, list })
  getUsageStats: function (childName, days, cb) {
    var child = childName || this.getCurrentChild()
    if (!this.globalData.cloudReady) { if (cb) cb(null); return }
    this.callCloudFunction('getUsageStats', { childName: child, days: days || 7 }, function (res) {
      if (cb) cb(res && res.success ? res.data : null)
    })
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
    // 切换身份(当前小孩)后，家长验证失效，再编辑错题/题目需重新输入密码(REQ-013 第3条)
    if (this.globalData.currentChild && this.globalData.currentChild !== name) this.clearParentVerified()
    this.globalData.currentChild = name
    try { wx.setStorageSync('currentChild', name) } catch (e) {}
  },

  getCurrentChild: function () {
    return this.globalData.currentChild || '宝贝'
  },

  // ---------------- 家长身份验证缓存(REQ-013) ----------------
  // 首次输入家长密码后，本会话内编辑错题/题目免重复输入；30分钟无操作过期；切换身份失效。
  PARENT_VERIFY_TTL_MS: 30 * 60 * 1000,

  // 是否仍处于已验证状态。返回 true 时滑动续期(有操作即刷新，满足「30分钟无操作过期」)。
  isParentVerified: function () {
    var ts = this.globalData.parentVerifiedAt || 0
    if (!ts) return false
    if (Date.now() - ts > this.PARENT_VERIFY_TTL_MS) { this.globalData.parentVerifiedAt = 0; return false }
    this.globalData.parentVerifiedAt = Date.now()
    return true
  },
  markParentVerified: function () { this.globalData.parentVerifiedAt = Date.now() },
  clearParentVerified: function () { this.globalData.parentVerifiedAt = 0 },

  // 家长密码校验闸门：编辑/删除等敏感操作前调用，仅在校验通过后执行 cb。
  // 已验证(本会话内)直接放行；未设置则引导设置；已设置则要求输入并云端校验。
  // 离线不拦截(只影响本地数据，与错题编辑一致)。
  requireParentPassword: function (cb) {
    var that = this
    if (!this.globalData.cloudReady) { cb(); return }
    if (this.isParentVerified()) { cb(); return }
    this.callCloudFunction('editPassword', { action: 'status' }, function (res) {
      if (!res || !res.success) { wx.showToast({ title: '网络异常，请重试', icon: 'none' }); return }
      if (res.data && res.data.hasPassword) that._promptVerifyParentPwd(cb)
      else that._promptSetParentPwd(cb)
    })
  },
  _promptVerifyParentPwd: function (cb) {
    var that = this
    wx.showModal({
      title: '家长验证', editable: true, placeholderText: '请输入家长密码',
      success: function (m) {
        if (!m.confirm) return
        that.callCloudFunction('editPassword', { action: 'verify', password: (m.content || '').trim() }, function (r) {
          if (r && r.success && r.data && r.data.match) { that.markParentVerified(); cb() }
          else wx.showToast({ title: '密码不正确', icon: 'none' })
        })
      }
    })
  },
  _promptSetParentPwd: function (cb) {
    var that = this
    wx.showModal({
      title: '设置家长密码', editable: true, placeholderText: '首次使用请设置(至少4位)',
      success: function (m) {
        if (!m.confirm) return
        var pwd = (m.content || '').trim()
        if (pwd.length < 4) { wx.showToast({ title: '密码至少 4 位', icon: 'none' }); return }
        that.callCloudFunction('editPassword', { action: 'set', password: pwd }, function (r) {
          if (r && r.success) { that.markParentVerified(); wx.showToast({ title: '已设置', icon: 'success' }); cb() }
          else wx.showToast({ title: (r && r.message) || '设置失败', icon: 'none' })
        })
      }
    })
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

  // ============ 离线写入队列：联网后自动回传云端 ============
  // 适用「幂等」写操作(可安全重放)，如打卡 saveCheckin(按 日期+类型+孩子 upsert)。
  // ⚠️ 增量/追加型(addGameTime/rateRecipe/saveUsageStat 等)不要走本队列——重放会重复计数；
  //    使用统计已有自己的增量缓冲(usageBuf)。
  initNetwork: function () {
    var that = this
    try {
      wx.getNetworkType({ success: function (r) { that.globalData.isOnline = (r && r.networkType && r.networkType !== 'none') } })
      wx.onNetworkStatusChange(function (r) {
        that.globalData.isOnline = !!(r && r.isConnected)
        if (that.globalData.isOnline) that.flushSync() // 一恢复网络就回传
      })
    } catch (e) {}
  },

  _syncQueueGet: function () {
    try { var q = wx.getStorageSync('pendingSyncQueue'); return Array.isArray(q) ? q : [] } catch (e) { return [] }
  },
  _syncQueueSet: function (q) {
    try { wx.setStorageSync('pendingSyncQueue', q || []) } catch (e) {}
  },
  _genOpId: function () {
    this._opSeq = (this._opSeq || 0) + 1
    return 's' + Date.now() + '_' + this._opSeq
  },
  getPendingSyncCount: function () { return this._syncQueueGet().length },

  // 入队一条待同步写操作。opts.dedupeKey 提供时，覆盖同 fn+dedupeKey 的旧项(防队列膨胀、保最新值)。
  queueSync: function (fn, data, opts) {
    opts = opts || {}
    var q = this._syncQueueGet()
    if (opts.dedupeKey) {
      q = q.filter(function (it) { return !(it.fn === fn && it.dedupeKey === opts.dedupeKey) })
    }
    q.push({ opId: this._genOpId(), fn: fn, data: data, label: opts.label || fn, dedupeKey: opts.dedupeKey || '', createdAt: Date.now() })
    this._syncQueueSet(q)
  },

  // 立即尝试写云端；离线或网络失败则入队等联网重放。
  // 仅对幂等 fn 使用。opts:{ label, dedupeKey, onResult(result, status) } status: 'sent'|'queued'
  pushOrQueue: function (fn, data, opts) {
    opts = opts || {}
    var that = this
    function enqueue() {
      that.queueSync(fn, data, opts)
      if (opts.onResult) opts.onResult(null, 'queued')
    }
    if (!this.globalData.cloudReady || !this.globalData.isOnline) { enqueue(); return }
    wx.cloud.callFunction({
      name: fn, data: data, timeout: 10000,
      // success = 已到达服务器(无论业务是否拒绝)，不入队
      success: function (res) { if (opts.onResult) opts.onResult(res && res.result, 'sent') },
      // fail = 网络/超时 → 入队，等联网重放
      fail: function () { enqueue() }
    })
  },

  // 顺序(FIFO)重放队列：到达服务器即出队；遇网络失败停止，保留队列等下次。
  flushSync: function (cb) {
    var that = this
    if (this._flushing) { if (cb) cb(); return }
    if (!this.globalData.cloudReady || !this.globalData.isOnline) { if (cb) cb(); return }
    if (!this._syncQueueGet().length) { if (cb) cb(); return }
    this._flushing = true
    function step() {
      var cur = that._syncQueueGet()
      if (!cur.length) { that._flushing = false; if (cb) cb(); return }
      var item = cur[0]
      wx.cloud.callFunction({
        name: item.fn, data: item.data, timeout: 10000,
        success: function () {
          var c2 = that._syncQueueGet()
          if (c2.length && c2[0].opId === item.opId) { c2.shift(); that._syncQueueSet(c2) }
          step()
        },
        fail: function () { that._flushing = false; if (cb) cb() } // 网络仍不行，下次再试
      })
    }
    step()
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
          that.flushSync() // 登录成功(云已就绪)后回传离线积压
          console.log('微信自动登录成功')
          console.log('=== DEBUG: openid ===', res.result.userInfo.openid || '未获取到')
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
    this.clearParentVerified()
    try {
      wx.removeStorageSync('userInfo')
      wx.removeStorageSync('familyId')
    } catch (e) {
      console.error('退出登录失败', e)
    }
  }
})