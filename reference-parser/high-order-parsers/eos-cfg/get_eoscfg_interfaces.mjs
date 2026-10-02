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
 * Module:      get_eoscfg_interfaces
 * Version:     3.0
 * Parameters:  deviceName: string
 * Description: Parses all BGP content for a single NXOS device
 * Caveats:     ?
 * Output:      normalized dictionary: 
 * {
 *    // this is a @todo
 * }
 *
 */

/** SECTION 1: module metadata ****/
const pmodule = {
	name: 'get_eoscfg_interfaces',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
	ver: 1.0,									  // future capability
	usage: '',							  	// future capability to provide help (may not be used)
}


const get_eoscfg_interfaces = (deviceName) => {

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
	// const eosComment1  = parseLine( '#', rol).debug()
	// const eosComment2  = parseLine( _, '!', rol).debug()
	const interfaceHeader_KNOWN = parseLine('interface', interfaceName).map((result) => result[1])
	const interfaceHeader_UNKNOWN = parseLine('interface', rol).map((result) => result[1])
	
	// common & important configs
	const desc 					= parseLine('description', rol).map((result) => result[1])
	const ipAddr_wMask 	= parseLine('ip address', ipAddress.tag('ip_addr'), '/', digits.tag('ip_masklen'))
	const ipUnnumbered 	= parseLine('ip address unnumbered', interfaceName).map((result) => result[1])
	const ipAddrVirtual 		= parseLine('ip address virtual', ipAddress).map((result)=>result[1])
	const shutdn 				= parseLine('shutdown').map(isTrue)
	const noShutdn			= parseLine('no shutdown').map(isTrue)
	const vrf 					= parseLine('vrf', hword).map((result) => result[1])
	const vrf_legacy 		= parseLine('vrf forwarding', hword).map((result) => result[1])
	const encapsDot1q 	= parseLine('encapsulation dot1q vlan', digits).map((result) => result[1])
	const ipAclIn 			=	parseLine('ip access-group', hword, 'in').map((result) => result[1])
	const ipAclout 			=	parseLine('ip access-group', hword, 'out').map((result) => result[1])

	// L2 common & important configs:
	const switchPort 									= parseLine('switchport', eol).map(isTrue)
	const noSwitchPort 								= parseLine('no switchport').map(isTrue)
	const switchportMode 							= parseLine('switchport mode', word).map((result) => result[1])
	const switchPortAccessVlan 				= parseLine('switchport access vlan', digits).map((result) => result[1])
	const switchPortTrunkNativeVlan 	= parseLine('switchport trunk native vlan', digits).map((result) => result[1])
	const switchportTrunkGroup 				= parseLine('switchport trunk group', hword).map((result) => result[1])
	const switchPortTrunkAllowedVlans = parseLine('switchport trunk allowed vlan', rol).map((result) => result[1].split(',').join('|'))
	const switchPortAccessOther 			= parseLine('switchport access', rol).map((result) => result[1])
	const switchPortTrunkOther 				= parseLine('switchport trunk', rol).map((result) => result[1])

	// MCAST / PIM / IGMP
	const ipMcastBoundaryIn 				= parseLine('multicast ipv4 boundary', hword).map((result) => result[1])
	const ipMcastBoundaryIn_legacy 	= parseLine('ip multicast boundary', hword).map((result) => result[1])
	const ipMcastBoundaryOut 				= parseLine('multicast ipv4 boundary', hword, 'out').map((result) => result[1])
	const ipMcastBoundaryOut_legacy = parseLine('ip multicast boundary', hword, 'out').map((result) => result[1])
	const ipPimSparseMode 					= parseLine('pim ipv4 sparse-mode').map(isTrue)
	const ipPimSparseMode_legacy 		= parseLine('ip pim sparse-mode').map(isTrue)
	const ipPimDrPriority 					= parseLine('pim ipv4 dr-priority', digits).map((result) => result[1])
	const ipPimNeighFilter 					= parseLine('pim ipv4 neighbor filter ', hword).map(res => res[1])
	const ipPimNeighFilter_legacy		= parseLine('ip pim neighbor-filter', hword).map(res => res[1])
	const ipPimBorder 							= parseLine('pim ipv4 border').map(isTrue)
	const ipPimBorder_legacy 				= parseLine('pim ipv4 border-router').map(isTrue)
	const ipPimBsrBorder 						= parseLine('pim bsr ipv4 border').map(isTrue)
	const ipPimBsrBorder_legacy 		= parseLine('ip pim bsr-border').map(isTrue)
	const ipIgmpVersion 						= parseLine('ip igmp version', digits).map((result)=>result[1])

	// Flag only (for further config fetching)
	const hasIgmpStaticGroupConfig= parseLine('ip igmp static-group').map(isTrue)
	const hasIgmpHostProxyConfig 	= parseLine('ip igmp host-proxy').map(isTrue)
	const hasNatConfig 						= parseLine('ip nat', rol).map(isTrue)
	const hasDhcpClientConfig 		= parseLine('ip address dhcp').map(isTrue)
	const hasDhcpServer 					= parseLine('dhcp server ipv4').map(isTrue)
	const hasIPHelperAddress 			= parseLine('ip helper-address', ipAddress).map(isTrue)
	const hasEvpnConfig 					= parseLine('evpn', rol).map(isTrue)
	const hasVxLan 								= parseLine('vxlan', rol).map(isTrue)
	const hasTrafficEngConfig 		= parseLine('traffic-engineering', rol).map(isTrue)
	const hasTunnelConfig 				= parseLine('tunnel', rol).map(isTrue)
	const hasOSPFConfig 					= parseLine('ip ospf').map(isTrue)
	const hasMplsConfig 					= parseLine('mpls', rol).map(isTrue)
	const hasSegmentRoutingConfig = parseLine('node-segment', rol).map(isTrue)
	const hasISISConfig 					= parseLine('isis', rol).map(isTrue)

	
	// FHRP items:
	const varpIP 									= parseLine('ip virtual-router address', ipAddress).map((result) => result[1])
	const vrrpIP 									= parseLine('vrrp', digits.tag('vrrp_id'), 'ipv4', ipAddress.tag('vrrp_ip'))
	const vrrpPriority 						= parseLine('vrrp', digits.tag('vrrp_id'), 'priority-level', digits.tag('vrrp_priority'))
	const vrrpSessionDesc 				= parseLine('vrrp', digits.tag('vrrp_id'), 'session description', rol.tag('vrrp_desc'))
	const vrrpOther								=	parseLine('vrrp', rol).map((result)=>result[1])

	// STP
	const stpPortfast 						= parseLine('spanning-tree portfast').map(isTrue)
	const stpBpduFilter 					= parseLine('spanning-tree bpdufilter', hword).map((result) => result[1])
	const stpBpduGuard 						= parseLine('spanning-tree', 'bpduguard', 'enable').map(isTrue)
	const channelGroup 						= parseLine('channel-group', digits).map((result) => result[1])

	// ptp items:
	const ptpEnable 							= parseLine('ptp enable').map(isTrue)
	const ptpRole 								= parseLine('ptp role', hword).map((result) => result[1])
	const ptpDelayReqIntvl= parseLine('ptp delay-req interval', hword).map((result)=>result[1])
	const ptpDelayMech 						= parseLine('ptp delay-mechanism', hword).map((result) => result[1])
	const ptpSyncInterval 				= parseLine('ptp sync-message interval', hword).map((result) => result[1])
	const ptpVlan									= parseLine('ptp vlan', digits).map((result) => result[1])
	const ptpOther								=	parseLine('ptp', rol).map(isTrue)

	// lldp items:
	const lldpDisabled 						= parseLine('lldp disabled').map(isTrue)
	const lldpNoTx 								= parseLine('no lldp transmit').map(isTrue)
	const lldpNoRx 								= parseLine('no lldp receive').map(isTrue)
	const lldpOther								=	parseLine('lldp', rol).map(isTrue)

	// miscellaneous items:
	const flowControl							= parseLine('flowcontrol', rol).map(isTrue)
	const noAutostate 						= parseLine('no autostate').map(isTrue)
	const speed 									= parseLine('speed', rol).map((result) => result[1])
	const bfd 										= parseLine('bfd', rol).map((result) => result[1])
	const loadInterval 						= parseLine('load-interval', digits).map((result) => result[1])
	const mtu 										= parseLine('mtu', digits).map((result) => result[1])
	const hasServicePolicyConfig 	= parseLine('service-policy', rol).map(isTrue)

	// believed to be EOS only:
	const shaping 								= parseLine('shape rate', digits).map(isTrue)
	const vlanId 									= parseLine('vlan id', digits).map((result) => result[1])
	const queueMonitor 						= parseLine('queue-monitor length thresholds', digits, digits).map(([, , low, high]) => `${low},${high}`)
	const mlagId 									= parseLine('mlag', digits).map((result) => result[1])

	const eosComment = parseLine('!', rol).map( (result) => result[1] )
	const eosCommentHash = parseLine('#', rol).map((result)=>result[1]).logResult( (result)=>`${deviceName}:[${pmodule.name}:eosCommentHash]: Hashcode found in EOS config: '#${result}'`)

	const unparsed = parseLine(rol).map((result) => result[0]).named('unknown')
	

	// any matches to these parsers are thrown (which happens by default for any parsers with untagged data)
	const ignored = [
		eosComment,
		eosCommentHash,
		parseLine('switchport tool group', rol),	//.logResult( ([part1,part2])=>`[${pmodule.name}]: intentionally ignoreed text '${part1} ${part2}'`),
		parseLine('traffic-loopback', rol),	//.logResult( ([part1,part2])=>`[${pmodule.name}]: intentionally ignoreed text '${part1} ${part2}'`),
		parseLine('channel-group recirculation', rol),	//.logResult( ([part1,part2])=>`[${pmodule.name}]: intentionally ignoreed text '${part1} ${part2}'`),
		parseLine('switchport recirculation', rol),	//.logResult( ([part1,part2])=>`[${pmodule.name}]: intentionally ignoreed text '${part1} ${part2}'`),
		parseLine('no ntp server', rol),	//.logResult( ([part1,part2])=>`[${pmodule.name}]: intentionally ignoreed text '${part1} ${part2}'`),
		parseLine('no vrrp ', digits, 'peer authentication', rol),	//.logResult( ([part1,part2])=>`[${pmodule.name}]: intentionally ignoreed text '${part1} ${part2}'`),
		parseLine('ptp announce', rol),	//.logResult( ([part1,part2])=>`[${pmodule.name}]: intentionally ignoreed text '${part1} ${part2}'`),
		parseLine('ptp sync-message interval', rol),	//.logResult( ([part1,part2])=>`[${pmodule.name}]: intentionally ignoreed text '${part1} ${part2}'`),
		parseLine('ptp delay-req', rol),	//.logResult( ([part1,part2])=>`[${pmodule.name}]: intentionally ignoreed text '${part1} ${part2}'`),
		parseLine('ptp pdelay-req', rol),	//.logResult( ([part1,part2])=>`[${pmodule.name}]: intentionally ignoreed text '${part1} ${part2}'`),
		parseLine('transceiver', rol),	//.logResult( ([part1,part2])=>`[${pmodule.name}]: intentionally ignoreed text '${part1} ${part2}'`),
		parseLine('no error-correction', rol),	//.logResult( ([part1,part2])=>`[${pmodule.name}]: intentionally ignoreed text '${part1} ${part2}'`),
		parseLine('error-correction', rol),	//.logResult( ([part1,part2])=>`[${pmodule.name}]: intentionally ignoreed text '${part1} ${part2}'`)
		parseLine('ip igmp last-member-query-interval'),
	]


	const interfaceConfigLine = oneOf(
		// general / common params:
		desc.tag('desc'),
		ipAddr_wMask,			// already tagged
		ipUnnumbered.tag('ip_unnumbered'),
		ipAddrVirtual.tag('ip_addr_virtual'),
		shutdn.tag('has_shutdown'),
		noShutdn.tag('has_noshutdown'),
		vrf.tag('vrf'),
		vrf_legacy.tag('vrf'),
		encapsDot1q.tag('dot1q'),
		ipAclIn.tag('ip_acl_in'),
		ipAclout.tag('ip_acl_out'),

		// L2 common & important configs:
		switchPort.tag('explicit_switchport').addTag('is_switchport', true),
		noSwitchPort.tag('explicit_no_switchport'),
		switchportMode.tag('l2_mode'),
		switchPortAccessVlan.tag('l2_access_vlan'),
		switchPortTrunkNativeVlan.tag('l2_native_vlan'),
		switchportTrunkGroup.tag('trunk_group'),
		switchPortTrunkAllowedVlans.tag('l2_allowed_vlan'),
		switchPortAccessOther.tag('l2_access_UNK'),
		switchPortTrunkOther.tag('l2_trunk_UNK'),

		// MCAST / PIM / IGMP
		ipMcastBoundaryIn.tag('ip_mc_acl'), 
		ipMcastBoundaryIn_legacy.tag('ip_mc_acl'), 		
		ipMcastBoundaryOut.tag('ip_mc_acl_out'), 
		ipMcastBoundaryOut_legacy.tag('ip_mc_acl_out'), 
		ipPimSparseMode.tag('ip_pim_sparsemode'),
		ipPimSparseMode_legacy.tag('ip_pim_sparsemode'),
		ipPimDrPriority.tag('ip_pim_dr_priority'),
		ipPimNeighFilter.tag('ip_pim_neighbor_filter'),
		ipPimNeighFilter_legacy.tag('ip_pim_neighbor_filter'),
		ipPimBorder.tag('ip_pim_border'),
		ipPimBorder_legacy.tag('ip_pim_border'),
		ipPimBsrBorder.tag('ip_pim_bsr_border'),
		ipPimBsrBorder_legacy.tag('ip_pim_bsr_border'),
		ipIgmpVersion.tag('igmp_version'),

		// Flag only (for further config fetching)
		hasIgmpStaticGroupConfig.tag('hascfg_igmp_static'),
		hasIgmpHostProxyConfig.tag('hascfg_igmp_host_proxy'),
		hasNatConfig.tag('hascfg_nat'),
		hasDhcpClientConfig.tag('hascfg_dhcp_client'),
		hasDhcpServer .tag('hascfg_dhcp_server'),
		hasIPHelperAddress.tag('hascfg_dhcp_proxy'),
		hasEvpnConfig.tag('hascfg_evpn'),
		hasVxLan.tag('hascfg_vxlan'),
		hasTrafficEngConfig.tag('hascfg_te'),
		hasTunnelConfig.tag('hascfg_tunnel'),
		hasOSPFConfig.tag('hascfg_ospf'),
		hasMplsConfig.tag('hascfg_mpls'),
		hasSegmentRoutingConfig.tag('hascfg_sr'),
		hasISISConfig.tag('hascfg_isis'),

		// FHRP items:
		varpIP.tag('varp_ip'),
		vrrpIP.tag('vrrp_ip'),
		vrrpPriority.tag('vrrp_priority'),
		vrrpSessionDesc.tag('vrrp_desc'),
		vrrpOther.tag('vrrp_UNK'),

		// spanning-tree:
		stpPortfast.tag('stp_portfast'),
		stpBpduFilter.tag('stp_bpdufilter'),
		stpBpduGuard.tag('stp_bpduguard'),
		channelGroup.tag('channel_group'),

		// ptp
		ptpEnable.tag('ptp_enabled'),
		ptpRole.tag('ptp_role'),
		ptpDelayReqIntvl.tag('ptp_delay_req_interval'),
		ptpDelayMech.tag('ptp_delay_mech'),
		ptpSyncInterval.tag('ptp_sync_interval'),
		ptpVlan.tag('ptp_vlan'),
		ptpOther.tag('ptp_UNK'),

		// lldp items:
		lldpDisabled.tag('lldp_disabled'),
		lldpNoTx.tag('lldp_no_tx'),
		lldpNoRx.tag('lldp_no_rx'),
		lldpOther.tag('lldp_UNK'),

		// miscellaneous items:
		flowControl.tag('hascfg_flowcontrol'),
		speed.tag('speed'),
		bfd.tag('bfd_cfg'),
		noAutostate.tag('no_autostate'),
		loadInterval.tag('load_interval'),
		mtu.tag('mtu'),
		hasServicePolicyConfig.tag('has_svc_policy_cfg'),

		// believed to be EOS only:
		shaping.tag('has_shaping_cfg'),
		vlanId.tag('vlan_id'),
		queueMonitor.tag('queue_monitor'),
		mlagId.tag('mlag_id'),

		// parse & discard (i.e. dont' tag) those in the 'ignored' list
		...ignored,

		// any lines not captured by above parsers are tagged and logged
		unparsed.logResult((res) => `${deviceName}: [${pmodule.name}::interfaceConfigLine]: Unrecognized text parsing interface configuration: '${res}')`).tag('UNK_eosos_cfg_interface')
	).named('oneOf(interfaceConfigLines')


	// whether we are already aware of the interfacename or not, we're including it.
	const interfaceHeader = oneOf(
		interfaceHeader_KNOWN,
		interfaceHeader_UNKNOWN.logResult((res) => `${deviceName}: [${pmodule.name}::interfaceHeader] Unrecognized interface type '${res}'`)
	)


	const parseInterface = sequenceOf(
		interfaceHeader.tag('interfaceName'),
		many(interfaceConfigLine),
	).named('parseInterface')


	// This addresses a problem when encountering interface names, but no config after them. 
	const interfaceRecord_noconfig = sequenceOf(
		interfaceHeader.tag('interfaceName'),
		strng('!\n')
	).getTaggedR()


	// example of record parser using indentation levels to terminate the record
	const interfaceRecord_configured = seqOf(
		until(endOfIndentLevel, parseInterface),
		parseLine('!'),					// <-- Why do we have this?   Because after we reach the endOfIndentLevel, this is what's there by itself in Arista EOS. '
	).logEnv(({
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
			section_parser_dataLog.map((entry) => `  ${entry}`),
		] : [],
		// if the section parser skips text for any reason, report it...
		(section_text_unparsed?.length > 0) ? [
			`${deviceName}: [${pmodule.name}::interfaceRecord]: The sub-parser 'parseInterface' did not parse entire section, starting from index ${section_index_termination}, and stopping at ${section_index_parseduntil}.  Skipped text is below:`,
			`  '${section_text_unparsed}'`,
		] : [],

	])).getTaggedR()


	const interfaceRecord = oneOf(
		interfaceRecord_configured,
		interfaceRecord_noconfig  // see the note above - this is a hack for interfaces that have zero config lines after them
	)

	const classifyIntfType = ({ interfaceName, ...rest }) => ({
		interfaceName,
		...rest,
		type: (interfaceName == null) ? `nullInterfaceName(${interfaceName})`
			: interfaceName.split('.').length > 1 ? 'subint'
			: /mgmt/i.test(interfaceName) ? 'management'
			: /channel/i.test(interfaceName) ? 'ethernet-channel'
			: /ethernet/i.test(interfaceName) ? 'ethernet'
			: /loopback/i.test(interfaceName) ? 'loopback'
			: /vlan/i.test(interfaceName) ? 'svi'
			: /vxlan/i.test(interfaceName) ? 'vxlan'
			: /tunnel/i.test(interfaceName) ? 'tunnel'
			: 'unclassified',
	})


	const formatColumns = ({
		// common & important configs
		interfaceName,
		type,											// added by function 'classifyInteraceType'
		desc,
		ip_addr,
		ip_masklen,
		ip_unnumbered,
		has_shutdown = false,			// default in EOS if not configured on interface
		has_noshutdown,
		vrf,
		dot1q,
		ip_acl_in,
		ip_acl_out,

		// L2 common & important configs:
		explicit_switchport,
		explicit_no_switchport,
		is_switchport,
		l2_mode,
		l2_access_vlan,
		l2_native_vlan,
		trunk_group,
		l2_allowed_vlan,
		l2_access_UNK,
		l2_trunk_UNK,

		// MCAST / PIM / IGMP
		ip_mc_acl,
		ip_mc_acl_out,
		ip_pim_sparsemode,
		ip_pim_dr_priority,
		ip_pim_neighbor_filter,
		ip_pim_border,
		ip_pim_bsr_border,
		igmp_version,

		// Flag only (for further config fetching)
		hascfg_igmp_static,
		hascfg_igmp_host_proxy,
		hascfg_nat,
		hascfg_dhcp_client,
		hascfg_dhcp_server,
		hascfg_dhcp_proxy,
		hascfg_evpn,
		hascfg_vxlan,
		hascfg_te,
		hascfg_tunnel,
		hascfg_ospf,
		hascfg_mpls,
		hascfg_sr,
		hascfg_isis,

		// FHRP items:
		varp_ip,
		vrrp_id,		
		vrrp_ip,
		vrrp_priority,
		vrrp_desc,
		vrrp_UNK,

		// spanning-tree:
		stp_portfast,
		stp_bpdufilter,
		stp_bpduguard,
		channel_group,

		// ptp
		ptp_enabled,
		ptp_role,
		ptp_delay_req_interval,
		ptp_delay_mech,
		ptp_sync_interval,
		ptp_vlan,
		ptp_UNK,

		// lldp
		lldp_disabled,
		lldp_no_tx,
		lldp_no_rx,
		lldp_UNK,

		// miscellaneous items
		hascfg_flowcontrol,
		speed,
		bfd_cfg,
		no_autostate,
		load_interval,
		mtu,
		has_svc_policy_cfg,

		// believed to be EOS only
		has_shaping_cfg,
		vlan_id,
		queue_monitor,
		mlag_id,
		UNK_eosos_cfg_interface,

		// believed to be NX-OS only
		// ip_pim_jppolicy,
		// hsrp_preempt,
		// hsrp_ip,
		// hsrp_id,
		// hsrp_priority,
		// UNK_nxos_cfg_interface,

		...skipped
	}) => ({
		deviceName,
		interfaceName,
		ip_addr,
		ip_unnumbered,
		ip_masklen,
		vrf,
		type,
		admin_down: (has_shutdown) ? true : (has_noshutdown) ? false : false,
	
		ip_type: is.empty(ip_addr) ? ''
			: parseInt(ip_masklen) == 32 ? 'loopback'
				: parseInt(ip_masklen) >= 30 ? 'transit'
					: parseInt(ip_masklen) >= 29 ? 'hybrid'
						: 'access',
	
		port_mode: (type == 'loopback') ? ''
			: explicit_no_switchport ? 'L3'
				: type == 'subint' ? 'L3'
					: type == 'svi' ? 'L3'
						: 'L2',
	
		desc,
		hascfg_nat,
		ip_acl_in,
		ip_acl_out,

		// mcast interfaces
		ip_mc_acl_out,
		ip_mc_acl,
		ip_pim_sparsemode,
		ip_pim_border,
		ip_pim_dr_priority,
		ip_pim_bsr_border,
		ip_pim_neighbor_filter,
		hascfg_igmp_static,
		hascfg_igmp_host_proxy,
		igmp_version,

		// ptp interfacess
		ptp_enabled,
		ptp_delay_req_interval,
		ptp_delay_mech,
		ptp_sync_interval,
		ptp_role,
		ptp_vlan,

		hascfg_flowcontrol,
		lldp_no_tx,
		load_interval,
		
		dot1q,
		speed,
		bfd_cfg,
		varp_ip,
		vrrp_id,
		vrrp_ip,
		vrrp_priority,
		vrrp_desc,
		vlan_id,
		stp_portfast,
		stp_bpdufilter,
		stp_bpduguard,
		no_autostate,
		mtu,
		l2_mode,
		l2_native_vlan,
		l2_access_vlan,
		l2_allowed_vlan,
		l2_trunk_UNK,
		l2_access_UNK,
		trunk_group,
		channel_group,
		queue_monitor,

		// misc configuration flags (for further development)
		hascfg_dhcp_client,
		hascfg_dhcp_server,
		hascfg_dhcp_proxy,
		hascfg_evpn,
		hascfg_vxlan,
		hascfg_te,
		hascfg_tunnel,
		hascfg_ospf,
		hascfg_mpls,
		hascfg_sr,
		hascfg_isis,
		_key_: `${deviceName}:${interfaceName}`,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')}`
	})

	const get_eoscfg_interfaces = sequenceOf(
		gotoSection('interface'),
		many(interfaceRecord).tagList('interfaces'),
	).getTaggedR()
		.map(multiplyBy('interfaces'))
		.map(mapArray(flattenItemRecursively))
		.map(mapArray(classifyIntfType))
		.map(mapArray(formatColumns))

	return get_eoscfg_interfaces
}



// get_eoscfg_interfaces('sampledevicename').named(pmodule.name)

// comment this out when using in production
//get_eoscfg_interfaces('sampledevicename')

// comment this out when using in-browser IDE
export { get_eoscfg_interfaces }

