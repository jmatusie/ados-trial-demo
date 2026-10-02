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



import { get_eoscfg_vlans } from '../eos-cfg/get_eoscfg_vlans.mjs'
import { get_nxcfg_vlans } from '../nxos-cfg/get_nxcfg_vlans.mjs'


/** SECTION 1: module metadata ****/
const pmodule = {
	name: 'get_vlans',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
	ver: 1.0,									  // future capability
	usage: '',							  	// future capability to provide help (may not be used)
}


const get_vlans = (deviceName, deviceOS) => coroutine(function* () {
	const dataLog = []

	const rawVlans = 
		(deviceOS == 'EOS') ? 	yield possibly(lookAhead(get_eoscfg_vlans(deviceName))).map(nullToArray)
		: (deviceOS == 'NX-OS') ? yield possibly(lookAhead(get_nxcfg_vlans(deviceName))).map(nullToArray)
		: null

	if (rawVlans == null) {
		dataLog.push(`[${pmodule.name}]: The supplied OS ${deviceOS} is not handled by this module.`)
		yield Parser.of(null).insertLogs(dataLog)
		return []
	}



	// helper function - eliminate columns not needed for ip-interfaces w/regards to bgp peering, & re-order the rest
	const formatColumns = ({
		deviceName,
		vlan_id,
		vlan_name,
		vlan_trunk_group,
		fromRange,
		skippedCols,
		...skipped
	}) => ({
		deviceName,
		deviceOS,
		vlan_id,
		vlan_name,
		fromRange,
		_key_: `${deviceName}:${vlan_id}`,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')} ${skippedCols}`
	})


	// ip interfaces here are defined as any having an IP address (i.e. non-empty ipType)

	const vlans = rawVlans
		.map(formatColumns)

	if (vlans.length == 0) {
		dataLog.push(`${deviceName}-4905: [${pmodule.name}]: No vlans were found on device. Verify the config has none, otherwise check the parser against the config.`)
	}

	// add error logs to the result
	yield Parser.of(null).insertLogs(dataLog)

	return vlans

}).named(pmodule.name)



// comment out for production
// get_vlans('fake_device_name')


export {
	get_vlans,
}