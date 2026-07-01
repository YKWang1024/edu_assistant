// 新建/编辑习惯定义(REQ-023 自定义习惯 + REQ-024 奖励类型配置)。仅家长(admin)可用；服务端也硬校验。
var app = getApp()

var MODES = [{ key: 'targetTime', label: '按目标时间打卡(早/晚算奖励)' }, { key: 'fixed', label: '打卡即得固定奖励' }]
var REWARD_TYPES = [{ key: 'time', label: '游戏时间(分钟)' }, { key: 'money', label: '零花钱(元)' }, { key: 'points', label: '积分' }]

Page({
  data: {
    editId: '',
    isAdmin: false,
    name: '',
    icon: '⭐',
    modeOptions: MODES,
    modeIndex: 0,
    targetTime: '20:00',
    maxReward: 10,
    deductOnLate: false,
    fixedReward: 5,
    rewardTypeOptions: REWARD_TYPES,
    rewardTypeIndex: 0,
    cycleWeekly: false,
    reminder: '',
    saving: false
  },

  onLoad: function (options) {
    var that = this
    // 先刷新家庭角色确保最新(深链直达时 globalData 可能是旧值)，再裁决是否放行。
    // 服务端 saveHabitDef/deleteHabitDef 也会再次硬校验角色，这里只是 UX 层拦截。
    app.refreshFamily(function () { that.gateAndInit(options) })
  },

  gateAndInit: function (options) {
    var isAdmin = app.globalData.myFamilyRole === 'admin'
    this.setData({ isAdmin: isAdmin })
    if (!isAdmin) {
      wx.showToast({ title: '只有家长可配置习惯', icon: 'none' })
      setTimeout(function () { wx.navigateBack() }, 1000)
      return
    }
    if (options && options.id) {
      this.setData({ editId: options.id })
      wx.setNavigationBarTitle({ title: '编辑习惯' })
      this.loadForEdit(options.id)
    } else {
      wx.setNavigationBarTitle({ title: '新建习惯' })
    }
  },

  loadForEdit: function (id) {
    var that = this
    app.callCloudFunction('listHabitDefs', {}, function (res) {
      if (!res || !res.success) { wx.showToast({ title: '加载失败', icon: 'none' }); return }
      var h = (res.data || []).filter(function (x) { return x._id === id })[0]
      if (!h) { wx.showToast({ title: '习惯不存在', icon: 'none' }); return }
      var mi = MODES.findIndex(function (m) { return m.key === h.mode })
      var ri = REWARD_TYPES.findIndex(function (r) { return r.key === h.rewardType })
      that.setData({
        name: h.name || '',
        icon: h.icon || '⭐',
        modeIndex: mi >= 0 ? mi : 0,
        targetTime: h.targetTime || '20:00',
        maxReward: h.maxReward != null ? h.maxReward : 10,
        deductOnLate: !!h.deductOnLate,
        fixedReward: h.fixedReward != null ? h.fixedReward : 5,
        rewardTypeIndex: ri >= 0 ? ri : 0,
        cycleWeekly: h.cycle === 'weekly',
        reminder: h.reminder || ''
      })
    })
  },

  onNameInput: function (e) { this.setData({ name: e.detail.value }) },
  onIconInput: function (e) { this.setData({ icon: e.detail.value }) },
  onModeChange: function (e) { this.setData({ modeIndex: Number(e.detail.value) }) },
  onTargetTimeChange: function (e) { this.setData({ targetTime: e.detail.value }) },
  onMaxRewardInput: function (e) { this.setData({ maxReward: e.detail.value }) },
  onToggleDeduct: function (e) { this.setData({ deductOnLate: e.detail.value }) },
  onFixedRewardInput: function (e) { this.setData({ fixedReward: e.detail.value }) },
  onRewardTypeChange: function (e) { this.setData({ rewardTypeIndex: Number(e.detail.value) }) },
  onToggleWeekly: function (e) { this.setData({ cycleWeekly: e.detail.value }) },
  onReminderInput: function (e) { this.setData({ reminder: e.detail.value }) },

  onSave: function () {
    var that = this
    var name = this.data.name.trim()
    if (!name) { wx.showToast({ title: '请输入习惯名称', icon: 'none' }); return }
    if (!app.globalData.cloudReady) { wx.showToast({ title: '请联网后再保存', icon: 'none' }); return }
    if (this.data.saving) return
    this.setData({ saving: true })

    var mode = MODES[this.data.modeIndex].key
    var rewardType = REWARD_TYPES[this.data.rewardTypeIndex].key

    app.callCloudFunction('saveHabitDef', {
      habitId: this.data.editId || undefined,
      name: name,
      icon: this.data.icon,
      mode: mode,
      targetTime: this.data.targetTime,
      maxReward: Number(this.data.maxReward) || 0,
      deductOnLate: this.data.deductOnLate,
      fixedReward: Number(this.data.fixedReward) || 0,
      rewardType: rewardType,
      cycle: this.data.cycleWeekly ? 'weekly' : 'daily',
      reminder: this.data.reminder.trim()
    }, function (res) {
      that.setData({ saving: false })
      if (res && res.success) {
        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(function () { wx.navigateBack() }, 1000)
      } else {
        wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' })
      }
    })
  }
})
