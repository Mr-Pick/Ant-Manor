/*
 * @Author: TonyJiangWJ
 * @Date: 2019-11-27 09:03:57
 * @Last Modified by: TonyJiangWJ
 * @Last Modified time: 2019-11-30 23:48:02
 * @Description: 日志工具
 */
let { config } = require('../config.js')
let { formatDate } = require('./DateUtil.js')
let { FileUtils } = require('./FileUtils.js')
let storage = storages.create('run_log_file')
/**
 * @param {string} content 
 * @param {function} logFunc 执行控制台日志打印的方法
 * @param {boolean} isToast 
 * @param {function} appendLogFunc 写入额外日志的方法
 * @param {string} prefix 日志的前缀
 */
const showToast = function (content, logFunc, isToast, appendLogFunc, prefix) {
  content = convertObjectContent(content)
  if (isToast) {
    toast(content)
  }
  innerAppendLog(content, appendLogFunc, prefix)
  logFunc(content)
}

const removeOutdateBacklogFiles = function () {
  let logbackDirPath = FileUtils.getRealMainScriptPath(true) + '/logs/logback'
  if (files.exists(logbackDirPath)) {
    // 日志保留天数
    let saveDays = config.logSavedDays || 3
    let threeDayAgo = formatDate(new Date(new Date().getTime() - saveDays * 24 * 3600000), 'yyyyMMddHHmm')
    let timeRegex = /.*(\d{12})\.log/
    let outdateLogs = files.listDir(logbackDirPath, function (fileName) {
      let checkResult = timeRegex.exec(fileName)
      if (checkResult) {
        let timestr = checkResult[1]
        return timestr < threeDayAgo
      } else {
        return true
      }
    })
    if (outdateLogs && outdateLogs.length > 0) {
      outdateLogs.forEach(logFile => {
        console.verbose('日志文件过期，删除掉：' + logFile)
        files.remove(logbackDirPath + '/' + logFile)
      })
    }
  }
}

const innerClearLogFile = function () {
  removeOutdateBacklogFiles()
  let mainScriptPath = FileUtils.getRealMainScriptPath(true) + '/logs'
  clearTarget(mainScriptPath, mainScriptPath + '/log-verboses.log', 'log-verboses')
  clearTarget(mainScriptPath, mainScriptPath + '/error.log', 'error')
  clearTarget(mainScriptPath, mainScriptPath + '/log.log', 'log')
  clearTarget(mainScriptPath, mainScriptPath + '/warn.log', 'warn')
  clearTarget(mainScriptPath, mainScriptPath + '/info.log', 'info')

}

const clearTarget = function (parentPath, filePath, fileName) {
  if (files.exists(filePath)) {
    let timestampLastHour = new Date().getTime() - 3600000
    let backLogPath = parentPath + '/logback/' + fileName + '.' + formatDate(new Date(timestampLastHour), 'yyyyMMddHHmm') + '.log'
    files.ensureDir(parentPath + '/logback/')
    console.info('备份日志文件[' + backLogPath + ']' + (files.move(filePath, backLogPath) ? '成功' : '失败'))
  } else {
    console.info(filePath + '不存在，不执行备份')
  }
  try {
    files.write(filePath, fileName + ' logs for [' + formatDate(new Date()) + ']\n')
  } catch (e) {
    console.error('初始化写入日志文件失败' + e)
  }
}

const innerAppendLog = function (content, appendAnother, prefix) {
  if (config.saveLogFile) {

    // 每个整点备份日志
    let compareDateTime = formatDate(new Date(), 'yyyyMMddHH')
    let last_back_file = storage.get('last_back_file')
    if (compareDateTime !== last_back_file) {
      storage.put('last_back_file', compareDateTime)
      innerClearLogFile()
    }
    let string = formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss.S') + ':' + (prefix ? prefix : '') + content + '\n'
    files.ensureDir(FileUtils.getRealMainScriptPath(true) + '/logs/')
    let logFilePath = FileUtils.getRealMainScriptPath(true) + '/logs/log-verboses.log'
    try {
      files.append(logFilePath, string)
    } catch (e) {
      console.error('写入日志信息失败' + e)
    }

    if (appendAnother) {
      try {
        appendAnother(string)
      } catch (e) {
        console.error('写入额外日志文件失败' + e)
      }
    }
  }
}


function convertObjectContent (originContent) {
  if (typeof originContent === 'string') {
    return originContent
  } else if (Array.isArray(originContent)) {
    // let [marker, ...args] = originContent
    let marker = originContent[0]
    let args = originContent.slice(1)
    let regex = /(\{\})/g
    let matchResult = marker.match(regex)
    if (matchResult && args && matchResult.length > 0 && matchResult.length === args.length) {
      args.forEach((item, idx) => {
        marker = marker.replace('{}', item)
      })
      return marker
    } else if (matchResult === null) {
      return marker
    }
  }
  console.error('参数不匹配[' + originContent + ']')
  return originContent
}


module.exports = {
  debugInfo: function (content, isToast) {
    if (config.show_debug_log) {
      showToast(content, (c) => console.verbose(c), isToast)
    } else {
      content = convertObjectContent(content)
      innerAppendLog('[DEBUG]' + content)
    }
  },
  logInfo: function (content, isToast) {
    showToast(content, (c) => console.log(c), isToast,
      (string) => {
        let filePath = FileUtils.getRealMainScriptPath(true) + '/logs/log.log'
        files.append(filePath, string)
      }, '[LOG]'
    )
  },
  infoLog: function (content, isToast) {
    showToast(content, (c) => console.info(c), isToast,
      (string) => {
        let filePath = FileUtils.getRealMainScriptPath(true) + '/logs/info.log'
        files.append(filePath, string)
      }, '[INFO]'
    )
  },
  warnInfo: function (content, isToast) {
    showToast(content, (c) => console.warn(c), isToast,
      (string) => {
        let filePath = FileUtils.getRealMainScriptPath(true) + '/logs/warn.log'
        files.append(filePath, string)
      }, '[WARN]'
    )
  },
  errorInfo: function (content, isToast) {
    showToast(content, (c) => console.error(c), isToast,
      (string) => {
        let filePath = FileUtils.getRealMainScriptPath(true) + '/logs/error.log'
        files.append(filePath, string)
      }, '[ERROR]'
    )
  },
  appendLog: innerAppendLog,
  clearLogFile: innerClearLogFile,
  removeOldLogFiles: removeOutdateBacklogFiles
}