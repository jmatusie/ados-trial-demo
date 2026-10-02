
/**  Comment out this import and export at bottom when using in browser sandbox     */

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
	is,

	// from Parser_Core.mjs
	Parser,
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
  coroutine,

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

	// from Parser_FlexParsers.mjs
	gotoStr,
	until,
	untilStr,
	goto,

	// from Parser_ResultHelpers.mjs
	flattenItem,
	nullToArray,
  nullToStr,
  filterArray,
  multiplyBy_v2,
	ifNotFound,

	// from classIPv4.mjs
	IPv4,
	RoutingTable,


} from '../parser_modules.mjs'



const get_eoscfg_nat_pools = (deviceName) => {  
	const pmodule = {
	name: 'get_eoscfg_nat_pools',			// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
	ver: 1.0,									  // future capability
	usage: '',							  	// future capability to provide help (may not be used)
}

const natPool = hword

const natPool_header =	parseLine('ip nat pool', natPool ).map(result=>result[1])
const natPool_stmt	= 	parseLine('range', ipAddress, ipAddress	).map( ([_, fromIP, toIP]) => {
	if (fromIP !== toIP) {
		// NOTE: this should be simple but is a bit of a mess b/c the second argument of 'IPv4.createPrefixesBetween'
		// is expected to be ONE HIGHER IP than the range (by design, like .slice(10,20) actually does 10-19.)
		// For that reason, need to take the numerical 32-bit number from toIP, add one, and use that for the second argument.
//		const toIP_v2 = new IPv4(toIP)
//		const rawAddr = toIP_v2.addr + 1
//		const toIP_v3 = new IPv4(rawAddr)
		const range = IPv4.createPrefixesBetween(fromIP, toIP, {inclusive:true})
		const returnValue = `list:${range.join('|')}`
		return returnValue
	}
	return new IPv4(fromIP).toString()
})

const natPoolSection = seqOf(
natPool_header.tag('poolName'),
natPool_stmt.tag('natPoolAddr'),
).getTaggedR()


const natPool_record = parseSection(natPoolSection)
const natPool_records = many(natPool_record)

const formatColumns = ({
	...natPoolRecord
	}) => ({
	deviceName,
	...natPoolRecord,
})


return seqOf(
	goto('ip nat pool'),
	natPool_records  .tagList('natPools')
).getTaggedR()
.map(multiplyBy('natPools'))
.map(mapArray(formatColumns))
} // end of module get_eoscfg_nat_pools



export {
	get_eoscfg_nat_pools
}