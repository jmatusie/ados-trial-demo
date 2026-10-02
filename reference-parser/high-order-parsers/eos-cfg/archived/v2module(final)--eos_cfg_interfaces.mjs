/**
 * @todo: these are unhandled interface lines as of 15-Feb-2024:
 * no autostate
 * channel-group recirculation <num>
 * dhcp server ipv4
 * evpn ethernet-segment
 * ip address unnumbered <interface>
 * ip address virtual 10.10.10.254/24
 * ip igmp
 * ip igmp host-proxy access-list <aclName>
 * ip igmp host-proxy report-interval <number)
 * ip igmp host-proxy version <ver>
 * ip igmp last-member-query-interval <number>
 * ip igmp query-interval <number>
 * isis enable <hword>
 * mpls ldp interface
 * multicast ipv4 source route export
 * multicast ipv4 static
 * no autostate
 * no lldp receive
 * no ntp serve
 * no queue-monitor length
 * no vrrp <id> peer authentication
 * node-segment ipv4 index <num> flex-algo <hword>
 * node-segment ipv4 index <num>
 * ntp serve
 * pim ipv4 local-interface Loopback201
 * pim ipv4 neighbor filter <hword>
 * ptp announce interval <number>
 * ptp delay-req interval <number>
 * ptp pdelay-req interval <number>
 * ptp sync-message interval <number>
 * service-policy type pbr input <hword>
 * service-policy type qos input <hword>
 * shape rate <number>
 * switchport recirculation features cpu-mirror
 * switchport tap default group <hword>
 * switchport tool group set <hword>
 * traffic-engineering min-delay static <number> microseconds
 * traffic-loopback source system device mac
 * transceiver channel <number>
 * Tunnel<number>
 * vrrp <groupNum> advertisement interval <number>
 * vrrp <groupNum> session description <text>
 * vxlan flood vtep <IP>
 * vxlan multicast routing ipv4
 * vxlan source-interface <loopbackInt>
 * vxlan udp-port 4789
 * vxlan vlan <number> vni <number>
 * vxlan vlan <number> flood vtep 198.19.0.4
 * vxlan vrf <hword> vni <number>
 * vxlan vrf <hword> multicast group <mcIP>
 * Vxlan1
 */


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
} from '../parser_modules.mjs'



/*********************************************************************************
 * Module:      eos_cfg_interfaces
 * Version:     3.0
 * Parameters:  deviceName: string
 * Description: Parses all BGP content for a single NXOS device
 * Caveats:     ?
 * Output:      normalized dictionary: 
 * {
 * 	"interface-name",		//	interface name
 * 	"description", 			//	inerface description
 * 	"noSwitchPortCmd"?  //	flagged if defined in config,
 * 	"ipAddr",    				//	ip address and mask,
 * 	"ipPimSparseMode",  //	flag,
 * 	"ipAclIn",   				//	name of security ACL (inbound)
 * 	"ipMcAcl",   				//	name of multicast boundary ACL (outbound) 
 * 	"nativeVlan",   		//	native VLAN (if defined in config)
 * 	"allowedVlans",   	//	allowed VLANs (if defined in config)
 * 	"switchPortMode",  	//	flag if defined in config
 * 	"portChannel",  		//	flag if defined in config
 * 	"shutdown",    			//	flag if defined in config
 * 	"vrrpAddr",    			//	virtual router address
 * }
 *
 */
const eos_cfg_interfaces = (deviceName) => {

	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'eos_cfg_interfaces',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									  // future capability
		usage: '',							  	// future capability to provide help (may not be used)
	}


	/** SECTION 2: local result helpers to make code more readable (arguably).  ****
 *  These are candidates for possibly moving into an external module 
 */
	const _0 = (arr) => arr[0]		// these get values out of arrays at the supplied index
	const _1 = (arr) => arr[1]
	const _2 = (arr) => arr[2]
	const _3 = (arr) => arr[3]
	const isTrue = (res) => true  // tags the existence of a result as 'true' - for flags (i.e. if xyz is parsed, xyz is true)



	/** SECTION 3: local token-level parsers ****
 *  Some of these are existing very general parsers, but renamed for semantics only
 *  If they need to be changed to more restrictive parsers, they can be done using the local name instead of replacing references
 *  througout the code
 */
	const eosCommentLine1  = parseLine( '#', rol)
	const eosCommentLine2  = parseLine( _, '!', rol)
	const interfaceHeader = parseLine('interface', interfaceName).map((result)=>result[1])
	const interfaceHeader_UNK = parseLine('interface', rol).map((result)=>result[1])
	const desc						= parseLine('description', rol ).map((result)=>result[1])
	const ipAddr					= parseLine('ip address', ipAddress, '/', digits).map( ([, ip_addr, , ip_masklen])=>({ip_addr, ip_masklen}) )
	const ipAddr2					= parseLine('ip address', ipNetwork).map((result)=> {
		const [ipaddr, ipMaskLen] = result[1].split('/')
		const returnVal = result[1]
		return ipMaskLen
	})
	const shutdn 					= parseLine('shutdown').map((result)=>true)
	const noshutdn 				= parseLine('no shutdown').map((result)=>true)
	const channelMember		= parseLine('channel-group', digits).map((result)=>result[1])
	
	const switchPort			= parseLine('switchport', eol).map((result)=>true)
	const noSwitchPort		= parseLine('no switchport').map((result)=>true)
	const switchPortMode	= parseLine('switchport mode', word).map((result)=>result[1])
	const switchPortTrunk	= parseLine('switchport trunk', rol).map((result)=>result[1])
	const switchPortAccess= parseLine('switchport access', rol).map((result)=>result[1])
	const nativeVlan			= parseLine('switchport trunk native vlan', digits).map((result)=>result[1])
	const allowedVlans		=	parseLine('switchport trunk allowed vlan', rol).map((result)=>result[1].split(',').join('|'))
	const accessVlan			= parseLine('switchport access vlan', digits).map((result)=>result[1])
		
	const stp_bpdufilter 	= parseLine('spanning-tree bpdufilter', hword).map((result)=>result[1])
	const stp_portfast 		= parseLine('spanning-tree portfast').map((result)=>true)
	const stp_bpduguard		= parseLine('spanning-tree', 'bpduguard', 'enable').map((result)=>true)
	
	const vrf							=	parseLine('vrf', hword).map((result)=>result[1])
	const vrf_2						=	parseLine('vrf forwarding', hword).map((result)=>result[1])
	const dot1q						= parseLine('encapsulation dot1q vlan', digits).map((result)=>result[1])
	const ipAclIn					= parseLine('ip access-group', hword, 'in').map((result)=>result[1])
	const ipAclout				= parseLine('ip access-group', hword, 'out').map((result)=>result[1])
	
	const ipMcAcl_out			= parseLine('ip multicast boundary', hword, 'out').map((result)=>result[1])
	const ipMcAcl_out_2		= parseLine('multicast ipv4 boundary', hword, 'out').map((result)=>result[1])
	const ipMcAcl					= parseLine('ip multicast boundary', hword).map((result)=>result[1])
	const ipMcAcl_2				= parseLine('multicast ipv4 boundary', hword).map((result)=>result[1])
	const ipPimSparseMode	= parseLine('ip pim sparse-mode').map((result)=>true)
	const ipPimSparseMode_2=parseLine('pim ipv4 sparse-mode').map((result)=>true)
	const ipPimBorder			= parseLine('pim ipv4 border-router').map((result)=>true)
	const ipPimBorder_2		= parseLine('pim ipv4 border').map((result)=>true)
	const ipPimBsrBorder	= parseLine('ip pim bsr-border').map((result)=>true)
	const ipPimBsrBorder_2= parseLine('pim bsr ipv4 border').map((result)=>true)
	const ipPimDrPriority	= parseLine('pim ipv4 dr-priority', digits).map((result)=>result[1])
	
	// these return true/false beacause there could be multiple lines with 
	// these commands, which should be handled by a specialized parser
	const has_igmpStaticGrp = parseLine('ip igmp static-group').map((result)=>true)
	const has_igmpv2 				= parseLine('ip igmp version 2').map((result)=>true)
	const has_nat	 				  = parseLine('ip nat', rol).map((result)=>true)
	const has_helperAddress = parseLine('ip helper-address', ipAddress).map((result)=>true)
	
	const varpIP					= parseLine('ip virtual-router address', ipAddress).map((result)=>result[1])
	const vrrpIP					= parseLine('vrrp', digits, 'ipv4', ipAddress).map( ([, grp, , addr])  => `group:${grp},addr:${addr})` )
	const vrrpPriority		= parseLine('vrrp', digits, 'priority-level', digits).map( ([, grp, , pri ])  => `group:${grp},priority:${pri})` )
	
	const loadInterval		=	parseLine('load-interval', digits).map((result)=>result[1])
	const mlagID					= parseLine('mlag', digits).map((result)=>result[1])
	const vlanID					= parseLine('vlan id', digits).map((result)=>result[1])
	const ptpEnable				=	parseLine('ptp enable').map((result)=>true)
	const ptpRole					= parseLine('ptp role', hword).map((result)=>result[1])
	const ptpDelayMech		= parseLine('ptp delay-mechanism', hword).map((result)=>result[1])
	const ptpVlan					= parseLine('ptp vlan', digits).map((result)=>result[1])
	const flowControlRec	=	parseLine('flowcontrol', rol).map((result)=>null)
	const remaining				= parseLine(rol).map((result)=>null)
	const lldp_disabled		= parseLine('lldp disabled').map((result)=>true)
	const lldp_noTransmit	= parseLine('no lldp transmit').map((result)=>true)
	const mtu							= parseLine('mtu', digits).map((result)=>result[1])
	const speed						= parseLine('speed', rol).map((result)=>result[1])
	const queueMonitor		= parseLine('queue-monitor length thresholds', digits, digits).map( ([,,low,high])=>`${low},${high}`)
	const bfd							= parseLine('bfd', rol ).map((result)=>result[1])
	const mlag						= parseLine('mlag', digits).map((result)=>result[1])
	const traffic_shaping	= parseLine('shape rate', digits).map((result)=>result[1])
	const unknown				  = parseLine(rol).map((result)=>result[0]).named('unknown')


	const interfaceConfigLine =	oneOf(
	// general params (used by classifiers)
		desc.tag('desc'),
		ipAddr.tag('ip'),	
		shutdn.tag('is_shutdown'),
		noshutdn.tag('explicit_noshutdown'),
		switchPort.tag('explicit_switchPort').addTag('switchPort', true),
		noSwitchPort.tag('explicit_noswitchPort'),
		channelMember.tag('channelMember'),
	
		// layer 3 params
		ipAclIn.tag('ip_acl_in'),
		ipAclout.tag('ip_acl_out'),
		ipMcAcl_out.tag('ip_mc_acl_out'), 
		ipMcAcl_out_2.tag('ip_mc_acl_out'), 
		ipMcAcl.tag('ip_mc_acl'), 
		ipMcAcl_2.tag('ip_mc_acl'),
		ipPimSparseMode.tag('ip_pim_sparsemode'),
		ipPimSparseMode_2.tag('ip_pim_sparsemode'),
		ipPimBorder.tag('ip_pim_border'),
		ipPimBorder_2.tag('ip_pim_border'),
		ipPimBsrBorder.tag('ip_pim_bsr_border'),
		ipPimBsrBorder_2.tag('ip_pim_bsr_border'),
		ipPimDrPriority.tag('ip_pim_dr_priority'),
		varpIP.tag('varp_IP'),
		vrrpIP.tag('vrrp'),
		vrrpPriority.tag('vrrp_priority'),
		vrf.tag('vrf'),
		vrf_2.tag('vrf'),
	
		// layer 2 
		switchPortTrunk.tag('l2_trunk'),
		switchPortAccess.tag('l2_access'),
		switchPortMode.tag('switchPortMode'),
		nativeVlan.tag('nativeVlan'),		
		accessVlan.tag('accessVlan'),
		allowedVlans.tag('allowedVlans'),
		dot1q.tag('dot1q'),
		loadInterval.tag('loadInterval'),
		lldp_disabled.tag('lldpDisabled'),
		lldp_noTransmit.tag('lldpNoTx'),
		mlag.tag('mlag'),
		vlanID.tag('vlanID'),
	
		// spanning-tree
		stp_portfast.tag('stp_portfast'),
		stp_bpdufilter.tag('stp_bpdufilter'),
		stp_bpduguard.tag('stp_bpduguard'),
	
		// layer 1~ish
		mtu.tag('mtu'),
		speed.tag('speed'),
		queueMonitor.tag('queueMonitor'),
		bfd.tag('bfdCfg'),
		vlanID.tag('vlanID'),
		flowControlRec.tag('flowControlRec'),
	
		// ptp
		ptpEnable.tag('ptpEnable'),
		ptpRole.tag('ptpRole'),
		ptpDelayMech.tag('ptpDelayMechanism'),
		ptpVlan.tag('ptpVlan'),
	
		// boolean values, because these commands may be multiple per interface, so separate parser is warranted
		has_nat.tag('ip_has_nat_cfg'),
		has_helperAddress.tag('ip_has_dhcp_helper_cfg'),
		has_igmpStaticGrp.tag('ip_has_igmpStaticGrp_cfg'),
		has_igmpv2.tag('ip_has_igmpv2'),
		eosCommentLine1.tag('eos1'),
		eosCommentLine2.tag('eos2'),
		// any lines not captured by abobe parsers are tagged and logged
		unknown.logResult( (res) => `unrecognized text parsing interface configuration: '${res}'`)
		//		unknown.logResult( (res) => `[module:${pmodule.name}, parser:interfaceConfigLine]: unrecognized text': '${res}'`)
	).named('oneOf(interfaceConfigLines')

	
	// re-usable component that can plug into interface record parsers.
	// results in a single interface record object.
	const parseInterface = sequenceOf(
		oneOf(
			interfaceHeader.tag('interfaceName'),
			interfaceHeader_UNK.logResult((res) =>`unrecognized interface type '${res}'`)).tag('interfaceName'),
		many(interfaceConfigLine),
	).named('parseInterface')


	// example of record parser using indentation levels to terminate the record
	const interfaceRecord = seqOf(
		until(endOfIndentLevel, parseInterface),
		parseLine('!'),					// <-- note that there is a '!' on a line by itself after we return to the same indentation level.  We need to explicitly consume it
	).logEnv( ({
		section_index_start,
		section_index_parseduntil, 
		section_index_termination,
		section_text_unparsed,
		section_parser_dataLog,
		// section_text,          // unused here, but available if needed
		// section_text_parsed,   // unused here, but available if needed
	}) => ([
		// if the section parser has logs, make sure we pull them from the environment, but return empty if not
		(section_parser_dataLog?.length > 0) ? [
			`${deviceName}: [${pmodule.name}::interfaceRecord]: The sub-parser 'parseInterface' generated the following logs (note that indices below are relative to the parent index ${section_index_start}:`,
			//`[interfaceRecord]: the parser function '[parseInterface]' generated the following logs (note that indices below are relative to the parent index ${section_index_start}:`,
			section_parser_dataLog.map( (entry) => `  ${entry}` ),
		] : [],
		// if the section parser skips text for any reason, report it...
		(section_text_unparsed?.length > 0) ? [
			`${deviceName}: [${pmodule.name}::interfaceRecord]: The sub-parser 'parseInterface' did not parse entire section, starting from index ${section_index_termination}, and stopping at ${section_index_parseduntil}.  Skipped text is below:`,
			`  '${section_text_unparsed}'`,
		] : [],

	])).getTaggedR()


	const formatColumns = ({
		interfaceName,
		ip_addr,
		ip_masklen,
		vrf,
		cfgState,
		ipType,
		hwType,
		portMode,
		type,
		desc,
		ip_has_nat_cfg,
		ip_has_igmpStaticGrp_cfg,
		ip_acl_in,
		ip_acl_out,
		ip_mc_acl_out,
		ip_mc_acl,
		ip_pim_sparsemode,
		ip_pim_border,
		ip_pim_dr_priority,
		ip_pim_bsr_border,
		ptpEnable,
		ptpDelayMechanism,
		ptpRole,
		varp_IP,
		flowControlRec,
		lldpNoTx,
		loadInterval,
		enabled,
		stp_bpduflter,
		ip_has_dhcp_helper_cfg,
		dot1q,
		speed,
		bfdCfg,
		queueMonitor,
		vrrp_priority,
		vrrp,
		l2_trunk,
		switchPortMode,
		channelMember,
		is_shutdown = false,
		UNK_arista_cfg_interface,

		explicit_noswitchPort,
		explicit_noshutdown,
		explicit_shutdown,

		...rest
	}) => ({
		deviceName,
		interfaceName,
		ip_addr,
		ip_masklen,
		vrf,

		ipType: is.empty(ip_addr) ? ''
		: parseInt(ip_masklen) == 32 ? 'loopback'
		: parseInt(ip_masklen) >= 30 ? 'transit'
		: parseInt(ip_masklen) >= 29 ? 'hybrid'
		: 'access',

		type: (interfaceName==null) ? `${deviceName}:nullInterfaceName(${interfaceName})` 
		: interfaceName.split('.').length > 1 ? 'subint'
		: /management/i.test(interfaceName) ? 'management'
		: /channel/i.test(interfaceName) ? 'ethernet-channel'
		: /ethernet/i.test(interfaceName) ? 'ethernet'
		: /loopback/i.test(interfaceName) ? 'loopback'
		: /vlan/i.test(interfaceName) ? 'svi'
		: /vxlan/i.test(interfaceName) ? 'vxlan'
		: /tunnel/i.test(interfaceName) ? 'tunnel'
		: 'unclassified',

		cfgState:	(explicit_noshutdown) ? 'admin-up' : (is_shutdown) ? 'admin-down' : 'admin-up',

		portMode: (type == 'loopback') ? ''
		: explicit_noswitchPort ? 'L3'
		: type == 'subint' ? 'L3'
		: type == 'svi' ? 'L3'
		: 'L2',

		desc,
		ip_has_nat_cfg,
		ip_has_igmpStaticGrp_cfg,
		ip_acl_in,
		ip_acl_out,
		ip_mc_acl_out,
		ip_mc_acl,
		ip_pim_sparsemode,
		ip_pim_border,
		ip_pim_dr_priority,
		ip_pim_bsr_border,
		ptpEnable,
		ptpDelayMechanism,
		ptpRole,
		varp_IP,
		flowControlRec,
		lldpNoTx,
		loadInterval,
		enabled,
		stp_bpduflter,
		ip_has_dhcp_helper_cfg,
		dot1q,
		speed,
		bfdCfg,
		queueMonitor,
		vrrp_priority,
		vrrp,
		l2_trunk,
		switchPortMode,
		channelMember,
		is_shutdown,
		UNK_arista_cfg_interface,
		rest: `(${pmodule.name}): ${(Object?.keys(rest ?? {}) ?? '').join(',')}`,
	})
	

	const eos_cfg_interfaces = sequenceOf(
		gotoSection('interface'),
		many(interfaceRecord).tagList('interfaces'),
	).getTaggedR()
		.map(multiplyBy('interfaces'))
		.map(mapArray(flattenItemRecursively))
		.map(mapArray(formatColumns))
		// .dataLog_toResult()			// <<-- this changes the return format to { result, dataLog } instead of a result

	return eos_cfg_interfaces
}


// comment this out when using in production
// eos_cfg_interfaces('sampledevicename')

// comment this out when using in-browser IDE
export { eos_cfg_interfaces }


