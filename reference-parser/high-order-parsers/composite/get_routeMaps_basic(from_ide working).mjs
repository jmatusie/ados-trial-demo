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
	bifurcateArray,

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

} from '../parser_modules.mjs'




import { get_eoscfg_route_maps } from '../eos-cfg/get_eoscfg_route_maps.mjs'
import { get_eoscfg_prefix_lists } from '../eos-cfg/get_eoscfg_prefix_lists.mjs'
import { get_eoscfg_community_lists } from '../eos-cfg/get_eoscfg_community_lists.mjs'




/** SECTION 1: module metadata ****/
const pmodule = {
	name: 'get_routeMaps_basic',					// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
	ver: 1.0,									  // future capability
	usage: '',							  	// future capability to provide help (may not be used)
}


// enhanced routeMaps
const get_routeMaps_basic = (deviceName) => coroutine( function*() {

	const dataLog = []



	const {
		result: routeMaps_deprecated=[], 
		dataLog: routeMaps_dataLog_deprecated=[]
	}	= yield possibly(lookAhead(get_eoscfg_route_maps(deviceName).dataLog_toResult())).map(nullToObject)

	const {
		result: routeMaps=[], 
		dataLog: routeMaps_dataLog=[]
	}	= yield possibly(lookAhead(get_eoscfg_route_maps(deviceName).dataLog_toResult())).map(nullToObject)

	const {
		result: prefixLists=[], 
		dataLog: prefixLists_dataLog=[]
	} = yield possibly(lookAhead(get_eoscfg_prefix_lists(deviceName).dataLog_toResult())).map(nullToObject)

	const {
		result: communityLists=[], 
		dataLog: communityLists_dataLog=[]
	} = yield possibly(lookAhead(get_eoscfg_community_lists(deviceName).dataLog_toResult())).map(nullToObject)

	// create a lookup table for communitylist names to values - one entry per community-list name
	//	const commName_to_value_map = communityLists.reduce( (accMap,communityListRecord) => accMap.set(communityListRecord.communityListName, communityListRecord), new Map())
	//const commName_to_value_map = communityLists
	//	.filter ( (communityListRecord) => communityListRecord.format=='value')
	//	.reduce( (accMap,communityListRecord) => accMap.set(communityListRecord.communityListName, communityListRecord), new Map())
	//
	//const commName_to_regexp_map = communityLists
	//	.filter ( (communityListRecord) => communityListRecord.format=='regexp')
	//	.reduce( (accMap,communityListRecord) => accMap.set(communityListRecord.communityListName, communityListRecord), new Map())

	const commName_map = groupByPropName('format')(communityLists)
	const commName_to_value_map = (commName_map?.['value']??[]).reduce( (accMap,communityListRecord) => accMap.set(communityListRecord.communityListName, communityListRecord), new Map())
	const commName_to_regexp_map = (commName_map?.['regexp']??[]).reduce( (accMap,communityListRecord) => accMap.set(communityListRecord.communityListName, communityListRecord), new Map())
	const commName_to_list_map = (commName_map?.['list']??[]).reduce( (accMap,communityListRecord) => accMap.set(communityListRecord.communityListName, communityListRecord), new Map())

	const get_community_value_from_name_locally = (communityName) => {
		const communityListRec  = commName_to_value_map.get(communityName) ?? null
		if (communityListRec===null) {
			return `${deviceName} lookup failed for community list name ${communityName}`
		}
		const value = communityListRec.value
		const format = communityListRec.format ?? `${deviceName} [get_community_value_from_name_locally] ERROR`

		if (format !== 'value') return `${value}|type=${format}`
		return value
	}

	const get_community_regexp_from_name_locally = (communityName) => {
		const communityListRec  = commName_to_regexp_map.get(communityName) ?? null
		if (communityListRec===null) {
			return `${deviceName} lookup failed for community list name ${communityName}`
		}
		
		const value = communityListRec.value
		const format = communityListRec.format ?? `${deviceName} [get_community_value_from_name_locally] ERROR`

		if (format !== 'value') return `${value}|type=${format}`
		return value
	}

	
	// create a lookup table for community values to community-list names - there could be duplicates so each unique value stores a list of entries
	const commValue_to_name_map = communityLists.reduce( (accMap, communityListRecord) => {
		if (accMap.has(communityListRecord.value)) {
			const existingRecord = accMap.get(communityListRecord.value)
			accMap.set(communityListRecord.value, [...existingRecord, communityListRecord] )
		} 
		else {
			accMap.set(communityListRecord.value, [communityListRecord] )
		}
		return accMap
	}, new Map())


	const get_community_name_from_value_locally = (communityValue) => {
		const communityListRecords = commValue_to_name_map.get(communityValue) ?? []
		// having no name give a given value is normal
		if (communityListRecords.length == 0) return `unnamed`
		// having a single name is normal
		if (communityListRecords.length == 1) return communityListRecords[0].communityListName
		// having multiple names is not normal - so return a message with the matching names
		if (communityListRecords.length > 1) {
			const matchingNames = communityListRecords.map( ((communityListRecord) => communityListRecord.communityListName) )
			return `WARNING:duplicate_community_lists_exist_for_value '${communityValue}': ${matchingNames.join(',')}` 
		}
		// should never happen...
		return `[get_community_name_from_value_locally]: ERROR: this should never be seen`
	}


	/** next, work on prefix-list resolution (match names to  lists of networks ) */
  
	// prefix-list getter  (will be used to resolve routeMaps in a later step)
	const prefixListDB = groupByPropName('pfxName') (prefixLists)     // prefixListDB is just a single object lookup table, keyed by the prefix-list name
  
	// prefix-list output helper: per-entry (helper to pfxList_toString)
	const pfxEntry_toString = ({ pfxName, seqNo, action, prefix, range }) => (range)	? ` ${prefix} (${range})`	: ` ${prefix}`


	// prefix-list output: per-prefix-list string output 
	// 	NOTE: use of '|\n' as a lineDelimiter looks like it produces nice output
	const pfxList_toString  = (pfxName) => {
		const lineDelimiter = '\n'
		const prefixListEntries = prefixListDB[pfxName]
		if (!prefixListEntries) return `CONFIG_ERROR: prefix-list ${pfxName} does not exist`
		if (prefixListEntries.length == 0) return `CONFIG_ERROR: prefix-list ${pfxName} contains no entries!`
		const [permittedEntries, otherEntries ] = bifurcateArray ( ({action})=>action=='permit' ) (prefixListEntries)
		const [deniedEntries, emptyEntries ] = bifurcateArray ( ({action})=>action=='deny' ) (otherEntries)
		// Note: all vars starting with 'rpt_' are components of the string build
		const rpt_pfxHeader = `${pfxName}`
		const rpt_permittedEntries = (permittedEntries.length > 0) 
			? permittedEntries.map(pfxEntry_toString).join(lineDelimiter) 
			: ``
		const rpt_deniedEntries = (deniedEntries.length > 0) 
			? `Denied Entries:${lineDelimiter}${deniedEntries.map(pfxEntry_toString).join(lineDelimiter)}`
			: ``
		const rpt_empty = (emptyEntries.length > 0) 
			? `${lineDelimiter}CONFIG_ERR: empty prefix-list`
			: ``
  
		if (emptyEntries.length > 0 ) {	
			dataLog.push(`${deviceName}: [pfxList_toString] Empty entries in prefix-list ${pfxName}`)
		}
  
		const rpt_permitted	= `${rpt_pfxHeader}${lineDelimiter}${rpt_permittedEntries}`
		//const rpt_denied 		= `${lineDelimiter}${rpt_deniedEntries}`
		const rpt_denied 		= rpt_deniedEntries.length==0 ? '' : `${lineDelimiter}${rpt_deniedEntries}`

		return `${rpt_permitted}${rpt_denied}${lineDelimiter}${rpt_empty}`
	}	
  

	// prefix-list output: per-prefix-list string output 
	// 	NOTE: use of '|\n' as a lineDelimiter looks like it produces nice output
	const pfxList_values  = (pfxName) => {
		const lineDelimiter = '\n'
		let pfxError = ``
		
		const prefixListEntries = prefixListDB[pfxName]

		if (!prefixListEntries) {
			return
			//return { pfxListError: `[pfxList_values]:CONFIG_ERROR: prefix-list ${pfxName} does not exist` }
		}
		else if (prefixListEntries.length == 0) {
			pfxError = `[pfxList_values(${pfxName})]:CONFIG_ERROR: prefix-list exists but contains no entries!`
		}
		// return {
		// 	//pfxListError: `[pfxList_values]:CONFIG_ERROR: prefix-list ${pfxName} exists but contains no entries!`
		// }

		const [pfxEntriesPermitted, pfxEntriesOther ] = bifurcateArray ( ({action})=>action=='permit' ) (prefixListEntries ?? [])
		const [pfxEntriesDenied, pfxEntriesEmpty ] = bifurcateArray ( ({action})=>action=='deny' ) (pfxEntriesOther)

		return {
			pfxsPermitted: pfxEntriesPermitted.map( ({prefix}) => prefix ).join(' | '),	// TODO: since the prefixList record has a range, include the range for more accuracy
			pfxsDenied: pfxEntriesDenied.map( ({prefix}) => prefix ).join('|'),
			pfxsEmpty: pfxEntriesEmpty.map( (prefixListEntry) => `SHOULD NOT HAPPEN!!! ${JSON.stringify(prefixListEntry)}`).join(','),
			pfxError,
			// pfxsPermitted,
			// pfxsDenied:    (pfxsDenied.length > 0) ? JSON.stringify(pfxsDenied.map(pfxEntry_toString)) : '',
		}
	}	


	const processColumns = ({ 
		matchCommunity, 
		matchPrefixList, 
		matchExtCommunity,
		matchLrgCommunity,
		setCommunity, 
		setCommunityList, 
		...rest
	}) => ({
		matchPrefixList_fancy: (matchPrefixList) ? `${pfxList_toString(matchPrefixList)}` : '',
		matchPrefixList, 
		...pfxList_values(matchPrefixList),
		matchCommunity_local: (matchCommunity) ? `${matchCommunity}=${ get_community_value_from_name_locally(matchCommunity) }` : '',
		// matchCommunity_value: (matchCommunity) ? `${get_community_value_from_name_locally(matchCommunity)}` : '',
		// matchCommunity_regexp: (matchCommunity) ? `${get_community_regexp_from_name_locally(matchCommunity)}` : '',
		matchCommunity_value: (matchCommunity) ? `${commName_to_value_map.get(matchCommunity)?.value ?? ''}` : '',
		matchCommunity_regexp: (matchCommunity) ? `${commName_to_regexp_map.get(matchCommunity)?.value ?? ''}` : '',
		matchCommunity_valueList: (matchCommunity) ? `${commName_to_list_map.get(matchCommunity)?.value ?? ''}` : '',
		matchCommunity, 
		matchExtCommunity,
		matchLrgCommunity,
		setCommunity, 
		setCommunityList, 
		setCommunity_local: (setCommunity) ? `${setCommunity} (${get_community_name_from_value_locally(setCommunity)})` : '',
		setCommunityList_local: (setCommunityList) ? `${setCommunityList}=${get_community_value_from_name_locally(setCommunityList)}` : '',
		setCommunityList_value: (setCommunityList) ? `${get_community_value_from_name_locally(setCommunityList)}` : '',
		...rest,
	})

	// helper function - eliminate columns not needed for ip-interfaces w/regards to bgp peering,
	//	 & re-order the rest
	const formatColumns = ({ 
		deviceName,
		routeMapName,
		seqNo,
		action,
		continues,
		desc,
		subRouteMap,
		matchTag,

		matchCommunity_local,
		matchCommunity_value,
		matchCommunity_regexp,
		matchCommunity_valueList,
		matchCommunity, 

		matchExtCommunity,
		matchLrgCommunity,

		matchPrefixList,
		pfxsPermitted,		
		matchPrefixList_fancy,
		matchRest,
		pfxsDenied,
		pfxsEmpty,
		pfxError,

		setCommunity, 
		setCommunity_local,
		setCommunity_value,
		setCommunityList, 
		setCommunityList_local,
		setCommunityList_value,
		setExtCommunity,
		setExtCommunityList,
		setLrgCommunity,
		setLrgCommunityList,
		setPrepend,
		setPrepend_lastAS,
		setLocalPref,
		setRest,
		_key_,
		skippedCols,
		...skipped 
	}) => ({
		deviceName,
		routeMapName,
		seqNo,
		action,
		subRouteMap,

		matchTag,

		matchPrefixList,
		pfxsPermitted,
		
		matchCommunity_value,
		matchCommunity_regexp,
		matchCommunity_valueList,
		matchCommunity, 

		matchRest,
		//matchCommunity_local,
		// matchExtCommunity,
		// matchLrgCommunity,
		setCommunity, 
		setCommunity_value,
		//setCommunity_local,

		setCommunityList, 
		setCommunityList_value,
		// setCommunityList_local,
		// setExtCommunity,
		// setExtCommunityList,
		// setLrgCommunity,
		// setLrgCommunityList,
		setPrepend,
		setPrepend_lastAS,
		setLocalPref,
		setRest,
		//matchPrefixList_fancy,
		//pfxListError,
		pfxsDenied,
		pfxsEmpty,
		pfxError,
		continues,
		desc,
		_key_,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')}, by previous module: ${skippedCols}`
	})


	const routeMaps_locallyResolved = routeMaps.map(processColumns).map(formatColumns)
	return routeMaps_locallyResolved

}).named(pmodule.name)


// get_routeMaps_basic('myswitch')


export {
	get_routeMaps_basic
}
