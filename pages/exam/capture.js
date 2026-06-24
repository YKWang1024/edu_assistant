var app = getApp()
var examUtil = require('../../utils/exam.js')
var imageUtil = require('../../utils/image.js')
var config = require('../../config/ai.js')

var MIN_CROP = 40 // 裁剪框最小边长(px)
var MAX_OUT = 1600 // 导出图片最长边上限(px)，过大在安卓上 canvasToTempFilePath 会失败

var TYPE_LABELS = ['选择题', '填空/简答', '其他']
var TYPE_KEYS = ['choice', 'fill', 'other']

// 把错因/上次错答/解析合并进 analysis 字段一起保存（复用现有 saveExamQuestion，无需改云函数）。
function buildAnalysis(errorPoint, studentAnswer, analysis) {
  var parts = []
  if (errorPoint) parts.push('错因：' + errorPoint)
  if (studentAnswer) parts.push('上次错答：' + studentAnswer)
  if (analysis) parts.push(analysis)
  return parts.join('\n')
}

Page({
  data: {
    // 单题：pick -> crop -> recognizing -> edit -> saving
    // 多题：pick -> multi-recognizing -> multi-review -> multi-saving
    stage: 'pick',
    imgSrc: '',
    natW: 0,
    natH: 0,
    imgBox: { left: 0, top: 0, width: 0, height: 0 }, // 图片显示尺寸(px)
    crop: { left: 0, top: 0, width: 0, height: 0 },    // 裁剪框(相对图片左上角, px)
    mask: { top: {}, bottom: {}, left: {}, right: {} },
    croppedTempPath: '',

    subjects: config.SUBJECTS,
    typeLabels: TYPE_LABELS,
    form: {
      subject: config.SUBJECTS[0],
      subjectIndex: 0,
      type: 'choice',
      typeIndex: 0,
      stem: '',
      options: [],
      correctAnswer: '',
      analysis: ''
    },

    // 整张试卷·多题
    multiImg: '',
    multiItems: [],
    multiSelectedCount: 0,
    multiSavedCount: 0,
    multiTotal: 0
  },

  // ---------------- 选图（单题：框选裁剪） ----------------
  onChoose: function () {
    var that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: function (res) {
        var path = res.tempFiles[0].tempFilePath
        wx.getImageInfo({
          src: path,
          success: function (info) {
            that.setupCropStage(path, info.width, info.height)
          },
          fail: function () { wx.showToast({ title: '读取图片失败', icon: 'none' }) }
        })
      }
    })
  },

  setupCropStage: function (path, natW, natH) {
    var sys = wx.getWindowInfo()
    var dispW = sys.windowWidth
    var dispH = Math.round(dispW * natH / natW)
    var maxH = Math.round(sys.windowHeight * 0.66)
    if (dispH > maxH) {
      dispH = maxH
      dispW = Math.round(dispH * natW / natH)
    }
    var imgBox = { left: 0, top: 0, width: dispW, height: dispH }
    var crop = {
      left: Math.round(dispW * 0.08),
      top: Math.round(dispH * 0.08),
      width: Math.round(dispW * 0.84),
      height: Math.round(dispH * 0.84)
    }
    this.setData({
      stage: 'crop',
      imgSrc: path,
      natW: natW,
      natH: natH,
      imgBox: imgBox,
      croppedTempPath: ''
    })
    this.applyCrop(crop)
  },

  // ---------------- 裁剪框拖拽 ----------------
  applyCrop: function (c) {
    var box = this.data.imgBox
    var mask = {
      top: { left: 0, top: 0, w: box.width, h: c.top },
      bottom: { left: 0, top: c.top + c.height, w: box.width, h: box.height - c.top - c.height },
      left: { left: 0, top: c.top, w: c.left, h: c.height },
      right: { left: c.left + c.width, top: c.top, w: box.width - c.left - c.width, h: c.height }
    }
    this.setData({ crop: c, mask: mask })
  },

  onCropTouchStart: function (e) {
    this._drag = {
      type: e.currentTarget.dataset.handle,
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      startCrop: {
        left: this.data.crop.left,
        top: this.data.crop.top,
        width: this.data.crop.width,
        height: this.data.crop.height
      }
    }
  },

  onCropTouchMove: function (e) {
    if (!this._drag) return
    var t = e.touches[0]
    var dx = t.clientX - this._drag.startX
    var dy = t.clientY - this._drag.startY
    var s = this._drag.startCrop
    var box = this.data.imgBox
    var c

    if (this._drag.type === 'move') {
      c = { left: s.left + dx, top: s.top + dy, width: s.width, height: s.height }
      c.left = Math.max(0, Math.min(c.left, box.width - c.width))
      c.top = Math.max(0, Math.min(c.top, box.height - c.height))
    } else {
      var left = s.left, top = s.top, right = s.left + s.width, bottom = s.top + s.height
      var type = this._drag.type
      if (type === 'tl') { left = s.left + dx; top = s.top + dy }
      else if (type === 'tr') { right = s.left + s.width + dx; top = s.top + dy }
      else if (type === 'bl') { left = s.left + dx; bottom = s.top + s.height + dy }
      else if (type === 'br') { right = s.left + s.width + dx; bottom = s.top + s.height + dy }

      left = Math.max(0, Math.min(left, box.width))
      right = Math.max(0, Math.min(right, box.width))
      top = Math.max(0, Math.min(top, box.height))
      bottom = Math.max(0, Math.min(bottom, box.height))

      if (right - left < MIN_CROP) {
        if (type === 'tl' || type === 'bl') left = right - MIN_CROP; else right = left + MIN_CROP
      }
      if (bottom - top < MIN_CROP) {
        if (type === 'tl' || type === 'tr') top = bottom - MIN_CROP; else bottom = top + MIN_CROP
      }
      left = Math.max(0, left); top = Math.max(0, top)
      right = Math.min(box.width, right); bottom = Math.min(box.height, bottom)
      c = { left: left, top: top, width: right - left, height: bottom - top }
    }
    this.applyCrop(c)
  },

  onCropTouchEnd: function () {
    this._drag = null
  },

  onRetake: function () {
    this.setData({ stage: 'pick', imgSrc: '' })
  },

  // ================= 整张试卷·多题 =================
  onChooseMulti: function () {
    var that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['original', 'compressed'], // 整卷要尽量清晰，原图由我们自行压缩
      success: function (res) {
        that.recognizeMulti(res.tempFiles[0].tempFilePath)
      }
    })
  },

  recognizeMulti: function (path) {
    var that = this
    this.setData({ stage: 'multi-recognizing', multiImg: path, multiItems: [] })

    // 整卷先压缩(省存储/加速)，再上传云存储用 fileID 识别（规避包体上限）。
    imageUtil.compressForUpload(path, { maxEdge: 1800, quality: 0.7 }).then(function (p) {
      that.setData({ multiImg: p })
      that._multiUploadPath = p
      return that.recognizeImage(p, true)
    }).then(function (list) {
      if (!list || !list.length) {
        that.setData({ stage: 'pick' })
        wx.showModal({
          title: '未识别到错题',
          content: '没有在这张试卷上识别到明显做错的题目。可换张更清晰的照片，或用「框选一道题」逐题录入。',
          showCancel: false
        })
        return
      }
      that.fillMultiList(list)
    }).catch(function (err) {
      console.error('recognizeMulti fail', err)
      that.setData({ stage: 'pick' })
      wx.showModal({
        title: '识别失败',
        content: (err && err.message) || '请重试，或改用「框选一道题」',
        showCancel: false
      })
    })
  },

  fillMultiList: function (list) {
    var subjects = this.data.subjects
    var items = list.map(function (q) {
      var subjectIndex = subjects.indexOf(q.subject)
      if (subjectIndex < 0) subjectIndex = subjects.length - 1
      var typeIndex = TYPE_KEYS.indexOf(q.type)
      if (typeIndex < 0) typeIndex = 2
      var optionText = (q.options || []).map(function (o) { return o.key + '. ' + o.text }).join('   ')
      // 选择题正确答案展示成「字母. 文本」，更直观
      var correctDisplay = q.correctAnswer || ''
      if (q.type === 'choice') {
        for (var ci = 0; ci < (q.options || []).length; ci++) {
          if (q.options[ci].key === q.correctAnswer) { correctDisplay = q.options[ci].key + '. ' + q.options[ci].text; break }
        }
      }
      return {
        selected: true,
        subject: subjects[subjectIndex],
        subjectIndex: subjectIndex,
        type: TYPE_KEYS[typeIndex],
        typeLabel: TYPE_LABELS[typeIndex],
        stem: q.stem || '',
        options: q.options || [],
        optionText: optionText,
        correctAnswer: q.correctAnswer || '',
        correctDisplay: correctDisplay,
        studentAnswer: q.studentAnswer || '',
        errorPoint: q.errorPoint || '',
        analysis: q.analysis || '',
        figure: q.figure || null
      }
    })
    this.setData({
      stage: 'multi-review',
      multiItems: items,
      multiSelectedCount: items.length
    })
  },

  onMultiToggle: function (e) {
    var i = e.currentTarget.dataset.index
    var sel = !this.data.multiItems[i].selected
    var patch = {}
    patch['multiItems[' + i + '].selected'] = sel
    this.setData(patch, this.refreshSelectedCount)
  },

  onMultiSubject: function (e) {
    var i = e.currentTarget.dataset.index
    var idx = Number(e.detail.value)
    var patch = {}
    patch['multiItems[' + i + '].subjectIndex'] = idx
    patch['multiItems[' + i + '].subject'] = this.data.subjects[idx]
    this.setData(patch)
  },

  onMultiToggleAll: function () {
    var all = this.data.multiItems.every(function (it) { return it.selected })
    var items = this.data.multiItems.map(function (it) { it.selected = !all; return it })
    this.setData({ multiItems: items }, this.refreshSelectedCount)
  },

  refreshSelectedCount: function () {
    var n = this.data.multiItems.filter(function (it) { return it.selected }).length
    this.setData({ multiSelectedCount: n })
  },

  onSaveSelected: function () {
    var that = this
    var selected = this.data.multiItems.filter(function (it) { return it.selected })
    if (!selected.length) { wx.showToast({ title: '请至少选择一道题', icon: 'none' }); return }

    this.setData({ stage: 'multi-saving', multiSavedCount: 0, multiTotal: selected.length })
    // 识别阶段已上传整卷图片，所有错题共用其 fileID；若当时回退过 base64 则现场补传一次
    if (this._lastFileID) {
      this.saveSelectedSeq(selected, this._lastFileID, 0, 0)
    } else if (app.globalData.cloudReady && wx.cloud && this._multiUploadPath) {
      this.uploadMultiImage(function (fileID) { that.saveSelectedSeq(selected, fileID, 0, 0) })
    } else {
      this.saveSelectedSeq(selected, '', 0, 0)
    }
  },

  uploadMultiImage: function (cb) {
    var path = this._multiUploadPath || this.data.multiImg
    if (!path || !app.globalData.cloudReady || !wx.cloud) { cb(''); return }
    var cloudPath = 'exam/' + Date.now() + '_' + Math.floor(Math.random() * 1000000) + '.jpg'
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: path,
      success: function (r) { cb(r.fileID) },
      fail: function () { cb('') }
    })
  },

  // 依次保存选中的错题（逐条调用现有 saveExamQuestion）
  saveSelectedSeq: function (selected, fileID, i, okCount) {
    var that = this
    if (i >= selected.length) {
      if (okCount > 0) {
        wx.showToast({ title: '已保存 ' + okCount + ' 道错题', icon: 'success' })
        setTimeout(function () { wx.navigateBack() }, 1200)
      } else {
        that.setData({ stage: 'multi-review' })
        wx.showToast({ title: '保存失败，请重试', icon: 'none' })
      }
      return
    }
    var it = selected[i]
    var options = it.type === 'choice'
      ? (it.options || []).filter(function (o) { return o.text && o.text.trim() })
        .map(function (o) { return { key: o.key, text: o.text.trim() } })
      : []
    app.callCloudFunction('saveExamQuestion', {
      subject: it.subject,
      type: it.type,
      stem: (it.stem || '').trim(),
      options: options,
      correctAnswer: (it.correctAnswer || '').trim(),
      analysis: buildAnalysis(it.errorPoint, it.studentAnswer, it.analysis),
      imageFileID: fileID,
      figure: it.figure || null,
      childName: app.getCurrentChild ? app.getCurrentChild() : '宝贝'
    }, function (res) {
      var ok = okCount + (res && res.success ? 1 : 0)
      that.setData({ multiSavedCount: i + 1 })
      that.saveSelectedSeq(selected, fileID, i + 1, ok)
    })
  },

  // ---------------- 裁剪 + 识别 ----------------
  onConfirmCrop: function () {
    var that = this
    var crop = this.data.crop
    var box = this.data.imgBox
    var scale = this.data.natW / box.width // 自然像素 / 显示像素

    var sx = Math.max(0, Math.round(crop.left * scale))
    var sy = Math.max(0, Math.round(crop.top * scale))
    var sW = Math.round(crop.width * scale)
    var sH = Math.round(crop.height * scale)

    var outW = sW, outH = sH
    if (outW > MAX_OUT || outH > MAX_OUT) {
      var r = Math.min(MAX_OUT / outW, MAX_OUT / outH)
      outW = Math.round(outW * r)
      outH = Math.round(outH * r)
    }

    wx.showLoading({ title: '正在裁剪…', mask: true })
    wx.createSelectorQuery().select('#cropCanvas').fields({ node: true }).exec(function (resq) {
      if (!resq[0] || !resq[0].node) {
        wx.hideLoading()
        wx.showToast({ title: '裁剪失败', icon: 'none' })
        return
      }
      var canvas = resq[0].node
      canvas.width = outW
      canvas.height = outH
      var ctx = canvas.getContext('2d')
      var img = canvas.createImage()
      img.onload = function () {
        ctx.drawImage(img, sx, sy, sW, sH, 0, 0, outW, outH)
        wx.canvasToTempFilePath({
          canvas: canvas,
          fileType: 'jpg',
          quality: 0.85,
          success: function (r) {
            wx.hideLoading()
            that.recognize(r.tempFilePath)
          },
          fail: function (err) {
            wx.hideLoading()
            console.error('canvasToTempFilePath fail', err)
            wx.showToast({ title: '裁剪失败', icon: 'none' })
          }
        })
      }
      img.onerror = function (err) {
        wx.hideLoading()
        console.error('image load fail', err)
        wx.showToast({ title: '图片加载失败', icon: 'none' })
      }
      img.src = that.data.imgSrc
    })
  },

  // 识别图片：优先上传云存储、用 fileID 识别（规避 callFunction 包体上限）；
  // 仅当【上传失败】时才回退到压缩后的 base64 直传（避免重复消耗 AI 调用）。
  // 成功后把所用 fileID 记在 this._lastFileID，保存时复用，避免二次上传。
  recognizeImage: function (path, multi) {
    var that = this
    function run(src) { return multi ? examUtil.recognizeQuestions(src) : examUtil.recognizeQuestion(src) }
    that._lastFileID = ''
    if (app.globalData.cloudReady && wx.cloud) {
      return imageUtil.uploadFile(path, 'exam').then(function (fileID) {
        that._lastFileID = fileID
        return run({ fileID: fileID, mediaType: 'image/jpeg' })
      }, function () {
        return imageUtil.compressForCloud(path).then(function (c) { return run(c.dataUri) })
      })
    }
    return imageUtil.compressForCloud(path).then(function (c) { return run(c.dataUri) })
  },

  recognize: function (croppedPath) {
    var that = this
    this.setData({ stage: 'recognizing', croppedTempPath: croppedPath })

    this.recognizeImage(croppedPath, false).then(function (q) {
      that.fillForm(q)
    }).catch(function (err) {
      console.error('recognize fail', err)
      // 识别失败：进入编辑，由用户手动录入
      that.fillForm({
        subject: that.data.form.subject,
        type: 'choice',
        stem: '',
        options: [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }],
        correctAnswer: '',
        analysis: ''
      })
      wx.showModal({
        title: '识别失败',
        content: (err && err.message) || '可手动输入题目内容后保存',
        showCancel: false
      })
    })
  },

  fillForm: function (q) {
    var subjects = this.data.subjects
    var subjectIndex = subjects.indexOf(q.subject)
    if (subjectIndex < 0) subjectIndex = subjects.length - 1
    var typeIndex = TYPE_KEYS.indexOf(q.type)
    if (typeIndex < 0) typeIndex = 2
    var type = TYPE_KEYS[typeIndex]

    var options = (q.options && q.options.length) ? q.options : []
    if (type === 'choice' && options.length === 0) {
      options = [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }]
    }

    this.setData({
      stage: 'edit',
      form: {
        subject: subjects[subjectIndex],
        subjectIndex: subjectIndex,
        type: type,
        typeIndex: typeIndex,
        stem: q.stem || '',
        options: options,
        correctAnswer: q.correctAnswer || '',
        analysis: buildAnalysis(q.errorPoint, '', q.analysis),
        figure: q.figure || null
      }
    })
  },

  // ---------------- 编辑表单 ----------------
  onSubjectChange: function (e) {
    var idx = Number(e.detail.value)
    this.setData({ 'form.subjectIndex': idx, 'form.subject': this.data.subjects[idx] })
  },

  onTypeChange: function (e) {
    var idx = Number(e.detail.value)
    var type = TYPE_KEYS[idx]
    var patch = { 'form.typeIndex': idx, 'form.type': type }
    if (type === 'choice' && (!this.data.form.options || this.data.form.options.length === 0)) {
      patch['form.options'] = [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }]
    }
    this.setData(patch)
  },

  onStemInput: function (e) {
    this.setData({ 'form.stem': e.detail.value })
  },

  onOptionInput: function (e) {
    var i = e.currentTarget.dataset.index
    this.setData({ ['form.options[' + i + '].text']: e.detail.value })
  },

  onSetCorrect: function (e) {
    this.setData({ 'form.correctAnswer': e.currentTarget.dataset.key })
  },

  onCorrectInput: function (e) {
    this.setData({ 'form.correctAnswer': e.detail.value })
  },

  onAnalysisInput: function (e) {
    this.setData({ 'form.analysis': e.detail.value })
  },

  onAddOption: function () {
    var options = this.data.form.options.slice()
    if (options.length >= 8) { wx.showToast({ title: '最多 8 个选项', icon: 'none' }); return }
    options.push({ key: String.fromCharCode(65 + options.length), text: '' })
    this.setData({ 'form.options': options })
  },

  onRemoveOption: function (e) {
    var i = e.currentTarget.dataset.index
    var options = this.data.form.options.slice()
    var removedKey = options[i] ? options[i].key : ''
    options.splice(i, 1)
    // 重新编号 A/B/C…
    options = options.map(function (o, idx) { return { key: String.fromCharCode(65 + idx), text: o.text } })
    var patch = { 'form.options': options }
    if (this.data.form.correctAnswer === removedKey) patch['form.correctAnswer'] = ''
    this.setData(patch)
  },

  // ---------------- 保存 ----------------
  onSave: function () {
    var that = this
    var form = this.data.form
    if (!form.stem || !form.stem.trim()) { wx.showToast({ title: '请填写题干', icon: 'none' }); return }

    if (form.type === 'choice') {
      var validOpts = (form.options || []).filter(function (o) { return o.text && o.text.trim() })
      if (validOpts.length < 2) { wx.showToast({ title: '选择题至少 2 个选项', icon: 'none' }); return }
      if (!form.correctAnswer) { wx.showToast({ title: '请标记正确答案', icon: 'none' }); return }
    }

    this.setData({ stage: 'saving' })
    this.uploadAndSave()
  },

  uploadAndSave: function () {
    var that = this
    var form = this.data.form

    function save(imageFileID) {
      var options = form.type === 'choice'
        ? (form.options || []).filter(function (o) { return o.text && o.text.trim() })
          .map(function (o) { return { key: o.key, text: o.text.trim() } })
        : []
      app.callCloudFunction('saveExamQuestion', {
        subject: form.subject,
        type: form.type,
        stem: form.stem.trim(),
        options: options,
        correctAnswer: (form.correctAnswer || '').trim(),
        analysis: (form.analysis || '').trim(),
        imageFileID: imageFileID || '',
        figure: form.figure || null,
        childName: app.getCurrentChild ? app.getCurrentChild() : '宝贝'
      }, function (res) {
        if (res && res.success) {
          wx.showToast({ title: '已保存到错题本', icon: 'success' })
          setTimeout(function () { wx.navigateBack() }, 1200)
        } else {
          that.setData({ stage: 'edit' })
          if (config.DEBUG && res && res.error) {
            wx.showModal({ title: '保存失败(调试)', content: ((res && res.message) || '') + '\n' + res.error, showCancel: false })
          } else {
            wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' })
          }
        }
      })
    }

    // 识别阶段通常已把图片上传过，直接复用其 fileID，避免重复上传
    if (that._lastFileID) { save(that._lastFileID); return }
    if (!that.data.croppedTempPath || !app.globalData.cloudReady || !wx.cloud) {
      save('')
      return
    }
    var cloudPath = 'exam/' + Date.now() + '_' + Math.floor(Math.random() * 1000000) + '.jpg'
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: that.data.croppedTempPath,
      success: function (r) { save(r.fileID) },
      fail: function () { save('') } // 图片上传失败也保存题目，只是没有配图
    })
  }
})
