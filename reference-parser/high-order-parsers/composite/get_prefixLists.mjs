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
	Parser,
} from '../parser_modules.mjs'


import { get_eoscfg_prefix_lists } from '../eos-cfg/get_eoscfg_prefix_lists.mjs'
import { get_nxcfg_prefix_lists } from '../nxos-cfg/get_nxcfg_prefix_lists.mjs'


/** SECTION 1: module metadata ****/
const pmodule = {
	name: 'get_prefixLists',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
	ver: 1.0,									  // future capability
	usage: '',							  	// future capability to provide help (may not be used)
}



const get_prefixLists = (deviceName, deviceOS) => coroutine( function*() {
	const dataLog = []

	const rawPrefixLists = 
		(deviceOS == 'EOS') ? 	yield possibly(lookAhead(get_eoscfg_prefix_lists(deviceName))).map(nullToArray)
		: (deviceOS == 'NX-OS') ? yield possibly(lookAhead(get_nxcfg_prefix_lists(deviceName))).map(nullToArray)		
		: null

	if (rawPrefixLists == null) {
		dataLog.push(`[${pmodule.name}]: The supplied OS ${deviceOS} is not handled by this module.`)
		yield Parser.of(null).insertLogs(dataLog)
		return []
	}


	// helper function - eliminate columns not needed for ip-interfaces w/regards to bgp peering, & re-order the rest
	const formatColumns = ({
		deviceName,
		pfxName,
		seqNo,
		action,
		prefix,
		range,
		comment,
		type,
		_key_,
		skippedCols,
		...skipped
	}) => ({
		deviceName,
		deviceOS,
		pfxName,
		seqNo,
		action,
		prefix,
		range,
		comment,
		type,
		_key_,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')} ${skippedCols}`,
	})

	
	const prefixLists = rawPrefixLists.map(formatColumns)
	if (prefixLists.length == 0) {
		throw new Error(`[${pmodule.name}]: No prefix-lists were found on device. Verify the config has none, otherwise check the parser against the config.`)
	}

	// add error logs to the result
	yield Parser.of(null).insertLogs(dataLog)

	return prefixLists

}).named(pmodule.name)


// prefixLists('myswitch')


export {
	get_prefixLists,
}