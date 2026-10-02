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



import { get_eoscfg_community_lists } from '../eos-cfg/get_eoscfg_community_lists.mjs'
import { get_nxcfg_community_lists } from '../nxos-cfg/get_nxcfg_community_lists.mjs'


/** SECTION 1: module metadata ****/
const pmodule = {
	name: 'get_community_lists',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
	ver: 1.0,									  // future capability
	usage: '',							  	// future capability to provide help (may not be used)
}



const get_community_lists = (deviceName, deviceOS) => coroutine( function*() {
	const dataLog = [];

	const rawCommunityLists = 
		(deviceOS == 'EOS') ? 	yield possibly(lookAhead(get_eoscfg_community_lists(deviceName))).map(nullToArray)
		: (deviceOS == 'NX-OS') ? yield possibly(lookAhead(get_nxcfg_community_lists(deviceName))).map(nullToArray)		
		: null

	if (rawCommunityLists == null) {
		dataLog.push(`[${pmodule.name}]: The supplied OS ${deviceOS} is not handled by this module.`)
		yield Parser.of(null).insertLogs(dataLog)
		return []
	}
	


	// helper function - eliminate columns not needed for ip-interfaces w/regards to bgp peering, & re-order the rest
	const formatColumns = ({
		deviceName,
		communityListName,
		communityListType,
		action,
		valueCount,
		format,
		value,
		skippedCols,
		unhandled,
		_key_,
		...skipped
	}) => ({
		deviceName,
		deviceOS,
		communityListName,
		communityListType,
		action,
		valueCount,
		format,
		value,
		_key_,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')} ${skippedCols}`
	})

	const bgpCommunities = rawCommunityLists.map(formatColumns)
	
	// add error logs to the result
	yield Parser.of(null).insertLogs(dataLog)

	return bgpCommunities

}).named(pmodule.name)



export {
	get_community_lists,
}