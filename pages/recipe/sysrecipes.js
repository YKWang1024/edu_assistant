// 系统菜谱库页(REQ-022)：
//  - import 模式(默认，任何用户)：勾选系统菜谱导入到自己家庭。从菜谱页"无菜品"时进入。
//  - manage 模式(仅超级用户)：新建/编辑/删除系统菜谱。从设置页进入。
var app = getApp()
var SUPER_OPENID = 'oSnsZ7e4ja7cq2Eq5_u3hQKx3HMo'

Page({
  data: {
    mode: 'import',   // import | manage
    isSuper: false,
    recipes: [],
    selected: {},     // 导入勾选 {sysRecipeId: true}
    loading: true,
    importing: false
  },

  onLoad: function (options) {
    var mode = (options && options.mode === 'manage') ? 'manage' : 'import'
    var ui = app.globalData.userInfo || {}
    this.setData({ mode: mode, isSuper: ui.openid === SUPER_OPENID })
    wx.setNavigationBarTitle({ title: mode === 'manage' ? '系统菜谱管理' : '从系统菜谱导入' })
  },

  onShow: function () { this.load() },

  load: function () {
    var that = this
    if (!app.globalData.cloudReady) { that.setData({ loading: false }); return }
    app.callCloudFunction('listSystemRecipes', {}, function (res) {
      that.setData({ loading: false, recipes: (res && res.success) ? (res.data || []) : [] })
    })
  },

  // —— 导入模式 ——
  onToggleSelect: function (e) {
    if (this.data.mode !== 'import') return
    var id = e.currentTarget.dataset.id
    var sel = Object.assign({}, this.data.selected)
    if (sel[id]) delete sel[id]; else sel[id] = true
    this.setData({ selected: sel })
  },

  onImport: function () {
    var that = this
    var ids = Object.keys(this.data.selected)
    if (!ids.length) { wx.showToast({ title: '请先勾选菜谱', icon: 'none' }); return }
    if (!app.globalData.cloudReady) { wx.showToast({ title: '请联网后再导入', icon: 'none' }); return }
    if (this.data.importing) return
    this.setData({ importing: true })
    app.callCloudFunction('importSystemRecipes', { ids: ids }, function (res) {
      that.setData({ importing: false })
      if (res && res.success) {
        var d = res.data || {}
        wx.showToast({ title: '已导入 ' + (d.imported || 0) + ' 道' + (d.skipped ? ('，跳过 ' + d.skipped + ' 道已有') : ''), icon: 'none' })
        that.setData({ selected: {} })
        setTimeout(function () { wx.navigateBack() }, 1300)
      } else {
        wx.showToast({ title: (res && res.message) || '导入失败', icon: 'none' })
      }
    })
  },

  // —— 管理模式(超级用户) ——
  onAddSys: function () { wx.navigateTo({ url: '/pages/recipe/add?sys=1' }) },
  onEditSys: function (e) { wx.navigateTo({ url: '/pages/recipe/add?sys=1&id=' + e.currentTarget.dataset.id }) },
  onDeleteSys: function (e) {
    var that = this
    var id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除系统菜谱', content: '确定删除这道系统菜谱吗？', confirmText: '删除', confirmColor: '#e5484d',
      success: function (m) {
        if (!m.confirm) return
        app.callCloudFunction('deleteSystemRecipe', { recipeId: id }, function (r) {
          if (r && r.success) { wx.showToast({ title: '已删除', icon: 'success' }); that.load() }
          else wx.showToast({ title: (r && r.message) || '删除失败', icon: 'none' })
        })
      }
    })
  }
})
