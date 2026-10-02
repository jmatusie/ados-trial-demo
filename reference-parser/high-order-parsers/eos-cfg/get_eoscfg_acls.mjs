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
	coroutine,
	is,
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

/** extended ACL parser for EOS - ***PARSES A SINGLE ACL***/
const parse_eoscfg_acl_extended = (deviceName) => {
	const pmodule = {
		name: `parse_eoscfg_acl_extended`,// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: ...`)
		ver: `1.0`,									// future capability
		usage: ``,								// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: {
			"deviceName": 'from parameter',
			"aclName": 'name of the ACL',
			"aclType": '"extended"',
			"action": '"permit", "deny", or "remark"',
			"seqNo": 'number',
			"proto": '"ip", "udp", "tcp", "icmp", "vxlan", "pim", "igmp", "vrrp", "ospf", etc,',
			"srcNet": 'For action="permit" or "deny", contains a IPv4 network with slash notation.  Host records have a /32, and "any" converts to 0.0.0.0/0',
			"srcPorts": 'For "proto" of "udp" or "tcp", this is a list of well-known ports, port numbers, or combinations of both, along with operators like "eq", "neq", "gt", and "lt"',
			"dstNet": 'For action="permit" or "deny", contains a IPv4 network with slash notation.  Host records have a /32, and "any" converts to 0.0.0.0/0',
			"dstPorts": `For "proto" of "udp" or "tcp", this is a list of well-known ports, port numbers, or combinations of both, along with operators like "eq", "neq", "gt", and "lt"
										 also used for icmp services`,
			"remark": 'For action="remark", contains the text of the remark',
			"flags": 'per-entry flags such as "log" or "mirror session"',
			"skipped": 'Lists the parser module that neglected to include previously parse column names.  Ideally equal to "", but provides insight to where lost data went',
		},
	}

	/** standard sub-parsers common to both standard and extended ACLs...	****/
	const eosName = regex(/^[a-zA-Z0-9_-]+/)	// generic alphanumeric (plus underscores and dashes) used for vrfNames, routeMap names, aclNames, etc
	const aclName = eosName.named('aclName')
	const aclSeqNo = digits.named('aclSeqNo')

	const aclNetwork = oneOf(
		strng('any').map(() => `0.0.0.0/0`),
		seqOf('host', ipAddress).map(([_, host_ip]) => `${host_ip}/32`),
		ipNetworkOrAddress,
	).named('aclNetwork')


	// acl-independent line-level parsers...
	const aclEntry_remark = parseLine(aclSeqNo.tag('seqNo'), 'remark', rol.tag('remark')).named('aclRemark')
	const aclEntry_counters_per_entry = parseLine('counters per-entry').named('aclEntry_stats_per_entry')
	const aclEntry_stats_per_entry = parseLine('statistics per-entry').named('aclEntry_stats_per_entry')
	const aclEntry_unknown = parseLine(rol).named('aclEntry_unknown')

	// ip, tcp, ospf, etc 
	const extAcl_proto = word

	// Just ports - like 'http', '80', 'ftp', '444', etc.
	const extAcl_service = oneOf(hword, digits)

	const operator = oneOf('neq', 'eq', 'gt', 'lt')

	// supplied with operator.map(operator_literal) to display eq, neq, gt, lt instead of symbols
	const operator_literal = (res) => match(res)
		.when('neq').return('neq:')
		.when('eq').return('eq:')
		.when('gt').return('gt:')
		.when('lt').return('lt:')
		.else('')

	// supplied with operator.map(operator_literal) to display symbols instead of eq, neq, gt, lt
	const operator_symbolic = (res) => match(res)
		.when('neq').return('<>')
		.when('eq').return('=')
		.when('gt').return('>')
		.when('lt').return('<')
		.else('')

	// needed for proper 'extAcl_ports_dst' parsing, so we know that the next word is not another port in the list
	const suffix_keyword = oneOf(
		'log',
		'mirror',
		'tracked',
		'ttl',
		'dscp',
		'ecn',
		'fragments',
		'inner',
		'ip-length',
		'metadata',
		'nexthop-group',
		'payload',
	)

	// we need to stop processing src ports when we encounter the dst portion (starting with 'aclNetwork') hence the exception parser 'except' below...
	const extAcl_ports_src = seqOf(
		possibly(operator.map(operator_literal)).map(nullToStr),
		many(except(aclNetwork,
			extAcl_service
		)).map(joinWith('|'))
	).map(joinWith(''))


	// we need to stop processing dst ports when we encounter a suffix keyword, hence the exception parser 'except' below...
	const extAcl_ports_dst = seqOf(
		possibly(operator.map(operator_literal)).map(nullToStr),
		many(except(suffix_keyword,
			extAcl_service
		)).map(joinWith('|'))
	).map(joinWith(''))


	// the stuff that comes after src & dst in an ext ACL...
	const extAclflags = oneOf(
		tok('log').map(() => `logged`),
		seqOf('mirror session', hword).map((res) => `mirror:${res[1]}`),
		tok('tracked').map(() => `tracked`),
		seqOf('ttl', operator.map(operator_symbolic), digits).map(joinWith('')),
		seqOf('dscp', hword).map((res) => `dscp:${res[1]}`),
		tok('ecn', hword).map((res) => `ecn:${res[1]}`),
		seqOf('inner ip', aclNetwork, aclNetwork).map((res) => `innerIP(src:${res[1]} dst:${res[2]})`),
		'fragments',
		// 		seqOf('payload',  log
	)


	// anything after the 'permit', or 'deny' in an extended ACL entry
	const restOf_extAcl = seqOf(
		extAcl_proto.tag('proto'),														// 'ip', 'tcp', 'udp', 'icmp', etc.
		aclNetwork.tag('srcNet'),															// one of: '10.10.10.0/24', 'host 10.10.10.10', or 'any'
		possibly(extAcl_ports_src.tag('srcPorts')),						// open-ended until an aclNetwork is encountered...
		aclNetwork.tag('dstNet'),															// one of: '10.10.10.0/24', 'host 10.10.10.10', or 'any'
		possibly(extAcl_ports_dst.tag('dstPorts')),						// open-ended until a 'suffix_keyword' is encountered...
		many(extAclflags).map(joinWith('|')).tag('flags'),		// per-entry flags such as 'log', 'tracked', 'mirror-session', etc
		//		possibly(strng('log')).map(asBoolean).tag('isLogged'),
		//		possibly(strng('tracked')).map(asBoolean).tag('isTracked'),
	)

	// extAcl-specific line-level parsers...
	const extAcl_header = parseLine('ip access-list', aclName).map((result) => result[1]).named('extAcl_header')
	const extAclEntry_permit = parseLine(aclSeqNo.tag('seqNo'), 'permit', restOf_extAcl).named('extAclEntry_permit')
	const extAclEntry_deny = parseLine(aclSeqNo.tag('seqNo'), 'deny', restOf_extAcl).named('extAclEntry_deny')

	// match any possible line within an extended ACL...
	const extAcl_entry = oneOf(
		aclEntry_remark.map(addTag('action', 'remark')),
		extAclEntry_permit.map(addTag('action', 'permit')),
		extAclEntry_deny.map(addTag('action', 'deny')),
		aclEntry_counters_per_entry,
		aclEntry_stats_per_entry,
		aclEntry_unknown.logResult( ([line]) => (`[${deviceName} ${pmodule.name} extAcl_entry]: PARSER-5-UNK: the line '${line}' does not match any parser in the list`)),
	)


	// return a record-level parser for an entire single extended ACL
	return seqOf(
		parseSection(seqOf(
			extAcl_header.tag('aclName'),
			succeedWith('extended').tag('aclType'),
			many(extAcl_entry).tagList('aclEntries'),
		)),
	).getTaggedR()

		.map(multiplyBy('aclEntries'))

		.logEnv(({
			section_index_start,
			section_index_parseduntil,
			section_index_termination,
			section_text_unparsed,
			section_parser_dataLog,
		}) => ([
			// if the section parser has logs, make sure we pull them from the environment, but return empty if not
			(section_parser_dataLog?.length > 0) ? [
				`[${deviceName} ${pmodule.name}]: PARSER-5-SUBPARSER: The extended acl parser generated the following logs (indices below are relative to index ${section_index_start}):`,
				section_parser_dataLog.map((entry) => `  ${entry}`),
			] : [],
			// if the section parser skips text for any reason, report it...
			(section_text_unparsed?.length > 0) ? [
				`[${deviceName} ${pmodule.name}]: PARSER-5-SKIPPED: The extended acl parser did not parse entire ACL, from (index ${section_index_termination}-${section_index_parseduntil}).  Skipped text is below:`,				
				` \u21B3 '${section_text_unparsed}'`,
			] : [],
		]))
}



/*********************************************************************************
	* Module:			get_eoscfg_acls_extended
	* Version:		3.0
	* Parameters:	deviceName: string
	* Description: Parses a single arista configuration file acls.	Does not flatten into per-entry (yet)
	* Caveats:	?
	* Where:
	* 	Extended ACL record is:
	*    {
	*      "aclName": name of the access-list,
	*      "aclType": "extended",
	*      "seqNo": number (as a string),
	*      "action": one of: "permit", "deny" or "remark",
	*      "remark": contents after the remark, or empty string if not a remark entry
	*      "proto": protocol, such as "ip", "tcp", "icmp", etc...
	*      "srcNet": the source network (as a string) with slash notation. acl entries with 'host', become "{{host_ip}}/32", and 'any' becomes "0.0.0.0/0"
	*      "srcPorts": the list of source ports, separated by "|" if more than one.  Strings like 'http' or 'bgp' remain as is, and ports like '80', '443', remain as is.
	*      "dstNet": the destination network (as a string).  Same format rules as srcNet
	*      "dstPorts": the list of dest ports, separated by "|" if more than one.  Strings like 'http' or 'bgp' remain as is, and ports like '80', '443', remain as is.
	*      "isLogged": true if 'log' keyword at end, false otherwise,
	*      "isTracked": true if 'log' keyword at end, false otherwise,
	*    },
	* 
	*  **Note** for remarks, 'proto', 'srcNet', 'srcPorts', 'dstNet', 'dstPorts' have empty strings
	* 
	* 	Standard ACL record is:
	*    {
	*      "aclName": name of the access-list,
	*      "aclType": "standard",
	*      "seqNo": number (as a string),
	*      "action": one of: "permit", "deny" or "remark",
	*      "net": the network (as a string) with slash notation. Entries with 'host', become "{{host_ip}}/32", and 'any' becomes "0.0.0.0/0",
	*      "isLogged": false,
	*      "isTracked": false
	*    },
	* 
	*  **Note** for remarks, 'net' is an empty string
	* 
	*/
const get_eoscfg_acls_extended = (deviceName) => {
	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'get_eoscfg_acls_extended',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									// future capability
		usage: '',								// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: `Array([eos_cfg_acl_ext])`,
	}


	/** standard sub-parsers common to both standard and extended ACLs...	****/
	const eosName = regex(/^[a-zA-Z0-9_-]+/)	// generic alphanumeric (plus underscores and dashes) used for vrfNames, routeMap names, aclNames, etc
	const aclName = eosName.named('aclName')
	const aclSeqNo = digits.named('aclSeqNo')

	const stdAcl_record_shim = parseSection(parseLine('ip access-list standard'))
	const extAcl_record = parse_eoscfg_acl_extended(deviceName)


	const acl_record = (deviceName) => oneOf(
		stdAcl_record_shim.map(addTag('aclType', 'standard_shim')).getTaggedR(),
		extAcl_record,
	)


	const formatColumns = ({
		aclName,
		aclType,
		action,
		seqNo,
		proto,
		srcNet,
		srcPorts,
		dstNet,
		dstPorts,
		remark,
		flags,
		...skipped
	}) => ({
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
		remark,
		flags,
		_key_: `${deviceName}:${aclName}`,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')}`
	})

	return seqOf(
		gotoSection('ip access-list'),
		many(acl_record(deviceName))
	).map(_1)
		.map(flattenArray)
		.map(filterArray((res) => res.aclType == 'extended'))
		.map(mapArray(formatColumns))
}


/** standard ACL parser for EOS - ***PARSES A SINGLE ACL***/
const parse_eoscfg_acl_standard = (deviceName) => {
	const pmodule = {
		name: `parse_eoscfg_acl_standard`,// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: ...`)
		ver: `1.0`,									// future capability
		usage: '',								// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: {
			"deviceName": 'supplied by parameter',
			"aclName": 'name of the ACL',
			"aclType": '"standard"',
			"action": '"permit", "deny", or "remark"',
			"seqNo": 'number',
			"net": 'For action="permit" or "deny", contains a IPv4 network with slash notation.  Host records have a /32, and "any" converts to 0.0.0.0/0',
			"remark": 'For action="remark", contains the text of the remark',
			"flags": 'per-entry flags such as "log" or "mirror session"',
			"skipped": 'Lists the parser module that neglected to include previously parse column names.  Ideally equal to "", but provides insight to where lost data went',
		},
	}

	/** standard sub-parsers common to both standard and extended ACLs...	****/
	const eosName = regex(/^[a-zA-Z0-9_-]+/)	// generic alphanumeric (plus underscores and dashes) used for vrfNames, routeMap names, aclNames, etc
	const aclName = eosName.named('aclName')
	const aclSeqNo = digits.named('aclSeqNo')

	const aclNetwork = oneOf(
		strng('any').map(() => `0.0.0.0/0`),
		seqOf('host', ipAddress).map(([_, host_ip]) => `${host_ip}/32`),
		ipNetworkOrAddress,
	).named('aclNetwork')


	// acl-independent line-level parsers...
	const aclEntry_remark = parseLine(aclSeqNo.tag('seqNo'), 'remark', rol.tag('remark')).named('aclRemark')
	const aclEntry_stats_per_entry = parseLine('statistics per-entry').named('aclEntry_stats_per_entry')
	const aclEntry_counters_per_entry = parseLine('counters per-entry').named('aclEntry_counters_per_entry')
	const aclEntry_unknown = parseLine(rol).named('aclEntry_unknown')

	const stdAclSuffix = oneOf(
		seqOf('mirror session', hword).map((res) => `mirror:${res[1]}`),
		tok('log').map(() => `logged`),
	)

	// anything after the 'permit', or 'deny' in a standard ACL entry
	const restOf_stdAcl = seqOf(
		aclNetwork.tag('net'),
		many(stdAclSuffix).map(joinWith('|')).tag('flags'),
	)

	// stdAcl-specific line-level parsers...
	const stdAcl_header = parseLine('ip access-list standard', aclName).map((result) => result[1]).named('stdAcl_header')
	const stdAclEntry_permit = parseLine(aclSeqNo.tag('seqNo'), 'permit', restOf_stdAcl).named('stdAclEntry_permit')
	const stdAclEntry_deny = parseLine(aclSeqNo.tag('seqNo'), 'deny', restOf_stdAcl).named('stdAclEntry_deny')

	// match any possible line within a standard ACL...
	const stdAcl_entry = oneOf(
		aclEntry_remark.map(addTag('action', 'remark')),
		stdAclEntry_permit.map(addTag('action', 'permit')),
		stdAclEntry_deny.map(addTag('action', 'deny')),
		aclEntry_counters_per_entry,
		aclEntry_stats_per_entry,
		aclEntry_unknown.logResult( ([line]) => (`[${deviceName} ${pmodule.name} stdAcl_entry]: PARSER-5-UNK: the line '${line}' does not match any parser in the list`)),
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
		.logEnv(({
			section_index_start,
			section_index_parseduntil,
			section_index_termination,
			section_text_unparsed,
			section_parser_dataLog,
		}) => ([
			// if the section parser has logs, make sure we pull them from the environment, but return empty if not
			(section_parser_dataLog?.length > 0) ? [
				`[${deviceName} ${pmodule.name}]: PARSER-5-SUBPARSER: The standard acl parser generated the following logs (indices below are relative to index ${section_index_start}):`,
				section_parser_dataLog.map((entry) => ` \u21B3 ${entry}`),
			] : [],
			// if the section parser skips text for any reason, report it...
			(section_text_unparsed?.length > 0) ? [
				`[${deviceName} ${pmodule.name}]: PARSER-5-SKIPPED: The standard acl parser did not parse entire ACL, from (index ${section_index_termination}-${section_index_parseduntil}).  Skipped text is below:`,
				` \u21B3 '${section_text_unparsed}'`,
			] : [],
		]))
}
//`[${deviceName} ${pmodule.name} extAcl_entry]: PARSER-5-UNK: the line '${line}' does not match any parser in the list`


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

	const extAcl_record_shim = parseSection(parseLine('ip access-list', aclName))
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
	).map(_1)
		.map(flattenArray)
		.map(filterArray((res) => res.aclType == 'standard'))			// filter out all the extended acl shims
		.map(mapArray(formatColumns)
		)
}



// converts the raw acl output (where remarks are on separate lines) to one whwere the remarks are embedded into
// the following permit or deny entries.  This may or may not be useful
function aclRollup_byRemarks(aclEntries = []) {
	const rollup = aclEntries.reduce((rollupObject, aclEntry) =>
		(aclEntry?.action == 'remark') ?
			{ ...rollupObject, lastRemark: aclEntry?.remark ?? 'ERROR - no remark - should not see this' }
			: { ...rollupObject, accumulatedEntries: [...rollupObject.accumulatedEntries, { ...aclEntry, remark: rollupObject.lastRemark }] },
		{ lastRemark: 'no_remark', accumulatedEntries: [] }			// initial value of accumulator object supplied to reduce()
	)
	return Object.groupBy(rollup.accumulatedEntries, (aclEntry) => aclEntry.remark)
}


const get_eoscfg_acls = (deviceName) => coroutine(function* () {
	const stdAcls = yield lookAhead(get_eoscfg_acls_standard(deviceName)) ?? []
	const extAcls = yield lookAhead(get_eoscfg_acls_extended(deviceName)) ?? []
	//const extAcls = []
	const allAcls = [...stdAcls, ...extAcls]
	return normalizedDataSet(allAcls)
})




const rollupComments = (aclEntries = []) => pipe(
	aclRollup_byRemarks,
	flattenItem,
	Object.values,
	flattenArray
)(aclEntries)



// comment this out when using in production
//	eos_cfg_acls_extended('test_device_name')


// comment this out when using in-browser IDE


export {
	get_eoscfg_acls,						// combined standard and extended

	// extended acls
	get_eoscfg_acls_extended,		// device-level - returns entries for all ACLs on device
	parse_eoscfg_acl_extended,	// acl level - returns entries for single ACL

	// standard acls
	get_eoscfg_acls_standard,		// device-level - returns entries for all ACLs on device
	parse_eoscfg_acl_standard,	// acl level - returns entries for single ACL

	// rollup utilities
	//	rollupComments,
	//	aclRollup_byRemarks,											// returns an object for a single acl, each key is the remark
}





