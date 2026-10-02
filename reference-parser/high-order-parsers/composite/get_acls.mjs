import {
	// from Parser_Result_helpers.mjs
	flattenArray,
	joinWith,
	mapArray,
	multiplyBy,
	addTag,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,
	intf_classifyBy,
	normalizedDataSet,
	coroutine,
	nullToObject,
	nullToArray,
	nullToStr,
	groupBy,
	groupByPropName,

	// from Parser_Core.mjs
	seqOf,
	sequenceOf,
	regex,
	oneOf,
	many,
	possibly,
	lookAhead,
	setOf,
	succeedWith,
	everythingUntil,
	except,
	strng,
	many1,
	Parser,

	// from Parser_Text.mjs
	parseLine,
	digits,
	rol,
	hword,
	at_eol,
	word,
	eol,
	_,			// 0 or more consequtive inline whitespace (spaces & tabs)
	__,			// 0 or more consequetive whitespace (spaces, tabs, newlines, carriage returns)

	// from Parser_Network.mjs
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetwork_asObject,
	interfaceName,
	gotoSection,
	parseSection,
	hostnameFromConfig,
	endOfIndentLevel,
	gotoStr,
	until,
	goto,

	// from classIPv4.mjs
	IPv4,

	// other
	flattenItem,
	pipe,

} from '../parser_modules.mjs'



import { get_eoscfg_acls } from '../eos-cfg/get_eoscfg_acls.mjs'
import { get_nxcfg_acls } from '../nxos-cfg/get_nxcfg_acls.mjs'


const get_acls = (deviceName, deviceOS) => coroutine(function* () {
	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'get_acls',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									  // future capability
		usage: '',							  	// future capability to provide help (may not be used)
	}


	const dataLog = []

	const rawAcls =
		(deviceOS == 'EOS') ? yield possibly(lookAhead(get_eoscfg_acls(deviceName))).map(nullToArray)
			: (deviceOS == 'NX-OS') ? yield possibly(lookAhead(get_nxcfg_acls(deviceName))).map(nullToArray)
				: null

	if (rawAcls == null) {
		dataLog.push(`[${pmodule.name}]: The supplied OS ${deviceOS} is not handled by this module.`)
		yield Parser.of(null).insertLogs(dataLog)
		return []
	}

	if (rawAcls.length == 0) {
		dataLog.push(`[${deviceName} ${pmodule.name}]: CFG-5-EMPTY: no ACLS configurations found.  Verify the config actually has none before considering a parsing bug in this module.`)
		yield Parser.of(null).insertLogs(dataLog)
		return []
	}


	const formatColumns = ({
		deviceName,
		aclName,
		aclType,
		action,
		seqNo,
		remark,
		proto,
		srcNet,
		net,
		srcPorts,
		dstNet,
		dstPorts,
		flags,
		_key_,
		skippedCols,
		...skipped
	}) => ({
		deviceName,
		deviceOS,
		aclName,
		aclType,
		action,
		seqNo,
		remark,
		proto,
		srcNet: net || srcNet || '',
		dstNet,
		dstPorts,
		flags,
		_key_: `${deviceName}:${aclName}`, // <-- this module introduces a key for acls unique within the device
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')} ${skippedCols}`
	})


	// add error logs to the result
	yield Parser.of(null).insertLogs(dataLog)

	return rawAcls.map(formatColumns)
})



/*** HELPER FUNCTIONS for getA_acls_rolledUpRemarks */


// converts the raw acl output (where remarks are on separate lines) to one whwere the remarks are embedded into
// the following permit or deny entries.  This may or may not be useful
function aclRollup_byRemarks(aclEntries = []) {
	const rollup = aclEntries.reduce((rollupObject, aclEntry) =>
		(aclEntry?.action == 'remark') ?
			{ ...rollupObject, lastRemark: aclEntry?.remark ?? 'ERROR - no remark - should not see this' }
			: { ...rollupObject, accumulatedEntries: [...rollupObject.accumulatedEntries, { ...aclEntry, remark: rollupObject.lastRemark }] },
		{ lastRemark: '', accumulatedEntries: [] }			// initial value of accumulator object supplied to reduce()
	)
	return Object.groupBy(rollup.accumulatedEntries, (aclEntry) => aclEntry.remark)
}


const rollupComments = (aclEntries = []) => pipe(
	aclRollup_byRemarks,
	flattenItem,
	Object.values,
	flattenArray
)(aclEntries)


const get_acls_rolledUpRemarks = (deviceName, deviceOS) => coroutine(function* () {
	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'get_acls_rolledUpRemarks',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									  // future capability
		usage: '',							  	// future capability to provide help (may not be used)
	}

	const dataLog = []

	const acls = yield get_acls(deviceName, deviceOS)

	const formatColumns = ({
		deviceName,
		aclName,
		aclType,
		action,
		seqNo,
		proto,
		srcNet,
		srcPorts,
		dstNet,
		dstPorts,
		flags,
		_key_,
		skippedCols,
		...skipped
	}) => ({
		deviceName,
		deviceOS,
		aclName,
		aclType,
		action,
		seqNo,
		proto,
		srcNet,
		srcPorts,
		dstNet,
		dstPorts,
		flags,
		_key_: `${deviceName}:${aclName}`, // <-- this module introduces a key for acls unique within the device
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')} ${skippedCols}`
	})

	yield Parser.of(null).insertLogs(dataLog)

	return acls.map(rollupComments).map(formatColumns)

})



// comment out for production
// get_acls('fake_device_name')


export {
	get_acls,
	rollupComments,
	get_acls_rolledUpRemarks,		// equivalent to get_acls.map(rollupComments)
}