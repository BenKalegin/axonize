import log from 'electron-log/main'

log.transports.file.maxSize = 5 * 1024 * 1024 // 5 MB
log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}'
log.transports.console.format = '{h}:{i}:{s}.{ms} [{level}] {text}'

export default log
