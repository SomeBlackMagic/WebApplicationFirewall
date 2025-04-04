const JailStorageMemory = require('../src/Jail/JailStorageMemory')
const { Log } = require('../src/Log')
const { LogsInMemoryTarget } = require('./Helpers/LogsInMemoryTarget')
const { LogLevel } = require('@elementary-lab/logger/src/Types')
const { Metrics } = require('../src/Metrics/Metrics')

global.jailStorage = new JailStorageMemory.JailStorageMemory()
process.env.WAF_LOG_FLUSH_INTERVAL = 0
Log.instance = new Log([
    new LogsInMemoryTarget({
        enabled: true,
        levels: [
            LogLevel.EMERGENCY,
            LogLevel.ERROR,
            LogLevel.NOTICE,
            LogLevel.WARNING,
            LogLevel.INFO,
            LogLevel.DEBUG,
            LogLevel.PROFILE
        ]
    })
])
Metrics.build({ enabled: false, auth: { enabled: false } }, jest.mock('express'))
