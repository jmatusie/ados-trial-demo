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
	RoutingTable,
} from '../parser_modules.mjs'


const { get_eoscfg_rp_mappings } = await import(`../eos-cfg/get_eoscfg_rp_mappings.mjs`)
const { get_eoscfg_acls_standard } = await import(`../eos-cfg/get_eoscfg_acls.mjs`)




/** SECTION 1: module metadata ****/
const pmodule = {
	name: 'get_rpMappings',			// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
	ver: 1.0,									  // future capability
	usage: '',							  	// future capability to provide help (may not be used)
}


const get_rpMappings = (deviceName, deviceOS) => coroutine(function* () {
	const dataLog = []

	const rawRpMappings = (deviceOS=='EOS') ? yield possibly(lookAhead(get_eoscfg_rp_mappings(deviceName))).map(nullToArray)
	: null

	const rawStdAcls = (deviceOS=='EOS') ? yield possibly(lookAhead(get_eoscfg_acls_standard(deviceName))).map(nullToArray)
	: null

	// early exit if wrong OS
	if (rawRpMappings == null || rawStdAcls == null) {
		dataLog.push(`[${pmodule.name}]: The supplied OS ${deviceOS} is not handled by this module.`) 
		yield Parser.of(null).insertLogs(dataLog)
		return []
	}


	// ip interfaces here are defined as any having an IP address (i.e. non-empty ipType)


	const rpMappings_raw = rawRpMappings

	// create a lookup for the ACL entries on this device, indexed by the ACL name
	const stdAclLookup = Map.groupBy(rawStdAcls, ({ aclName, deviceName }) => `${deviceName}:${aclName}`)

	
	// create a lookup for rp mapping instances on this switch, which are unique by vrfName & rpAddress
	// NOTE: there canb e multiple records, because on EOS many rp-mappings can exist across multiple ACLs
	// rpLookup is unique per IP address
	// reach entry is an array of one or more ACLs
	const rpLookup = Map.groupBy(rpMappings_raw, ({ _key_ }) => _key_)

	// get the values.  There should now be an array of arrays, with an outer array for each unique RP ip address/VRF, and an inner array for each ACL mapped to that IP.  These ACLs will be combined in a later step.
	const rpLookup_values = [...rpLookup.values()]

	// build rpAcl records which contain ACL entries.  Note the first map is mapping over different RP's where as the inner map is mapping over each ACL for that RP
	const rpMappings_withAclEntries = rpLookup_values.map( (rpAclMappingRecords) => rpAclMappingRecords.map( ({deviceName, rpAcl, rpAddress, vrfName, ...rpAclMappingRecord}) => {
		// case 1: rpAcl property is not defined: incorporate error into rpAcl property.  For rpAclEntries: return empty list (still need to handle mcRange, but later...)
		if (!rpAcl) {
			//	console.log(`[rpLookup_values.map(...)]: case 1: no rpAcl is defined`)
			dataLog.push(`[${deviceName} ${pmodule.name}]: CFGERR-3-NO_ACL_USED: rp address ${rpAddress} (vrf ${vrfName}) does not reference an ACL. All arbitrary sparse-mode multicast traffic will map to it by default. `)
			return {
				deviceName,
				rpAcl: `**none(CFGERR-3-NO_ACL_USED)`,
				rpAddress,
				vrfName,
				rpAclEntries: [],
				...rpAclMappingRecord      
			}
		}
		// now that we have an rpACL defined, use lookup to get entries (which may fail)
		const rpAclEntries = stdAclLookup.get(`${deviceName}:${rpAcl}`)
		// case 2: rpAcl property is defined, but the rpAcl contains no entries: incoroprate error into rpAcl property.  For rpAclEntries: return empty list (still need to handle mcRange, but later...)
		if (!rpAclEntries) {
			//	console.log(`[rpLookup_values.map(...)]: case 2: rpAcl is empty (no ACL ${rpAcl} exists in configuration)`)
			dataLog.push(`[${deviceName} ${pmodule.name}]: CFGERR-3-ACL_INVALID: rp address ${rpAddress} (vrf ${vrfName}) is referencing an ACL '${rpAcl}' which does not exist.`)
			return {
				deviceName,
				rpAcl: `**${rpAcl}(CFGERR-3-ACL_INVALID)`,
				rpAddress,
				vrfName,
				rpAclEntries: [],
				...rpAclMappingRecord
			}
		}
		// case 3: rpAcl property is defined with entries, add entries to recrod
		return {
			deviceName,
			rpAcl,
			rpAddress,
			vrfName,
			rpAclEntries,
			...rpAclMappingRecord
		}
	}))


	// helper function to 1) normalize range entries into rpAclEntries, and 2) aggregate  for a given rp IP address into a single set of ACL entries
	const aggregateEntriesPerRP = (rpEntriesAcrossACLs) => rpEntriesAcrossACLs.reduce( (accObj, rpAcl) => {
		const { deviceName, vrfName, rpAddress, rpAclEntries=[], mcRange, _key_ } = rpAcl
		// if there is no ACL, but a range instead, treat the range as if it were an acl entry so it gets rolled up into the RP aggregate group entries
		const pseudoAclEntry = (mcRange == null) ? [] : [{
				deviceName,
				aclName: `pseudoACL_fromRange_${mcRange}`,
				aclType: "standard",
				action: "permit",
				net: mcRange,
				seqNo: "0",
				remark: "",
				skippedCols: "",
		}]
		const updated_rpAclEntries = [ ...accObj?.rpAclEntries??[], ...rpAclEntries, ...pseudoAclEntry ]
		return {
			deviceName,
			vrfName,
			rpAddress,
			mcRange,
			rpAclEntries: updated_rpAclEntries,
			//rpAclEntries: [ ...accObj?.rpAclEntries??[], ...rpAclEntries, ...maybeRange ],
			_key_,
		}
	}, {} )

	// apply the function to our current data structure - we should have a single-layer deep dataSet, where each entry is an RP IP address, and rpAclEntries is the combined total
	// entries of all sub-ACLS as well as multicast ranges, in a single normalized rpMapping object.
	const rpMappings_normalized = rpMappings_withAclEntries.flatMap(aggregateEntriesPerRP)

	// helper function to consolidate different ACL entries for a given rp IP address into a single set of ACL entries - used to construct smaller ACL summarized by table
	const summarizeAcls_bySubnet = ({rpAclEntries, ...rpAclRecord}) => {
		const permitEntries = rpAclEntries.filter( ({action}) => action=='permit' )
		const aclRoutingTable = RoutingTable.fromRawRecords ('net') (permitEntries)
		const consolidatedAclRoutingTable = aclRoutingTable.consolidate()
		const summarizedAclSubnets = consolidatedAclRoutingTable.getLongestMatchTable()//.toString()
		return {
			...rpAclRecord,
			rpAclEntries,			// provided only for troubleshooting to see what our original ACL looks lke
			summarizedAclSubnets
		}
	}
	// remove duplicates from combined ACLs, combined excessive ACL entries into subnets
	const rpMappings_consolidated = rpMappings_normalized.map( summarizeAcls_bySubnet )


	const formatColumns = ({
		deviceName,
		vrfName = 'default',
		rpAddress,
		rpAcl,
		mcRange,
		priority,
		override,
		rpAclEntries,
		summarizedAclSubnets,
		_key_,
		skippedCols,
		...skipped
	}) => ({
		deviceName,
		deviceOS,
		vrfName,
		rpAddress,
		//	rpAclEntries,	// <-- uncomment this if you want the original ACL records
		//	rpAcl,
		//	mcRange,
		//	priority,
		//	override,
		rpGroupMappings_asText: summarizedAclSubnets.toString().replaceAll(',', '|'),
		_key_,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')} ${skippedCols}`
	})

	// add local error messages to the system so they get logged as errors
	yield Parser.of(null).insertLogs(dataLog)


	//return consolidatedRpEntries	//.map(formatColumns)
	return rpMappings_consolidated.map(formatColumns)

}).named(pmodule.name)

// comment out for production
// get_rpMappings('fake_device_name')


export {
	get_rpMappings
}