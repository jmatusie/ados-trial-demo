/**	Comment out this import and export at bottom when using in browser sandbox		*/


import {
	// from Parser_Result_helpers.mjs
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
 
 
/** STANDARD SUB-PARSERS COMMON TO BOTH STANDARD AND EXTEDNED ACLS...	****
	* 
	*/
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
const aclEntry_unknown					= parseLine(rol).map(_0).named('aclEntry_unknown')
 
 
 
/** STANDARD EOS ACL PARSER MODULE - SINGLE ACL	****
	*/
const eos_cfg_acl_std = (deviceName) => {
	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'eos_cfg_acl_std',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									// future capability
		usage: '',								// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: null,
	}
 
 
	const stdAclSuffix = oneOf(
		seqOf( tok('mirror session'), hword.tag('sessionName') ),
		tok('log').map(asBoolean).tag('isLogged'),
	)
 
	// anything after the 'permit', or 'deny' in a standard ACL entry
	const restOf_stdAcl	=	seqOf( 
		aclNetwork.tag('net'),
		many(stdAclSuffix),
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
		aclEntry_stats_per_entry,
		aclEntry_unknown.logResult( (line) => (`${deviceName}: ${pmodule.name}, [stdAcl_entry]: the line '${line}' does not match any parser in the list`) ),
	)
 
 
	// record-level parser for an entire single standard ACL
	const stdAcl_record = seqOf(
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
				section_parser_dataLog.map( (entry) => `  ${entry}` ),
			] : [],
			// if the section parser skips text for any reason, report it...
			(section_text_unparsed?.length > 0) ? [
				`${deviceName}: [module:${pmodule.name}, parser:stdAcl_record]: The section parser did not parse entire section, starting from index ${section_index_termination}, and stopping at ${section_index_parseduntil}.  Skipped text is below:`,
				`  '${section_text_unparsed}'`,
			] : [],
		]))
 
 
	return {
		stdAcl_record,
	}
}
 
 
 
/** EXTENDED EOS ACL PARSER MODULE- SINGLE ACL	****
	*/
 
const eos_cfg_acl_ext = (deviceName) => {
	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'eos_cfg_acl_ext',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									// future capability
		usage: '',								// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: null,
	}
 
 
	// ip, tcp, ospf, etc 
	const extAcl_proto = word
 
	// Just ports - like 'http', '80', 'ftp', '444', etc.
	const extAcl_service = oneOf(hword, digits)
 
 
	const operator = oneOf(
		'neq',
		'eq',
		'gt',
		'lt',
	).map( (res)=> match(res)
		.when('neq').return('<>')
		.when('eq').return('=')
		.when('gt').return('>')
		.when('lt').return('<')
		.else('') 
	)

 
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
		operator,
		many(except(aclNetwork, 
			extAcl_service
		)).map(joinWith('|'))
	).map(joinWith(''))

 
	// we need to stop processing dst ports when we encounter a suffix keyword, hence the exception parser 'except' below...
	const extAcl_ports_dst = seqOf(
		operator,
		many(except(suffix_keyword, 
			extAcl_service
		)).map(joinWith('|'))
	).map(joinWith(''))
 
 
	// the stuff that comes after src & dst in an ext ACL...
	const extAclSuffix = oneOf(
		tok('log').map(()=>`logged`),
		seqOf('mirror session', hword).map((res)=>`mirror:${res[1]}`),
		tok('tracked').map(()=>`tracked`),
		seqOf('ttl', operator, digits).map(joinWith('')),
		seqOf('dscp', hword).map((res)=>`dscp:${res[1]}`),
		tok('ecn', hword).map((res)=>`ecn:${res[1]}`),
		seqOf('inner ip', aclNetwork, aclNetwork).map((res)=>`innerIP(src:${res[1]} dst:${res[2]})`),
		'fragments',
		// 		seqOf('payload',  log
	)
 
 
	// anything after the 'permit', or 'deny' in an extended ACL entry
	const restOf_extAcl	=	seqOf( 
		extAcl_proto.tag('proto'),														// 'ip', 'tcp', 'udp', 'icmp', etc.
		aclNetwork.tag('srcNet'),
		possibly(extAcl_ports_src.tag('srcPorts')),
		aclNetwork.tag('dstNet'),
		possibly(extAcl_ports_dst.tag('dstPorts')),
		many(extAclSuffix).map(joinWith('|')).tag('flags'),
		//		possibly(strng('log')).map(asBoolean).tag('isLogged'),
		//		possibly(strng('tracked')).map(asBoolean).tag('isTracked'),
	)
 
	// extAcl-specific line-level parsers...
	const extAcl_header				= parseLine('ip access-list', aclName).map((result)=>result[1]).named('extAcl_header')
	const extAclEntry_permit	=	parseLine( aclSeqNo.tag('seqNo'), 'permit', restOf_extAcl).named('extAclEntry_permit')
	const extAclEntry_deny		=	parseLine( aclSeqNo.tag('seqNo'), 'deny', restOf_extAcl).named('extAclEntry_deny')
 
	// match any possible line within an extended ACL...
	const extAcl_entry = oneOf(
		aclEntry_remark.map(addTag('action', 'remark')),
		extAclEntry_permit.map(addTag('action', 'permit')),
		extAclEntry_deny.map(addTag('action', 'deny')),
		aclEntry_stats_per_entry,
		aclEntry_unknown.logResult( (line) => (`${deviceName}: ${pmodule.name}, [extAcl_entry]: the line '${line}' does not match any parser in the list`) ),
	)
 
 
	// record-level parser for an entire single extended ACL
	const extAcl_record = seqOf(
		parseSection(seqOf(
			extAcl_header.tag('aclName'),
			succeedWith('extended').tag('aclType'),
			many(extAcl_entry).tagList('aclEntries'),
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
				`${deviceName}: [module:${pmodule.name}, parser:extAcl_record]: The section parser generated the following logs (note that indices below are relative to the parent index ${section_index_start}:`,
				section_parser_dataLog.map( (entry) => `  ${entry}` ),
			] : [],
			// if the section parser skips text for any reason, report it...
			(section_text_unparsed?.length > 0) ? [
				`${deviceName}: [module:${pmodule.name}, parser:extAcl_record]: The section parser did not parse entire section, starting from index ${section_index_termination}, and stopping at ${section_index_parseduntil}.  Skipped text is below:`,
				`  '${section_text_unparsed}'`,
			] : [],
		]))
 
	return {
		extAcl_record
	}
 
}
 
 
/*********************************************************************************
	* Module:			eos_cfg_acl
	* Version:		3.0
	* Parameters:	deviceName: string
	* Description: Parses a single arista configuration file acls.	Does not flatten into per-entry (yet)
	* Caveats:	?
	* Output:
	* 	{
	* 		"extended": [  
	* 			...list of extended ACL records)
	* 		],
	* 		"standard: [
	* 			...list of standard ACL records
	* 		]"
	* 	}
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
const eos_cfg_acls = (deviceName) => {
	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'eos_cfg_acl',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									// future capability
		usage: '',								// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: null,
	}
 
 
	const { stdAcl_record } = eos_cfg_acl_std(deviceName)
	const { extAcl_record } = eos_cfg_acl_ext(deviceName)
 
	const acl_record = (deviceName) => oneOf(
		stdAcl_record,
		extAcl_record,
	)
 

	const formatColumns_std = ({
		aclName,
		...rest
	}) => ({
		deviceName,
		aclName,
		rest: `(${pmodule.name}): ${(Object?.keys(rest ?? {}) ?? '').join(',')}`,
	})


	const formatColumns_ext = ({
		aclName,
		...rest
	}) => ({
		deviceName,
		aclName,
		rest: `(${pmodule.name}): ${(Object?.keys(rest ?? {}) ?? '').join(',')}`,
	})


 
	return seqOf(
		gotoSection('ip access-list'),
		many(acl_record(deviceName))
	).map( _1 )
		.map(flattenArray)
		.map(groupByPropName('aclType'))
//		.map(({std,ext})=>({
//			std:formatColumns_std(std),
//			ext:formatColumns_ext(ext)
//		}))
		// .dataLog_toResult below changes the return format to { result, dataLog } instead of a result
		// use this for production, but comment out when running in IDE, because the Popout doesn't consider it when 
		// printing out the tables
		// .dataLog_toResult()
}
 
 
// comment this out when using in production
//	eos_cfg_acls('test_device_name')
 
 
// comment this out when using in-browser IDE


export { 
	eos_cfg_acls,
//	eos_cfg_acls_std,
//	eos_cfg_acls_ext,
}


 
 
 
 