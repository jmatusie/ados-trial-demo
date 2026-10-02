/**	Comment out this import and export at bottom when using in browser sandbox		*/

import {
	// from Parser_Result_helpers.mjs
	filterArray,
	flattenArray,
	joinWith,
	mapArray,
	multiplyBy,
	addTag,
	flattenItem,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,
	groupByPropName,
	normalizedDataSet,
	nullToStr,
	pipe,
	asBoolean,
	match,

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
	tok,
	maybe,

	// from Parser_Text.mjs
	parseLine,
	letters,
	word,
	digits,
	rol,
	hword,
	at_eol,
	eol,

	// from Parser_Network.mjs
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetwork_asObject,
	ipNetworkOrAddress,
	gotoSection,
	parseSection,
	hostnameFromConfig,
	endOfIndentLevel,
	gotoStr,
	until,
	goto,
} from '../parser_modules.mjs'



/** LOCAL RESULT HELPERS to make code more readable (arguably).	****
 *	These are candidates for possibly moving into an external module 
 */
const toJSON = (data) => JSON.stringify(data)
const _0 = (arr) => arr[0]		// these get values out of arrays at the supplied index
const _1 = (arr) => arr[1]
const _2 = (arr) => arr[2]
const _3 = (arr) => arr[3]
const isTrue = (res) => true	// tags the existence of a result as 'true' - for flags (i.e. if xyz is parsed, xyz is true)


/** standard ACL parser for EOS - ***PARSES A SINGLE ACL***/
const parse_eoscfg_acl_standard = (deviceName) => {
	const pmodule = {
		name: `parse_eoscfg_acl_standard`,// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: ...`)
		ver: `1.0`,									// future capability
		usage: '',								// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: {
			"deviceName":	'supplied by parameter',
			"aclName": 		'name of the ACL',
			"aclType": 		'"standard"',
			"action": 		'"permit", "deny", or "remark"',
			"seqNo": 			'number',
			"net": 				'For action="permit" or "deny", contains a IPv4 network with slash notation.  Host records have a /32, and "any" converts to 0.0.0.0/0',	
			"remark": 		'For action="remark", contains the text of the remark',
			"flags": 			'per-entry flags such as "log" or "mirror session"',
			"skipped": 		'Lists the parser module that neglected to include previously parse column names.  Ideally equal to "", but provides insight to where lost data went',
		},
	}

	/** standard sub-parsers common to both standard and extended ACLs...	****/
	const eosName = regex(/^[a-zA-Z0-9_-]+/)	// generic alphanumeric (plus underscores and dashes) used for vrfNames, routeMap names, aclNames, etc
	const aclName = eosName.named('aclName')
	const aclSeqNo = digits.named('aclSeqNo')

	const aclNetwork = oneOf(
		strng('any').map( ()=> `0.0.0.0/0` ),
		seqOf('host', ipAddress).map( ([_, host_ip]) => `${host_ip}/32` ),
		ipNetworkOrAddress,
	).named('aclNetwork')
	
	
	// acl-independent line-level parsers...
	const aclEntry_remark						=	parseLine( aclSeqNo.tag('seqNo'), 'remark', rol.tag('remark') ).named('aclRemark')
	const aclEntry_stats_per_entry	= parseLine('statistics per-entry').named('aclEntry_stats_per_entry')
	const aclEntry_counters_per_entry	= parseLine('counters per-entry').named('aclEntry_counters_per_entry')
	const aclEntry_unknown					= parseLine(rol).map(_0).named('aclEntry_unknown')

	const stdAclSuffix = oneOf(
		seqOf('mirror session', hword).map((res)=>`mirror:${res[1]}`),
		tok('log').map(()=>`logged`),
	)

	// anything after the 'permit', or 'deny' in a standard ACL entry
	const restOf_stdAcl	=	seqOf( 
		aclNetwork.tag('net'),
		many(stdAclSuffix).map(joinWith('|')).tag('flags'),
	)
 
	// stdAcl-specific line-level parsers...
	const stdAcl_header				= parseLine('ip access-list standard', aclName).map((result)=>result[1]).named('stdAcl_header')
	const stdAclEntry_permit	=	parseLine( aclSeqNo.tag('seqNo'), 'permit', restOf_stdAcl ).named('stdAclEntry_permit')
	const stdAclEntry_deny		=	parseLine( aclSeqNo.tag('seqNo'), 'deny', restOf_stdAcl ).named('stdAclEntry_deny')

	// match any possible line within a standard ACL...
	const stdAcl_entry = oneOf(
		aclEntry_remark.map(addTag('action', 'remark')),
		stdAclEntry_permit.map(addTag('action', 'permit')),
		stdAclEntry_deny.map(addTag('action', 'deny')),
		aclEntry_counters_per_entry,
		aclEntry_stats_per_entry,
		aclEntry_unknown.logResult( (line) => (`${deviceName}: ${pmodule.name}, [stdAcl_entry]: the line '${line}' does not match any parser in the list`) ),
	)

	// record-level parser for an entire single standard ACL
	return seqOf(
		parseSection(seqOf(
			stdAcl_header.tag('aclName'),
			succeedWith('standard').tag('aclType'),
			many(stdAcl_entry).tagList('aclEntries'),
		)),
	).getTaggedR()
		.map(multiplyBy('aclEntries'))
		.logEnv( ({
			section_index_start,
			section_index_parseduntil, 
			section_index_termination,
			section_text_unparsed,
			section_parser_dataLog,
		}) => ([
		// if the section parser has logs, make sure we pull them from the environment, but return empty if not
			(section_parser_dataLog?.length > 0) ? [
				`${deviceName}: [module:${pmodule.name}, parser:stdAcl_record]: The section parser generated the following logs (note that indices below are relative to the parent index ${section_index_start}:`,
				section_parser_dataLog.map( (entry) => ` \u21B3 ${entry}` ),
			] : [],
			// if the section parser skips text for any reason, report it...
			(section_text_unparsed?.length > 0) ? [
				`${deviceName}: [module:${pmodule.name}, parser:stdAcl_record]: The section parser did not parse entire section, starting from index ${section_index_termination}, and stopping at ${section_index_parseduntil}.  Skipped text is below:`,
				` \u21B3 '${section_text_unparsed}'`,
			] : [],
		]))
}



/*********************************************************************************
	* Module:			get_eoscfg_acls_standard
	* Version:		3.0
	* Parameters:	deviceName: string
	* Description: Parses a single arista configuration file acls.	Does not flatten into per-entry (yet)
	* Caveats:	?
	*  **Note** for remarks, 'net' is an empty string
	*/
const get_eoscfg_acls_standard = (deviceName) => {
	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'get_eoscfg_acls_standard',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									// future capability
		usage: '',								// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: `Array([eos_cfg_acl_std])`,
	}
 
	/** standard sub-parsers common to both standard and extended ACLs...	****/
	const eosName = regex(/^[a-zA-Z0-9_-]+/)	// generic alphanumeric (plus underscores and dashes) used for vrfNames, routeMap names, aclNames, etc
	const aclName = eosName.named('aclName')
	const aclSeqNo = digits.named('aclSeqNo')

	const extAcl_record_shim =	parseSection(parseLine('ip access-list', aclName))
	const stdAcl_record = parse_eoscfg_acl_standard(deviceName)


	const acl_record = (deviceName) => oneOf(
		stdAcl_record,
		extAcl_record_shim.map(addTag('aclType', 'extended_shim')).getTaggedR(),
	)


	const formatColumns = ({
		aclName,
		aclType,
		action,
		seqNo,
		net,
		remark,
		flags,
		...skippedCols
	}) => ({
		deviceName,
		aclName,
		aclType,
		action,
		seqNo,
		net,	
		remark,
		flags,
		skippedCols: Object.keys(skippedCols).length == 0 ? `` : `(by ${pmodule.name}): ${(Object.keys(skippedCols)).join(',')}`
	})


	/** stdAclRollup - optional dataSet transformer
	 *  converts an array of stdAcl records, each of which has the shape:
	 *  [
	 *     {
   *      "deviceName",
   *      "aclName",
   *      "aclType",
   *      "action": "remark" | "permit" | "deny",
   *      "seqNo",
   *      "net": IPv4 prefix string,
   *      "flags": "",
   *      "skippedCols": string,
   *      "lastRemark": string
   *     },
	 *     { ...
	 *     }
	 *   ]
	 * 
	 * into this:
	 * 
	 */ 

	return seqOf(
		gotoSection('ip access-list standard'),
		many(acl_record(deviceName))
	).map( _1 )
		.map(flattenArray)
		.map(filterArray((res)=>res.aclType=='standard'))			// filter out all the extended acl shims
		.map(mapArray(formatColumns)
	)
}



/** eos_cfg_acls_rollup_by_remarks - utility function to transform eos stdAcl into groups (still a WIP)
 * 
 * *** STILL A WIP *** 
 * TO DO:  This function does not make sense to simply map over an entire switch', but needs to be constrained by an ACL
 * 
 * utility function to take output of 'parse_eoscfg_acl_standard' and roll-up acl entries inside comment container.  
 * Used to group services, when the remark is considered a header.
 * 
 * @param {*} aclEntries  - the output of the parser 'get_eoscfg_acls_standard', which is a list of stdAcl records
 * @returns Record, where each key is a command.  ACL entries are within the comment key
 */
const aclRollup = (aclEntries=[]) => {
	const rollup = aclEntries.reduce(
		(accObj, aclEntry) => {
			if (aclEntry?.action=='remark' ?? false) {
				accObj.lastRemark = aclEntry?.remark ?? 'ERROR - no remark - should not see this'
			}
			else {
				accObj.accumulatedEntries = [...accObj.accumulatedEntries, { ...aclEntry, remark:accObj.lastRemark } ]
			}
			return accObj
		},
		{ lastRemark:'no_remark', accumulatedEntries:[] }
	)
	return Object.groupBy(rollup.accumulatedEntries, (aclEntry)=>aclEntry.remark)
}


// use when all aclEntries are for a single ACL
function aclRollup_byRemarks (aclEntries=[]) {
	const rollup = aclEntries.reduce(
		(rollupObject, aclEntry) => {
			if (aclEntry?.action=='remark' ?? false) {
				rollupObject.lastRemark = aclEntry?.remark ?? 'ERROR - no remark - should not see this'
			}
			else {
				rollupObject.accumulatedEntries = [...rollupObject.accumulatedEntries, { ...aclEntry, remark:rollupObject.lastRemark } ]
			}
			return rollupObject
		},
		{ lastRemark:'no_remark', accumulatedEntries:[] }
	)
	return Object.groupBy(rollup.accumulatedEntries, (aclEntry)=>aclEntry.remark)
}


/** eos_cfg_acls_rollup_byRemarks -  Roll up an entire switch's acls into a single two-level object:
 *   The first-level keys are the aclNames found in the dataset
 *   The second-level keys for each aclName are the acl comments (assumed to be an entitlemenet or product name)
 * 
 * ** Use this when evaluating a list of stdAclEntries across many ACLs **
 * 
 * Usage example:  const rollupresults = get_eoscfg_acls_standard('fakename').map(eos_cfg_acls_rollup_byRemarks)
 * 
 * Pseudocode description of the return value:
 *   {
 *     aclName1: {
 *       aclComment1: [ ...aclRecords under aclComment1 for aclName1 ],
 *       aclComment2: [ ...aclRecords under aclComment2 for aclName1 ],
 *       ...more keys (one for each aclComment under aclName1)
 *     },
 *     aclName2: {
 *       aclComment1: [ ...aclRecords under aclComment1 for aclName2 ],
 *       aclComment2: [ ...aclRecords under aclComment2 for aclName2 ],
 *       ...more keys (one for each aclComment under aclName1)
 *     }
 *   }
 */

const eos_cfg_acls_rollup_byRemarks = (stdAclEntries=[]) => {
	const stdAclEntryMap_byAclName = Object.groupBy(stdAclEntries, (rec=>rec.aclName))
	const  returnVal = {}
	for ( const aclName in stdAclEntryMap_byAclName ) {
		returnVal[aclName] = aclRollup(stdAclEntryMap_byAclName[aclName])
	}
	return returnVal
}





// comment this out when using in production
//	eoscfg_acls_standard('test_device_name')


// comment this out when using in-browser IDE
export {
	parse_eoscfg_acl_standard,
	get_eoscfg_acls_standard,
	aclRollup_byRemarks,
	eos_cfg_acls_rollup_byRemarks
}


 
 
 
 