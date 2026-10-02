class Logger {
	constructor(name = '', timeStampFn = () => new Date().toISOString()) {
		this.timeStampFn = timeStampFn
		this.name = name
		this.logObj = {}
		this.log = []
		this.externalLoggingFns = {
			['EMRG']: (msg) => { console.error(msg) },
			['ALRT']: (msg) => { console.error(msg) },
			['CRIT']: (msg) => { console.error(msg) },
			['EROR']: (msg) => { console.error(msg) },
			['WARN']: (msg) => { console.warn(msg) },
			['NOTC']: (msg) => { },
			['INFO']: (msg) => { },
			['DEBG']: (msg) => { },
		}
	}
	// functions
	emergency = (msg, data = null) => this.logEntry(0, msg, data)
	alert = (msg, data = null) => this.logEntry(1, msg, data)
	critical = (msg, data = null) => this.logEntry(2, msg, data)
	error = (msg, data = null) => this.logEntry(3, msg, data)
	warn = (msg, data = null) => this.logEntry(4, msg, data)
	notice = (msg, data = null) => this.logEntry(5, msg, data)
	info = (msg, data = null) => this.logEntry(6, msg, data)
	debug = (msg, data = null) => this.logEntry(7, msg, data)

	setName = (name) => {
		this.name = name
		return this
	}

	setExternalLogger = (levelKey, externalLoggingFn) => {
		const loggingLevel = Logger.lookupLevel(levelKey)
		if (loggingLevel.level < 0) throw `Log(${this.name}).setExternalLogger(${levelKey}: invalid log level`
		this.externalLoggingFns[loggingLevel.keyword] = externalLoggingFn
		return this
	}

	newLogger = (name) => {
		this.logObj[name] = new Logger(name, this.timeStampFn)
		return this.logObj[name]
	}

	collectAsList() {
		const collector = [...this.log]
		for (const subLogName in this.logObj) {
			collector.push(this.logObj[subLogName].collectAsList())
		}
		return collector.flat()
	}

	// returns all logs & sublogs, and maintains the collection structure by returning a object with the same shape
	collectAsStructure() {
		const collector = {}
		collector['log'] = [...this.log]
		for (const subLogName in this.logObj) {
			collector[subLogName] = this.logObj[subLogName].collectAsStructure()
		}
		return collector
	}

	logEntry(levelKey, msg, data = null) {
		const loggingLevel = Logger.lookupLevel(levelKey)
		if (loggingLevel.level < 0) throw `Log(${this.name}).log(${levelKey}, ${msg}): invalid log level`		// early exit for bad input
		this.log.push({
			facility: this.name,
			level: loggingLevel.level,
			timeStamp: this.timeStampFn(),		//.padEnd(24,' ')
			msg: `[${this.name}]: ${msg}`,
			data,
		})
		try { this.externalLoggingFns[loggingLevel.keyword](`[${this.name}]: ${msg}`) }
		catch (error) { console.error(error) }
		return this
	}

	toString = (levelKey = 7) => this.getEntries(levelKey).join('\n')

	getEntries = (levelKey = 7) => Logger.getEntries(this, levelKey)

	// internal utility only
	static lookupLevel = (key) => {
		return Logger.levelMap.find((o) => o.keyword === key || o.level === key || o.longName === key)
	}
	static levelMap = [
		{ level: 0, longName: 'emergency', keyword: 'EMRG' },
		{ level: 1, longName: 'alert', keyword: 'ALRT' },
		{ level: 2, longName: 'critical', keyword: 'CRIT' },
		{ level: 3, longName: 'error', keyword: 'EROR' },
		{ level: 4, longName: 'warning', keyword: 'WARN' },
		{ level: 5, longName: 'notice', keyword: 'NOTC' },
		{ level: 6, longName: 'informational', keyword: 'INFO' },
		{ level: 7, longName: 'debug', keyword: 'DEBG' },
	]

	static getEntries = (logInstance, levelKey = 7) => {
		const levelMapItem = Logger.lookupLevel(levelKey)
		if (levelMapItem < 0) throw `Log(${this.facilityName}).show(${levelKey}: invalid log level`		// early exit for bad input
		const level = levelMapItem.level
		const logsToDisplay = logInstance.log
			.filter((entry) => entry.level <= level)
			.map(({ level, timeStamp, msg }) => `${levelMapItem.keyword}  ${timeStamp}- :  ${msg}`)
		return logsToDisplay
	}
}			// class


export {
	Logger
}